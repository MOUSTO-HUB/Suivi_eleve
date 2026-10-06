import { router } from 'expo-router';
import { useState } from 'react';
import { Bouton, Ecran, Texte, Titre } from '@/components/ui';
import { useSession, useUtilisateur } from '@/lib/session';
import type { Role } from '@/lib/types';

const LIBELLES_ROLE: Record<Role, string> = {
  ADMIN: 'Direction',
  SECRETARIAT: 'Secrétariat',
  ENSEIGNANT: 'Enseignant',
  SURVEILLANT: 'Surveillant',
  COMPTABLE: 'Comptabilité',
  PARENT: 'Parent',
  SUPER_ADMIN: 'Concepteur',
};

/** Rôles qui peuvent signaler un comportement (même règle que l'API). */
const SIGNALEMENT: Role[] = [
  'ADMIN',
  'SECRETARIAT',
  'ENSEIGNANT',
  'SURVEILLANT',
];

export default function AccueilPersonnel() {
  const u = useUtilisateur();
  const { deconnexion } = useSession();
  const [enCours, setEnCours] = useState(false);

  return (
    <Ecran>
      <Titre>Bonjour {u.prenoms}</Titre>
      <Texte discret>{LIBELLES_ROLE[u.role]}</Texte>
      <Bouton
        libelle="📷  Scanner un appareil"
        surAppui={() => router.push('/scanner')}
      />
      {SIGNALEMENT.includes(u.role) && (
        <Bouton
          libelle="⭐  Signaler un comportement"
          variante="secondaire"
          surAppui={() => router.push('/signaler-comportement')}
        />
      )}
      <Texte discret>
        Le reste de la gestion (élèves, résultats, annonces…) se fait sur le
        site de l&apos;école.
      </Texte>
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
