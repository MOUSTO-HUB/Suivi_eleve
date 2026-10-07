import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErreurApi } from '@/lib/api';
import { useSession, useUtilisateur } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { Bouton, Carte, Ecran, Message, Texte, Titre } from './ui';

/** Première connexion d'un parent : information sur les données et accord. */
export function Consentement() {
  const u = useUtilisateur();
  const { consentir, deconnexion } = useSession();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const { couleurs } = useTheme();
  if (!u.consentement) return null;
  const { version, texte } = u.consentement;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: couleurs.fond }}>
      <Ecran>
        <Titre>Bienvenue {u.prenoms}</Titre>
        <Texte discret>
          Avant de commencer, merci de lire comment l&apos;école utilise vos
          données et celles de votre enfant.
        </Texte>
        <Carte>
          {texte.map((paragraphe) => (
            <Texte key={paragraphe}>{paragraphe}</Texte>
          ))}
        </Carte>
        {erreur && <Message>{erreur}</Message>}
        <Bouton
          libelle="J'ai lu et j'accepte"
          enCours={enCours}
          surAppui={async () => {
            setEnCours(true);
            setErreur(null);
            try {
              await consentir(version);
            } catch (e) {
              setErreur(
                e instanceof ErreurApi ? e.message : 'Erreur inattendue.',
              );
              setEnCours(false);
            }
          }}
        />
        <Bouton
          libelle="Se déconnecter"
          variante="secondaire"
          surAppui={() => void deconnexion()}
        />
      </Ecran>
    </SafeAreaView>
  );
}
