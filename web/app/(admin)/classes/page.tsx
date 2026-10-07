import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Carte,
  cellule,
  Champ,
  EnTete,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { peutGererDossiers } from '@/lib/profil';
import type { Classe } from '@/lib/types';
import { creerClasse } from './actions';

export const metadata: Metadata = { title: 'Classes · Suivi_eleve' };

export default async function PageClasses() {
  const [classes, gestion] = await Promise.all([
    lireApi<Classe[]>('/classes'),
    peutGererDossiers(),
  ]);
  const annee = classes[0]?.anneeScolaire.libelle;
  const total = classes.reduce((somme, c) => somme + c.effectif, 0);

  return (
    <>
      <EnTete
        titre="Classes"
        sousTitre={
          annee
            ? `Année scolaire ${annee} · ${classes.length} classe(s), ${total} élève(s) actif(s)`
            : 'Année scolaire active'
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tableau
            entetes={['Classe', 'Niveau', 'Enseignant principal', 'Effectif']}
            vide={
              classes.length === 0
                ? 'Aucune classe pour cette année scolaire.'
                : undefined
            }
          >
            {classes.map((c) => (
              <tr key={c.id} className="hover:bg-marque-50/60">
                <td className={cellule}>
                  <Link className={styles.lien} href={`/classes/${c.id}`}>
                    {c.nom}
                  </Link>
                </td>
                <td className={cellule}>{c.niveau}</td>
                <td className={cellule}>
                  {c.enseignantPrincipal
                    ? `${c.enseignantPrincipal.prenoms} ${c.enseignantPrincipal.nom}`
                    : '—'}
                </td>
                <td className={cellule}>{c.effectif}</td>
              </tr>
            ))}
          </Tableau>
        </div>
        {gestion && (
          <Carte titre="Nouvelle classe">
            <FormulaireAction
              action={creerClasse}
              libelle="Créer la classe"
              reinitialiserSiSucces
            >
              <Champ libelle="Nom" obligatoire aide="Ex. 6e A">
                <Saisie name="nom" required maxLength={50} />
              </Champ>
              <Champ libelle="Niveau" obligatoire aide="Ex. 6e">
                <Saisie name="niveau" required maxLength={50} />
              </Champ>
            </FormulaireAction>
          </Carte>
        )}
      </div>
    </>
  );
}
