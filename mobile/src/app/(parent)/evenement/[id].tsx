import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Bouton,
  Carte,
  Ecran,
  Etat,
  Ligne,
  Message,
  Pastille,
  Texte,
  Titre,
} from '@/components/ui';
import { envoyer, ErreurApi } from '@/lib/api';
import { dateFr, heureFr } from '@/lib/format';
import { ouvrirDocument } from '@/lib/fichiers';
import { useRequete } from '@/lib/requete';
import type { Evenement } from '@/lib/types';

/** Détail d'un événement ; le parent répond oui / non pour chacun de ses enfants. */
export default function DetailEvenement() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useRequete<Evenement>(`/evenements/${id}`);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const e = r.donnees;

  const executer = async (cle: string, action: () => Promise<unknown>) => {
    setEnCours(cle);
    setErreur(null);
    try {
      await action();
      await r.recharger();
    } catch (x) {
      setErreur(x instanceof ErreurApi ? x.message : 'Erreur inattendue.');
    } finally {
      setEnCours(null);
    }
  };

  if (!e)
    return (
      <Ecran>
        <Etat
          chargement={r.chargement}
          erreur={r.erreur}
          surReessayer={r.recharger}
        />
      </Ecran>
    );

  const annule = e.statut === 'ANNULEE';
  const ouvert = !annule && new Date(e.dateDebut) > new Date();

  return (
    <Ecran enChargement={r.chargement} surRafraichir={r.recharger}>
      <Titre>{e.titre}</Titre>
      {annule && <Message>Cet événement est annulé.</Message>}
      <Carte>
        <Ligne
          libelle="Date"
          valeur={`${dateFr(e.dateDebut)} à ${heureFr(e.dateDebut)}`}
        />
        {e.dateFin && dateFr(e.dateFin) !== dateFr(e.dateDebut) && (
          <Ligne libelle="Jusqu'au" valeur={dateFr(e.dateFin)} />
        )}
        {e.lieu && <Ligne libelle="Lieu" valeur={e.lieu} />}
      </Carte>
      <Carte>
        <Texte>{e.description}</Texte>
        {e.modalites && (
          <View style={{ marginTop: 8 }}>
            <Texte gras>Modalités</Texte>
            <Texte>{e.modalites}</Texte>
          </View>
        )}
      </Carte>
      {e.pieceJointe && (
        <Bouton
          libelle={
            e.pieceJointe === 'PDF'
              ? 'Ouvrir le document (PDF)'
              : "Voir l'image jointe"
          }
          variante="secondaire"
          enCours={enCours === 'document'}
          surAppui={() =>
            executer('document', () =>
              ouvrirDocument(
                `/evenements/${e.id}/piece-jointe`,
                e.pieceJointe === 'PDF' ? 'evenement.pdf' : 'evenement.jpg',
                e.pieceJointe === 'PDF' ? 'application/pdf' : 'image/*',
              ),
            )
          }
        />
      )}

      {e.demandeReponse && (
        <View style={{ gap: 12, marginTop: 8 }}>
          <Titre>Votre réponse</Titre>
          <Texte>{e.question}</Texte>
          {e.enfants.map((enfant) => (
            <Carte
              key={enfant.id}
              accent={enfant.reponse === null ? 'alerte' : 'primaire'}
            >
              <Texte gras>
                {enfant.prenoms}
                {enfant.classe ? ` (${enfant.classe.nom})` : ''}
              </Texte>
              {enfant.reponse === null ? (
                <Pastille ton="alerte">Pas encore répondu</Pastille>
              ) : (
                <Pastille ton={enfant.reponse ? 'ok' : 'danger'}>
                  Vous avez répondu : {enfant.reponse ? 'Oui' : 'Non'}
                </Pastille>
              )}
              {ouvert && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  {[true, false].map((oui) => (
                    <View key={String(oui)} style={{ flex: 1 }}>
                      <Bouton
                        libelle={oui ? 'Oui' : 'Non'}
                        variante={
                          enfant.reponse === oui ? 'primaire' : 'secondaire'
                        }
                        enCours={enCours === `${enfant.id}-${oui}`}
                        surAppui={() =>
                          executer(`${enfant.id}-${oui}`, () =>
                            envoyer(`/evenements/${e.id}/reponses`, 'POST', {
                              eleveId: enfant.id,
                              reponse: oui,
                            }),
                          )
                        }
                      />
                    </View>
                  ))}
                </View>
              )}
            </Carte>
          ))}
          {!ouvert && !annule && (
            <Texte discret>
              L&apos;événement a commencé : les réponses sont closes.
            </Texte>
          )}
        </View>
      )}
      {erreur && <Message>{erreur}</Message>}
    </Ecran>
  );
}
