import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChoixEnfant } from '@/components/choix-enfant';
import { LigneNotification } from '@/components/ligne-notification';
import {
  Carte,
  couleurs,
  Ecran,
  Etat,
  Message,
  Texte,
  Titre,
} from '@/components/ui';
import { useEnfants } from '@/lib/enfants';
import { useMesNotifications } from '@/lib/notifications';
import { useUtilisateur } from '@/lib/session';

const RUBRIQUES = [
  { href: '/resultats', libelle: 'Résultats', icone: '📊' },
  { href: '/comportement', libelle: 'Comportement', icone: '⭐' },
  { href: '/absences', libelle: 'Absences', icone: '📋' },
  { href: '/paiements', libelle: 'Paiements', icone: '💳' },
  { href: '/appareils', libelle: 'Appareils', icone: '📱' },
  { href: '/evenements', libelle: 'Événements', icone: '📅' },
] as const;

export default function Accueil() {
  const utilisateur = useUtilisateur();
  const enfants = useEnfants();
  const messages = useMesNotifications();

  return (
    <Ecran
      enChargement={messages.chargement}
      surRafraichir={() => {
        void messages.recharger();
        void enfants.recharger();
      }}
    >
      <Titre>Bonjour {utilisateur.prenoms}</Titre>
      <Etat
        chargement={enfants.chargement && !enfants.enfants.length}
        erreur={enfants.enfants.length ? null : enfants.erreur}
        vide={
          !enfants.chargement &&
          !enfants.enfants.length &&
          "Aucun enfant n'est rattaché à votre numéro. Contactez le secrétariat de l'école."
        }
        surReessayer={enfants.recharger}
      />
      <ChoixEnfant />
      {enfants.enfant && (
        <Texte discret>
          Dossier de {enfants.enfant.prenoms} {enfants.enfant.nom}
          {enfants.enfant.classe ? ` · ${enfants.enfant.classe.nom}` : ''}
        </Texte>
      )}

      <View style={styles.grille}>
        {RUBRIQUES.map((r) => (
          <Pressable
            key={r.href}
            onPress={() => router.push(r.href)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.tuile, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.tuileIcone}>{r.icone}</Text>
            <Text style={styles.tuileTexte}>{r.libelle}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.entete}>
        <Titre>Derniers messages</Titre>
        {messages.nonLues > 0 && (
          <Text style={styles.compteur}>{messages.nonLues} non lu(s)</Text>
        )}
      </View>
      {messages.horsLigne && messages.liste.length > 0 && (
        <Message type="info">
          Pas de réseau : derniers messages enregistrés sur le téléphone.
        </Message>
      )}
      <Etat
        chargement={messages.chargement && !messages.liste.length}
        erreur={messages.erreur}
        vide={
          !messages.liste.length && "Aucun message de l'école pour le moment."
        }
        surReessayer={messages.recharger}
      />
      {messages.liste.slice(0, 3).map((n) => (
        <LigneNotification key={n.id} n={n} />
      ))}
      {messages.liste.length > 3 && (
        <Carte surAppui={() => router.navigate('/notifications')}>
          <Text style={styles.lien}>Voir tous les messages</Text>
        </Carte>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tuile: {
    width: '31%',
    flexGrow: 1,
    minHeight: 96,
    backgroundColor: couleurs.blanc,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
  },
  tuileIcone: { fontSize: 30 },
  tuileTexte: { fontSize: 15, fontWeight: '600', color: couleurs.texte },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  compteur: { fontSize: 15, color: couleurs.primaire, fontWeight: '600' },
  lien: {
    fontSize: 17,
    color: couleurs.primaire,
    fontWeight: '600',
    textAlign: 'center',
  },
});
