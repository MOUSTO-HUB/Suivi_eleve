import { redirect } from 'next/navigation';
import { Bandeau } from '@/components/bandeau';
import { Menu } from '@/components/navigation';
import { profilCourant } from '@/lib/profil';
import { accueilDuRole } from '@/lib/types';

const LIENS = [
  { href: '/plateforme', libelle: 'Tableau de bord', icone: '📈' },
  { href: '/plateforme/ecoles', libelle: 'Écoles', icone: '🏫' },
  {
    href: '/plateforme/ecoles/nouvelle',
    libelle: 'Nouvelle école',
    icone: '➕',
  },
];

/** Espace concepteur : réservé au SUPER_ADMIN (aucune donnée d'élève). */
export default async function LayoutPlateforme({ children }: LayoutProps<'/'>) {
  const profil = await profilCourant();
  if (profil.role !== 'SUPER_ADMIN') redirect(accueilDuRole(profil.role));
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Bandeau
        accueil="/plateforme"
        espace="Concepteur"
        utilisateur={`${profil.prenoms} ${profil.nom}`}
        compte="/plateforme/compte"
      />
      <Menu liens={LIENS} libelle="Espace concepteur" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
