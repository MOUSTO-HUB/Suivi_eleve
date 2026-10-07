import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Carte,
  cellule,
  Champ,
  EnTete,
  Liste,
  parametre,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import type { Classe, Enseignement, Matiere, Personne } from '@/lib/types';
import {
  creerMatiere,
  definirEnseignements,
  modifierCoefficient,
} from './actions';

export const metadata: Metadata = {
  title: 'Matières et professeurs · Suivi_eleve',
};

export default async function PageMatieres(
  props: PageProps<'/resultats/matieres'>,
) {
  const classeId = parametre((await props.searchParams).classeId);
  const [matieres, classes, enseignants, enseignements] = await Promise.all([
    lireApi<Matiere[]>('/matieres'),
    lireApi<Classe[]>('/classes'),
    lireApi<Personne[]>('/personnel?role=ENSEIGNANT'),
    classeId
      ? lireApi<Enseignement[]>(`/classes/${classeId}/enseignements`)
      : Promise.resolve([]),
  ]);
  const classe = classes.find((c) => c.id === classeId);

  return (
    <>
      <EnTete
        titre="Matières et professeurs"
        sousTitre="Le professeur d'une matière dans une classe est celui qui en saisit les moyennes."
        actions={
          <Link className={styles.boutonSecondaire} href="/resultats">
            Retour
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Carte titre="Professeurs par classe">
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
                Afficher
              </button>
            </form>
            {classe && (
              <FormulaireAction
                action={definirEnseignements.bind(null, classe.id)}
                libelle={`Enregistrer pour ${classe.nom}`}
              >
                <Tableau entetes={['Enseignée', 'Matière', 'Professeur']}>
                  {matieres.map((m) => {
                    const actuel = enseignements.find(
                      (e) => e.matiere.id === m.id,
                    );
                    return (
                      <tr key={m.id}>
                        <td className={cellule}>
                          <input
                            type="checkbox"
                            name="matiereId"
                            value={m.id}
                            defaultChecked={Boolean(actuel)}
                            aria-label={`${m.nom} enseignée en ${classe.nom}`}
                          />
                        </td>
                        <td className={cellule}>{m.nom}</td>
                        <td className={cellule}>
                          <Liste
                            name={`prof-${m.id}`}
                            defaultValue={actuel?.enseignant?.id ?? ''}
                            aria-label={`Professeur de ${m.nom}`}
                          >
                            <option value="">Non désigné</option>
                            {enseignants.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.prenoms} {p.nom}
                              </option>
                            ))}
                          </Liste>
                        </td>
                      </tr>
                    );
                  })}
                </Tableau>
              </FormulaireAction>
            )}
          </Carte>
        </div>
        <div className="flex flex-col gap-6">
          <Carte titre="Matières de l'école">
            <ul className="mb-4 flex flex-col gap-2">
              {matieres.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>{m.nom}</span>
                  <FormulaireAction
                    action={modifierCoefficient.bind(null, m.id)}
                    libelle="OK"
                    style="boutonSecondaire"
                    className="flex items-center gap-2"
                  >
                    <Saisie
                      name="coefficient"
                      defaultValue={String(m.coefficient).replace('.', ',')}
                      inputMode="decimal"
                      className="w-16"
                      aria-label={`Coefficient de ${m.nom}`}
                    />
                  </FormulaireAction>
                </li>
              ))}
            </ul>
            <p className="mb-3 text-xs text-slate-500">
              Le coefficient figure sur le bulletin ; il n’entre dans aucun
              calcul.
            </p>
          </Carte>
          <Carte titre="Nouvelle matière">
            <FormulaireAction
              action={creerMatiere}
              libelle="Ajouter"
              reinitialiserSiSucces
            >
              <Champ libelle="Nom" obligatoire>
                <Saisie name="nom" required maxLength={60} />
              </Champ>
              <Champ libelle="Coefficient">
                <Saisie
                  name="coefficient"
                  inputMode="decimal"
                  defaultValue="1"
                  className="w-24"
                />
              </Champ>
            </FormulaireAction>
          </Carte>
        </div>
      </div>
    </>
  );
}
