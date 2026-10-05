import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Carte,
  Champ,
  EnTete,
  Liste,
  parametre,
  styles,
} from '@/components/ui';
import { lireApi, lireApiOuNull } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import type { Classe, ClasseDetail, EleveDetail } from '@/lib/types';
import { signalerComportement } from '../actions';
import { ChampsComportement } from './champs-comportement';

export const metadata: Metadata = {
  title: 'Signaler un comportement · Suivi_eleve',
};

/** Ouvert depuis la fiche élève (eleveId) ou en choisissant la classe puis l'élève. */
export default async function PageNouveauComportement(
  props: PageProps<'/comportements/nouveau'>,
) {
  const sp = await props.searchParams;
  const eleveId = parametre(sp.eleveId);
  const classeId = parametre(sp.classeId);
  const [profil, eleve, classes, classe] = await Promise.all([
    profilCourant(),
    eleveId
      ? lireApiOuNull<EleveDetail>(`/eleves/${eleveId}`)
      : Promise.resolve(null),
    lireApi<Classe[]>('/classes'),
    !eleveId && classeId
      ? lireApiOuNull<ClasseDetail>(`/classes/${classeId}`)
      : Promise.resolve(null),
  ]);

  return (
    <>
      <EnTete
        titre="Signaler un comportement"
        sousTitre={
          eleve
            ? `${eleve.prenoms} ${eleve.nom} · ${eleve.classe?.nom ?? 'sans classe'}`
            : 'Félicitations, retards, indiscipline… La famille est prévenue par SMS, email et application.'
        }
        actions={
          <Link
            className={styles.boutonSecondaire}
            href={eleve ? `/eleves/${eleve.id}` : '/comportements'}
          >
            Annuler
          </Link>
        }
      />
      {!eleve && (
        <form className="mb-4 flex items-end gap-3">
          <Champ libelle="Classe">
            <Liste name="classeId" defaultValue={classeId ?? ''} required>
              <option value="" disabled>
                Choisir…
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Liste>
          </Champ>
          <button type="submit" className={styles.boutonSecondaire}>
            Afficher les élèves
          </button>
        </form>
      )}
      {(eleve || classe) && (
        <Carte>
          <FormulaireAction
            action={signalerComportement}
            libelle="Enregistrer"
            className="flex flex-col gap-6"
          >
            {eleve ? (
              <input type="hidden" name="eleveId" value={eleve.id} />
            ) : (
              <Champ libelle="Élève" obligatoire>
                <Liste name="eleveId" defaultValue="" required>
                  <option value="" disabled>
                    Choisir l&apos;élève…
                  </option>
                  {classe!.eleves.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom} {e.prenoms}
                    </option>
                  ))}
                </Liste>
              </Champ>
            )}
            <ChampsComportement direction={profil.role === 'ADMIN'} />
          </FormulaireAction>
        </Carte>
      )}
    </>
  );
}
