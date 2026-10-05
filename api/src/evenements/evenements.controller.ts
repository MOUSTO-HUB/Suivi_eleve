import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { GESTION_SCOLARITE, PERSONNEL } from '../common/roles.js';
import { Role } from '../generated/prisma/enums.js';
import {
  CreerEvenementDto,
  FiltreEvenementsDto,
  PublierEvenementDto,
  RepondreEvenementDto,
} from './evenements.dto.js';
import { EvenementsService } from './evenements.service.js';

const TAILLE_MAX_PIECE_JOINTE = 5 * 1024 * 1024;

@Controller('evenements')
@Roles(...PERSONNEL, Role.PARENT)
export class EvenementsController {
  constructor(private readonly evenements: EvenementsService) {}

  @Get()
  lister(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltreEvenementsDto,
  ) {
    return this.evenements.lister(u, filtre);
  }

  @Get(':id')
  detail(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evenements.detail(u, id);
  }

  @Get(':id/piece-jointe')
  async pieceJointe(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { contenu, type, nom } = await this.evenements.lirePieceJointe(u, id);
    res.setHeader('Content-Type', type);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(nom)}`,
    );
    res.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(contenu);
  }

  /** Crée l'événement en brouillon ; la publication prévient les familles. */
  @Post()
  @Roles(...GESTION_SCOLARITE)
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreerEvenementDto,
  ) {
    return this.evenements.creer(u, dto);
  }

  @Post(':id/piece-jointe')
  @Roles(...GESTION_SCOLARITE)
  @UseInterceptors(
    FileInterceptor('fichier', {
      limits: { fileSize: TAILLE_MAX_PIECE_JOINTE },
    }),
  )
  joindre(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() fichier: Express.Multer.File | undefined,
  ) {
    return this.evenements.joindre(u, id, fichier);
  }

  @Delete(':id/piece-jointe')
  @Roles(...GESTION_SCOLARITE)
  retirerPieceJointe(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evenements.retirerPieceJointe(u, id);
  }

  @Post(':id/publier')
  @Roles(...GESTION_SCOLARITE)
  @HttpCode(200)
  publier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublierEvenementDto,
  ) {
    return this.evenements.publier(u, id, dto.programmeeLe);
  }

  /** Annule ; les familles déjà prévenues reçoivent un message d'annulation. */
  @Post(':id/annuler')
  @Roles(...GESTION_SCOLARITE)
  @HttpCode(200)
  annuler(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evenements.annuler(u, id);
  }

  @Delete(':id')
  @Roles(...GESTION_SCOLARITE)
  @HttpCode(204)
  async supprimer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.evenements.supprimer(u, id);
  }

  /** Réponse du parent (participation, autorisation) pour un de ses enfants. */
  @Post(':id/reponses')
  @Roles(Role.PARENT)
  @HttpCode(200)
  repondre(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepondreEvenementDto,
  ) {
    return this.evenements.repondre(u, id, dto);
  }
}
