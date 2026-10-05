import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { lireApiOuNull } from '@/lib/api';
import { peutGererDossiers } from '@/lib/profil';
import type { ClasseDetail } from '@/lib/types';
import { modifierClasse } from '../actions';

export const metadata: Metadata = { title: 'Classe · Suivi_eleve' };

export default async function FicheClasse(props: PageProps<'/classes/[id]'>) {
  const { id } = await props.params;
  const [classe, gestion] = await Promise.all([
    lireApiOuNull<ClasseDetail>(`/classes/${id}`),
    peutGererDossiers(),
  ]);
  if (!classe) notFound();

  return (
    <>
      <EnTete
        titre={classe.nom}
        sousTitre={`${classe.effectif} élève(s) · année ${classe.anneeScolaire.libelle}`}
        actions={
          <>
            <Link className={styles.boutonSecondaire} href="/classes">
              Retour aux classes
            </Link>
            <a
              className={styles.boutonSecondaire}
              href={`/telechargements/eleves?classeId=${classe.id}&format=xlsx`}
            >
              Exporter la liste
            </a>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tableau
            entetes={['Élève', 'Matricule', 'Genre']}
            vide={
              classe.eleves.length === 0
                ? 'Aucun élève dans cette classe.'
                : undefined
            }
          >
            {classe.eleves.map((e) => (
              <tr key={e.id}>
                <td className={cellule}>
                  <Link className={styles.lien} href={`/eleves/${e.id}`}>
                    {e.nom} {e.prenoms}
                  </Link>
                </td>
                <td className={`${cellule} font-mono text-xs`}>
                  {e.matricule}
                </td>
                <td className={cellule}>{e.genre === 'FEMININ' ? 'F' : 'M'}</td>
              </tr>
            ))}
          </Tableau>
        </div>
        {gestion && (
          <Carte titre="Modifier la classe">
            <FormulaireAction
              action={modifierClasse.bind(null, classe.id)}
              libelle="Enregistrer"
            >
              <Champ libelle="Nom" obligatoire>
                <Saisie
                  name="nom"
                  defaultValue={classe.nom}
                  required
                  maxLength={50}
                />
              </Champ>
              <Champ libelle="Niveau" obligatoire>
                <Saisie
                  name="niveau"
                  defaultValue={classe.niveau}
                  required
                  maxLength={50}
                />
              </Champ>
            </FormulaireAction>
          </Carte>
        )}
      </div>
    </>
  );
}
