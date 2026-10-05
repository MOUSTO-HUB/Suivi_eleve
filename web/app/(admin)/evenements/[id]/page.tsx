import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { FormulaireAction } from '@/components/formulaire-action';
import { RafraichissementAuto } from '@/components/rafraichissement-auto';
import {
  Alerte,
  Badge,
  Carte,
  cellule,
  EnTete,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApiOuNull } from '@/lib/api';
import { peutGererDossiers } from '@/lib/profil';
import {
  dateFr,
  dateHeureFr,
  heureFr,
  LIBELLES_STATUT_EVENEMENT,
  type EvenementSuivi,
} from '@/lib/types';
import {
  annulerEvenement,
  publierEvenement,
  supprimerEvenement,
} from '../actions';

export const metadata: Metadata = { title: 'Événement · Suivi_eleve' };

function Compteur({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {libelle}
      </p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {valeur}
      </p>
    </div>
  );
}

function Info({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {libelle}
      </dt>
      <dd className="mt-1 whitespace-pre-line text-sm">{children}</dd>
    </div>
  );
}

export default async function PageEvenement(
  props: PageProps<'/evenements/[id]'>,
) {
  const { id } = await props.params;
  const [e, gestion] = await Promise.all([
    lireApiOuNull<EvenementSuivi>(`/evenements/${id}`),
    peutGererDossiers(),
  ]);
  if (!e) notFound();
  const debut = e.dateDebut.slice(0, 10);
  const fin = e.dateFin?.slice(0, 10);
  const envoye = e.statut === 'ENVOYEE';
  const avenir = new Date(e.dateDebut) > new Date();

  return (
    <>
      <EnTete
        titre={e.titre}
        sousTitre={[
          `${dateFr(debut)} à ${heureFr(e.dateDebut)}${fin && fin !== debut ? ` au ${dateFr(fin)}` : ''}`,
          e.lieu,
          e.auteur && `publié par ${e.auteur.prenoms} ${e.auteur.nom}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <Link
            className={styles.boutonSecondaire}
            href={`/evenements?mois=${debut.slice(0, 7)}`}
          >
            Calendrier
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge
          couleur={
            envoye ? 'vert' : e.statut === 'PROGRAMMEE' ? 'orange' : 'gris'
          }
        >
          {LIBELLES_STATUT_EVENEMENT[e.statut]}
        </Badge>
        {e.envoyeeLe && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            le {dateHeureFr(e.envoyeeLe)}
          </span>
        )}
        {envoye && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            · rappel de la veille{' '}
            {e.rappelEnvoyeLe
              ? `envoyé le ${dateHeureFr(e.rappelEnvoyeLe)}`
              : avenir
                ? 'programmé à 18h'
                : 'non envoyé'}
          </span>
        )}
        <RafraichissementAuto
          actif={e.suivi.enCours || e.statut === 'PROGRAMMEE'}
        />
      </div>

      {e.statut === 'PROGRAMMEE' && e.programmeeLe && (
        <div className="mb-4">
          <Alerte type="info">
            Les familles seront prévenues le {dateHeureFr(e.programmeeLe)}.
          </Alerte>
        </div>
      )}
      {e.statut === 'ANNULEE' && (
        <div className="mb-4">
          <Alerte type="info">
            Événement annulé
            {e.envoyeeLe
              ? ' : les familles ont reçu un message d’annulation.'
              : ' avant tout envoi aux familles.'}
          </Alerte>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <Carte titre="L'événement">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Info libelle="Description">{e.description}</Info>
            </div>
            {e.modalites && <Info libelle="Modalités">{e.modalites}</Info>}
            <Info libelle="Public">
              {e.cible === 'ECOLE'
                ? "Toute l'école"
                : e.classes.map((c) => c.nom).join(', ')}
            </Info>
            {e.question && (
              <Info libelle="Question aux parents">{e.question}</Info>
            )}
            {e.pieceJointe && (
              <Info libelle="Pièce jointe">
                <a
                  className={styles.lien}
                  href={`/telechargements/piece-jointe-evenement/${e.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {e.pieceJointe === 'PDF' ? 'Ouvrir le PDF' : "Voir l'image"}
                </a>
              </Info>
            )}
          </dl>
        </Carte>

        {gestion && e.statut !== 'ANNULEE' && (
          <div className="flex flex-wrap gap-2">
            {e.statut === 'BROUILLON' && (
              <>
                <FormulaireAction
                  action={publierEvenement.bind(null, e.id)}
                  libelle="Prévenir les familles"
                  confirmation="Prévenir maintenant les familles concernées ?"
                  className="flex"
                />
                <FormulaireAction
                  action={supprimerEvenement.bind(null, e.id)}
                  libelle="Supprimer le brouillon"
                  style="boutonDanger"
                  confirmation="Supprimer ce brouillon ?"
                  className="flex"
                />
              </>
            )}
            {e.statut !== 'BROUILLON' && avenir && (
              <FormulaireAction
                action={annulerEvenement.bind(null, e.id)}
                libelle="Annuler l'événement"
                style="boutonDanger"
                confirmation={
                  envoye
                    ? 'Annuler cet événement ? Les familles prévenues recevront un message d’annulation.'
                    : "Annuler cet événement ? Aucun message n'a encore été envoyé."
                }
                className="flex flex-col gap-2"
              />
            )}
          </div>
        )}

        {e.envoyeeLe && (
          <Carte titre="Familles prévenues">
            <div className="grid gap-6 sm:grid-cols-3">
              <Compteur libelle="Familles" valeur={e.suivi.familles} />
              <Compteur libelle="Ont lu" valeur={e.suivi.lues} />
              <Compteur
                libelle="Pas encore lu"
                valeur={e.suivi.familles - e.suivi.lues}
              />
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Détail de chaque envoi dans le{' '}
              <Link className={styles.lien} href="/notifications">
                journal des notifications
              </Link>
              .
            </p>
          </Carte>
        )}

        {e.reponses && (
          <Carte titre="Réponses des parents">
            <div className="mb-4 grid gap-6 sm:grid-cols-3">
              <Compteur libelle="Oui" valeur={e.reponses.oui} />
              <Compteur libelle="Non" valeur={e.reponses.non} />
              <Compteur
                libelle="Sans réponse"
                valeur={e.reponses.sansReponse}
              />
            </div>
            <Tableau
              entetes={['Élève', 'Classe', 'Réponse', 'Commentaire', 'Par']}
              vide={
                e.reponses.eleves.length === 0
                  ? 'Aucun élève concerné.'
                  : undefined
              }
            >
              {e.reponses.eleves.map((r) => (
                <tr key={r.id}>
                  <td className={cellule}>
                    <Link className={styles.lien} href={`/eleves/${r.id}`}>
                      {r.prenoms} {r.nom}
                    </Link>
                  </td>
                  <td className={cellule}>{r.classe?.nom ?? '—'}</td>
                  <td className={cellule}>
                    {r.reponse === null ? (
                      <span className="text-zinc-500">En attente</span>
                    ) : (
                      <Badge couleur={r.reponse ? 'vert' : 'orange'}>
                        {r.reponse ? 'Oui' : 'Non'}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
                    {r.commentaire ?? ''}
                  </td>
                  <td className={cellule}>
                    {r.repondant && `${r.repondant.prenoms} ${r.repondant.nom}`}
                    {r.reponduLe && (
                      <span className="block text-xs text-zinc-500">
                        {dateHeureFr(r.reponduLe)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </Tableau>
          </Carte>
        )}
      </div>
    </>
  );
}
