import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { GESTION_SCOLARITE, PERSONNEL } from '../common/roles.js';
import { Role } from '../generated/prisma/enums.js';
import {
  CreerAppareilDto,
  EtiquettesDto,
  FiltreAppareilsDto,
  ModifierAppareilDto,
  SignalementDto,
} from './appareils.dto.js';
import { AppareilsService } from './appareils.service.js';
import { planchesEtiquettes } from './etiquettes.js';

const TAILLE_MAX_PHOTO = 3 * 1024 * 1024;
const LIBELLE_TYPE = {
  TELEPHONE: 'Téléphone',
  TABLETTE: 'Tablette',
  ORDINATEUR: 'Ordinateur',
  AUTRE: 'Appareil',
} as const;

@Controller('appareils')
export class AppareilsController {
  private readonly urlWeb: string;

  constructor(
    private readonly appareils: AppareilsService,
    config: ConfigService,
  ) {
    this.urlWeb = config.get<string>('WEB_URL', 'http://localhost:3001');
  }

  /** Personnel : recherche dans l'école. Parent : appareils de ses enfants. */
  @Get()
  lister(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltreAppareilsDto,
  ) {
    return this.appareils.lister(u, filtre);
  }

  /** Scan d'une étiquette : réservé au personnel connecté (EF-11). */
  @Get('qr/:code')
  @Roles(...PERSONNEL)
  parQr(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('code') code: string,
  ) {
    return this.appareils.parQr(u, code);
  }

  /** Planche PDF d'étiquettes QR (12 par page A4) pour un élève ou une classe. */
  @Get('etiquettes')
  @Roles(...GESTION_SCOLARITE, Role.SURVEILLANT)
  async etiquettes(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: EtiquettesDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { ecole, appareils } = await this.appareils.pourEtiquettes(u, filtre);
    const pdf = await planchesEtiquettes(
      ecole,
      appareils.map((a) => ({
        lien: `${this.urlWeb}/appareils/scan/${a.qrCode}`,
        codeCourt: a.codeCourt,
        designation: [LIBELLE_TYPE[a.type], a.marque, a.modele, a.couleur]
          .filter(Boolean)
          .join(' '),
      })),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="etiquettes-appareils.pdf"',
    );
    return new StreamableFile(pdf);
  }

  @Get(':id')
  detail(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appareils.detail(u, id);
  }

  @Get(':id/photo')
  async photo(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { contenu, type } = await this.appareils.lirePhoto(u, id);
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(contenu);
  }

  @Post()
  @Roles(...GESTION_SCOLARITE)
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreerAppareilDto,
  ) {
    return this.appareils.creer(u, dto);
  }

  @Patch(':id')
  @Roles(...GESTION_SCOLARITE)
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModifierAppareilDto,
  ) {
    return this.appareils.modifier(u, id, dto);
  }

  @Post(':id/photo')
  @Roles(...GESTION_SCOLARITE)
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: TAILLE_MAX_PHOTO } }),
  )
  enregistrerPhoto(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() fichier: Express.Multer.File | undefined,
  ) {
    return this.appareils.enregistrerPhoto(u, id, fichier);
  }

  /**
   * Signalement : perdu, trouvé, confisqué, restitué, usage en classe.
   * Les droits dépendent du type (un parent peut seulement déclarer une perte).
   */
  @Post(':id/signalements')
  signaler(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignalementDto,
  ) {
    return this.appareils.signaler(u, id, dto);
  }
}
