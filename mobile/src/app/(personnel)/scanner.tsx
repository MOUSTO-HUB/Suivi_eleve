import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Bouton, Champ, Ecran, Message, Texte } from '@/components/ui';
import { codeEtiquette } from '@/lib/format';

/** Lecture de l'étiquette QR d'un appareil, ou saisie du code à 8 caractères. */
export default function Scanner() {
  const [permission, demanderPermission] = useCameraPermissions();
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [actif, setActif] = useState(true);
  const dejaLu = useRef(false);

  // La caméra se rallume au retour sur l'écran (scan suivant).
  useFocusEffect(
    useCallback(() => {
      dejaLu.current = false;
      setActif(true);
      return () => setActif(false);
    }, []),
  );

  const ouvrir = (lu: string) => {
    const code = codeEtiquette(lu);
    if (!code) {
      setErreur("Ce code n'est pas une étiquette Suivi_eleve.");
      return;
    }
    dejaLu.current = true;
    setErreur(null);
    router.push(`/appareil/${encodeURIComponent(code)}`);
  };

  return (
    <Ecran>
      {!permission ? null : permission.granted ? (
        actif && (
          <View style={styles.cadre}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (!dejaLu.current) ouvrir(data);
              }}
            />
          </View>
        )
      ) : (
        <>
          <Texte>
            L&apos;application a besoin de la caméra pour lire les étiquettes.
          </Texte>
          <Bouton libelle="Autoriser la caméra" surAppui={demanderPermission} />
        </>
      )}
      {erreur && <Message>{erreur}</Message>}
      <Champ
        libelle="Ou saisir le code de l'étiquette"
        placeholder="Ex. 3f9a2b7c"
        autoCapitalize="none"
        autoCorrect={false}
        value={saisie}
        onChangeText={setSaisie}
      />
      <Bouton
        libelle="Rechercher"
        variante="secondaire"
        desactive={saisie.trim().length < 8}
        surAppui={() => ouvrir(saisie)}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  cadre: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
});
