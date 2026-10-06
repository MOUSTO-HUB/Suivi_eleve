import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeStatut } from '@/components/appareils';
import { ChampsTuteur } from '@/components/champs-eleve';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Badge,
  Carte,
  Champ,
  EnTete,
  Liste,
  Saisie,
  styles,
} from '@/components/ui';
import { lireApi, lireApiOuNull } from '@/lib/api';
import { peutGererDossiers, profilCourant } from '@/lib/profil';
import {
  dateFr,
  designationAppareil,
  LIBELLES_LIEN,
  noteFr,
  type ResultatsEleve,
  type Comportement,
  LIBELLES_CATEGORIE,
  peutSignaler,
  voitPaiements,
  montant,
  type ListeRappels,
  type Absence,
  type Appareil,
  type Classe,
  type EleveDetail,
  type Page,
} from '@/lib/types';
import {
  ajouterTuteur,
  archiverEleve,
  effacerDonnees,
  changerClasse,
  restaurerEleve,
  retirerTuteur,
} from '../actions';

export const metadata: Metadata = { title: 'Fiche élève · Suivi_eleve' };

function Info({
  libelle,
  children,
}: {
  libelle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {libelle}
      </dt>
      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">
        {children}
      </dd>
    </div>
  );
}

export default async function FicheEleve(props: PageProps<'/eleves/[id]'>) {
  const { id } = await props.params;
  const [eleve, gestion, profil] = await Promise.all([
    lireApiOuNull<EleveDetail>(`/eleves/${id}`),
    peutGererDossiers(),
    profilCourant(),
  ]);
  if (!eleve) notFound();
  const [classes, appareils, absences, resultats, comportements, paiements] =
    await Promise.all([
      gestion ? lireApi<Classe[]>('/classes') : Promise.resolve([]),
      lireApi<Page<Appareil>>(`/appareils?eleveId=${eleve.id}&parPage=100`),
      lireApi<Page<Absence> & { nonJustifiees: number }>(
        `/absences?eleveId=${eleve.id}&parPage=5`,
      ),
      lireApi<ResultatsEleve>(`/resultats/eleves/${eleve.id}`),
      lireApi<Page<Comportement>>(
        `/comportements?eleveId=${eleve.id}&parPage=5`,
      ),
      // Réservé à la comptabilité, à la direction et au secrétariat.
      voitPaiements(profil.role)
        ? lireApi<ListeRappels>(
            `/rappels-paiement?eleveId=${eleve.id}&statut=EN_COURS`,
          )
        : Promise.resolve(null),
    ]);
  const archive = eleve.statut === 'ARCHIVE';

  return (
    <>
      <EnTete
        titre={`${eleve.prenoms} ${eleve.nom}`}
        sousTitre={`Matricule ${eleve.matricule}`}
        actions={
          <>
            <Link className={styles.boutonSecondaire} href="/eleves">
              Retour à la liste
            </Link>
            {gestion && (
              <Link
                className={styles.bouton}
                href={`/eleves/${eleve.id}/modifier`}
              >
                Modifier
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Carte
            titre="Identité"
            actions={
              archive ? (
                <Badge couleur="orange">Archivé</Badge>
              ) : (
                <Badge couleur="vert">Actif</Badge>
              )
            }
          >
            <dl className="grid gap-4 sm:grid-cols-3">
              <Info libelle="Genre">
                {eleve.genre === 'FEMININ' ? 'Féminin' : 'Masculin'}
              </Info>
              <Info libelle="Date de naissance">
                {dateFr(eleve.dateNaissance)}
              </Info>
              <Info libelle="Âge">{eleve.age} ans</Info>
              <Info libelle="Classe">{eleve.classe?.nom ?? 'Sans classe'}</Info>
              <Info libelle="Téléphone">{eleve.telephone ?? '—'}</Info>
              <Info libelle="Inscrit le">{dateFr(eleve.dateInscription)}</Info>
            </dl>
          </Carte>

          <Carte titre="Tuteurs">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {eleve.tuteurs.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div className="text-sm">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      <Link className={styles.lien} href={`/tuteurs/${t.id}`}>
                        {t.prenoms} {t.nom}
                      </Link>{' '}
                      <span className="text-zinc-500">
                        · {LIBELLES_LIEN[t.lien]}
                      </span>{' '}
                      {t.principal && <Badge couleur="vert">Principal</Badge>}
                    </p>
                    <p className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {t.contact1}
                      {t.contact2 && ` · ${t.contact2}`}
                      {t.email && ` · ${t.email}`}
                    </p>
                  </div>
                  {gestion && eleve.tuteurs.length > 1 && (
                    <FormulaireAction
                      action={retirerTuteur.bind(null, eleve.id, t.id)}
                      libelle="Retirer"
                      libelleEnCours="Retrait…"
                      style="boutonDanger"
                      confirmation={`Retirer ${t.prenoms} ${t.nom} des tuteurs de cet élève ?`}
                      className="flex flex-col items-end gap-2"
                    />
                  )}
                </li>
              ))}
            </ul>
            {gestion && (
              <details className="mt-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
                <summary className="cursor-pointer text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Ajouter un tuteur
                </summary>
                <div className="mt-4">
                  <FormulaireAction
                    action={ajouterTuteur.bind(null, eleve.id)}
                    libelle="Ajouter le tuteur"
                    reinitialiserSiSucces
                  >
                    <ChampsTuteur obligatoire lienParDefaut="MERE" />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="principal" /> Devient le
                      tuteur principal
                    </label>
                  </FormulaireAction>
                </div>
              </details>
            )}
          </Carte>

          <Carte
            titre="Appareils"
            actions={
              gestion &&
              !archive && (
                <Link
                  className={styles.boutonSecondaire}
                  href={`/appareils/nouveau?eleveId=${eleve.id}`}
                >
                  Ajouter un appareil
                </Link>
              )
            }
          >
            {appareils.total === 0 ? (
              <p className="text-sm text-zinc-500">
                Aucun appareil enregistré.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {appareils.elements.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <Link className={styles.lien} href={`/appareils/${a.id}`}>
                      {designationAppareil(a)}
                    </Link>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500">
                        {a.codeCourt}
                      </span>
                      <BadgeStatut statut={a.statut} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <div className="flex flex-col gap-6">
          <Carte titre="Résultats">
            {resultats.periodes.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Aucune période pour cette classe.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {resultats.periodes.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      <span className="font-medium">{p.libelle}</span>
                      {p.resultat?.moyenne != null && (
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {' '}
                          · {noteFr(p.resultat.moyenne)}/20
                          {p.resultat.rang
                            ? ` · ${p.resultat.rang}/${resultats.effectif}`
                            : ''}
                        </span>
                      )}
                    </span>
                    {p.resultat ? (
                      <a
                        className={styles.lien}
                        href={`/telechargements/bulletin/${eleve.id}/${p.id}`}
                      >
                        Bulletin{p.publie ? '' : ' (provisoire)'}
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-500">non saisi</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {resultats.decision && (
              <p className="mt-3 text-sm">
                Décision :{' '}
                <span className="font-medium">
                  {resultats.decision.libelle}
                </span>
                {!resultats.decision.publie && ' (non publiée)'}
              </p>
            )}
          </Carte>

          <Carte
            titre="Comportement"
            actions={
              !archive &&
              peutSignaler(profil.role) && (
                <Link
                  className={styles.boutonSecondaire}
                  href={`/comportements/nouveau?eleveId=${eleve.id}`}
                >
                  Signaler
                </Link>
              )
            }
          >
            {comportements.total === 0 ? (
              <p className="text-sm text-zinc-500">Rien de signalé.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {comportements.elements.map((c) => (
                  <li key={c.id}>
                    <Badge couleur={c.type === 'POSITIF' ? 'vert' : 'orange'}>
                      {LIBELLES_CATEGORIE[c.categorie]}
                    </Badge>{' '}
                    <span className="text-xs text-zinc-500">
                      {dateFr(c.date.slice(0, 10))}
                      {c.statut === 'EN_ATTENTE' ? ' · à valider' : ''}
                    </span>
                    <span className="block text-zinc-700 dark:text-zinc-300">
                      {c.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          {paiements && (
            <Carte
              titre="Paiements en attente"
              actions={
                <Link className={styles.boutonSecondaire} href="/paiements">
                  Gérer
                </Link>
              }
            >
              {paiements.total === 0 ? (
                <p className="text-sm text-zinc-500">
                  Aucun paiement en attente.
                </p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {paiements.elements.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>
                        {r.libelle}
                        <span className="block font-medium">
                          {montant(r.montant, profil.ecole?.monnaie ?? 'FCFA')}
                        </span>
                      </span>
                      {r.joursRetard > 0 ? (
                        <Badge couleur="orange">
                          {r.joursRetard} j de retard
                        </Badge>
                      ) : (
                        <Badge>À venir</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          )}

          <Carte titre="Absences">
            <p className="text-sm">
              {absences.total} absence(s), dont{' '}
              <span
                className={
                  absences.nonJustifiees
                    ? 'font-semibold text-red-700 dark:text-red-400'
                    : ''
                }
              >
                {absences.nonJustifiees} non justifiée(s)
              </span>
            </p>
            {absences.elements.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {absences.elements.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span>
                      {dateFr(a.date)} · {a.creneau}
                    </span>
                    <Badge couleur={a.justifiee ? 'vert' : 'orange'}>
                      {a.justifiee ? 'Justifiée' : 'Non justifiée'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          <Carte titre="Historique des classes">
            <ol className="flex flex-col gap-3 text-sm">
              {eleve.historiqueClasse.map((h) => (
                <li key={`${h.classe.id}-${h.dateDebut}`}>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {h.classe.nom}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    depuis le {dateFr(h.dateDebut)}
                    {h.dateFin
                      ? ` jusqu'au ${dateFr(h.dateFin)}`
                      : ' (en cours)'}
                  </span>
                </li>
              ))}
              {eleve.historiqueClasse.length === 0 && (
                <li className="text-zinc-500">
                  Aucune classe pour l&apos;instant.
                </li>
              )}
            </ol>
          </Carte>

          {gestion && !archive && (
            <Carte titre="Changer de classe">
              <FormulaireAction
                action={changerClasse.bind(null, eleve.id)}
                libelle="Changer de classe"
              >
                <Champ libelle="Nouvelle classe" obligatoire>
                  <Liste name="classeId" defaultValue="" required>
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {classes
                      .filter((c) => c.id !== eleve.classe?.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}
                        </option>
                      ))}
                  </Liste>
                </Champ>
                <Champ libelle="À partir du" aide="Par défaut : aujourd'hui.">
                  <Saisie type="date" name="date" />
                </Champ>
              </FormulaireAction>
            </Carte>
          )}

          {gestion && (
            <Carte titre={archive ? 'Dossier archivé' : 'Archiver le dossier'}>
              {archive ? (
                <FormulaireAction
                  action={restaurerEleve.bind(null, eleve.id)}
                  libelle="Restaurer l'élève"
                  style="boutonSecondaire"
                />
              ) : (
                <FormulaireAction
                  action={archiverEleve.bind(null, eleve.id)}
                  libelle="Archiver"
                  style="boutonDanger"
                  confirmation="Archiver ce dossier ? L'élève n'apparaîtra plus dans les listes, mais rien n'est supprimé."
                >
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Le dossier est conservé et peut être restauré à tout moment.
                  </p>
                  <Champ libelle="Motif">
                    <Saisie
                      name="motif"
                      maxLength={500}
                      placeholder="Ex. départ de la famille"
                    />
                  </Champ>
                </FormulaireAction>
              )}
            </Carte>
          )}

          {profil.role === 'ADMIN' && (
            <Carte titre="Données personnelles">
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                À la demande de la famille : copie complète des données de
                l&apos;élève et de ses tuteurs, puis effacement après son
                départ.
              </p>
              <a
                href={`/telechargements/donnees-eleve/${eleve.id}`}
                className={styles.boutonSecondaire}
              >
                Exporter les données (JSON)
              </a>
              {archive && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-red-700 dark:text-red-400">
                    Effacer les données de l&apos;élève…
                  </summary>
                  <div className="mt-3">
                    <FormulaireAction
                      action={effacerDonnees.bind(null, eleve.id)}
                      libelle="Effacer définitivement"
                      style="boutonDanger"
                      confirmation="Effacer les données de cet élève ? C'est irréversible : identité anonymisée, absences, comportement, résultats, appareils et messages supprimés."
                    >
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Le dossier reste (anonymisé) pour les statistiques. Les
                        tuteurs sans autre enfant à l&apos;école sont aussi
                        anonymisés et leur compte fermé.
                      </p>
                      <Champ
                        libelle={`Saisissez le matricule ${eleve.matricule} pour confirmer`}
                      >
                        <Saisie
                          name="confirmation"
                          required
                          autoComplete="off"
                        />
                      </Champ>
                    </FormulaireAction>
                  </div>
                </details>
              )}
            </Carte>
          )}
        </div>
      </div>
    </>
  );
}
