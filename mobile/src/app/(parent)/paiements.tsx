import { ChoixEnfant } from '@/components/choix-enfant';
import {
  Carte,
  Ecran,
  Etat,
  Ligne,
  Pastille,
  Texte,
  Titre,
} from '@/components/ui';
import { useEnfants } from '@/lib/enfants';
import { dateFr, fcfa } from '@/lib/format';
import { useRequete } from '@/lib/requete';
import type { ListeRappels } from '@/lib/types';

/** Paiements signalés en attente par la comptabilité, avec le retard du jour. */
export default function Paiements() {
  const { enfant } = useEnfants();
  const r = useRequete<ListeRappels>(
    enfant
      ? `/rappels-paiement?eleveId=${enfant.id}&statut=EN_COURS&parPage=50`
      : null,
  );
  const liste = r.donnees?.elements ?? [];
  const total = liste.reduce((s, p) => s + p.montant, 0);
  return (
    <Ecran enChargement={r.chargement} surRafraichir={r.recharger}>
      <ChoixEnfant />
      <Etat
        chargement={r.chargement && !r.donnees}
        erreur={r.erreur}
        vide={
          r.donnees !== null &&
          !liste.length &&
          'Aucun paiement en attente. Merci !'
        }
        surReessayer={r.recharger}
      />
      {liste.length > 0 && (
        <Carte accent="alerte">
          <Texte discret>Total à régler</Texte>
          <Titre>{fcfa(total)}</Titre>
        </Carte>
      )}
      {liste.map((p) => (
        <Carte key={p.id} accent={p.joursRetard > 0 ? 'danger' : undefined}>
          <Texte gras>{p.libelle}</Texte>
          <Ligne libelle="Montant" valeur={fcfa(p.montant)} />
          <Ligne libelle="À payer le" valeur={dateFr(p.dateEcheance)} />
          {p.joursRetard > 0 ? (
            <Pastille ton="danger">
              {p.joursRetard} jour{p.joursRetard > 1 ? 's' : ''} de retard
            </Pastille>
          ) : (
            <Pastille>À venir</Pastille>
          )}
        </Carte>
      ))}
      {liste.length > 0 && (
        <Texte discret>
          Le paiement se fait auprès de la comptabilité de l&apos;école. Cette
          liste est mise à jour par l&apos;école.
        </Texte>
      )}
    </Ecran>
  );
}
