import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import { Carte, EnTete, parametre, styles } from '@/components/ui';
import { lireApi } from '@/lib/api';
import type { Classe } from '@/lib/types';
import { creerAnnonce } from '../actions';
import { ChampsAnnonce } from './champs-annonce';

export const metadata: Metadata = { title: 'Nouvelle annonce · Suivi_eleve' };

export default async function PageNouvelleAnnonce(
  props: PageProps<'/annonces/nouvelle'>,
) {
  const type =
    parametre((await props.searchParams).type) === 'PAS_DE_COURS'
      ? 'PAS_DE_COURS'
      : 'LIBERATION_ANTICIPEE';
  const classes = await lireApi<Classe[]>('/classes');

  return (
    <>
      <EnTete
        titre="Prévenir les familles"
        sousTitre="Libération anticipée ou absence de cours : SMS, email et notification aux parents concernés."
        actions={
          <Link className={styles.boutonSecondaire} href="/annonces">
            Annuler
          </Link>
        }
      />
      <Carte>
        <FormulaireAction
          action={creerAnnonce}
          libelle="Prévenir les familles"
          libelleEnCours="Envoi…"
          confirmation="Confirmer l'envoi aux familles concernées ?"
          className="flex flex-col gap-6"
        >
          <ChampsAnnonce typeInitial={type} classes={classes} />
        </FormulaireAction>
      </Carte>
    </>
  );
}
