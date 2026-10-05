import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Badge,
  Carte,
  cellule,
  Champ,
  EnTete,
  Liste,
  Pagination,
  parametre,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi, lireApiOuNull } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import {
  aujourdHui,
  dateFr,
  peutFaireAppel,
  peutJustifier,
  type Absence,
  type Classe,
  type ClasseDetail,
  type Page,
} from '@/lib/types';
import { faireAppel, justifierAbsence, supprimerAbsence } from './actions';

export const metadata: Metadata = { title: 'Absences · Suivi_eleve' };

const CRENEAUX = [
  '08h-10h',
  '10h-12h',
  '12h-14h',
  '15h-17h',
  'matinée',
  'après-midi',
  'journée',
];

export default async function PageAbsences(props: PageProps<'/absences'>) {
  const sp = await props.searchParams;
  const appel = parametre(sp.appel);
  const filtres = {
    classeId: parametre(sp.classeId),
    justifiee: parametre(sp.justifiee),
    du: parametre(sp.du),
    au: parametre(sp.au),
  };
  const requete = new URLSearchParams({ page: parametre(sp.page) ?? '1' });
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur) requete.set(cle, valeur);
  }

  const profil = await profilCourant();
  const [absences, classes, classeAppel] = await Promise.all([
    lireApi<Page<Absence> & { nonJustifiees: number }>(
      `/absences?${requete.toString()}`,
    ),
    lireApi<Classe[]>('/classes'),
    appel
      ? lireApiOuNull<ClasseDetail>(`/classes/${appel}`)
      : Promise.resolve(null),
  ]);
  const appelPossible = peutFaireAppel(profil.role);
  const vieScolaire = peutJustifier(profil.role);

  return (
    <>
      <EnTete
        titre="Absences"
        sousTitre="Chaque absence non justifiée prévient aussitôt la famille par SMS, email et notification."
      />

      {appelPossible && (
        <Carte titre="Faire l'appel">
          <form className="mb-4 flex flex-wrap items-end gap-3">
            <Champ libelle="Classe">
              <Liste name="appel" defaultValue={appel ?? ''} required>
                <option value="" disabled>
                  Choisir la classe…
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

          {classeAppel && (
            <FormulaireAction
              action={faireAppel}
              libelle="Enregistrer les absences"
              confirmation="Enregistrer ces absences ? Les familles des absents non justifiés seront prévenues."
              reinitialiserSiSucces
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Champ libelle="Date" obligatoire>
                  <Saisie
                    type="date"
                    name="date"
                    defaultValue={aujourdHui()}
                    max={aujourdHui()}
                    required
                  />
                </Champ>
                <Champ libelle="Créneau" obligatoire>
                  <Saisie
                    name="creneau"
                    list="creneaux-appel"
                    required
                    maxLength={60}
                    placeholder="08h-10h"
                  />
                  <datalist id="creneaux-appel">
                    {CRENEAUX.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Champ>
                <Champ libelle="Matière">
                  <Saisie name="matiere" maxLength={60} />
                </Champ>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">
                  Élèves absents de {classeAppel.nom} (
                  {classeAppel.eleves.length} élèves)
                </legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {classeAppel.eleves.map((e) => (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-red-400 has-[:checked]:bg-red-50 dark:border-zinc-700 dark:has-[:checked]:bg-red-950"
                    >
                      <input type="checkbox" name="eleveIds" value={e.id} />
                      {e.nom} {e.prenoms}
                    </label>
                  ))}
                </div>
              </fieldset>
              <details className="text-sm">
                <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
                  La famille a déjà prévenu ?
                </summary>
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="justifiee" /> Absence(s) déjà
                    justifiée(s) : ne pas envoyer de message
                  </label>
                  <Saisie
                    name="motif"
                    maxLength={300}
                    placeholder="Motif (ex. malade, la mère a appelé)"
                  />
                </div>
              </details>
            </FormulaireAction>
          )}
        </Carte>
      )}

      <form
        role="search"
        className="my-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_1fr_150px_150px_auto] dark:border-zinc-800 dark:bg-zinc-900"
      >
        <Liste
          name="classeId"
          defaultValue={filtres.classeId ?? ''}
          aria-label="Classe"
        >
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </Liste>
        <Liste
          name="justifiee"
          defaultValue={filtres.justifiee ?? ''}
          aria-label="Justification"
        >
          <option value="">Toutes les absences</option>
          <option value="false">Non justifiées</option>
          <option value="true">Justifiées</option>
        </Liste>
        <Saisie
          type="date"
          name="du"
          defaultValue={filtres.du}
          aria-label="Du"
        />
        <Saisie
          type="date"
          name="au"
          defaultValue={filtres.au}
          aria-label="Au"
        />
        <button type="submit" className={styles.bouton}>
          Filtrer
        </button>
      </form>

      <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
        {absences.total} absence(s), dont {absences.nonJustifiees} non
        justifiée(s).
      </p>
      <Tableau
        entetes={['Date', 'Élève', 'Classe', 'Créneau', 'Justification', '']}
        vide={
          absences.total === 0 ? 'Aucune absence pour ces critères.' : undefined
        }
      >
        {absences.elements.map((a) => (
          <tr key={a.id} className="align-top">
            <td className={cellule}>{dateFr(a.date)}</td>
            <td className={cellule}>
              <Link className={styles.lien} href={`/eleves/${a.eleve.id}`}>
                {a.eleve.nom} {a.eleve.prenoms}
              </Link>
            </td>
            <td className={cellule}>{a.eleve.classe?.nom ?? '—'}</td>
            <td className={cellule}>
              {a.creneau}
              {a.matiere && (
                <span className="block text-xs text-zinc-500">{a.matiere}</span>
              )}
            </td>
            <td className={`${cellule} whitespace-normal`}>
              {a.justifiee ? (
                <>
                  <Badge couleur="vert">Justifiée</Badge>
                  {a.motif && <span className="block text-xs">{a.motif}</span>}
                </>
              ) : (
                <Badge couleur="orange">Non justifiée</Badge>
              )}
              {a.justificationParent && (
                <span className="mt-1 block max-w-xs text-xs text-zinc-600 dark:text-zinc-400">
                  Famille : « {a.justificationParent} »
                </span>
              )}
            </td>
            <td className={cellule}>
              {vieScolaire && (
                <div className="flex flex-col gap-2">
                  {!a.justifiee && (
                    <details>
                      <summary className="cursor-pointer text-sm text-emerald-700 dark:text-emerald-400">
                        Justifier
                      </summary>
                      <FormulaireAction
                        action={justifierAbsence.bind(null, a.id)}
                        libelle="Valider"
                        className="mt-2 flex flex-col gap-2"
                      >
                        <Saisie
                          name="motif"
                          required
                          maxLength={300}
                          defaultValue={a.justificationParent ?? ''}
                          placeholder="Motif"
                        />
                      </FormulaireAction>
                    </details>
                  )}
                  <FormulaireAction
                    action={supprimerAbsence.bind(null, a.id)}
                    libelle="Supprimer"
                    style="boutonDanger"
                    confirmation="Supprimer cette absence saisie par erreur ?"
                    className="flex flex-col"
                  />
                </div>
              )}
            </td>
          </tr>
        ))}
      </Tableau>
      <Pagination
        page={absences.page}
        pages={absences.pages}
        total={absences.total}
        chemin="/absences"
        parametres={filtres}
      />
    </>
  );
}
