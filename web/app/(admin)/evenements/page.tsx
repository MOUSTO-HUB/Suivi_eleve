import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Badge,
  cellule,
  EnTete,
  parametre,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { peutGererDossiers } from '@/lib/profil';
import {
  aujourdHui,
  dateFr,
  heureFr,
  LIBELLES_STATUT_EVENEMENT,
  type EvenementListe,
  type StatutAnnonce,
} from '@/lib/types';

export const metadata: Metadata = { title: 'Événements · Suivi_eleve' };

const COULEUR: Record<StatutAnnonce, 'gris' | 'vert' | 'orange'> = {
  BROUILLON: 'gris',
  PROGRAMMEE: 'orange',
  ENVOYEE: 'vert',
  ANNULEE: 'gris',
};
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** « 2026-11 » décalé de n mois. */
const decaler = (mois: string, n: number) => {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

/** Jours (AAAA-MM-JJ) couverts par un événement, de son début à sa fin. */
function joursCouverts(e: EvenementListe): string[] {
  const debut = e.dateDebut.slice(0, 10);
  const fin = (e.dateFin ?? e.dateDebut).slice(0, 10);
  const jours: string[] = [];
  for (
    let d = new Date(`${debut}T00:00:00Z`);
    d.toISOString().slice(0, 10) <= fin && jours.length < 62;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    jours.push(d.toISOString().slice(0, 10));
  }
  return jours;
}

export default async function PageEvenements(props: PageProps<'/evenements'>) {
  const demande = parametre((await props.searchParams).mois);
  const mois =
    demande && /^\d{4}-(0[1-9]|1[0-2])$/.test(demande)
      ? demande
      : aujourdHui().slice(0, 7);
  const [annee, numero] = mois.split('-').map(Number);
  const nbJours = new Date(Date.UTC(annee, numero, 0)).getUTCDate();
  const [evenements, gestion] = await Promise.all([
    lireApi<EvenementListe[]>(
      `/evenements?du=${mois}-01&au=${mois}-${String(nbJours).padStart(2, '0')}`,
    ),
    peutGererDossiers(),
  ]);

  const parJour = new Map<string, EvenementListe[]>();
  for (const e of evenements)
    for (const j of joursCouverts(e))
      parJour.set(j, [...(parJour.get(j) ?? []), e]);

  // Grille du lundi au dimanche ; cases vides avant le 1er du mois.
  const decalage =
    (new Date(Date.UTC(annee, numero - 1, 1)).getUTCDay() + 6) % 7;
  const cases = [
    ...Array<null>(decalage).fill(null),
    ...Array.from(
      { length: nbJours },
      (_, i) => `${mois}-${String(i + 1).padStart(2, '0')}`,
    ),
  ];
  const nomMois = new Date(Date.UTC(annee, numero - 1, 1)).toLocaleDateString(
    'fr-FR',
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  );
  const aujourdhui = aujourdHui();

  return (
    <>
      <EnTete
        titre="Événements"
        sousTitre="Réunions, sorties, fêtes et examens : calendrier et réponses des familles"
        actions={
          gestion && (
            <Link className={styles.bouton} href="/evenements/nouveau">
              Nouvel événement
            </Link>
          )
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          className={styles.boutonSecondaire}
          href={`/evenements?mois=${decaler(mois, -1)}`}
        >
          ← Mois précédent
        </Link>
        <h2 className="text-lg font-semibold capitalize">{nomMois}</h2>
        <Link
          className={styles.boutonSecondaire}
          href={`/evenements?mois=${decaler(mois, 1)}`}
        >
          Mois suivant →
        </Link>
      </div>

      <div className="mb-6 hidden overflow-hidden rounded-2xl border border-marque-100 bg-white shadow-sm shadow-marque-900/5 sm:block">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-600">
          {JOURS.map((j) => (
            <div key={j} className="py-2">
              {j}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cases.map((jour, i) => (
            <div
              key={jour ?? `vide-${i}`}
              className="min-h-24 border-b border-r border-slate-100 p-1.5 text-xs"
            >
              {jour && (
                <>
                  <p
                    className={`mb-1 font-medium ${
                      jour === aujourdhui
                        ? 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-marque-700 text-white'
                        : 'text-slate-500'
                    }`}
                  >
                    {Number(jour.slice(8))}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {(parJour.get(jour) ?? []).map((e) => (
                      <li key={e.id}>
                        <Link
                          href={`/evenements/${e.id}`}
                          className={`block truncate rounded px-1.5 py-0.5 ${
                            e.statut === 'ANNULEE'
                              ? 'bg-slate-100 text-slate-500 line-through'
                              : e.statut === 'ENVOYEE'
                                ? 'bg-marque-50 text-marque-800 hover:bg-marque-100'
                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                          }`}
                          title={e.titre}
                        >
                          {jour === e.dateDebut.slice(0, 10) &&
                            `${heureFr(e.dateDebut)} `}
                          {e.titre}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <Tableau
        entetes={['Date', 'Événement', 'Public', 'Statut', 'Réponses']}
        vide={
          evenements.length === 0 ? 'Aucun événement ce mois-ci.' : undefined
        }
      >
        {evenements.map((e) => (
          <tr key={e.id} className="hover:bg-marque-50/60">
            <td className={cellule}>
              {dateFr(e.dateDebut.slice(0, 10))} à {heureFr(e.dateDebut)}
              {e.dateFin &&
                e.dateFin.slice(0, 10) !== e.dateDebut.slice(0, 10) && (
                  <span className="block text-xs text-slate-500">
                    jusqu&apos;au {dateFr(e.dateFin.slice(0, 10))}
                  </span>
                )}
            </td>
            <td className={cellule}>
              <Link className={styles.lien} href={`/evenements/${e.id}`}>
                {e.titre}
              </Link>
              {e.lieu && (
                <span className="block text-xs text-slate-500">{e.lieu}</span>
              )}
            </td>
            <td className={cellule}>
              {e.cible === 'ECOLE'
                ? "Toute l'école"
                : e.classes.map((c) => c.nom).join(', ')}
            </td>
            <td className={cellule}>
              <Badge couleur={COULEUR[e.statut]}>
                {LIBELLES_STATUT_EVENEMENT[e.statut]}
              </Badge>
            </td>
            <td className={cellule}>
              {e.demandeReponse
                ? `${e.reponses.oui} oui · ${e.reponses.non} non`
                : '—'}
            </td>
          </tr>
        ))}
      </Tableau>
    </>
  );
}
