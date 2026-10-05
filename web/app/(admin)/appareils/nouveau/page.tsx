import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChampsAppareil } from '@/components/appareils';
import { FormulaireAction } from '@/components/formulaire-action';
import { Alerte, Carte, EnTete, parametre, styles } from '@/components/ui';
import { lireApiOuNull } from '@/lib/api';
import type { EleveDetail } from '@/lib/types';
import { creerAppareil } from '../actions';

export const metadata: Metadata = { title: 'Nouvel appareil · Suivi_eleve' };

/** Enregistrement d'un appareil, ouvert depuis la fiche de l'élève. */
export default async function PageNouvelAppareil(
  props: PageProps<'/appareils/nouveau'>,
) {
  const eleveId = parametre((await props.searchParams).eleveId);
  if (!eleveId) {
    return (
      <>
        <EnTete titre="Nouvel appareil" />
        <Alerte type="info">
          Ouvrez la fiche de l&apos;élève puis choisissez « Ajouter un appareil
          ».{' '}
          <Link className={styles.lien} href="/eleves">
            Aller à la liste des élèves
          </Link>
        </Alerte>
      </>
    );
  }
  const eleve = await lireApiOuNull<EleveDetail>(`/eleves/${eleveId}`);
  if (!eleve) notFound();

  return (
    <>
      <EnTete
        titre="Nouvel appareil"
        sousTitre={`Pour ${eleve.prenoms} ${eleve.nom} · ${eleve.classe?.nom ?? 'sans classe'}`}
        actions={
          <Link
            className={styles.boutonSecondaire}
            href={`/eleves/${eleve.id}`}
          >
            Annuler
          </Link>
        }
      />
      <Carte>
        <FormulaireAction
          action={creerAppareil}
          libelle="Enregistrer l'appareil"
        >
          <input type="hidden" name="eleveId" value={eleve.id} />
          <ChampsAppareil />
        </FormulaireAction>
      </Carte>
    </>
  );
}
