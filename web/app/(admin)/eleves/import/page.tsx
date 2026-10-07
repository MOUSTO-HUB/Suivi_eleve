import type { Metadata } from 'next';
import Link from 'next/link';
import { Carte, EnTete, styles } from '@/components/ui';
import { FormulaireImport } from './formulaire-import';

export const metadata: Metadata = {
  title: 'Importer des élèves · Suivi_eleve',
};

const COLONNES = [
  ['prenoms, nom', 'obligatoires'],
  ['genre', 'obligatoire : M ou F'],
  ['date_naissance', 'obligatoire : JJ/MM/AAAA'],
  ['classe', 'nom exact de la classe, ex. 6e A'],
  ['telephone', "téléphone de l'élève"],
  ['tuteur_prenoms, tuteur_nom', 'obligatoires'],
  ['lien_tuteur', 'père, mère, tuteur ou autre'],
  [
    'contact_tuteur_1',
    "obligatoire, numéro local (indicatif du pays de l'école ajouté) ou international, ex. +224621123456",
  ],
  ['contact_tuteur_2, email_tuteur', 'facultatifs'],
];

export default function PageImport() {
  return (
    <>
      <EnTete
        titre="Importer des élèves"
        sousTitre="Inscrivez une liste d'élèves depuis un fichier Excel ou CSV."
        actions={
          <>
            <Link className={styles.boutonSecondaire} href="/eleves">
              Retour à la liste
            </Link>
            <a
              className={styles.boutonSecondaire}
              href="/telechargements/modele-import"
            >
              Télécharger le modèle
            </a>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Carte>
            <FormulaireImport />
          </Carte>
        </div>
        <Carte titre="Colonnes attendues">
          <ul className="flex flex-col gap-2 text-sm">
            {COLONNES.map(([colonne, aide]) => (
              <li key={colonne}>
                <code className="text-xs font-semibold">{colonne}</code>
                <span className="block text-slate-600">{aide}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Les matricules sont attribués automatiquement. Un tuteur dont le
            Contact_tuteur_1 est déjà connu est rattaché, pas recréé. Un élève
            déjà inscrit (mêmes nom, prénoms et date de naissance) est signalé
            et ignoré.
          </p>
        </Carte>
      </div>
    </>
  );
}
