import { redirect } from 'next/navigation';
import { profilCourant } from '@/lib/profil';

/** Les pages de l'espace parents demandent d'abord le consentement du tuteur. */
export default async function LayoutEspace({
  children,
}: LayoutProps<'/parent'>) {
  const { consentement } = await profilCourant();
  if (consentement && !consentement.accepte) redirect('/parent/consentement');
  return children;
}
