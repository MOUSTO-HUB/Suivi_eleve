import type { Metadata } from 'next';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  ChoixEnfant,
  enfantChoisi,
  TitreParent,
  Vide,
} from '@/components/parent';
import { Badge, Carte, Champ, Zone } from '@/components/ui';
import { lireApi } from '@/lib/api';
import {
  designationAppareil,
  LIBELLES_STATUT_APPAREIL,
  signalementsPossibles,
  type Appareil,
  type Page,
} from '@/lib/types';
import { declarerPerte } from '../../actions';

export const metadata: Metadata = { title: 'Appareils · Suivi_eleve' };

/** Appareils enregistrés par l'école ; le parent peut déclarer une perte. */
export default async function Appareils(props: PageProps<'/parent/appareils'>) {
  const { enfants, enfant } = await enfantChoisi(props.searchParams);
  const liste = enfant
    ? (
        await lireApi<Page<Appareil>>(
          `/appareils?eleveId=${enfant.id}&parPage=50`,
        )
      ).elements
    : [];
  return (
    <>
      <TitreParent
        titre="Appareils"
        sousTitre={enfant && `${enfant.prenoms} ${enfant.nom}`}
      />
      <ChoixEnfant
        enfants={enfants}
        actif={enfant?.id}
        chemin="/parent/appareils"
      />
      {liste.length === 0 && (
        <Vide>Aucun appareil enregistré par l&apos;école.</Vide>
      )}
      <ul className="flex flex-col gap-3">
        {liste.map((a) => (
          <li key={a.id}>
            <Carte>
              <p className="text-lg font-semibold">{designationAppareil(a)}</p>
              <p className="text-sm text-zinc-500">
                Étiquette {a.codeCourt}
                {a.imei ? ` · IMEI ${a.imei}` : ''}
              </p>
              <p className="my-2">
                <Badge couleur={a.statut === 'ACTIF' ? 'vert' : 'orange'}>
                  {LIBELLES_STATUT_APPAREIL[a.statut]}
                </Badge>
              </p>
              {signalementsPossibles('PARENT', a.statut).includes(
                'DECLARE_PERDU',
              ) && (
                <details>
                  <summary className="cursor-pointer font-medium text-red-700 dark:text-red-400">
                    Déclarer perdu
                  </summary>
                  <div className="mt-3">
                    <FormulaireAction
                      action={declarerPerte.bind(null, a.id)}
                      libelle="Confirmer la perte"
                      style="boutonDanger"
                      confirmation="Déclarer cet appareil perdu ? L'école sera prévenue."
                    >
                      <Champ libelle="Où et quand l'avez-vous perdu ? (facultatif)">
                        <Zone name="commentaire" rows={2} maxLength={500} />
                      </Champ>
                    </FormulaireAction>
                  </div>
                </details>
              )}
            </Carte>
          </li>
        ))}
      </ul>
    </>
  );
}
