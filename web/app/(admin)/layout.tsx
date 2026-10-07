import { redirect } from 'next/navigation';
import { Bandeau } from '@/components/bandeau';
import { Navigation } from '@/components/navigation';
import { BandeauAbonnement } from '@/components/abonnement';
import { profilCourant } from '@/lib/profil';
import { LIBELLES_ROLE } from '@/lib/types';

export default async function LayoutAdmin({ children }: LayoutProps<'/'>) {
  const profil = await profilCourant();
  // Les parents ont leur propre espace.
  if (profil.role === 'PARENT') redirect('/parent');
  // Le concepteur a son espace, sans accès aux données des écoles.
  if (profil.role === 'SUPER_ADMIN') redirect('/plateforme');
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Bandeau
        accueil="/eleves"
        espace={LIBELLES_ROLE[profil.role]}
        utilisateur={`${profil.prenoms} ${profil.nom}`}
        compte="/compte"
      />
      <Navigation role={profil.role} />
      {profil.role === 'ADMIN' && <BandeauAbonnement />}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
