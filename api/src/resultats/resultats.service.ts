import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { versJour } from '../common/dates.js';
import {
  ActionAudit,
  Role,
  StatutEleve,
  TypeNotification,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  DecisionsDto,
  MoyennesMatiereDto,
  ResultatsGenerauxDto,
} from './resultats.dto.js';
import {
  erreurMoyenne,
  erreurRang,
  LIBELLES_DECISION,
  noteFr,
  rangSur,
} from './resultats.regles.js';

/** Decimal Prisma → nombre (ou null). */
const nombre = (d: { toNumber(): number } | null | undefined) =>
  d ? d.toNumber() : null;

const estGestion = (u: UtilisateurConnecte) =>
  u.role === Role.ADMIN || u.role === Role.SECRETARIAT;

const VERROU =
  'Résultats déjà publiés : seuls la direction et le secrétariat peuvent encore les corriger.';

/**
 * Résultats saisis par les professeurs (aucun calcul) : moyennes par matière,
 * moyenne générale, rang et appréciation, publication par la direction, décisions.
 */
@Injectable()
export class ResultatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** Classe, période (de l'année de la classe) et élèves actifs. */
  private async contexte(
    u: UtilisateurConnecte,
    classeId: string,
    periodeId?: string,
  ) {
    const classe = await this.prisma.classe.findFirst({
      where: { id: classeId, ecoleId: u.ecoleId },
      select: {
        id: true,
        nom: true,
        anneeScolaireId: true,
        anneeScolaire: { select: { id: true, libelle: true } },
        enseignantPrincipal: { select: { id: true, prenoms: true, nom: true } },
      },
    });
    if (!classe) throw new NotFoundException('Classe introuvable.');
    const periode = periodeId
      ? await this.prisma.periode.findFirst({
          where: { id: periodeId, anneeScolaireId: classe.anneeScolaireId },
          select: { id: true, libelle: true, ordre: true },
        })
      : null;
    if (periodeId && !periode) {
      throw new BadRequestException(
        "Période inconnue pour l'année de cette classe.",
      );
    }
    const eleves = await this.prisma.eleve.findMany({
      where: { classeId, statut: StatutEleve.ACTIF },
      select: { id: true, matricule: true, prenoms: true, nom: true },
      orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }],
    });
    return { classe, periode, eleves };
  }

  private estPrincipal(
    u: UtilisateurConnecte,
    classe: { enseignantPrincipal: { id: string } | null },
  ) {
    return estGestion(u) || classe.enseignantPrincipal?.id === u.id;
  }

  private async estPublie(classeId: string, periodeId: string) {
    return (
      (await this.prisma.resultat.count({
        where: { periodeId, publie: true, eleve: { classeId } },
      })) > 0
    );
  }

  /** Périodes de l'année active (choix dans les écrans de saisie). */
  async periodes(u: UtilisateurConnecte) {
    return this.prisma.periode.findMany({
      where: { anneeScolaire: { ecoleId: u.ecoleId, active: true } },
      select: {
        id: true,
        libelle: true,
        ordre: true,
        dateDebut: true,
        dateFin: true,
      },
      orderBy: { ordre: 'asc' },
    });
  }

  /** Classes et matières dont l'utilisateur saisit les moyennes. */
  async mesSaisies(u: UtilisateurConnecte) {
    const [enseignements, principales] = await Promise.all([
      this.prisma.enseignement.findMany({
        where: {
          classe: { ecoleId: u.ecoleId, anneeScolaire: { active: true } },
          ...(estGestion(u) ? {} : { enseignantId: u.id }),
        },
        select: {
          classe: { select: { id: true, nom: true } },
          matiere: { select: { id: true, nom: true } },
          enseignant: { select: { prenoms: true, nom: true } },
        },
        orderBy: [{ classe: { nom: 'asc' } }, { matiere: { nom: 'asc' } }],
      }),
      this.prisma.classe.findMany({
        where: {
          ecoleId: u.ecoleId,
          anneeScolaire: { active: true },
          ...(estGestion(u) ? {} : { enseignantPrincipalId: u.id }),
        },
        select: { id: true, nom: true },
        orderBy: { nom: 'asc' },
      }),
    ]);
    return { enseignements, classesPrincipales: principales };
  }

  /** Grille de saisie d'une classe pour une période, avec les droits de l'utilisateur. */
  async saisie(u: UtilisateurConnecte, classeId: string, periodeId: string) {
    const { classe, periode, eleves } = await this.contexte(
      u,
      classeId,
      periodeId,
    );
    const enseignements = await this.prisma.enseignement.findMany({
      where: { classeId },
      select: {
        enseignantId: true,
        matiere: { select: { id: true, nom: true, coefficient: true } },
        enseignant: { select: { id: true, prenoms: true, nom: true } },
      },
      orderBy: { matiere: { nom: 'asc' } },
    });
    const principal = this.estPrincipal(u, classe);
    if (!principal && !enseignements.some((e) => e.enseignantId === u.id)) {
      throw new ForbiddenException("Vous n'enseignez pas dans cette classe.");
    }
    const ids = eleves.map((e) => e.id);
    const [moyennes, resultats, publie] = await Promise.all([
      this.prisma.moyenneMatiere.findMany({
        where: { periodeId, eleveId: { in: ids } },
        select: {
          eleveId: true,
          matiereId: true,
          moyenne: true,
          appreciation: true,
        },
      }),
      this.prisma.resultat.findMany({
        where: { periodeId, eleveId: { in: ids } },
        select: {
          eleveId: true,
          moyenne: true,
          rang: true,
          appreciation: true,
          publie: true,
          publieLe: true,
        },
      }),
      this.estPublie(classeId, periodeId!),
    ]);
    const verrou = publie && !estGestion(u);

    return {
      classe,
      periode,
      publie,
      publieLe: resultats.find((r) => r.publieLe)?.publieLe ?? null,
      peutSaisirGeneral: principal && !verrou,
      peutPublier: u.role === Role.ADMIN,
      matieres: enseignements.map((e) => ({
        ...e.matiere,
        coefficient: e.matiere.coefficient.toNumber(),
        enseignant: e.enseignant,
        peutSaisir: !verrou && (estGestion(u) || e.enseignantId === u.id),
        saisies: moyennes.filter(
          (m) => m.matiereId === e.matiere.id && m.moyenne !== null,
        ).length,
      })),
      eleves: eleves.map((e) => {
        const r = resultats.find((x) => x.eleveId === e.id);
        return {
          ...e,
          moyennes: Object.fromEntries(
            moyennes
              .filter((m) => m.eleveId === e.id)
              .map((m) => [
                m.matiereId,
                { moyenne: nombre(m.moyenne), appreciation: m.appreciation },
              ]),
          ),
          resultat: r
            ? {
                moyenne: nombre(r.moyenne),
                rang: r.rang,
                appreciation: r.appreciation,
              }
            : null,
        };
      }),
    };
  }

  async enregistrerMoyennes(u: UtilisateurConnecte, dto: MoyennesMatiereDto) {
    const { classe, eleves } = await this.contexte(
      u,
      dto.classeId,
      dto.periodeId,
    );
    const enseignement = await this.prisma.enseignement.findUnique({
      where: {
        classeId_matiereId: { classeId: classe.id, matiereId: dto.matiereId },
      },
    });
    if (!enseignement) {
      throw new BadRequestException(
        "Cette matière n'est pas enseignée dans la classe.",
      );
    }
    if (!estGestion(u) && enseignement.enseignantId !== u.id) {
      throw new ForbiddenException(
        'Seul le professeur de cette matière saisit ses moyennes.',
      );
    }
    if (!estGestion(u) && (await this.estPublie(classe.id, dto.periodeId))) {
      throw new ForbiddenException(VERROU);
    }
    this.verifierLignes(dto.lignes, eleves, (l) => erreurMoyenne(l.moyenne));

    await this.prisma.$transaction(
      dto.lignes.map((l) =>
        this.prisma.moyenneMatiere.upsert({
          where: {
            eleveId_periodeId_matiereId: {
              eleveId: l.eleveId,
              periodeId: dto.periodeId,
              matiereId: dto.matiereId,
            },
          },
          update: {
            moyenne: l.moyenne,
            appreciation: l.appreciation ?? null,
            saisieParId: u.id,
          },
          create: {
            eleveId: l.eleveId,
            periodeId: dto.periodeId,
            matiereId: dto.matiereId,
            moyenne: l.moyenne,
            appreciation: l.appreciation,
            saisieParId: u.id,
            creePar: u.id,
          },
        }),
      ),
    );
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'MoyenneMatiere',
      undefined,
      {
        classeId: classe.id,
        periodeId: dto.periodeId,
        matiereId: dto.matiereId,
        lignes: dto.lignes.length,
      },
    );
    return this.saisie(u, classe.id, dto.periodeId);
  }

  async enregistrerGeneraux(u: UtilisateurConnecte, dto: ResultatsGenerauxDto) {
    const { classe, eleves } = await this.contexte(
      u,
      dto.classeId,
      dto.periodeId,
    );
    if (!this.estPrincipal(u, classe)) {
      throw new ForbiddenException(
        'La moyenne générale et le rang sont saisis par le professeur principal ou la direction.',
      );
    }
    if (!estGestion(u) && (await this.estPublie(classe.id, dto.periodeId))) {
      throw new ForbiddenException(VERROU);
    }
    this.verifierLignes(
      dto.lignes,
      eleves,
      (l) => erreurMoyenne(l.moyenne) ?? erreurRang(l.rang, eleves.length),
    );

    await this.prisma.$transaction(
      dto.lignes.map((l) =>
        this.prisma.resultat.upsert({
          where: {
            eleveId_periodeId: { eleveId: l.eleveId, periodeId: dto.periodeId },
          },
          update: {
            moyenne: l.moyenne,
            rang: l.rang ?? null,
            appreciation: l.appreciation ?? null,
          },
          create: {
            eleveId: l.eleveId,
            periodeId: dto.periodeId,
            moyenne: l.moyenne,
            rang: l.rang ?? null,
            appreciation: l.appreciation,
            creePar: u.id,
          },
        }),
      ),
    );
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Resultat',
      undefined,
      {
        classeId: classe.id,
        periodeId: dto.periodeId,
        lignes: dto.lignes.length,
      },
    );
    return this.saisie(u, classe.id, dto.periodeId);
  }

  /**
   * Publication par la direction (EF-42) : les familles reçoivent moyenne et rang ;
   * le bulletin devient visible. Une republication ne renvoie pas de message.
   */
  async publier(u: UtilisateurConnecte, classeId: string, periodeId: string) {
    const { classe, periode, eleves } = await this.contexte(
      u,
      classeId,
      periodeId,
    );
    const resultats = await this.prisma.resultat.findMany({
      where: { periodeId, eleveId: { in: eleves.map((e) => e.id) } },
    });
    const manquants = eleves.filter(
      (e) => resultats.find((r) => r.eleveId === e.id)?.moyenne == null,
    );
    if (manquants.length) {
      const noms = manquants.slice(0, 10).map((e) => `${e.prenoms} ${e.nom}`);
      throw new BadRequestException(
        `Moyenne générale manquante pour ${manquants.length} élève(s) : ${noms.join(', ')}${
          manquants.length > 10 ? '…' : ''
        }.`,
      );
    }
    await this.prisma.resultat.updateMany({
      where: { id: { in: resultats.map((r) => r.id) }, publie: false },
      data: { publie: true, publieLe: new Date() },
    });

    let notifies = 0;
    for (const r of resultats) {
      const { tuteurs } = await this.notifications.notifier({
        ecoleId: u.ecoleId,
        type: TypeNotification.RESULTATS,
        cible: { eleveIds: [r.eleveId] },
        variables: {
          periode: periode!.libelle,
          moyenne: noteFr(nombre(r.moyenne)),
          rang: rangSur(r.rang, eleves.length),
        },
        sourceType: 'resultat',
        sourceId: r.id,
        cleDeduplication: `resultats:${periodeId}:${r.eleveId}`,
        creePar: u.id,
      });
      notifies += tuteurs;
    }
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Resultat',
      undefined,
      {
        publication: { classeId, periodeId },
      },
    );
    return {
      classe: classe.nom,
      periode: periode!.libelle,
      eleves: resultats.length,
      famillesPrevenues: notifies,
    };
  }

  // ─── Décisions de fin d'année ──────────────────────────────────────────────

  async decisions(u: UtilisateurConnecte, classeId: string) {
    const { classe, eleves } = await this.contexte(u, classeId);
    const decisions = await this.prisma.decisionAnnuelle.findMany({
      where: {
        anneeScolaireId: classe.anneeScolaireId,
        eleveId: { in: eleves.map((e) => e.id) },
      },
    });
    return {
      classe,
      peutSaisir: this.estPrincipal(u, classe),
      peutPublier: u.role === Role.ADMIN,
      publie: decisions.some((d) => d.publie),
      eleves: eleves.map((e) => {
        const d = decisions.find((x) => x.eleveId === e.id);
        return {
          ...e,
          decision: d
            ? {
                decision: d.decision,
                moyenneAnnuelle: nombre(d.moyenneAnnuelle),
                observation: d.observation,
                publie: d.publie,
              }
            : null,
        };
      }),
    };
  }

  async enregistrerDecisions(u: UtilisateurConnecte, dto: DecisionsDto) {
    const { classe, eleves } = await this.contexte(u, dto.classeId);
    if (!this.estPrincipal(u, classe)) {
      throw new ForbiddenException(
        'Les décisions sont saisies par le professeur principal ou la direction.',
      );
    }
    this.verifierLignes(dto.lignes, eleves, (l) =>
      erreurMoyenne(l.moyenneAnnuelle),
    );
    await this.prisma.$transaction(
      dto.lignes.map((l) =>
        this.prisma.decisionAnnuelle.upsert({
          where: {
            eleveId_anneeScolaireId: {
              eleveId: l.eleveId,
              anneeScolaireId: classe.anneeScolaireId,
            },
          },
          update: {
            decision: l.decision,
            moyenneAnnuelle: l.moyenneAnnuelle ?? null,
            observation: l.observation ?? null,
          },
          create: {
            eleveId: l.eleveId,
            anneeScolaireId: classe.anneeScolaireId,
            decision: l.decision,
            moyenneAnnuelle: l.moyenneAnnuelle ?? null,
            observation: l.observation,
            creePar: u.id,
          },
        }),
      ),
    );
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'DecisionAnnuelle',
      undefined,
      {
        classeId: classe.id,
        lignes: dto.lignes.length,
      },
    );
    return this.decisions(u, classe.id);
  }

  async publierDecisions(u: UtilisateurConnecte, classeId: string) {
    const { classe, eleves } = await this.contexte(u, classeId);
    const decisions = await this.prisma.decisionAnnuelle.findMany({
      where: {
        anneeScolaireId: classe.anneeScolaireId,
        eleveId: { in: eleves.map((e) => e.id) },
      },
    });
    const manquants = eleves.filter(
      (e) => !decisions.some((d) => d.eleveId === e.id),
    );
    if (manquants.length) {
      throw new BadRequestException(
        `Décision manquante pour ${manquants.length} élève(s) : ${manquants
          .slice(0, 10)
          .map((e) => `${e.prenoms} ${e.nom}`)
          .join(', ')}.`,
      );
    }
    await this.prisma.decisionAnnuelle.updateMany({
      where: { id: { in: decisions.map((d) => d.id) }, publie: false },
      data: { publie: true, publieLe: new Date() },
    });
    let notifies = 0;
    for (const d of decisions) {
      const { tuteurs } = await this.notifications.notifier({
        ecoleId: u.ecoleId,
        type: TypeNotification.DECISION_FIN_ANNEE,
        cible: { eleveIds: [d.eleveId] },
        variables: {
          decision: LIBELLES_DECISION[d.decision],
          annee: classe.anneeScolaire.libelle,
        },
        sourceType: 'decision',
        sourceId: d.id,
        cleDeduplication: `decision:${classe.anneeScolaireId}:${d.eleveId}`,
        creePar: u.id,
      });
      notifies += tuteurs;
    }
    return {
      classe: classe.nom,
      eleves: decisions.length,
      famillesPrevenues: notifies,
    };
  }

  // ─── Consultation et bulletin ──────────────────────────────────────────────

  /** Résultats d'un élève, période par période. Un parent ne voit que ce qui est publié. */
  async resultatsEleve(u: UtilisateurConnecte, eleveId: string) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id: eleveId, ecoleId: u.ecoleId },
      select: {
        id: true,
        prenoms: true,
        nom: true,
        classe: { select: { id: true, nom: true, anneeScolaireId: true } },
      },
    });
    if (!eleve) throw new NotFoundException('Élève introuvable.');
    if (!eleve.classe) return { eleve, periodes: [], decision: null };
    const parent = u.role === Role.PARENT;
    const anneeScolaireId = eleve.classe.anneeScolaireId;

    const [periodes, resultats, moyennes, decision, effectif] =
      await Promise.all([
        this.prisma.periode.findMany({
          where: { anneeScolaireId },
          select: { id: true, libelle: true, ordre: true },
          orderBy: { ordre: 'asc' },
        }),
        this.prisma.resultat.findMany({ where: { eleveId } }),
        this.prisma.moyenneMatiere.findMany({
          where: { eleveId },
          select: {
            periodeId: true,
            moyenne: true,
            appreciation: true,
            matiere: { select: { id: true, nom: true, coefficient: true } },
          },
          orderBy: { matiere: { nom: 'asc' } },
        }),
        this.prisma.decisionAnnuelle.findUnique({
          where: { eleveId_anneeScolaireId: { eleveId, anneeScolaireId } },
        }),
        this.prisma.eleve.count({
          where: { classeId: eleve.classe.id, statut: StatutEleve.ACTIF },
        }),
      ]);

    return {
      eleve,
      effectif,
      periodes: periodes.map((p) => {
        const r = resultats.find((x) => x.periodeId === p.id);
        const visible = Boolean(r) && (!parent || r!.publie);
        return {
          ...p,
          publie: r?.publie ?? false,
          resultat: visible
            ? {
                moyenne: nombre(r!.moyenne),
                rang: r!.rang,
                appreciation: r!.appreciation,
              }
            : null,
          matieres: visible
            ? moyennes
                .filter((m) => m.periodeId === p.id)
                .map((m) => ({
                  matiere: {
                    ...m.matiere,
                    coefficient: m.matiere.coefficient.toNumber(),
                  },
                  moyenne: nombre(m.moyenne),
                  appreciation: m.appreciation,
                }))
            : [],
        };
      }),
      decision:
        decision && (!parent || decision.publie)
          ? {
              decision: decision.decision,
              libelle: LIBELLES_DECISION[decision.decision],
              moyenneAnnuelle: nombre(decision.moyenneAnnuelle),
              observation: decision.observation,
              publie: decision.publie,
            }
          : null,
    };
  }

  /** Données du bulletin d'une période ; pour un parent, seulement une fois publié. */
  async donneesBulletin(
    u: UtilisateurConnecte,
    eleveId: string,
    periodeId: string,
  ) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id: eleveId, ecoleId: u.ecoleId },
      select: {
        prenoms: true,
        nom: true,
        matricule: true,
        dateNaissance: true,
        ecole: { select: { nom: true, adresse: true, telephone: true } },
        classe: {
          select: {
            id: true,
            nom: true,
            anneeScolaireId: true,
            anneeScolaire: { select: { libelle: true } },
            enseignantPrincipal: { select: { prenoms: true, nom: true } },
          },
        },
      },
    });
    if (!eleve?.classe)
      throw new NotFoundException('Élève introuvable ou sans classe.');
    const periode = await this.prisma.periode.findFirst({
      where: { id: periodeId, anneeScolaireId: eleve.classe.anneeScolaireId },
      select: { id: true, libelle: true, ordre: true },
    });
    if (!periode) throw new NotFoundException('Période introuvable.');

    const [resultat, enseignements, moyennes, effectif, derniere, decision] =
      await Promise.all([
        this.prisma.resultat.findUnique({
          where: { eleveId_periodeId: { eleveId, periodeId } },
        }),
        this.prisma.enseignement.findMany({
          where: { classeId: eleve.classe.id },
          select: {
            matiere: { select: { id: true, nom: true, coefficient: true } },
            enseignant: { select: { prenoms: true, nom: true } },
          },
          orderBy: { matiere: { nom: 'asc' } },
        }),
        this.prisma.moyenneMatiere.findMany({ where: { eleveId, periodeId } }),
        this.prisma.eleve.count({
          where: { classeId: eleve.classe.id, statut: StatutEleve.ACTIF },
        }),
        this.prisma.periode.findFirst({
          where: { anneeScolaireId: eleve.classe.anneeScolaireId },
          orderBy: { ordre: 'desc' },
          select: { id: true },
        }),
        this.prisma.decisionAnnuelle.findUnique({
          where: {
            eleveId_anneeScolaireId: {
              eleveId,
              anneeScolaireId: eleve.classe.anneeScolaireId,
            },
          },
        }),
      ]);
    const publie = resultat?.publie ?? false;
    if (u.role === Role.PARENT && !publie) {
      throw new NotFoundException(
        "Le bulletin de cette période n'est pas encore publié.",
      );
    }
    const decisionVisible =
      derniere?.id === periodeId &&
      decision &&
      (u.role !== Role.PARENT || decision.publie);

    return {
      ecole: eleve.ecole,
      annee: eleve.classe.anneeScolaire.libelle,
      periode: periode.libelle,
      provisoire: !publie,
      eleve: {
        prenoms: eleve.prenoms,
        nom: eleve.nom,
        matricule: eleve.matricule,
        dateNaissance: versJour(eleve.dateNaissance),
        classe: eleve.classe.nom,
        effectif,
        professeurPrincipal: eleve.classe.enseignantPrincipal,
      },
      matieres: enseignements.map((e) => {
        const m = moyennes.find((x) => x.matiereId === e.matiere.id);
        return {
          nom: e.matiere.nom,
          coefficient: e.matiere.coefficient.toNumber(),
          moyenne: nombre(m?.moyenne),
          appreciation: m?.appreciation ?? null,
          professeur: e.enseignant
            ? `${e.enseignant.prenoms} ${e.enseignant.nom}`
            : null,
        };
      }),
      resultat: resultat
        ? {
            moyenne: nombre(resultat.moyenne),
            rang: resultat.rang,
            appreciation: resultat.appreciation,
          }
        : null,
      decision: decisionVisible ? LIBELLES_DECISION[decision.decision] : null,
    };
  }

  /** Chaque ligne vise un élève actif de la classe et respecte la règle donnée. */
  private verifierLignes<L extends { eleveId: string }>(
    lignes: L[],
    eleves: { id: string; prenoms: string; nom: string }[],
    erreur: (l: L) => string | null,
  ) {
    const ids = lignes.map((l) => l.eleveId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Un élève apparaît deux fois.');
    }
    for (const l of lignes) {
      const eleve = eleves.find((e) => e.id === l.eleveId);
      if (!eleve)
        throw new BadRequestException(
          'Élève inconnu dans cette classe (ou archivé).',
        );
      const message = erreur(l);
      if (message)
        throw new BadRequestException(
          `${eleve.prenoms} ${eleve.nom} : ${message}`,
        );
    }
  }
}
