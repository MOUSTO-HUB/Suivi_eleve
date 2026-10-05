import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerte, EnTete, styles } from '@/components/ui';

export const metadata: Metadata = { title: 'Accès refusé · Suivi_eleve' };

export default function AccesRefuse() {
  return (
    <>
      <EnTete titre="Accès refusé" />
      <Alerte>
        Votre rôle ne permet pas d&apos;ouvrir cette page. Adressez-vous à la
        direction si vous pensez en avoir besoin.
      </Alerte>
      <p className="mt-4">
        <Link className={styles.bouton} href="/eleves">
          Retour aux élèves
        </Link>
      </p>
    </>
  );
}
