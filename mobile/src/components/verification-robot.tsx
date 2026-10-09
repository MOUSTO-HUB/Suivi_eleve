import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { resoudreAltcha, type DefiAltcha } from '@/lib/altcha';
import { lire } from '@/lib/api';
import { useStyles, type Couleurs } from '@/lib/theme';

type Etat = 'attente' | 'calcul' | 'verifie' | 'erreur';

/**
 * Case « Je ne suis pas un robot » (ALTCHA). `prendre()` donne la réponse à
 * envoyer ; elle ne sert qu'une fois, une nouvelle est alors préparée sans
 * redemander de cocher.
 */
export function useVerificationRobot() {
  const [etat, setEtat] = useState<Etat>('attente');
  const reponse = useRef<string | null>(null);
  const enCours = useRef(false);

  const verifier = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    reponse.current = null;
    setEtat('calcul');
    try {
      reponse.current = await resoudreAltcha(
        await lire<DefiAltcha>('/auth/altcha'),
      );
      setEtat('verifie');
    } catch {
      setEtat('erreur');
    } finally {
      enCours.current = false;
    }
  }, []);

  const prendre = useCallback((): string | null => {
    const r = reponse.current;
    if (r) setTimeout(() => void verifier(), 0);
    return r;
  }, [verifier]);

  return {
    pret: etat === 'verifie',
    prendre,
    case: <CaseRobot etat={etat} surAppui={verifier} />,
  };
}

function CaseRobot({ etat, surAppui }: { etat: Etat; surAppui: () => void }) {
  const styles = useStyles(creerStyles);
  const cochee = etat === 'verifie' || etat === 'calcul';
  return (
    <Pressable
      onPress={surAppui}
      disabled={etat === 'calcul' || etat === 'verifie'}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: cochee, busy: etat === 'calcul' }}
      style={styles.cadre}
    >
      <View style={[styles.case, cochee && styles.caseCochee]}>
        {cochee && <Text style={styles.coche}>✓</Text>}
      </View>
      <Text style={styles.texte}>
        {etat === 'calcul'
          ? 'Vérification…'
          : etat === 'verifie'
            ? 'Vérifié : vous n’êtes pas un robot'
            : etat === 'erreur'
              ? 'Vérification impossible, touchez à nouveau'
              : 'Je ne suis pas un robot'}
      </Text>
      <Text style={styles.marque}>ALTCHA</Text>
    </Pressable>
  );
}

const creerStyles = (couleurs: Couleurs) =>
  StyleSheet.create({
    cadre: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: couleurs.bordure,
      borderRadius: 12,
      backgroundColor: couleurs.carte,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 16,
    },
    case: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: couleurs.bordure,
      alignItems: 'center',
      justifyContent: 'center',
    },
    caseCochee: {
      backgroundColor: couleurs.primaire,
      borderColor: couleurs.primaire,
    },
    coche: { color: couleurs.surPrimaire, fontSize: 15, fontWeight: '700' },
    texte: { flex: 1, fontSize: 15, color: couleurs.texte },
    marque: { fontSize: 10, letterSpacing: 1, color: couleurs.secondaire },
  });
