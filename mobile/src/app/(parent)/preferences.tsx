import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Bouton, Carte, Ecran, Etat, Message, Texte } from '@/components/ui';
import { envoyer, ErreurApi } from '@/lib/api';
import { TYPES_NOTIFICATION } from '@/lib/format';
import { useRequete } from '@/lib/requete';
import type { Preference } from '@/lib/types';
import { useStyles, useTheme, type Couleurs } from '@/lib/theme';

const CANAUX = [
  ['sms', 'SMS', 'SMS'],
  ['email', 'EMAIL', 'Email'],
  ['push', 'PUSH', 'Application'],
] as const;

/** Canaux par type de message ; les messages importants restent obligatoires. */
export default function Preferences() {
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
  const r = useRequete<Preference[]>('/notifications/preferences');
  // Modifications en cours ; sinon, les préférences enregistrées.
  const [modifiees, setModifiees] = useState<Preference[] | null>(null);
  const prefs = modifiees ?? r.donnees ?? [];
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(
    null,
  );

  const basculer = (type: string, canal: 'sms' | 'email' | 'push') =>
    setModifiees(
      prefs.map((p) => (p.type === type ? { ...p, [canal]: !p[canal] } : p)),
    );

  const enregistrer = async () => {
    setEnCours(true);
    setRetour(null);
    try {
      await envoyer('/notifications/preferences', 'PUT', {
        preferences: prefs
          .filter((p) => !p.obligatoire)
          .map(({ type, sms, email, push }) => ({ type, sms, email, push })),
      });
      setRetour({ ok: true, texte: 'Préférences enregistrées.' });
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
    <Ecran>
      <Texte discret>
        Les messages importants (libération anticipée, absence, comportement,
        retard de paiement…) sont toujours envoyés par tous les moyens.
      </Texte>
      <Etat
        chargement={r.chargement && !r.donnees}
        erreur={r.erreur}
        surReessayer={r.recharger}
      />
      {prefs.map((p) => (
        <Carte key={p.type}>
          <Texte gras>
            {TYPES_NOTIFICATION[p.type].icone}{' '}
            {TYPES_NOTIFICATION[p.type].libelle}
          </Texte>
          {p.obligatoire ? (
            <Texte discret>Toujours envoyé (message important)</Texte>
          ) : (
            CANAUX.filter(([, c]) => p.canauxDisponibles.includes(c)).map(
              ([cle, , libelle]) => (
                <View key={cle} style={styles.rangee}>
                  <Text style={styles.libelle}>{libelle}</Text>
                  <Switch
                    value={p[cle]}
                    onValueChange={() => basculer(p.type, cle)}
                    trackColor={{ true: couleurs.primaire }}
                    accessibilityLabel={`${TYPES_NOTIFICATION[p.type].libelle} par ${libelle}`}
                  />
                </View>
              ),
            )
          )}
        </Carte>
      ))}
      {retour && (
        <Message type={retour.ok ? 'succes' : 'erreur'}>{retour.texte}</Message>
      )}
      {prefs.length > 0 && (
        <Bouton
          libelle="Enregistrer"
          enCours={enCours}
          surAppui={enregistrer}
        />
      )}
    </Ecran>
  );
}

const creerStyles = (couleurs: Couleurs) =>
  StyleSheet.create({
    rangee: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    libelle: { fontSize: 17, color: couleurs.texte },
  });
