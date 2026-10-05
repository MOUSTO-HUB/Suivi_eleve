import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Text } from 'react-native';
import {
  Bouton,
  Carte,
  Champ,
  couleurs,
  Ecran,
  Etat,
  Ligne,
  Message,
  Pastille,
  Texte,
  Titre,
} from '@/components/ui';
import { envoyer, ErreurApi } from '@/lib/api';
import {
  dateFr,
  designationAppareil,
  heureFr,
  LIBELLES_SIGNALEMENT,
  LIBELLES_STATUT_APPAREIL,
  signalementsPossibles,
} from '@/lib/format';
import { useRequete } from '@/lib/requete';
import { useUtilisateur } from '@/lib/session';
import type { AppareilScanne, TypeSignalement } from '@/lib/types';

/** Appareil scanné : propriétaire, contacts des tuteurs et signalements possibles. */
export default function EcranAppareil() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const u = useUtilisateur();
  const r = useRequete<AppareilScanne>(
    `/appareils/qr/${encodeURIComponent(code)}`,
  );
  const [choix, setChoix] = useState<TypeSignalement | null>(null);
  const [lieu, setLieu] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(
    null,
  );
  const a = r.donnees;

  if (!a)
    return (
      <Ecran>
        <Etat
          chargement={r.chargement}
          erreur={r.erreur}
          surReessayer={r.recharger}
        />
      </Ecran>
    );

  const signaler = async () => {
    if (!choix) return;
    setEnCours(true);
    setRetour(null);
    try {
      await envoyer(`/appareils/${a.id}/signalements`, 'POST', {
        type: choix,
        lieu: lieu.trim() || undefined,
        commentaire: commentaire.trim() || undefined,
      });
      setRetour({
        ok: true,
        texte:
          choix === 'USAGE_EN_CLASSE'
            ? 'Usage en classe enregistré : la famille est prévenue.'
            : 'Signalement enregistré.',
      });
      setChoix(null);
      setLieu('');
      setCommentaire('');
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
      <Titre>{designationAppareil(a)}</Titre>
      <Pastille ton={a.statut === 'ACTIF' ? 'ok' : 'alerte'}>
        {LIBELLES_STATUT_APPAREIL[a.statut]}
      </Pastille>
      <Carte>
        <Texte gras>
          {a.eleve.prenoms} {a.eleve.nom}
        </Texte>
        <Ligne libelle="Classe" valeur={a.eleve.classe?.nom ?? '—'} />
        <Ligne libelle="Matricule" valeur={a.eleve.matricule} />
        {a.imei && <Ligne libelle="IMEI" valeur={a.imei} />}
        {a.signesDistinctifs && <Texte discret>{a.signesDistinctifs}</Texte>}
      </Carte>
      {a.tuteurs.map((t) => (
        <Carte key={t.contact1}>
          <Texte gras>
            {t.prenoms} {t.nom}
            {t.principal ? ' (principal)' : ''}
          </Texte>
          {[t.contact1, t.contact2].filter(Boolean).map((tel) => (
            <Text
              key={tel}
              style={{
                fontSize: 18,
                color: couleurs.primaire,
                paddingVertical: 6,
              }}
              onPress={() => Linking.openURL(`tel:${tel}`)}
              accessibilityRole="link"
            >
              📞 {tel}
            </Text>
          ))}
        </Carte>
      ))}

      {retour && (
        <Message type={retour.ok ? 'succes' : 'erreur'}>{retour.texte}</Message>
      )}
      {choix ? (
        <Carte>
          <Texte gras>{LIBELLES_SIGNALEMENT[choix]}</Texte>
          <Champ
            libelle="Lieu (facultatif)"
            maxLength={120}
            value={lieu}
            onChangeText={setLieu}
          />
          <Champ
            libelle="Commentaire (facultatif)"
            multiline
            maxLength={500}
            value={commentaire}
            onChangeText={setCommentaire}
          />
          <Bouton libelle="Enregistrer" enCours={enCours} surAppui={signaler} />
          <Bouton
            libelle="Annuler"
            variante="secondaire"
            surAppui={() => setChoix(null)}
          />
        </Carte>
      ) : (
        signalementsPossibles(u.role, a.statut).map((t) => (
          <Bouton
            key={t}
            libelle={LIBELLES_SIGNALEMENT[t]}
            variante={t === 'USAGE_EN_CLASSE' ? 'primaire' : 'secondaire'}
            surAppui={() => {
              setChoix(t);
              setRetour(null);
            }}
          />
        ))
      )}

      {a.incidents.length > 0 && (
        <Carte>
          <Texte gras>Historique</Texte>
          {a.incidents.slice(0, 5).map((i) => (
            <Texte key={i.id} discret>
              {dateFr(i.dateHeure)} {heureFr(i.dateHeure)} ·{' '}
              {LIBELLES_SIGNALEMENT[i.type]}
            </Texte>
          ))}
        </Carte>
      )}
    </Ecran>
  );
}
