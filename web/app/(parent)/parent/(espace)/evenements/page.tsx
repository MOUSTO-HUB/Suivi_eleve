import type { Metadata } from 'next';
import Link from 'next/link';
import { TitreParent, Vide } from '@/components/parent';
import { Badge } from '@/components/ui';
import { lireApi } from '@/lib/api';
import { aujourdHui, dateFr, heureFr, type EvenementParent } from '@/lib/types';

export const metadata: Metadata = { title: 'Événements · Suivi_eleve' };

const plusJours = (jour: string, n: number) => {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Calendrier des trois prochains mois, regroupé par mois. */
export default async function Evenements() {
  const du = aujourdHui();
  const evenements = await lireApi<EvenementParent[]>(
    `/evenements?du=${du}&au=${plusJours(du, 92)}`,
  );
  const parMois = new Map<string, EvenementParent[]>();
  for (const e of evenements) {
    const mois = new Date(e.dateDebut).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Dakar',
    });
    parMois.set(mois, [...(parMois.get(mois) ?? []), e]);
  }

  return (
    <>
      <TitreParent
        titre="Événements"
        sousTitre="Réunions, sorties, fêtes… des trois prochains mois"
      />
      {evenements.length === 0 && (
        <Vide>Aucun événement prévu pour le moment.</Vide>
      )}
      {[...parMois].map(([mois, liste]) => (
        <section key={mois} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold capitalize">{mois}</h2>
          <ul className="flex flex-col gap-2">
            {liste.map((e) => {
              const attendue =
                e.demandeReponse &&
                e.statut === 'ENVOYEE' &&
                e.enfants.some((x) => x.reponse === null);
              return (
                <li key={e.id}>
                  <Link
                    href={`/parent/evenements/${e.id}`}
                    className="flex gap-4 rounded-xl border border-slate-200 bg-carte p-4 hover:border-marque-600"
                  >
                    <span className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-marque-50 py-2 text-marque-800">
                      <span className="text-2xl font-bold">
                        {new Date(e.dateDebut).getUTCDate()}
                      </span>
                      <span className="text-sm">{heureFr(e.dateDebut)}</span>
                    </span>
                    <span className="flex flex-col gap-1">
                      <span
                        className={`text-lg font-semibold ${e.statut === 'ANNULEE' ? 'text-slate-500 line-through' : ''}`}
                      >
                        {e.titre}
                      </span>
                      {e.lieu && (
                        <span className="text-slate-600">{e.lieu}</span>
                      )}
                      {e.dateFin &&
                        e.dateFin.slice(0, 10) !== e.dateDebut.slice(0, 10) && (
                          <span className="text-sm text-slate-500">
                            jusqu&apos;au {dateFr(e.dateFin.slice(0, 10))}
                          </span>
                        )}
                      <span>
                        {e.statut === 'ANNULEE' ? (
                          <Badge couleur="gris">Annulé</Badge>
                        ) : attendue ? (
                          <Badge couleur="orange">Réponse attendue</Badge>
                        ) : e.demandeReponse ? (
                          <Badge couleur="vert">Répondu</Badge>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
