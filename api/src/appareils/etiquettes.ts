// Planche d'étiquettes QR à imprimer : 12 par page A4 (3 colonnes × 4 lignes).
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface Etiquette {
  /** Contenu du QR code : lien vers la page de scan. */
  lien: string;
  codeCourt: string;
  designation: string;
}

const A4 = { largeur: 595.28, hauteur: 841.89 };
const MARGE = 28;
const COLONNES = 3;
const LIGNES = 4;
export const ETIQUETTES_PAR_PAGE = COLONNES * LIGNES;

/**
 * Le nom de l'élève n'est pas imprimé : seul le personnel connecté voit le
 * propriétaire en scannant le code (cahier des charges, EF-11).
 */
export async function planchesEtiquettes(
  ecole: string,
  etiquettes: Etiquette[],
): Promise<Buffer> {
  const qrs = await Promise.all(
    etiquettes.map((e) =>
      QRCode.toBuffer(e.lien, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 300,
      }),
    ),
  );

  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGE,
    info: { Title: `Étiquettes appareils – ${ecole}`, Author: 'Suivi_eleve' },
  });
  const morceaux: Buffer[] = [];
  doc.on('data', (m: Buffer) => morceaux.push(m));
  const fini = new Promise<Buffer>((ok, ko) => {
    doc.on('end', () => ok(Buffer.concat(morceaux)));
    doc.on('error', ko);
  });

  const largeur = (A4.largeur - 2 * MARGE) / COLONNES;
  const hauteur = (A4.hauteur - 2 * MARGE) / LIGNES;
  const tailleQr = 112;

  etiquettes.forEach((etiquette, i) => {
    const position = i % ETIQUETTES_PAR_PAGE;
    if (i > 0 && position === 0) doc.addPage();
    const x = MARGE + (position % COLONNES) * largeur;
    const y = MARGE + Math.floor(position / COLONNES) * hauteur;
    const interieur = largeur - 16;

    // Repère de découpe en pointillés.
    doc.save().dash(3, { space: 3 }).lineWidth(0.5).strokeColor('#a1a1aa');
    doc.rect(x + 2, y + 2, largeur - 4, hauteur - 4).stroke();
    doc.restore();

    doc
      .fillColor('#18181b')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(ecole, x + 8, y + 12, {
        width: interieur,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
    doc.image(qrs[i], x + (largeur - tailleQr) / 2, y + 28, {
      width: tailleQr,
    });
    doc
      .font('Courier-Bold')
      .fontSize(13)
      .text(etiquette.codeCourt, x + 8, y + 28 + tailleQr + 6, {
        width: interieur,
        align: 'center',
      });
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#3f3f46')
      .text(etiquette.designation, {
        width: interieur,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      })
      .text('Si trouvé : remettre à la vie scolaire', {
        width: interieur,
        align: 'center',
      });
  });

  doc.end();
  return fini;
}
