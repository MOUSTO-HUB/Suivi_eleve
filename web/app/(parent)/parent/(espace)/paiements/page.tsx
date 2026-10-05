import type { Metadata } from 'next';
import {
  ChoixEnfant,
  enfantChoisi,
  TitreParent,
  Vide,
} from '@/components/parent';
import { Badge, Carte } from '@/components/ui';
import { lireApi } from '@/lib/api';
import { dateFr, fcfa, type ListeRappels } from '@/lib/types';

export const metadata: Metadata = { title: 'Paiements · Suivi_eleve' };

/** Paiements signalés en attente par la comptabilité, avec le retard du jour. */
export default async function Paiements(props: PageProps<'/parent/paiements'>) {
  const { enfants, enfant } = await enfantChoisi(props.searchParams);
  const liste = enfant
    ? (
        await lireApi<ListeRappels>(
          `/rappels-paiement?eleveId=${enfant.id}&statut=EN_COURS&parPage=50`,
        )
      ).elements
    : [];
  const total = liste.reduce((s, p) => s + p.montant, 0);
  return (
    <>
      <TitreParent
        titre="Paiements"
        sousTitre={enfant && `${enfant.prenoms} ${enfant.nom}`}
      />
      <ChoixEnfant
        enfants={enfants}
        actif={enfant?.id}
        chemin="/parent/paiements"
      />
      {liste.length === 0 ? (
        <Vide>Aucun paiement en attente. Merci !</Vide>
      ) : (
        <div className="flex flex-col gap-3">
          <Carte>
            <p className="text-zinc-600 dark:text-zinc-400">Total à régler</p>
            <p className="text-3xl font-semibold">{fcfa(total)}</p>
          </Carte>
          {liste.map((p) => (
            <Carte key={p.id}>
              <p className="text-lg font-semibold">{p.libelle}</p>
              <p>
                {fcfa(p.montant)} · à payer le {dateFr(p.dateEcheance)}
              </p>
              <p className="mt-2">
                {p.joursRetard > 0 ? (
                  <Badge couleur="orange">
                    {p.joursRetard} jour{p.joursRetard > 1 ? 's' : ''} de retard
                  </Badge>
                ) : (
                  <Badge>À venir</Badge>
                )}
              </p>
            </Carte>
          ))}
          <p className="text-sm text-zinc-500">
            Le paiement se fait auprès de la comptabilité de l&apos;école ;
            cette liste est mise à jour par l&apos;école.
          </p>
        </div>
      )}
    </>
  );
}
