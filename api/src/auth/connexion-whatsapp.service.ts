import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EtatEcolesService } from '../plateforme/etat-ecoles.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Session } from './auth.types.js';
import {
  DEMANDES_MAX_OTP,
  FENETRE_DEMANDES_OTP_MS,
  OtpService,
} from './otp.service.js';
import { WhatsappClient } from './whatsapp.client.js';
import {
  DUREE_VALIDITE_WHATSAPP_MS,
  empreinte,
  extraireCode,
  lienWhatsapp,
  messageConnexion,
  nouveauCodeWhatsapp,
  nouveauJetonSuivi,
  type MessageRecu,
} from './whatsapp.regles.js';

export interface DemandeWhatsapp {
  /** À garder par l'appareil : il ouvre la session une fois le message reçu. */
  jeton: string;
  code: string;
  message: string;
  /** Ouvre WhatsApp avec le message prérempli. */
  lien: string;
  numero: string;
  expireLe: Date;
}

export type SuiviWhatsapp = { statut: 'EN_ATTENTE' } | Session;

const DEMANDE_EXPIREE =
  'Demande expirée ou déjà utilisée. Recommencez la connexion.';

/**
 * Connexion des parents par « code inversé » : le parent envoie lui-même, depuis
 * son WhatsApp, le code affiché à l'écran au numéro du service. WhatsApp ayant
 * vérifié son numéro, le message prouve qu'il le détient, comme un code SMS reçu.
 * Gratuit : Meta ne facture pas les messages reçus.
 */
@Injectable()
export class ConnexionWhatsappService {
  private readonly logger = new Logger(ConnexionWhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappClient,
    private readonly otp: OtpService,
    private readonly etatEcoles: EtatEcolesService,
  ) {}

  /** Même réponse que le numéro soit connu ou non : rien n'est révélé. */
  async demander(telephone: string): Promise<DemandeWhatsapp> {
    const numero = this.whatsapp.numero;
    if (!numero) {
      throw new BadRequestException(
        "La connexion par WhatsApp n'est pas disponible.",
      );
    }
    const recentes = await this.prisma.demandeConnexionWhatsapp.count({
      where: {
        telephone,
        creeLe: { gte: new Date(Date.now() - FENETRE_DEMANDES_OTP_MS) },
      },
    });
    if (recentes >= DEMANDES_MAX_OTP) {
      throw new HttpException(
        'Trop de demandes de connexion. Réessayez dans 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = nouveauCodeWhatsapp();
    const jeton = nouveauJetonSuivi();
    const expireLe = new Date(Date.now() + DUREE_VALIDITE_WHATSAPP_MS);
    // Une nouvelle demande annule les précédentes pour ce numéro.
    await this.prisma.$transaction([
      this.prisma.demandeConnexionWhatsapp.updateMany({
        where: { telephone, consommeLe: null },
        data: { consommeLe: new Date() },
      }),
      this.prisma.demandeConnexionWhatsapp.create({
        data: {
          telephone,
          codeHash: empreinte(code),
          jetonHash: empreinte(jeton),
          expireLe,
        },
      }),
    ]);
    const message = messageConnexion(code);
    return {
      jeton,
      code,
      message,
      lien: lienWhatsapp(numero, message),
      numero,
      expireLe,
    };
  }

  /** Message reçu sur le numéro du service (webhook de Meta). */
  async recevoir({ telephone, texte }: MessageRecu): Promise<void> {
    const code = extraireCode(texte);
    if (!code) {
      await this.whatsapp.repondre(
        telephone,
        'Bonjour ! Ce numéro sert uniquement à la connexion à Suivi_eleve. Pour vous connecter, appuyez sur « Me connecter avec WhatsApp » dans l’application ou sur le site, puis envoyez le message proposé. Pour toute autre question, contactez l’école.',
      );
      return;
    }

    // Le code doit venir du numéro saisi : un autre téléphone ne peut pas valider la demande.
    const { count } = await this.prisma.demandeConnexionWhatsapp.updateMany({
      where: {
        telephone,
        codeHash: empreinte(code),
        valideeLe: null,
        consommeLe: null,
        expireLe: { gt: new Date() },
      },
      data: { valideeLe: new Date() },
    });
    if (count === 0) {
      await this.whatsapp.repondre(
        telephone,
        'Ce code est expiré, déjà utilisé, ou a été demandé pour un autre numéro. Recommencez la connexion depuis l’application ou le site.',
      );
      return;
    }

    const tuteur = await this.otp.trouverTuteur(telephone);
    if (!tuteur) {
      await this.whatsapp.repondre(
        telephone,
        'Ce numéro n’est enregistré dans aucune école. Vérifiez auprès de l’école le numéro donné à l’inscription.',
      );
      return;
    }
    if (await this.etatEcoles.estSuspendue(tuteur.ecoleId)) {
      await this.whatsapp.repondre(
        telephone,
        'La connexion est impossible pour le moment. Contactez l’école.',
      );
      return;
    }
    this.logger.log(`Connexion WhatsApp validée pour le tuteur ${tuteur.id}.`);
    await this.whatsapp.repondre(
      telephone,
      `Merci ${tuteur.prenoms} ! Votre connexion à Suivi_eleve est confirmée : retournez sur l’application ou le site. Si ce n’est pas vous, prévenez l’école.`,
    );
  }

  /** Appelé régulièrement par l'appareil qui a fait la demande. */
  async suivre(jeton: string): Promise<SuiviWhatsapp> {
    const demande = await this.prisma.demandeConnexionWhatsapp.findUnique({
      where: { jetonHash: empreinte(jeton) },
    });
    if (!demande || demande.consommeLe || demande.expireLe < new Date()) {
      throw new UnauthorizedException(DEMANDE_EXPIREE);
    }
    if (!demande.valideeLe) return { statut: 'EN_ATTENTE' };

    // Une seule session par demande, même avec des appels simultanés.
    const { count } = await this.prisma.demandeConnexionWhatsapp.updateMany({
      where: { id: demande.id, consommeLe: null },
      data: { consommeLe: new Date() },
    });
    if (count === 0) throw new UnauthorizedException(DEMANDE_EXPIREE);
    // École suspendue : la session est refusée par AuthService.
    return this.otp.ouvrirSessionParent(demande.telephone, DEMANDE_EXPIREE);
  }
}
