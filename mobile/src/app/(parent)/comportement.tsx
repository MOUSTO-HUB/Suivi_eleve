import { ChoixEnfant } from '@/components/choix-enfant';
import { Carte, Ecran, Etat, Pastille, Texte } from '@/components/ui';
import { useEnfants } from '@/lib/enfants';
import { dateFr, heureFr, LIBELLES_CATEGORIE } from '@/lib/format';
import { useRequete } from '@/lib/requete';
import type { Comportement as TypeComportement, Page } from '@/lib/types';

/** Historique des félicitations et des faits signalés par l'école. */
export default function Comportement() {
  const { enfant } = useEnfants();
  const r = useRequete<Page<TypeComportement>>(
    enfant ? `/comportements?eleveId=${enfant.id}&parPage=50` : null,
  );
  const liste = r.donnees?.elements ?? [];
  return (
    <Ecran enChargement={r.chargement} surRafraichir={r.recharger}>
      <ChoixEnfant />
      <Etat
        chargement={r.chargement && !r.donnees}
        erreur={r.erreur}
        vide={
          r.donnees !== null &&
          !liste.length &&
          'Aucun signalement pour le moment.'
        }
        surReessayer={r.recharger}
      />
      {liste.map((c) => (
        <Carte key={c.id} accent={c.type === 'POSITIF' ? 'primaire' : 'alerte'}>
          <Pastille ton={c.type === 'POSITIF' ? 'ok' : 'alerte'}>
            {c.type === 'POSITIF' ? '👍 ' : ''}
            {LIBELLES_CATEGORIE[c.categorie] ?? c.categorie}
          </Pastille>
          <Texte discret>{dateFr(c.date)}</Texte>
          <Texte>{c.description}</Texte>
          {c.sanction && <Texte discret>Mesure prise : {c.sanction}</Texte>}
          {c.convocationLe && (
            <Pastille ton="danger">
              Rendez-vous à l&apos;école le {dateFr(c.convocationLe)} à{' '}
              {heureFr(c.convocationLe)}
            </Pastille>
          )}
        </Carte>
      ))}
    </Ecran>
  );
}
