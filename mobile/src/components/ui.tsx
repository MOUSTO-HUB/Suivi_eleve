import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

// Interface pensée pour des parents peu habitués au numérique : gros textes,
// gros boutons, peu d'éléments par écran.

export const couleurs = {
  primaire: '#047857',
  primaireClair: '#ecfdf5',
  texte: '#18181b',
  secondaire: '#52525b',
  bordure: '#e4e4e7',
  fond: '#f4f4f5',
  blanc: '#ffffff',
  danger: '#b91c1c',
  dangerClair: '#fef2f2',
  alerte: '#b45309',
  alerteClair: '#fffbeb',
};

export function Ecran({
  children,
  enChargement = false,
  surRafraichir,
}: {
  children: ReactNode;
  enChargement?: boolean;
  surRafraichir?: () => void;
}) {
  return (
    <ScrollView
      style={styles.ecran}
      contentContainerStyle={styles.contenu}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        surRafraichir ? (
          <RefreshControl
            refreshing={enChargement}
            onRefresh={surRafraichir}
            colors={[couleurs.primaire]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Titre({ children }: { children: ReactNode }) {
  return <Text style={styles.titre}>{children}</Text>;
}

export function Texte({
  children,
  discret,
  gras,
}: {
  children: ReactNode;
  discret?: boolean;
  gras?: boolean;
}) {
  return (
    <Text
      style={[
        styles.texte,
        discret && { color: couleurs.secondaire, fontSize: 15 },
        gras && { fontWeight: '600' },
      ]}
    >
      {children}
    </Text>
  );
}

export function Carte({
  children,
  surAppui,
  accent,
}: {
  children: ReactNode;
  surAppui?: () => void;
  accent?: 'alerte' | 'danger' | 'primaire';
}) {
  const bord = accent
    ? {
        borderLeftWidth: 5,
        borderLeftColor:
          accent === 'danger'
            ? couleurs.danger
            : accent === 'alerte'
              ? couleurs.alerte
              : couleurs.primaire,
      }
    : null;
  if (!surAppui) return <View style={[styles.carte, bord]}>{children}</View>;
  return (
    <Pressable
      onPress={surAppui}
      accessibilityRole="button"
      style={({ pressed }) => [styles.carte, bord, pressed && styles.presse]}
    >
      {children}
    </Pressable>
  );
}

export function Bouton({
  libelle,
  surAppui,
  variante = 'primaire',
  enCours = false,
  desactive = false,
}: {
  libelle: string;
  surAppui: () => void;
  variante?: 'primaire' | 'secondaire' | 'danger';
  enCours?: boolean;
  desactive?: boolean;
}) {
  const fond =
    variante === 'primaire'
      ? couleurs.primaire
      : variante === 'danger'
        ? couleurs.dangerClair
        : couleurs.blanc;
  const texte =
    variante === 'primaire'
      ? couleurs.blanc
      : variante === 'danger'
        ? couleurs.danger
        : couleurs.texte;
  return (
    <Pressable
      onPress={surAppui}
      disabled={desactive || enCours}
      accessibilityRole="button"
      accessibilityState={{ disabled: desactive || enCours }}
      style={({ pressed }) => [
        styles.bouton,
        { backgroundColor: fond },
        variante !== 'primaire' && styles.boutonBordure,
        (desactive || enCours) && { opacity: 0.6 },
        pressed && styles.presse,
      ]}
    >
      {enCours ? (
        <ActivityIndicator color={texte} />
      ) : (
        <Text style={[styles.boutonTexte, { color: texte }]}>{libelle}</Text>
      )}
    </Pressable>
  );
}

export function Champ({
  libelle,
  aide,
  ...props
}: TextInputProps & { libelle: string; aide?: string }) {
  return (
    <View style={styles.champ}>
      <Text style={styles.libelle}>{libelle}</Text>
      <TextInput
        placeholderTextColor="#a1a1aa"
        {...props}
        style={[styles.saisie, props.multiline && { minHeight: 96 }]}
        accessibilityLabel={libelle}
      />
      {aide && <Text style={styles.aide}>{aide}</Text>}
    </View>
  );
}

export function Message({
  type = 'erreur',
  children,
}: {
  type?: 'erreur' | 'info' | 'succes';
  children: ReactNode;
}) {
  const c = {
    erreur: [couleurs.dangerClair, couleurs.danger],
    info: [couleurs.alerteClair, couleurs.alerte],
    succes: [couleurs.primaireClair, couleurs.primaire],
  }[type];
  return (
    <View
      style={[styles.message, { backgroundColor: c[0] }]}
      accessibilityRole={type === 'erreur' ? 'alert' : undefined}
    >
      <Text style={{ color: c[1], fontSize: 16 }}>{children}</Text>
    </View>
  );
}

/** Chargement, erreur ou liste vide : un seul composant pour les trois cas. */
export function Etat({
  chargement,
  erreur,
  vide,
  surReessayer,
}: {
  chargement: boolean;
  erreur: string | null;
  vide?: string | false;
  surReessayer?: () => void;
}) {
  if (erreur)
    return (
      <View style={{ gap: 12 }}>
        <Message>{erreur}</Message>
        {surReessayer && (
          <Bouton
            libelle="Réessayer"
            variante="secondaire"
            surAppui={surReessayer}
          />
        )}
      </View>
    );
  if (chargement)
    return (
      <ActivityIndicator
        size="large"
        color={couleurs.primaire}
        style={{ marginVertical: 32 }}
      />
    );
  if (vide)
    return (
      <Text style={[styles.texte, styles.vide]} accessibilityRole="text">
        {vide}
      </Text>
    );
  return null;
}

export function Pastille({
  children,
  ton = 'neutre',
}: {
  children: ReactNode;
  ton?: 'neutre' | 'ok' | 'alerte' | 'danger';
}) {
  const c = {
    neutre: ['#f4f4f5', '#3f3f46'],
    ok: [couleurs.primaireClair, couleurs.primaire],
    alerte: [couleurs.alerteClair, couleurs.alerte],
    danger: [couleurs.dangerClair, couleurs.danger],
  }[ton];
  return (
    <View style={[styles.pastille, { backgroundColor: c[0] }]}>
      <Text style={{ color: c[1], fontSize: 14, fontWeight: '600' }}>
        {children}
      </Text>
    </View>
  );
}

export function Ligne({
  libelle,
  valeur,
}: {
  libelle: string;
  valeur: ReactNode;
}) {
  return (
    <View style={styles.ligne}>
      <Text style={[styles.texte, { color: couleurs.secondaire }]}>
        {libelle}
      </Text>
      <Text
        style={[
          styles.texte,
          { fontWeight: '600', flexShrink: 1, textAlign: 'right' },
        ]}
      >
        {valeur}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { padding: 16, gap: 12, paddingBottom: 40 },
  titre: { fontSize: 22, fontWeight: '700', color: couleurs.texte },
  texte: { fontSize: 17, color: couleurs.texte, lineHeight: 24 },
  carte: {
    backgroundColor: couleurs.blanc,
    borderRadius: 12,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: couleurs.bordure,
  },
  presse: { opacity: 0.75 },
  bouton: {
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boutonBordure: { borderWidth: 1, borderColor: couleurs.bordure },
  boutonTexte: { fontSize: 18, fontWeight: '600' },
  champ: { gap: 6 },
  libelle: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
  saisie: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    backgroundColor: couleurs.blanc,
    color: couleurs.texte,
    textAlignVertical: 'top',
  },
  aide: { fontSize: 14, color: couleurs.secondaire },
  message: { borderRadius: 12, padding: 14 },
  vide: { textAlign: 'center', color: couleurs.secondaire, marginVertical: 32 },
  pastille: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  ligne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
});
