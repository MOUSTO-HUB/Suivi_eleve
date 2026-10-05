import { router } from 'expo-router';
import { useState } from 'react';
import { ChoixEnfant } from '@/components/choix-enfant';
import { Bouton, Carte, Ecran, Ligne, Texte, Titre } from '@/components/ui';
import { useEnfants } from '@/lib/enfants';
import { useSession, useUtilisateur } from '@/lib/session';

export default function Reglages() {
  const utilisateur = useUtilisateur();
  const { deconnexion } = useSession();
  const { enfants } = useEnfants();
  const [enCours, setEnCours] = useState(false);

  return (
    <Ecran>
      <Titre>
        {utilisateur.prenoms} {utilisateur.nom}
      </Titre>
      <Carte>
        {enfants.map((e) => (
          <Ligne
            key={e.id}
            libelle={`${e.prenoms} ${e.nom}`}
            valeur={e.classe?.nom ?? '—'}
          />
        ))}
      </Carte>
      {enfants.length > 1 && (
        <>
          <Texte discret>Enfant affiché dans l&apos;application :</Texte>
          <ChoixEnfant />
        </>
      )}
      <Bouton
        libelle="Choisir comment recevoir les messages"
        variante="secondaire"
        surAppui={() => router.push('/preferences')}
      />
      <Bouton
        libelle="Se déconnecter"
        variante="danger"
        enCours={enCours}
        surAppui={() => {
          setEnCours(true);
          void deconnexion();
        }}
      />
    </Ecran>
  );
}
