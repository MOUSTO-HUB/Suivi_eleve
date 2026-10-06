import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { ParamEleve } from '../auth/decorators/param-eleve.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { ParentOwnsEleveGuard } from '../auth/guards/parent-owns-eleve.guard.js';
import { GESTION_SCOLARITE, PERSONNEL } from '../common/roles.js';
import { Role } from '../generated/prisma/enums.js';
import {
  ArchiverEleveDto,
  ChangerClasseDto,
  CreerEleveDto,
  EffacerDonneesDto,
  ExportElevesDto,
  FiltreElevesDto,
  ImportElevesDto,
  ModifierEleveDto,
  TuteurEleveDto,
} from './eleves.dto.js';
import { DonneesService } from './donnees.service.js';
import { ElevesService } from './eleves.service.js';
import {
  type FichierExport,
  ImportExportService,
} from './import-export.service.js';

const TAILLE_MAX_IMPORT = 2 * 1024 * 1024;

function envoyerFichier(res: Response, fichier: FichierExport) {
  res.setHeader('Content-Type', fichier.type);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fichier.nomFichier}"`,
  );
  return new StreamableFile(fichier.contenu);
}

@Controller('eleves')
export class ElevesController {
  constructor(
    private readonly eleves: ElevesService,
    private readonly importExport: ImportExportService,
    private readonly donnees: DonneesService,
  ) {}

  /** Personnel : élèves de l'école. Parent : ses enfants uniquement. */
  @Get()
  lister(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltreElevesDto,
  ) {
    return this.eleves.lister(u, filtre);
  }

  @Get('export')
  @Roles(...PERSONNEL)
  async exporter(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: ExportElevesDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return envoyerFichier(res, await this.importExport.exporter(u, filtre));
  }

  @Get('import/modele')
  @Roles(...GESTION_SCOLARITE)
  async modeleImport(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Res({ passthrough: true }) res: Response,
  ) {
    return envoyerFichier(res, await this.importExport.modele(u));
  }

  @Post('import')
  @Roles(...GESTION_SCOLARITE)
  @UseInterceptors(
    FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_IMPORT } }),
  )
  importer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @UploadedFile() fichier: Express.Multer.File | undefined,
    @Query() options: ImportElevesDto,
  ) {
    return this.importExport.importer(u, fichier, options.simulation);
  }

  @Get(':id')
  @UseGuards(ParentOwnsEleveGuard)
  @ParamEleve('id')
  detail(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eleves.detail(u, id);
  }

  @Post()
  @Roles(...GESTION_SCOLARITE)
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreerEleveDto,
  ) {
    return this.eleves.creer(u, dto);
  }

  @Patch(':id')
  @Roles(...GESTION_SCOLARITE)
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModifierEleveDto,
  ) {
    return this.eleves.modifier(u, id, dto);
  }

  @Post(':id/changer-classe')
  @Roles(...GESTION_SCOLARITE)
  changerClasse(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangerClasseDto,
  ) {
    return this.eleves.changerClasse(u, id, dto);
  }

  @Post(':id/archiver')
  @Roles(...GESTION_SCOLARITE)
  archiver(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ArchiverEleveDto,
  ) {
    return this.eleves.archiver(u, id, dto);
  }

  @Post(':id/restaurer')
  @Roles(...GESTION_SCOLARITE)
  restaurer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eleves.restaurer(u, id);
  }

  @Post(':id/tuteurs')
  @Roles(...GESTION_SCOLARITE)
  ajouterTuteur(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TuteurEleveDto,
  ) {
    return this.eleves.ajouterTuteur(u, id, dto);
  }

  @Delete(':id/tuteurs/:tuteurId')
  @Roles(...GESTION_SCOLARITE)
  retirerTuteur(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tuteurId', ParseUUIDPipe) tuteurId: string,
  ) {
    return this.eleves.retirerTuteur(u, id, tuteurId);
  }

  /** Copie de toutes les données de l'élève et de ses tuteurs (demande de la famille). */
  @Get(':id/donnees')
  @Roles(Role.ADMIN)
  async exporterDonnees(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return envoyerFichier(res, await this.donnees.exporter(u, id));
  }

  /** Effacement des données d'un élève archivé (irréversible, direction seulement). */
  @Post(':id/effacer')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  effacerDonnees(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EffacerDonneesDto,
  ) {
    return this.donnees.effacer(u, id, dto.confirmation);
  }
}
