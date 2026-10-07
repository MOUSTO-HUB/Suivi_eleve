import type { Metadata } from 'next';
import {
  ChoixEnfant,
  enfantChoisi,
  TitreParent,
  Vide,
} from '@/components/parent';
import { Badge, Carte } from '@/components/ui';
import { lireApi } from '@/lib/api';
import {
  dateHeureFr,
  LIBELLES_CATEGORIE,
  type Comportement,
  type Page,
} from '@/lib/types';

export const metadata: Metadata = { title: 'Comportement · Suivi_eleve' };

/** Félicitations et faits signalés par l'école (validés par la direction si graves). */
export default async function PageComportement(
  props: PageProps<'/parent/comportement'>,
) {
  const { enfants, enfant } = await enfantChoisi(props.searchParams);
  const liste = enfant
    ? (
        await lireApi<Page<Comportement>>(
          `/comportements?eleveId=${enfant.id}&parPage=50`,
        )
      ).elements
    : [];
  return (
    <>
      <TitreParent
        titre="Comportement"
        sousTitre={enfant && `${enfant.prenoms} ${enfant.nom}`}
      />
      <ChoixEnfant
        enfants={enfants}
        actif={enfant?.id}
        chemin="/parent/comportement"
      />
      {liste.length === 0 && <Vide>Aucun signalement pour le moment.</Vide>}
      <ul className="flex flex-col gap-3">
        {liste.map((c) => (
          <li key={c.id}>
            <Carte>
              <div className="flex flex-wrap items-center gap-2">
                <Badge couleur={c.type === 'POSITIF' ? 'vert' : 'orange'}>
                  {c.type === 'POSITIF' ? '👍 ' : ''}
                  {LIBELLES_CATEGORIE[c.categorie]}
                </Badge>
                <span className="text-sm text-slate-500">
                  {dateHeureFr(c.date)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line">{c.description}</p>
              {c.sanction && (
                <p className="mt-1 text-slate-600">
                  Mesure prise : {c.sanction}
                </p>
              )}
              {c.convocationLe && (
                <p className="mt-2 font-medium text-red-700">
                  Rendez-vous à l&apos;école le {dateHeureFr(c.convocationLe)}
                </p>
              )}
            </Carte>
          </li>
        ))}
      </ul>
    </>
  );
}
