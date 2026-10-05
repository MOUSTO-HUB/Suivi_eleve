import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChampsIdentite } from '@/components/champs-eleve';
import { FormulaireAction } from '@/components/formulaire-action';
import { Carte, EnTete, styles } from '@/components/ui';
import { lireApiOuNull } from '@/lib/api';
import type { EleveDetail } from '@/lib/types';
import { modifierEleve } from '../../actions';

export const metadata: Metadata = { title: 'Modifier un élève · Suivi_eleve' };

export default async function PageModifierEleve(
  props: PageProps<'/eleves/[id]/modifier'>,
) {
  const { id } = await props.params;
  const eleve = await lireApiOuNull<EleveDetail>(`/eleves/${id}`);
  if (!eleve) notFound();

  return (
    <>
      <EnTete
        titre={`Modifier ${eleve.prenoms} ${eleve.nom}`}
        sousTitre={`Matricule ${eleve.matricule}`}
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
          action={modifierEleve.bind(null, eleve.id)}
          libelle="Enregistrer"
        >
          <ChampsIdentite eleve={eleve} />
        </FormulaireAction>
      </Carte>
    </>
  );
}
