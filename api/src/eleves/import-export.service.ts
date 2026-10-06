import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { ClassesService } from '../classes/classes.service.js';
import { versJour } from '../common/dates.js';
import { exempleInternational, PAYS } from '../common/pays.js';
import { ActionAudit, LienTuteur } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ExportElevesDto } from './eleves.dto.js';
import {
  ElevesService,
  formaterEleve,
  selectionEleve,
} from './eleves.service.js';
import {
  analyserLigne,
  celluleCsv,
  cleEleve,
  COLONNES_IMPORT,
  lireLignes,
  normaliserEntete,
  parserCsv,
} from './import-export.js';

export interface RapportImport {
  simulation: boolean;
  totalLignes: number;
  valides: number;
  crees: number;
  erreurs: { ligne: number; messages: string[] }[];
}

export interface FichierExport {
  contenu: Buffer;
  nomFichier: string;
  type: string;
}

const TYPE_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const LIBELLE_LIEN: Record<LienTuteur, string> = {
  PERE: 'père',
  MERE: 'mère',
  TUTEUR_LEGAL: 'tuteur légal',
  AUTRE: 'autre',
};

const COLONNES_EXPORT = ['matricule', ...COLONNES_IMPORT, 'age', 'statut'];

/** Texte d'une cellule Excel, quel que soit son type (date, nombre, formule, lien…). */
function texteCellule(valeur: ExcelJS.CellValue): string {
  if (valeur == null) return '';
  if (valeur instanceof Date) return versJour(valeur);
  if (typeof valeur === 'object') {
    if ('richText' in valeur)
      return valeur.richText.map((r) => r.text).join('');
    if ('text' in valeur) return String(valeur.text);
    if ('result' in valeur)
      return texteCellule(valeur.result as ExcelJS.CellValue);
    return '';
  }
  return String(valeur);
}

async function lireXlsx(contenu: Buffer): Promise<string[][]> {
  const classeur = new ExcelJS.Workbook();
  try {
    await classeur.xlsx.load(contenu as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestException('Fichier Excel illisible.');
  }
  const feuille = classeur.worksheets[0];
  if (!feuille) throw new BadRequestException('Le fichier Excel est vide.');
  const lignes: string[][] = [];
  feuille.eachRow({ includeEmpty: true }, (row) => {
    const cellules: string[] = [];
    for (let c = 1; c <= feuille.columnCount; c++) {
      cellules.push(texteCellule(row.getCell(c).value));
    }
    lignes.push(cellules);
  });
  return lignes;
}

async function versXlsx(
  nomFeuille: string,
  entetes: string[],
  lignes: (string | number)[][],
): Promise<Buffer> {
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet(nomFeuille);
  feuille.addRow(entetes).font = { bold: true };
  lignes.forEach((l) => feuille.addRow(l));
  feuille.columns.forEach((colonne) => {
    colonne.width = 18;
    colonne.numFmt = '@'; // texte : les numéros gardent leur « + »
  });
  feuille.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await classeur.xlsx.writeBuffer());
}

@Injectable()
export class ImportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eleves: ElevesService,
    private readonly classes: ClassesService,
    private readonly audit: AuditService,
  ) {}

  async importer(
    u: UtilisateurConnecte,
    fichier: Express.Multer.File | undefined,
    simulation: boolean,
  ): Promise<RapportImport> {
    if (!fichier) {
      throw new BadRequestException(
        'Joignez un fichier dans le champ « fichier ».',
      );
    }
    const nom = fichier.originalname.toLowerCase();
    const tableau = nom.endsWith('.xlsx')
      ? await lireXlsx(fichier.buffer)
      : nom.endsWith('.csv') || nom.endsWith('.txt')
        ? parserCsv(fichier.buffer.toString('utf8'))
        : null;
    if (!tableau) {
      throw new BadRequestException(
        'Format non pris en charge : utilisez un fichier .csv ou .xlsx.',
      );
    }
    const lignes = lireLignes(tableau);

    const annee = await this.classes.anneeActive(u.ecoleId);
    const classes = await this.prisma.classe.findMany({
      where: { ecoleId: u.ecoleId, anneeScolaireId: annee.id },
      select: { id: true, nom: true },
    });
    const existants = await this.prisma.eleve.findMany({
      where: { ecoleId: u.ecoleId },
      select: {
        prenoms: true,
        nom: true,
        dateNaissance: true,
        matricule: true,
      },
    });
    const dejaInscrits = new Map(
      existants.map((e) => [
        cleEleve(e.prenoms, e.nom, versJour(e.dateNaissance)),
        e.matricule,
      ]),
    );
    const contexte = {
      classes: new Map(classes.map((c) => [normaliserEntete(c.nom), c.id])),
      // Numéros saisis sans indicatif : celui du pays de l'école.
      indicatif: PAYS[await this.paysEcole(u.ecoleId)].indicatif,
    };

    const rapport: RapportImport = {
      simulation,
      totalLignes: lignes.length,
      valides: 0,
      crees: 0,
      erreurs: [],
    };
    const vusDansLeFichier = new Map<string, number>();

    for (const ligne of lignes) {
      const { donnees, erreurs } = analyserLigne(ligne, contexte);
      if (donnees) {
        const cle = cleEleve(
          donnees.prenoms,
          donnees.nom,
          donnees.dateNaissance,
        );
        const matricule = dejaInscrits.get(cle);
        const premiereLigne = vusDansLeFichier.get(cle);
        if (matricule) {
          erreurs.push(`Élève déjà enregistré (matricule ${matricule}).`);
        } else if (premiereLigne) {
          erreurs.push(`Doublon de la ligne ${premiereLigne}.`);
        } else {
          vusDansLeFichier.set(cle, ligne.ligne);
        }
      }
      if (erreurs.length || !donnees) {
        rapport.erreurs.push({ ligne: ligne.ligne, messages: erreurs });
        continue;
      }

      rapport.valides++;
      if (simulation) continue;
      try {
        await this.eleves.creerInterne(u, donnees);
        rapport.crees++;
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        rapport.erreurs.push({ ligne: ligne.ligne, messages: [e.message] });
      }
    }

    if (!simulation) {
      await this.audit.journaliser(
        u,
        ActionAudit.CREATION,
        'ImportEleves',
        undefined,
        {
          fichier: fichier.originalname,
          crees: rapport.crees,
          erreurs: rapport.erreurs.length,
        },
      );
    }
    return rapport;
  }

  async exporter(
    u: UtilisateurConnecte,
    filtre: ExportElevesDto,
  ): Promise<FichierExport> {
    const { format, ...criteres } = filtre;
    const eleves = await this.prisma.eleve.findMany({
      where: this.eleves.construireFiltre(u, criteres),
      select: selectionEleve,
      orderBy: [{ classe: { nom: 'asc' } }, { nom: 'asc' }, { prenoms: 'asc' }],
    });
    const lignes = eleves.map(formaterEleve).map((e) => {
      const tuteur = e.tuteurs[0];
      return [
        e.matricule,
        e.prenoms,
        e.nom,
        e.genre === 'FEMININ' ? 'F' : 'M',
        e.dateNaissance,
        e.classe?.nom ?? '',
        e.telephone ?? '',
        tuteur?.prenoms ?? '',
        tuteur?.nom ?? '',
        tuteur ? LIBELLE_LIEN[tuteur.lien] : '',
        tuteur?.contact1 ?? '',
        tuteur?.contact2 ?? '',
        tuteur?.email ?? '',
        e.age,
        e.statut === 'ACTIF' ? 'actif' : 'archivé',
      ];
    });

    await this.audit.journaliser(u, ActionAudit.EXPORT, 'Eleve', undefined, {
      format,
      nombre: lignes.length,
    });

    const nomFichier = `eleves-${versJour(new Date())}.${format}`;
    if (format === 'csv') {
      const texte = [COLONNES_EXPORT, ...lignes]
        .map((l) => l.map(celluleCsv).join(';'))
        .join('\r\n');
      return {
        // BOM : Excel ouvre ainsi le fichier en UTF-8 (accents corrects).
        contenu: Buffer.from(`﻿${texte}\r\n`, 'utf8'),
        nomFichier,
        type: 'text/csv; charset=utf-8',
      };
    }
    return {
      contenu: await versXlsx('Élèves', COLONNES_EXPORT, lignes),
      nomFichier,
      type: TYPE_XLSX,
    };
  }

  private async paysEcole(ecoleId: string) {
    const ecole = await this.prisma.ecole.findUniqueOrThrow({
      where: { id: ecoleId },
      select: { pays: true },
    });
    return ecole.pays;
  }

  /** Modèle Excel à remplir : en-têtes attendus et une ligne d'exemple. */
  async modele(u: UtilisateurConnecte): Promise<FichierExport> {
    const pays = await this.paysEcole(u.ecoleId);
    const exemple = [
      'Awa',
      'Diop',
      'F',
      '15/03/2014',
      '6e A',
      '',
      'Malick',
      'Diop',
      'père',
      exempleInternational(pays),
      '',
      'malick.diop@exemple.com',
    ];
    return {
      contenu: await versXlsx('Élèves', [...COLONNES_IMPORT], [exemple]),
      nomFichier: 'modele-import-eleves.xlsx',
      type: TYPE_XLSX,
    };
  }
}
