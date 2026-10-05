import { useState } from 'react';
import { ChoixEnfant } from '@/components/choix-enfant';
import {
  Bouton,
  Carte,
  Champ,
  Ecran,
  Etat,
  Message,
  Pastille,
  Texte,
} from '@/components/ui';
import { envoyer, ErreurApi } from '@/lib/api';
import { useEnfants } from '@/lib/enfants';
import {
  designationAppareil,
  LIBELLES_STATUT_APPAREIL,
  signalementsPossibles,
} from '@/lib/format';
import { useRequete } from '@/lib/requete';
import type { Appareil, Page } from '@/lib/types';

/** Appareils enregistrés par l'école ; le parent peut déclarer une perte. */
export default function Appareils() {
  const { enfant } = useEnfants();
  const r = useRequete<Page<Appareil>>(
    enfant ? `/appareils?eleveId=${enfant.id}&parPage=50` : null,
  );
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(
    null,
  );
  const liste = r.donnees?.elements ?? [];

  const declarerPerdu = async (id: string) => {
    setEnCours(true);
    setRetour(null);
    try {
      await envoyer(`/appareils/${id}/signalements`, 'POST', {
        type: 'DECLARE_PERDU',
        commentaire: commentaire.trim() || undefined,
      });
      setOuvert(null);
      setCommentaire('');
      setRetour({ ok: true, texte: "Perte déclarée : l'école est prévenue." });
      await r.recharger();
    } catch (e) {
      setRetour({
        ok: false,
        texte: e instanceof ErreurApi ? e.message : 'Erreur inattendue.',
      });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Ecran enChargement={r.chargement} surRafraichir={r.recharger}>
      <ChoixEnfant />
      <Etat
        chargement={r.chargement && !r.donnees}
        erreur={r.erreur}
        vide={
          r.donnees !== null &&
          !liste.length &&
          "Aucun appareil enregistré par l'école."
        }
        surReessayer={r.recharger}
      />
      {retour && (
        <Message type={retour.ok ? 'succes' : 'erreur'}>{retour.texte}</Message>
      )}
      {liste.map((a) => {
        const peutDeclarer = signalementsPossibles('PARENT', a.statut).includes(
          'DECLARE_PERDU',
        );
        return (
          <Carte
            key={a.id}
            accent={a.statut === 'ACTIF' ? undefined : 'alerte'}
          >
            <Texte gras>{designationAppareil(a)}</Texte>
            {a.imei && <Texte discret>IMEI {a.imei}</Texte>}
            <Texte discret>Étiquette {a.codeCourt}</Texte>
            <Pastille ton={a.statut === 'ACTIF' ? 'ok' : 'alerte'}>
              {LIBELLES_STATUT_APPAREIL[a.statut]}
            </Pastille>
            {peutDeclarer && ouvert !== a.id && (
              <Bouton
                libelle="Déclarer perdu"
                variante="danger"
                surAppui={() => {
                  setOuvert(a.id);
                  setRetour(null);
                }}
              />
            )}
            {ouvert === a.id && (
              <>
                <Champ
                  libelle="Où et quand l'avez-vous perdu ? (facultatif)"
                  multiline
                  maxLength={500}
                  value={commentaire}
                  onChangeText={setCommentaire}
                />
                <Bouton
                  libelle="Confirmer la perte"
                  variante="danger"
                  enCours={enCours}
                  surAppui={() => declarerPerdu(a.id)}
                />
                <Bouton
                  libelle="Annuler"
                  variante="secondaire"
                  surAppui={() => setOuvert(null)}
                />
              </>
            )}
          </Carte>
        );
      })}
    </Ecran>
  );
}
