import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { quandFr, TYPES_NOTIFICATION } from '@/lib/format';
import type { Notification } from '@/lib/types';
import { Carte, couleurs } from './ui';

/** Une notification : icône du type, titre, enfant, date ; en gras si non lue. */
export function LigneNotification({ n }: { n: Notification }) {
  const type = TYPES_NOTIFICATION[n.type];
  const nonLue = !n.lueLe;
  return (
    <Carte
      surAppui={() => router.push(`/notification/${n.id}`)}
      accent={
        n.priorite === 'URGENTE' ? 'danger' : nonLue ? 'primaire' : undefined
      }
    >
      <View style={styles.rangee}>
        <Text style={styles.icone} accessibilityLabel={type.libelle}>
          {type.icone}
        </Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.type}>
            {type.libelle}
            {n.eleve ? ` · ${n.eleve.prenoms}` : ''}
          </Text>
          <Text
            style={[styles.sujet, nonLue && { fontWeight: '700' }]}
            numberOfLines={2}
          >
            {n.sujet || n.contenu}
          </Text>
          <Text style={styles.date}>
            {quandFr(n.creeLe)}
            {nonLue ? ' · non lu' : ''}
          </Text>
        </View>
      </View>
    </Carte>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icone: { fontSize: 28 },
  type: { fontSize: 14, color: couleurs.secondaire },
  sujet: { fontSize: 17, color: couleurs.texte, lineHeight: 23 },
  date: { fontSize: 14, color: couleurs.secondaire },
});
