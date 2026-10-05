// Bulletin PDF d'une période, à partir des moyennes saisies par les professeurs.
import PDFDocument from 'pdfkit';
import { noteFr, rangSur } from './resultats.regles.js';

export interface DonneesBulletin {
  ecole: { nom: string; adresse: string | null; telephone: string | null };
  annee: string;
  periode: string;
  provisoire: boolean;
  eleve: {
    prenoms: string;
    nom: string;
    matricule: string;
    dateNaissance: string;
    classe: string;
    effectif: number;
    professeurPrincipal: { prenoms: string; nom: string } | null;
  };
  matieres: {
    nom: string;
    coefficient: number;
    moyenne: number | null;
    appreciation: string | null;
    professeur: string | null;
  }[];
  resultat: {
    moyenne: number | null;
    rang: number | null;
    appreciation: string | null;
  } | null;
  decision: string | null;
}

const MARGE = 30;
const LARGEUR = 595.28 - 2 * MARGE;
const ENCRE = '#18181b';
const GRIS = '#52525b';
const TRAIT = '#a1a1aa';
const COLONNES = [
  { titre: 'Matière', largeur: 125 },
  { titre: 'Coef.', largeur: 38, centre: true },
  { titre: 'Moyenne /20', largeur: 62, centre: true },
  { titre: 'Appréciation', largeur: 195 },
  { titre: 'Professeur', largeur: LARGEUR - 125 - 38 - 62 - 195 },
];

const jourFr = (jour: string) => jour.split('-').reverse().join('/');

export async function bulletinPdf(d: DonneesBulletin): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGE,
    info: {
      Title: `Bulletin ${d.periode} – ${d.eleve.prenoms} ${d.eleve.nom}`,
      Author: d.ecole.nom,
    },
  });
  const morceaux: Buffer[] = [];
  doc.on('data', (m: Buffer) => morceaux.push(m));
  const fini = new Promise<Buffer>((ok, ko) => {
    doc.on('end', () => ok(Buffer.concat(morceaux)));
    doc.on('error', ko);
  });

  if (d.provisoire) {
    doc
      .save()
      .rotate(-35, { origin: [297, 420] })
      .font('Helvetica-Bold')
      .fontSize(70)
      .fillColor('#e4e4e7')
      .text('PROVISOIRE', 60, 390, { width: 480, align: 'center' })
      .restore();
  }

  // En-tête
  doc
    .fillColor(ENCRE)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(d.ecole.nom, MARGE, MARGE);
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(GRIS)
    .text(
      [d.ecole.adresse, d.ecole.telephone].filter(Boolean).join(' · ') || ' ',
    );
  doc.fontSize(9).text(`Année scolaire ${d.annee}`, MARGE, MARGE, {
    width: LARGEUR,
    align: 'right',
  });

  doc
    .moveDown(2.2)
    .fillColor(ENCRE)
    .font('Helvetica-Bold')
    .fontSize(15)
    .text(`BULLETIN – ${d.periode.toUpperCase()}`, MARGE, doc.y, {
      width: LARGEUR,
      align: 'center',
    });
  if (d.provisoire) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#b91c1c')
      .text('Document provisoire : résultats non encore publiés', {
        width: LARGEUR,
        align: 'center',
      });
  }

  // Identité de l'élève
  const yIdentite = doc.y + 10;
  doc
    .rect(MARGE, yIdentite, LARGEUR, 52)
    .lineWidth(0.6)
    .strokeColor(TRAIT)
    .stroke();
  const ligne = (libelle: string, valeur: string, x: number, y: number) => {
    doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(libelle, x, y);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(ENCRE)
      .text(valeur, x, y + 10, { width: 240 });
  };
  ligne(
    'Élève',
    `${d.eleve.nom.toUpperCase()} ${d.eleve.prenoms}`,
    MARGE + 10,
    yIdentite + 7,
  );
  ligne('Matricule', d.eleve.matricule, MARGE + 260, yIdentite + 7);
  ligne('Né(e) le', jourFr(d.eleve.dateNaissance), MARGE + 410, yIdentite + 7);
  ligne(
    'Classe',
    `${d.eleve.classe} (${d.eleve.effectif} élèves)`,
    MARGE + 10,
    yIdentite + 28,
  );
  ligne(
    'Professeur principal',
    d.eleve.professeurPrincipal
      ? `${d.eleve.professeurPrincipal.prenoms} ${d.eleve.professeurPrincipal.nom}`
      : '—',
    MARGE + 260,
    yIdentite + 28,
  );

  // Tableau des matières
  let y = yIdentite + 66;
  const enTete = () => {
    doc.rect(MARGE, y, LARGEUR, 18).fillColor('#f4f4f5').fill();
    let x = MARGE;
    for (const c of COLONNES) {
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(ENCRE)
        .text(c.titre, x + 4, y + 5, {
          width: c.largeur - 8,
          align: c.centre ? 'center' : 'left',
        });
      x += c.largeur;
    }
    y += 18;
  };
  enTete();

  for (const m of d.matieres) {
    const cellules = [
      m.nom,
      String(m.coefficient).replace('.', ','),
      noteFr(m.moyenne),
      m.appreciation ?? '',
      m.professeur ?? '',
    ];
    doc.font('Helvetica').fontSize(8.5);
    const hauteur = Math.max(
      18,
      ...cellules.map(
        (t, i) => doc.heightOfString(t, { width: COLONNES[i].largeur - 8 }) + 8,
      ),
    );
    if (y + hauteur > 841.89 - 190) {
      doc.addPage();
      y = MARGE;
      enTete();
    }
    let x = MARGE;
    cellules.forEach((texte, i) => {
      const c = COLONNES[i];
      doc
        .font(i === 2 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8.5)
        .fillColor(ENCRE)
        .text(texte, x + 4, y + 4, {
          width: c.largeur - 8,
          align: c.centre ? 'center' : 'left',
        });
      x += c.largeur;
    });
    doc
      .moveTo(MARGE, y + hauteur)
      .lineTo(MARGE + LARGEUR, y + hauteur)
      .lineWidth(0.4)
      .strokeColor(TRAIT)
      .stroke();
    y += hauteur;
  }
  if (!d.matieres.length) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(GRIS)
      .text('Aucune matière renseignée.', MARGE + 4, y + 6);
    y += 22;
  }

  // Synthèse
  y += 14;
  doc.rect(MARGE, y, LARGEUR, 70).lineWidth(0.8).strokeColor(ENCRE).stroke();
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(GRIS)
    .text('Moyenne générale', MARGE + 10, y + 8);
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(ENCRE)
    .text(`${noteFr(d.resultat?.moyenne)} / 20`, MARGE + 10, y + 20);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(GRIS)
    .text('Rang', MARGE + 170, y + 8);
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(ENCRE)
    .text(rangSur(d.resultat?.rang, d.eleve.effectif), MARGE + 170, y + 22);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(GRIS)
    .text('Appréciation générale', MARGE + 300, y + 8);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(ENCRE)
    .text(d.resultat?.appreciation ?? '—', MARGE + 300, y + 21, {
      width: LARGEUR - 310,
      height: 45,
    });
  y += 80;

  if (d.decision) {
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(ENCRE)
      .text(`Décision de fin d'année : ${d.decision}`, MARGE, y + 4, {
        width: LARGEUR,
      });
    y += 26;
  }

  // Signatures
  y += 16;
  doc.font('Helvetica').fontSize(9).fillColor(GRIS);
  doc.text('Le professeur principal', MARGE, y, {
    width: LARGEUR / 2,
    align: 'center',
  });
  doc.text("Le chef d'établissement", MARGE + LARGEUR / 2, y, {
    width: LARGEUR / 2,
    align: 'center',
  });
  doc
    .fontSize(7.5)
    .text(
      `Édité le ${new Date().toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' })} · moyennes saisies par les professeurs`,
      MARGE,
      841.89 - MARGE - 12,
      { width: LARGEUR, align: 'center', lineBreak: false },
    );

  doc.end();
  return fini;
}
