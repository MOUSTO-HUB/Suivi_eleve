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
import { dateFr } from '@/lib/format';
import { useEnfants } from '@/lib/enfants';
import { useRequete } from '@/lib/requete';
import type { Absence, Page } from '@/lib/types';

/** Absences relevées en classe ; le parent peut en donner le motif. */
export default function Absences() {
  const { enfant } = useEnfants();
  const r = useRequete<Page<Absence>>(
    enfant ? `/absences?eleveId=${enfant.id}&parPage=50` : null,
  );
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const liste = r.donnees?.elements ?? [];

  const transmettre = async (id: string) => {
    setEnCours(true);
    setErreur(null);
    try {
      await envoyer(`/absences/${id}/justification-parent`, 'POST', { motif });
      setOuverte(null);
      setMotif('');
      await r.recharger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur inattendue.');
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
        vide={r.donnees !== null && !liste.length && 'Aucune absence relevée.'}
        surReessayer={r.recharger}
      />
      {liste.map((a) => (
        <Carte key={a.id} accent={a.justifiee ? undefined : 'alerte'}>
          <Texte gras>
            {dateFr(a.date)} · {a.creneau}
          </Texte>
          {a.matiere && <Texte discret>{a.matiere}</Texte>}
          {a.justifiee ? (
            <Pastille ton="ok">
              Justifiée{a.motif ? ` : ${a.motif}` : ''}
            </Pastille>
          ) : a.justificationParent ? (
            <Pastille>Motif transmis : {a.justificationParent}</Pastille>
          ) : (
            <Pastille ton="alerte">Non justifiée</Pastille>
          )}
          {!a.justifiee && ouverte !== a.id && (
            <Bouton
              libelle={
                a.justificationParent ? 'Modifier le motif' : 'Donner le motif'
              }
              variante="secondaire"
              surAppui={() => {
                setOuverte(a.id);
                setMotif(a.justificationParent ?? '');
                setErreur(null);
              }}
            />
          )}
          {ouverte === a.id && (
            <>
              <Champ
                libelle="Motif de l'absence"
                placeholder="Ex. maladie, rendez-vous médical…"
                multiline
                maxLength={300}
                value={motif}
                onChangeText={setMotif}
              />
              {erreur && <Message>{erreur}</Message>}
              <Bouton
                libelle="Envoyer à l'école"
                enCours={enCours}
                desactive={!motif.trim()}
                surAppui={() => transmettre(a.id)}
              />
              <Bouton
                libelle="Annuler"
                variante="secondaire"
                surAppui={() => setOuverte(null)}
              />
            </>
          )}
        </Carte>
      ))}
    </Ecran>
  );
}
