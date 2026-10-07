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
import { degrade, useStyles, useTheme, type Couleurs } from '@/lib/theme';

// Interface pensée pour des parents peu habitués au numérique : gros textes,
// gros boutons, peu d'éléments par écran.

export function Ecran({
  children,
  enChargement = false,
  surRafraichir,
}: {
  children: ReactNode;
  enChargement?: boolean;
  surRafraichir?: () => void;
}) {
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
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
            tintColor={couleurs.primaire}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Titre({ children }: { children: ReactNode }) {
  const styles = useStyles(creerStyles);
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
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
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
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
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

/**
 * Contour en dégradé bleu : un fond dégradé de 2 px autour d'un fond de carte.
 * `plein` : tout le bloc en dégradé (choix actif).
 */
export function ContourDegrade({
  children,
  plein = false,
  rayon = 14,
  style,
}: {
  children: ReactNode;
  plein?: boolean;
  rayon?: number;
  style?: object;
}) {
  const { couleurs } = useTheme();
  return (
    <View
      style={[
        { borderRadius: rayon, padding: 2 },
        degrade(couleurs.degrade),
        plein && ombreBleue(couleurs),
        style,
      ]}
    >
      <View
        style={[
          {
            flex: 1,
            borderRadius: rayon - 2,
            backgroundColor: plein ? 'transparent' : couleurs.carte,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const ombreBleue = (couleurs: Couleurs) => ({
  shadowColor: couleurs.degrade[1],
  shadowOpacity: 0.3,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
});

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
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
  const texte =
    variante === 'primaire'
      ? couleurs.surPrimaire
      : variante === 'danger'
        ? couleurs.danger
        : couleurs.primaire;
  const contenu = enCours ? (
    <ActivityIndicator color={texte} />
  ) : (
    <Text style={[styles.boutonTexte, { color: texte }]}>{libelle}</Text>
  );
  return (
    <Pressable
      onPress={surAppui}
      disabled={desactive || enCours}
      accessibilityRole="button"
      accessibilityState={{ disabled: desactive || enCours }}
      style={({ pressed }) => [
        (desactive || enCours) && { opacity: 0.6 },
        pressed && styles.presse,
      ]}
    >
      {variante === 'secondaire' ? (
        <ContourDegrade>
          <View style={[styles.bouton, { minHeight: 52 }]}>{contenu}</View>
        </ContourDegrade>
      ) : (
        <View
          style={[
            styles.bouton,
            variante === 'primaire'
              ? [degrade(couleurs.degrade), ombreBleue(couleurs)]
              : styles.boutonDanger,
          ]}
        >
          {contenu}
        </View>
      )}
    </Pressable>
  );
}

export function Champ({
  libelle,
  aide,
  ...props
}: TextInputProps & { libelle: string; aide?: string }) {
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.champ}>
      <Text style={styles.libelle}>{libelle}</Text>
      <TextInput
        placeholderTextColor={couleurs.indice}
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
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
  const c = {
    erreur: [couleurs.dangerClair, couleurs.danger],
    info: [couleurs.alerteClair, couleurs.alerte],
    succes: [couleurs.okClair, couleurs.ok],
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
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
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
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
  const c = {
    neutre: [couleurs.neutreClair, couleurs.neutre],
    ok: [couleurs.okClair, couleurs.ok],
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
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
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

/** Bouton ☀️/🌙 : passe l'application en clair ou en sombre (choix gardé). */
export function ChoixTheme({ surFond = false }: { surFond?: boolean }) {
  const { theme, couleurs, basculer } = useTheme();
  const libelle = theme === 'sombre' ? 'Mode clair' : 'Mode sombre';
  return (
    <Pressable
      onPress={basculer}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: surFond ? 'rgba(255,255,255,0.45)' : couleurs.bordure,
          backgroundColor: surFond ? 'rgba(255,255,255,0.12)' : couleurs.carte,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={{ fontSize: 18 }}>{theme === 'sombre' ? '☀️' : '🌙'}</Text>
    </Pressable>
  );
}

const creerStyles = (couleurs: Couleurs) =>
  StyleSheet.create({
    ecran: { flex: 1, backgroundColor: couleurs.fond },
    contenu: { padding: 16, gap: 12, paddingBottom: 40 },
    titre: { fontSize: 22, fontWeight: '800', color: couleurs.titre },
    texte: { fontSize: 17, color: couleurs.texte, lineHeight: 24 },
    carte: {
      backgroundColor: couleurs.carte,
      borderRadius: 16,
      padding: 16,
      gap: 6,
      borderWidth: 1,
      borderColor: couleurs.bordure,
    },
    presse: { opacity: 0.75, transform: [{ scale: 0.98 }] },
    bouton: {
      minHeight: 56,
      borderRadius: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boutonDanger: {
      backgroundColor: couleurs.dangerClair,
      borderWidth: 2,
      borderColor: couleurs.danger,
    },
    boutonTexte: { fontSize: 18, fontWeight: '700' },
    champ: { gap: 6 },
    libelle: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
    saisie: {
      minHeight: 56,
      borderWidth: 1,
      borderColor: couleurs.bordureChamp,
      borderRadius: 14,
      paddingHorizontal: 14,
      fontSize: 18,
      backgroundColor: couleurs.carte,
      color: couleurs.texte,
      textAlignVertical: 'top',
    },
    aide: { fontSize: 14, color: couleurs.secondaire },
    message: { borderRadius: 14, padding: 14 },
    vide: {
      textAlign: 'center',
      color: couleurs.secondaire,
      marginVertical: 32,
    },
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
