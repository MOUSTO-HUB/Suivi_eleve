import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bouton,
  Champ,
  couleurs,
  Ecran,
  Message,
  Texte,
  Titre,
} from '@/components/ui';
import { ErreurApi } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Enseignants, surveillants et administration : email et mot de passe. */
export default function ConnexionPersonnel() {
  const { connexionPersonnel } = useSession();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await connexionPersonnel(email.trim(), motDePasse);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur inattendue.');
      setEnCours(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: couleurs.fond }}>
      <Ecran>
        <Titre>Espace du personnel</Titre>
        <Texte discret>
          Scanner un appareil, signaler un comportement ou un usage en classe.
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
          onSubmitEditing={valider}
        />
        {erreur && <Message>{erreur}</Message>}
        <Bouton
          libelle="Se connecter"
          enCours={enCours}
          desactive={!email || !motDePasse}
          surAppui={valider}
        />
        <Bouton
          libelle="Retour"
          variante="secondaire"
          surAppui={() => router.back()}
        />
      </Ecran>
    </SafeAreaView>
  );
}
