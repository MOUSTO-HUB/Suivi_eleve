import { redirect } from 'next/navigation';
import { Bandeau } from '@/components/bandeau';
import { profilCourant } from '@/lib/profil';

/** Espace parents : réservé aux comptes PARENT (le personnel a son propre espace). */
export default async function LayoutParent({ children }: LayoutProps<'/'>) {
  const profil = await profilCourant();
  if (profil.role !== 'PARENT') redirect('/eleves');
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Bandeau
        accueil="/parent"
        espace="Espace parents"
        utilisateur={`${profil.prenoms} ${profil.nom}`}
        largeur="max-w-3xl"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
