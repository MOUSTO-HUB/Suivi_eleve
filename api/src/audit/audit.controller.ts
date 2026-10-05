import { Controller, Get, Query } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { page, PaginationDto, sauter } from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ActionAudit, Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class FiltreAuditDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ActionAudit)
  action?: ActionAudit;

  /** Ex. Eleve, Tuteur, Utilisateur. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  entite?: string;
}

/** Journal d'audit : consultation par la direction uniquement. */
@Controller('audit')
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async lister(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() filtre: FiltreAuditDto,
  ) {
    const where: Prisma.JournalAuditWhereInput = {
      ecoleId: u.ecoleId,
      action: filtre.action,
      entite: filtre.entite,
    };
    const [lignes, total] = await this.prisma.$transaction([
      this.prisma.journalAudit.findMany({
        where,
        select: {
          id: true,
          action: true,
          entite: true,
          entiteId: true,
          details: true,
          ip: true,
          creeLe: true,
          utilisateur: { select: { prenoms: true, nom: true, role: true } },
        },
        orderBy: { creeLe: 'desc' },
        ...sauter(filtre),
      }),
      this.prisma.journalAudit.count({ where }),
    ]);
    return page(lignes, total, filtre);
  }
}
