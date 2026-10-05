import { redirect } from 'next/navigation';
import { profilCourant } from '@/lib/profil';
import { accueilDuRole } from '@/lib/types';

export default async function Accueil() {
  redirect(accueilDuRole((await profilCourant()).role));
}
