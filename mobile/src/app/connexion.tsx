import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bouton,
  Champ,
  couleurs,
  Ecran,
  Message,
  Texte,
} from '@/components/ui';
import { ErreurApi } from '@/lib/api';
import { estPays, PAYS, telephoneE164, type Pays } from '@/lib/format';
import { useSession } from '@/lib/session';
import { enregistrerPays, paysEnregistre } from '@/lib/stockage-local';

/** Pays proposé d'abord : EXPO_PUBLIC_PAYS_PAR_DEFAUT (GN, CI, SN), sinon la Guinée. */
const PAYS_PAR_DEFAUT: Pays = estPays(process.env.EXPO_PUBLIC_PAYS_PAR_DEFAUT)
  ? process.env.EXPO_PUBLIC_PAYS_PAR_DEFAUT
  : 'GN';

/** Connexion des parents : numéro de téléphone puis code reçu par SMS. */
export default function Connexion() {
  const { demanderCode, verifierCode } = useSession();
  const [etape, setEtape] = useState<'numero' | 'code'>('numero');
  const [numero, setNumero] = useState('');
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pays, setPays] = useState<Pays>(PAYS_PAR_DEFAUT);
  const telephone = telephoneE164(numero, pays);

  // Dernier pays choisi sur ce téléphone.
  useEffect(() => {
    void paysEnregistre().then((p) => estPays(p) && setPays(p));
  }, []);

  const executer = async (action: () => Promise<void>) => {
    setEnCours(true);
    setErreur(null);
    try {
      await action();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur inattendue.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: couleurs.fond }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Ecran>
          <View style={styles.entete}>
            <Text style={styles.logo}>Suivi_eleve</Text>
            <Texte discret>
              La scolarité de votre enfant, sur votre téléphone.
            </Texte>
          </View>

          {etape === 'numero' ? (
            <>
              <Texte>Pays</Texte>
              <View style={styles.pays} accessibilityRole="radiogroup">
                {(Object.keys(PAYS) as Pays[]).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPays(p)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: p === pays }}
                    style={[styles.choixPays, p === pays && styles.paysActif]}
                  >
                    <Text
                      style={[
                        styles.textePays,
                        p === pays && styles.textePaysActif,
                      ]}
                    >
                      {PAYS[p].nom}
                    </Text>
                    <Text
                      style={[
                        styles.indicatif,
                        p === pays && styles.textePaysActif,
                      ]}
                    >
                      +{PAYS[p].indicatif}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Champ
                libelle="Votre numéro de téléphone"
                aide="Le numéro donné à l'école lors de l'inscription."
                placeholder={PAYS[pays].exemple}
                keyboardType="phone-pad"
                autoComplete="tel"
                value={numero}
                onChangeText={setNumero}
              />
              {erreur && <Message>{erreur}</Message>}
              <Bouton
                libelle="Recevoir le code par SMS"
                enCours={enCours}
                desactive={numero.replace(/\D/g, '').length < 8}
                surAppui={() =>
                  executer(async () => {
                    await demanderCode(telephone);
                    await enregistrerPays(pays);
                    setEtape('code');
                  })
                }
              />
            </>
          ) : (
            <>
              <Message type="succes">
                Si ce numéro est connu de l&apos;école, un code à 6 chiffres
                vient d&apos;être envoyé au {telephone}.
              </Message>
              <Champ
                libelle="Code reçu par SMS"
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              />
              {erreur && <Message>{erreur}</Message>}
              <Bouton
                libelle="Se connecter"
                enCours={enCours}
                desactive={code.length !== 6}
                surAppui={() => executer(() => verifierCode(telephone, code))}
              />
              <Bouton
                libelle="Changer de numéro"
                variante="secondaire"
                surAppui={() => {
                  setEtape('numero');
                  setCode('');
                  setErreur(null);
                }}
              />
            </>
          )}

          <Link href="/connexion-personnel" style={styles.lien}>
            Personnel de l&apos;école : se connecter
          </Link>
        </Ecran>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  entete: { alignItems: 'center', gap: 6, marginVertical: 32 },
  logo: { fontSize: 32, fontWeight: '800', color: couleurs.primaire },
  pays: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 16 },
  choixPays: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    backgroundColor: couleurs.blanc,
  },
  paysActif: {
    backgroundColor: couleurs.primaire,
    borderColor: couleurs.primaire,
  },
  textePays: { fontSize: 15, fontWeight: '600', color: couleurs.texte },
  indicatif: { fontSize: 13, color: couleurs.secondaire },
  textePaysActif: { color: couleurs.blanc },
  lien: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 16,
    color: couleurs.primaire,
    padding: 12,
  },
});
