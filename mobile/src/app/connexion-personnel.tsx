import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Accueil } from '@/components/entete';
import { Bouton, Champ, Ecran, Message, Texte, Titre } from '@/components/ui';
import { useVerificationRobot } from '@/components/verification-robot';
import { API_URL, ErreurApi } from '@/lib/api';
import { useSession, type EtapeDoubleAuth } from '@/lib/session';
import { useStyles, useTheme, type Couleurs } from '@/lib/theme';

/** Site web (même adresse que l'API, sans /api) : page « mot de passe oublié ». */
const URL_SITE = API_URL.replace(/\/api$/, '');

/** Enseignants, surveillants et administration : email et mot de passe, puis code si demandé. */
export default function ConnexionPersonnel() {
  const { connexionPersonnel, verifierDoubleAuth, renvoyerCodeEmail } =
    useSession();
  const robot = useVerificationRobot();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [etape, setEtape] = useState<EtapeDoubleAuth | null>(null);
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);

  const executer = async (action: () => Promise<void>) => {
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await action();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur inattendue.');
    } finally {
      setEnCours(false);
    }
  };

  const valider = () =>
    executer(async () => {
      const altcha = robot.prendre();
      if (!altcha)
        throw new ErreurApi(400, 'Cochez la case « Je ne suis pas un robot ».');
      const suite = await connexionPersonnel(email.trim(), motDePasse, altcha);
      if (suite) setEtape(suite);
    });

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={{ flex: 1, backgroundColor: couleurs.fond }}
    >
      <Accueil sousTitre="Espace du personnel de l'école" />
      <Ecran>
        <Titre>Espace du personnel</Titre>
        {etape ? (
          <>
            <Message type="succes">
              {etape.methode === 'APPLICATION'
                ? 'Double authentification : saisissez le code à 6 chiffres affiché par votre application d’authentification.'
                : `Double authentification : un code à 6 chiffres vient d’être envoyé par email${etape.email ? ` à ${etape.email}` : ''}. Il est valable 10 minutes.`}
            </Message>
            <Champ
              libelle="Code"
              aide="Téléphone perdu ? Saisissez un de vos codes de secours."
              placeholder="123456"
              autoCapitalize="none"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={12}
              value={code}
              onChangeText={setCode}
              onSubmitEditing={() =>
                executer(() => verifierDoubleAuth(etape.jeton, code.trim()))
              }
            />
            {erreur && <Message>{erreur}</Message>}
            {info && <Message type="succes">{info}</Message>}
            <Bouton
              libelle="Valider le code"
              enCours={enCours}
              desactive={code.trim().length < 6}
              surAppui={() =>
                executer(() => verifierDoubleAuth(etape.jeton, code.trim()))
              }
            />
            {etape.methode === 'EMAIL' && (
              <Bouton
                libelle="Renvoyer un code"
                variante="secondaire"
                surAppui={() =>
                  executer(async () => {
                    await renvoyerCodeEmail(etape.jeton);
                    setInfo('Un nouveau code vient d’être envoyé par email.');
                  })
                }
              />
            )}
            <Bouton
              libelle="Recommencer"
              variante="secondaire"
              surAppui={() => {
                setEtape(null);
                setCode('');
                setErreur(null);
              }}
            />
          </>
        ) : (
          <>
            <Texte discret>
              Scanner un appareil, signaler un comportement ou un usage en
              classe.
            </Texte>
            <Champ
              libelle="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <Champ
              libelle="Mot de passe"
              secureTextEntry
              autoComplete="current-password"
              value={motDePasse}
              onChangeText={setMotDePasse}
            />
            {robot.case}
            {erreur && <Message>{erreur}</Message>}
            <Bouton
              libelle="Se connecter"
              enCours={enCours}
              desactive={!email || !motDePasse || !robot.pret}
              surAppui={valider}
            />
            <Bouton
              libelle="Retour"
              variante="secondaire"
              surAppui={() => router.back()}
            />
            <Pressable
              onPress={() =>
                void Linking.openURL(`${URL_SITE}/mot-de-passe-oublie`)
              }
              accessibilityRole="link"
            >
              <Text style={styles.lien}>Mot de passe oublié ?</Text>
            </Pressable>
          </>
        )}
      </Ecran>
    </SafeAreaView>
  );
}

const creerStyles = (couleurs: Couleurs) =>
  StyleSheet.create({
    lien: {
      marginTop: 16,
      textAlign: 'center',
      fontSize: 16,
      color: couleurs.primaire,
      padding: 12,
    },
  });
