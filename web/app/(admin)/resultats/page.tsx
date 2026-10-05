import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Alerte,
  Carte,
  EnTete,
  Liste,
  parametre,
  styles,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import { peutGerer, type MesSaisies, type Periode } from '@/lib/types';

export const metadata: Metadata = { title: 'Résultats · Suivi_eleve' };

/** Point d'entrée : choix de la période, puis des saisies de l'utilisateur. */
export default async function PageResultats(props: PageProps<'/resultats'>) {
  const [periodes, saisies, profil] = await Promise.all([
    lireApi<Periode[]>('/resultats/periodes'),
    lireApi<MesSaisies>('/resultats/mes-saisies'),
    profilCourant(),
  ]);
  const periodeId =
    parametre((await props.searchParams).periodeId) ?? periodes[0]?.id;
  const gestion = peutGerer(profil.role);

  // Regroupe les matières par classe.
  const parClasse = new Map<
    string,
    { nom: string; matieres: MesSaisies['enseignements'] }
  >();
  for (const e of saisies.enseignements) {
    const entree = parClasse.get(e.classe.id) ?? {
      nom: e.classe.nom,
      matieres: [],
    };
    entree.matieres.push(e);
    parClasse.set(e.classe.id, entree);
  }

  return (
    <>
      <EnTete
        titre="Résultats"
        sousTitre="Chaque professeur saisit les moyennes de sa matière ; le professeur principal saisit la moyenne générale et le rang. Aucun calcul automatique."
        actions={
          gestion && (
            <Link
              className={styles.boutonSecondaire}
              href="/resultats/matieres"
            >
              Matières et professeurs
            </Link>
          )
        }
      />
      {!periodes.length ? (
        <Alerte type="info">
          Aucune période (trimestre) n’est définie pour l’année active.
        </Alerte>
      ) : (
        <>
          <form className="mb-6 flex items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Période
              <Liste name="periodeId" defaultValue={periodeId}>
                {periodes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.libelle}
                  </option>
                ))}
              </Liste>
            </label>
            <button type="submit" className={styles.boutonSecondaire}>
              Afficher
            </button>
          </form>

          <div className="grid gap-6 lg:grid-cols-2">
            <Carte titre={gestion ? 'Saisie par matière' : 'Mes matières'}>
              {parClasse.size === 0 ? (
                <p className="text-sm text-zinc-500">
                  Aucune matière ne vous est attribuée. La direction l’indique
                  dans « Matières et professeurs ».
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {[...parClasse.entries()].map(([classeId, c]) => (
                    <li key={classeId}>
                      <p className="mb-1 font-medium">{c.nom}</p>
                      <div className="flex flex-wrap gap-2">
                        {c.matieres.map((m) => (
                          <Link
                            key={m.matiere.id}
                            className={styles.boutonSecondaire}
                            href={`/resultats/saisie?classeId=${classeId}&periodeId=${periodeId}&matiereId=${m.matiere.id}`}
                          >
                            {m.matiere.nom}
                          </Link>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
            <Carte
              titre={
                gestion
                  ? 'Synthèse, publication et décisions'
                  : 'Mes classes (professeur principal)'
              }
            >
              {saisies.classesPrincipales.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Vous n’êtes professeur principal d’aucune classe.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {saisies.classesPrincipales.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="font-medium">{c.nom}</span>
                      <span className="flex gap-2">
                        <Link
                          className={styles.boutonSecondaire}
                          href={`/resultats/synthese?classeId=${c.id}&periodeId=${periodeId}`}
                        >
                          Synthèse
                        </Link>
                        <Link
                          className={styles.boutonSecondaire}
                          href={`/resultats/decisions?classeId=${c.id}`}
                        >
                          Décisions
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          </div>
        </>
      )}
    </>
  );
}
