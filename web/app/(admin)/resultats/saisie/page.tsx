import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Alerte,
  cellule,
  EnTete,
  parametre,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import type { GrilleSaisie } from '@/lib/types';
import { enregistrerMoyennes } from '../actions';

export const metadata: Metadata = {
  title: 'Saisie des moyennes · Suivi_eleve',
};

/** Saisie des moyennes d'une matière, pour une classe et une période. */
export default async function PageSaisie(
  props: PageProps<'/resultats/saisie'>,
) {
  const sp = await props.searchParams;
  const classeId = parametre(sp.classeId);
  const periodeId = parametre(sp.periodeId);
  const matiereId = parametre(sp.matiereId);
  if (!classeId || !periodeId || !matiereId) notFound();

  const grille = await lireApi<GrilleSaisie>(
    `/resultats/saisie?classeId=${classeId}&periodeId=${periodeId}`,
  );
  const matiere = grille.matieres.find((m) => m.id === matiereId);
  if (!matiere) notFound();

  return (
    <>
      <EnTete
        titre={`${matiere.nom} · ${grille.classe.nom}`}
        sousTitre={`${grille.periode.libelle} · coefficient ${String(matiere.coefficient).replace('.', ',')}${
          matiere.enseignant
            ? ` · ${matiere.enseignant.prenoms} ${matiere.enseignant.nom}`
            : ''
        }`}
        actions={
          <Link
            className={styles.boutonSecondaire}
            href={`/resultats?periodeId=${periodeId}`}
          >
            Retour
          </Link>
        }
      />
      {grille.publie && (
        <div className="mb-4">
          <Alerte type="info">
            Résultats déjà publiés : seuls la direction et le secrétariat
            peuvent encore les corriger.
          </Alerte>
        </div>
      )}
      <FormulaireAction
        action={enregistrerMoyennes.bind(null, {
          classeId,
          periodeId,
          matiereId,
        })}
        libelle="Enregistrer les moyennes"
        className="flex flex-col gap-4"
      >
        <Tableau entetes={['Élève', 'Moyenne /20', 'Appréciation']}>
          {grille.eleves.map((e) => {
            const saisie = e.moyennes[matiere.id];
            return (
              <tr key={e.id}>
                <td className={cellule}>
                  <input type="hidden" name="eleveId" value={e.id} />
                  {e.nom} {e.prenoms}
                  <span className="block font-mono text-xs text-zinc-500">
                    {e.matricule}
                  </span>
                </td>
                <td className={cellule}>
                  <Saisie
                    name={`moyenne-${e.id}`}
                    defaultValue={
                      saisie?.moyenne === null || saisie?.moyenne === undefined
                        ? ''
                        : String(saisie.moyenne).replace('.', ',')
                    }
                    inputMode="decimal"
                    placeholder="ex. 12,5"
                    disabled={!matiere.peutSaisir}
                    className="w-24"
                    aria-label={`Moyenne de ${e.prenoms} ${e.nom}`}
                  />
                </td>
                <td className={`${cellule} w-full`}>
                  <Saisie
                    name={`appreciation-${e.id}`}
                    defaultValue={saisie?.appreciation ?? ''}
                    maxLength={300}
                    disabled={!matiere.peutSaisir}
                    aria-label={`Appréciation de ${e.prenoms} ${e.nom}`}
                  />
                </td>
              </tr>
            );
          })}
        </Tableau>
        {!matiere.peutSaisir && (
          <Alerte type="info">
            Vous pouvez consulter ces moyennes mais pas les modifier.
          </Alerte>
        )}
        <p className="text-xs text-zinc-500">
          Laissez vide pour un élève non noté. Virgule ou point acceptés.
        </p>
      </FormulaireAction>
    </>
  );
}
