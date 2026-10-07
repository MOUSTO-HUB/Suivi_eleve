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
import { dateFr, type Absence, type Page } from '@/lib/types';
import { donnerMotif } from '../../actions';

export const metadata: Metadata = { title: 'Absences · Suivi_eleve' };

/** Absences relevées en classe ; le parent transmet le motif à la vie scolaire. */
export default async function Absences(props: PageProps<'/parent/absences'>) {
  const { enfants, enfant } = await enfantChoisi(props.searchParams);
  const liste = enfant
    ? (
        await lireApi<Page<Absence>>(
          `/absences?eleveId=${enfant.id}&parPage=50`,
        )
      ).elements
    : [];
  return (
    <>
      <TitreParent
        titre="Absences"
        sousTitre={enfant && `${enfant.prenoms} ${enfant.nom}`}
      />
      <ChoixEnfant
        enfants={enfants}
        actif={enfant?.id}
        chemin="/parent/absences"
      />
      {liste.length === 0 && <Vide>Aucune absence relevée.</Vide>}
      <ul className="flex flex-col gap-3">
        {liste.map((a) => (
          <li key={a.id}>
            <Carte>
              <p className="font-semibold">
                {dateFr(a.date)} · {a.creneau}
                {a.matiere && (
                  <span className="font-normal text-slate-500">
                    {' '}
                    · {a.matiere}
                  </span>
                )}
              </p>
              <p className="my-2">
                {a.justifiee ? (
                  <Badge couleur="vert">
                    Justifiée{a.motif ? ` : ${a.motif}` : ''}
                  </Badge>
                ) : a.justificationParent ? (
                  <Badge>Motif transmis : {a.justificationParent}</Badge>
                ) : (
                  <Badge couleur="orange">Non justifiée</Badge>
                )}
              </p>
              {!a.justifiee && (
                <FormulaireAction
                  action={donnerMotif.bind(null, a.id)}
                  libelle={
                    a.justificationParent
                      ? 'Modifier le motif'
                      : "Envoyer le motif à l'école"
                  }
                  style="boutonSecondaire"
                >
                  <Champ libelle="Motif de l'absence">
                    <Zone
                      name="motif"
                      rows={2}
                      maxLength={300}
                      required
                      defaultValue={a.justificationParent ?? ''}
                      placeholder="Ex. maladie, rendez-vous médical…"
                    />
                  </Champ>
                </FormulaireAction>
              )}
            </Carte>
          </li>
        ))}
      </ul>
    </>
  );
}
