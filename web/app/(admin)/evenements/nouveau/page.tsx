import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import { Carte, EnTete, styles } from '@/components/ui';
import { lireApi } from '@/lib/api';
import { peutGererDossiers } from '@/lib/profil';
import { aujourdHui, type Classe } from '@/lib/types';
import { creerEvenement } from '../actions';
import { ChampsEvenement } from './champs-evenement';

export const metadata: Metadata = { title: 'Nouvel événement · Suivi_eleve' };

export default async function PageNouvelEvenement() {
  if (!(await peutGererDossiers())) redirect('/acces-refuse');
  const classes = await lireApi<Classe[]>('/classes');

  return (
    <>
      <EnTete
        titre="Nouvel événement"
        sousTitre="Réunion, sortie, fête, examen… Les familles concernées reçoivent SMS, email et notification."
        actions={
          <Link className={styles.boutonSecondaire} href="/evenements">
            Annuler
          </Link>
        }
      />
      <Carte>
        <FormulaireAction
          action={creerEvenement}
          libelle="Publier l'événement"
          libelleEnCours="Publication…"
          confirmation="Publier cet événement et prévenir les familles concernées ?"
          className="flex flex-col gap-6"
        >
          <ChampsEvenement classes={classes} dateMin={aujourdHui()} />
        </FormulaireAction>
      </Carte>
    </>
  );
}
