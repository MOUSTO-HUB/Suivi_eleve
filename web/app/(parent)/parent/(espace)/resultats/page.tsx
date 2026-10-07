import type { Metadata } from 'next';
import {
  ChoixEnfant,
  enfantChoisi,
  TitreParent,
  Vide,
} from '@/components/parent';
import { Carte, styles } from '@/components/ui';
import { lireApi } from '@/lib/api';
import { noteFr, type ResultatsEleve } from '@/lib/types';

export const metadata: Metadata = { title: 'Résultats · Suivi_eleve' };

const rang = (r: number) => (r === 1 ? '1er' : `${r}e`);

/** Moyennes publiées par l'école et bulletins PDF. */
export default async function Resultats(props: PageProps<'/parent/resultats'>) {
  const { enfants, enfant } = await enfantChoisi(props.searchParams);
  const resultats = enfant
    ? await lireApi<ResultatsEleve>(`/resultats/eleves/${enfant.id}`)
    : null;
  const publiees = (resultats?.periodes ?? []).filter(
    (p) => p.publie && p.resultat,
  );

  return (
    <>
      <TitreParent
        titre="Résultats"
        sousTitre={enfant && `${enfant.prenoms} ${enfant.nom}`}
      />
      <ChoixEnfant
        enfants={enfants}
        actif={enfant?.id}
        chemin="/parent/resultats"
      />
      {resultats?.decision?.publie && (
        <div className="mb-4">
          <Carte titre="Décision de fin d'année">
            <p className="text-2xl font-semibold">
              {resultats.decision.libelle}
            </p>
          </Carte>
        </div>
      )}
      {publiees.length === 0 && (
        <Vide>Aucun résultat publié pour l&apos;instant.</Vide>
      )}
      <div className="flex flex-col gap-4">
        {publiees.map((p) => (
          <Carte
            key={p.id}
            titre={p.libelle}
            actions={
              enfant && (
                <a
                  href={`/telechargements/bulletin/${enfant.id}/${p.id}`}
                  className={styles.boutonSecondaire}
                >
                  Bulletin (PDF)
                </a>
              )
            }
          >
            <p className="text-lg">
              Moyenne générale :{' '}
              <strong>{noteFr(p.resultat?.moyenne)} / 20</strong>
              {p.resultat?.rang && (
                <>
                  {' '}
                  · rang <strong>{rang(p.resultat.rang)}</strong> sur{' '}
                  {resultats?.effectif}
                </>
              )}
            </p>
            {p.resultat?.appreciation && (
              <p className="mt-1 italic text-slate-600">
                « {p.resultat.appreciation} »
              </p>
            )}
            {p.matieres && p.matieres.length > 0 && (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 font-medium">Matière</th>
                    <th className="py-1 text-right font-medium">Moyenne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {p.matieres.map((m) => (
                    <tr key={m.matiere.id}>
                      <td className="py-2">
                        {m.matiere.nom}
                        {m.appreciation && (
                          <span className="block text-xs text-slate-500">
                            {m.appreciation}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right font-semibold">
                        {noteFr(m.moyenne)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Carte>
        ))}
      </div>
    </>
  );
}
