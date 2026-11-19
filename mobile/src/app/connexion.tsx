import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Accueil } from '@/components/entete';
import { Bouton, Champ, Ecran, Message, Texte } from '@/components/ui';
import { useVerificationRobot } from '@/components/verification-robot';
import { ErreurApi, lire } from '@/lib/api';
import { estPays, PAYS, telephoneE164, type Pays } from '@/lib/format';
import { useSession, type DemandeWhatsapp } from '@/lib/session';
import { enregistrerPays, paysEnregistre } from '@/lib/stockage-local';
import { degrade, useStyles, useTheme, type Couleurs } from '@/lib/theme';

/** Pays proposé d'abord : EXPO_PUBLIC_PAYS_PAR_DEFAUT (GN, CI, SN), sinon la Guinée. */
const PAYS_PAR_DEFAUT: Pays = estPays(process.env.EXPO_PUBLIC_PAYS_PAR_DEFAUT)
  ? process.env.EXPO_PUBLIC_PAYS_PAR_DEFAUT
  : 'GN';

type Moyen = 'WHATSAPP' | 'EMAIL' | 'SMS';

/** WhatsApp d'abord : gratuit, et sans email à renseigner. */
const MOYENS: { valeur: Moyen; libelle: string; canal: keyof Canaux }[] = [
  { valeur: 'WHATSAPP', libelle: 'WhatsApp', canal: 'whatsapp' },
  { valeur: 'EMAIL', libelle: 'Email', canal: 'email' },
  { valeur: 'SMS', libelle: 'SMS', canal: 'sms' },
];

interface Canaux {
  sms: boolean;
  email: boolean;
  whatsapp: boolean;
}

const INTERVALLE_WHATSAPP_MS = 3000;

/** Connexion des parents : numéro de téléphone, puis WhatsApp ou code reçu par email ou SMS. */
export default function Connexion() {
  const { demanderCode, verifierCode, demanderWhatsapp, suivreWhatsapp } =
    useSession();
  const robot = useVerificationRobot();
  const [etape, setEtape] = useState<'numero' | 'code' | 'whatsapp'>('numero');
  const [numero, setNumero] = useState('');
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pays, setPays] = useState<Pays>(PAYS_PAR_DEFAUT);
  const [canaux, setCanaux] = useState<Canaux>({
    sms: true,
    email: true,
    whatsapp: false,
  });
  const [moyen, setMoyen] = useState<Moyen>('SMS');
  const [demande, setDemande] = useState<DemandeWhatsapp | null>(null);
  const verificationEnCours = useRef(false);
  const telephone = telephoneE164(numero, pays);
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
  const moyens = MOYENS.filter((m) => canaux[m.canal]);

  // Dernier pays choisi sur ce téléphone ; moyens proposés par l'école.
  useEffect(() => {
    void paysEnregistre().then((p) => estPays(p) && setPays(p));
    lire<Canaux>('/auth/parents/canaux')
      .then((c) => {
        setCanaux(c);
        const premier = MOYENS.find((m) => c[m.canal]);
        if (premier) setMoyen(premier.valeur);
      })
      .catch(() => undefined);
  }, []);

  // WhatsApp : vérifie régulièrement, et dès le retour dans l'application, si le message est arrivé.
  useEffect(() => {
    if (etape !== 'whatsapp' || !demande) return;
    const verifier = async () => {
      if (verificationEnCours.current) return;
      verificationEnCours.current = true;
      try {
        await suivreWhatsapp(demande.jeton);
      } catch (e) {
        if (e instanceof ErreurApi && e.statut !== 0) {
          setErreur(e.message);
          setEtape('numero');
          setDemande(null);
        }
      } finally {
        verificationEnCours.current = false;
      }
    };
    const minuterie = setInterval(
      () => void verifier(),
      INTERVALLE_WHATSAPP_MS,
    );
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') void verifier();
    });
    return () => {
      clearInterval(minuterie);
      abonnement.remove();
    };
  }, [etape, demande, suivreWhatsapp]);

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

  const ouvrirWhatsapp = (d: DemandeWhatsapp) =>
    Linking.openURL(d.lien).catch(() =>
      setErreur(
        `WhatsApp ne s'ouvre pas : envoyez vous-même le message « ${d.message} » au ${d.numero}.`,
      ),
    );

  const continuer = () =>
    executer(async () => {
      const altcha = robot.prendre();
      if (!altcha)
        throw new ErreurApi(400, 'Cochez la case « Je ne suis pas un robot ».');
      if (moyen === 'WHATSAPP') {
        const d = await demanderWhatsapp(telephone, altcha);
        await enregistrerPays(pays);
        setDemande(d);
        setEtape('whatsapp');
        await ouvrirWhatsapp(d);
        return;
      }
      await demanderCode(telephone, altcha, moyen);
      await enregistrerPays(pays);
      setEtape('code');
    });

  const recommencer = () => {
    setEtape('numero');
    setCode('');
    setDemande(null);
    setErreur(null);
  };

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={{ flex: 1, backgroundColor: couleurs.fond }}
    >
      <Accueil sousTitre="La scolarité de votre enfant, sur votre téléphone." />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Ecran>
          {etape === 'numero' ? (
            <>
              <Texte>Pays</Texte>
              <View style={styles.choix} accessibilityRole="radiogroup">
                {(Object.keys(PAYS) as Pays[]).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPays(p)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: p === pays }}
                    style={[
                      styles.option,
                      p === pays && [
                        styles.optionActive,
                        degrade(couleurs.degrade),
                      ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.texteOption,
                        p === pays && styles.texteOptionActive,
                      ]}
                    >
                      {PAYS[p].nom}
                    </Text>
                    <Text
                      style={[
                        styles.indicatif,
                        p === pays && styles.texteOptionActive,
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
              <Texte>Se connecter avec</Texte>
              <View style={styles.choix} accessibilityRole="radiogroup">
                {moyens.map((m) => (
                  <Pressable
                    key={m.valeur}
                    onPress={() => setMoyen(m.valeur)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: m.valeur === moyen }}
                    style={[
                      styles.option,
                      m.valeur === moyen && [
                        styles.optionActive,
                        degrade(couleurs.degrade),
                      ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.texteOption,
                        m.valeur === moyen && styles.texteOptionActive,
                      ]}
                    >
                      {m.libelle}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {robot.case}
              {erreur && <Message>{erreur}</Message>}
              <Bouton
                libelle={
                  moyen === 'WHATSAPP'
                    ? 'Me connecter avec WhatsApp'
                    : moyen === 'EMAIL'
                      ? 'Recevoir le code par email'
                      : 'Recevoir le code par SMS'
                }
                enCours={enCours}
                desactive={numero.replace(/\D/g, '').length < 8 || !robot.pret}
                surAppui={continuer}
              />
            </>
          ) : etape === 'whatsapp' && demande ? (
            <>
              <Message type="succes">
                Envoyez depuis votre WhatsApp le message proposé au{' '}
                {demande.numero}. Cet écran s&apos;ouvrira tout seul dès
                qu&apos;il sera reçu.
              </Message>
              <Texte>
                Le message contient le code{' '}
                <Text style={styles.code}>{demande.code}</Text>, valable 10
                minutes.
              </Texte>
              {erreur && <Message>{erreur}</Message>}
              <Bouton
                libelle="Ouvrir WhatsApp"
                surAppui={() => void ouvrirWhatsapp(demande)}
              />
              <Bouton
                libelle="Recommencer"
                variante="secondaire"
                surAppui={recommencer}
              />
            </>
          ) : (
            <>
              <Message type="succes">
                {moyen === 'EMAIL'
                  ? "Si ce numéro est connu de l'école et qu'un email y est enregistré, un code à 6 chiffres vient d'y être envoyé."
                  : `Si ce numéro est connu de l'école, un code à 6 chiffres vient d'être envoyé au ${telephone}.`}
              </Message>
              <Champ
                libelle={
                  moyen === 'EMAIL'
                    ? 'Code reçu par email'
                    : 'Code reçu par SMS'
                }
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete={moyen === 'SMS' ? 'sms-otp' : 'one-time-code'}
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
                surAppui={recommencer}
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

const creerStyles = (couleurs: Couleurs) =>
  StyleSheet.create({
    choix: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 16 },
    option: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: couleurs.bordure,
      backgroundColor: couleurs.carte,
    },
    optionActive: {
      backgroundColor: couleurs.primaire,
      borderColor: 'transparent',
    },
    texteOption: { fontSize: 15, fontWeight: '600', color: couleurs.texte },
    indicatif: { fontSize: 13, color: couleurs.secondaire },
    texteOptionActive: { color: couleurs.surPrimaire },
    code: {
      fontWeight: '700',
      letterSpacing: 3,
      color: couleurs.texte,
    },
    lien: {
      marginTop: 24,
      textAlign: 'center',
      fontSize: 16,
      color: couleurs.primaire,
      padding: 12,
    },
  });
