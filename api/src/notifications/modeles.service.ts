import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import {
  ActionAudit,
  Langue,
  TypeNotification,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CANAUX_MODELE,
  MODELES_PAR_DEFAUT,
  type CanalModele,
} from './modeles.defaut.js';
import type { ModeleDto } from './notifications.dto.js';
import {
  LONGUEUR_SMS,
  preparerSms,
  REGLES_TYPE,
  rendre,
  variablesDuModele,
} from './notifications.regles.js';

/** Valeurs d'exemple pour l'aperçu des modèles. */
const EXEMPLE: Record<string, string> = {
  prenom_eleve: 'Awa',
  nom_eleve: 'Diop',
  classe: '6e A',
  ecole: 'École pilote',
  prenom_tuteur: 'Malick',
  heure: '11h00',
  motif: "coupure d'électricité",
  date: '06/10/2026',
  creneau: 'matin',
  montant: '25 000',
  mois: 'octobre 2026',
  date_limite: '05/11/2026',
  jours_retard: '7 jours',
  libelle: "la mensualité d'octobre 2026",
  date_echeance: '05/10/2026',
  total: '',
  numero_recu: 'R-2026-0042',
  periode: 'Trimestre 1',
  moyenne: '14,25',
  rang: '5e',
  decision: 'admis(e) en classe supérieure',
  annee: '2026-2027',
  titre: 'Journée portes ouvertes',
  lieu: 'cour de l’école',
  details: 'Message détaillé.',
};

const VARIABLES_COMMUNES = [
  'prenom_eleve',
  'nom_eleve',
  'classe',
  'ecole',
  'prenom_tuteur',
];

/** Modèles de messages modifiables par l'école (EF-81). */
@Injectable()
export class ModelesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async lister(u: UtilisateurConnecte) {
    const personnalises = await this.prisma.modeleMessage.findMany({
      where: { ecoleId: u.ecoleId, langue: Langue.FR },
    });
    return (Object.keys(MODELES_PAR_DEFAUT) as TypeNotification[]).map(
      (type) => ({
        type,
        obligatoire: REGLES_TYPE[type].obligatoire,
        canauxParDefaut: REGLES_TYPE[type].canaux,
        canaux: CANAUX_MODELE.map((canal) => {
          const defaut = MODELES_PAR_DEFAUT[type][canal];
          const perso = personnalises.find(
            (m) => m.type === type && m.canal === canal,
          );
          const sujet = perso ? (perso.sujet ?? defaut.sujet) : defaut.sujet;
          const contenu = perso?.contenu ?? defaut.contenu;
          const apercu = rendre(contenu, EXEMPLE);
          return {
            canal,
            personnalise: Boolean(perso),
            sujet: sujet ?? null,
            contenu,
            defaut,
            variables: [
              ...new Set([
                ...VARIABLES_COMMUNES,
                ...variablesDuModele(defaut.contenu),
              ]),
            ],
            apercu: canal === 'SMS' ? preparerSms(apercu) : apercu,
            apercuSujet: sujet ? rendre(sujet, EXEMPLE) : null,
          };
        }),
      }),
    );
  }

  async enregistrer(
    u: UtilisateurConnecte,
    type: TypeNotification,
    canal: CanalModele,
    dto: ModeleDto,
  ) {
    const inconnues = variablesDuModele(
      `${dto.sujet ?? ''} ${dto.contenu}`,
    ).filter(
      (v) =>
        !VARIABLES_COMMUNES.includes(v) &&
        !variablesDuModele(
          `${MODELES_PAR_DEFAUT[type][canal].sujet ?? ''} ${MODELES_PAR_DEFAUT[type][canal].contenu}`,
        ).includes(v),
    );
    if (inconnues.length) {
      throw new BadRequestException(
        `Variable(s) inconnue(s) pour ce message : ${inconnues.map((v) => `{${v}}`).join(', ')}.`,
      );
    }
    if (
      canal === 'SMS' &&
      preparerSms(rendre(dto.contenu, EXEMPLE)).endsWith('...')
    ) {
      throw new BadRequestException(
        `Le SMS dépasse ${LONGUEUR_SMS} caractères avec des valeurs d'exemple : raccourcissez-le.`,
      );
    }
    await this.prisma.modeleMessage.upsert({
      where: {
        ecoleId_type_canal_langue: {
          ecoleId: u.ecoleId,
          type,
          canal,
          langue: Langue.FR,
        },
      },
      update: { sujet: dto.sujet ?? null, contenu: dto.contenu },
      create: {
        ecoleId: u.ecoleId,
        type,
        canal,
        langue: Langue.FR,
        sujet: dto.sujet,
        contenu: dto.contenu,
        creePar: u.id,
      },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'ModeleMessage',
      undefined,
      {
        type,
        canal,
      },
    );
    return this.lister(u);
  }

  async reinitialiser(
    u: UtilisateurConnecte,
    type: TypeNotification,
    canal: CanalModele,
  ) {
    await this.prisma.modeleMessage.deleteMany({
      where: { ecoleId: u.ecoleId, type, canal, langue: Langue.FR },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'ModeleMessage',
      undefined,
      {
        type,
        canal,
        reinitialise: true,
      },
    );
    return this.lister(u);
  }
}
