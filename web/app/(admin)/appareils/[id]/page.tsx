import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  BadgeStatut,
  ChampsAppareil,
  FormulaireSignalement,
} from '@/components/appareils';
import { FormulaireAction } from '@/components/formulaire-action';
import { Carte, Champ, EnTete, styles } from '@/components/ui';
import { lireApiOuNull } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import {
  dateHeureFr,
  designationAppareil,
  LIBELLES_ROLE,
  LIBELLES_SIGNALEMENT,
  peutGerer,
  signalementsPossibles,
  type AppareilDetail,
} from '@/lib/types';
import { envoyerPhoto, modifierAppareil, signalerAppareil } from '../actions';

export const metadata: Metadata = { title: 'Appareil · Suivi_eleve' };

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
      <dd className="mt-0.5 break-words text-sm text-zinc-900 dark:text-zinc-100">
        {children}
      </dd>
    </div>
  );
}

export default async function FicheAppareil(
  props: PageProps<'/appareils/[id]'>,
) {
  const { id } = await props.params;
  const [appareil, profil] = await Promise.all([
    lireApiOuNull<AppareilDetail>(`/appareils/${id}`),
    profilCourant(),
  ]);
  if (!appareil) notFound();
  const gestion = peutGerer(profil.role);

  return (
    <>
      <EnTete
        titre={designationAppareil(appareil)}
        sousTitre={`Étiquette ${appareil.codeCourt}`}
        actions={
          <>
            <Link className={styles.boutonSecondaire} href="/appareils">
              Retour à la liste
            </Link>
            {['ADMIN', 'SECRETARIAT', 'SURVEILLANT'].includes(profil.role) && (
              <a
                className={styles.boutonSecondaire}
                href={`/telechargements/etiquettes?eleveId=${appareil.eleve.id}`}
              >
                Étiquettes de l&apos;élève (PDF)
              </a>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Carte
            titre="Appareil"
            actions={<BadgeStatut statut={appareil.statut} />}
          >
            <div className="flex flex-col gap-6 sm:flex-row">
              {appareil.aPhoto && (
                // eslint-disable-next-line @next/next/no-img-element -- photo privée servie par une route authentifiée
                <img
                  src={`/telechargements/photo-appareil/${appareil.id}`}
                  alt={`Photo : ${designationAppareil(appareil)}`}
                  className="h-40 w-40 shrink-0 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                />
              )}
              <dl className="grid flex-1 gap-4 sm:grid-cols-2">
                <Info libelle="Élève">
                  <Link
                    className={styles.lien}
                    href={`/eleves/${appareil.eleve.id}`}
                  >
                    {appareil.eleve.prenoms} {appareil.eleve.nom}
                  </Link>{' '}
                  · {appareil.eleve.classe?.nom ?? 'sans classe'}
                </Info>
                <Info libelle="Matricule">{appareil.eleve.matricule}</Info>
                <Info libelle="IMEI">
                  <span className="font-mono">{appareil.imei ?? '—'}</span>
                </Info>
                <Info libelle="Numéro de série">
                  <span className="font-mono">
                    {appareil.numeroSerie ?? '—'}
                  </span>
                </Info>
                <Info libelle="Signes distinctifs">
                  {appareil.signesDistinctifs ?? '—'}
                </Info>
                <Info libelle="Enregistré le">
                  {dateHeureFr(appareil.creeLe)}
                </Info>
              </dl>
            </div>
          </Carte>

          <Carte titre="Historique">
            {appareil.incidents.length === 0 ? (
              <p className="text-sm text-zinc-500">Aucun signalement.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {appareil.incidents.map((i) => (
                  <li
                    key={i.id}
                    className="border-l-2 border-zinc-200 pl-3 text-sm dark:border-zinc-700"
                  >
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {LIBELLES_SIGNALEMENT[i.type]}
                      <span className="font-normal text-zinc-500">
                        {' '}
                        · {dateHeureFr(i.dateHeure)}
                      </span>
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      {[i.lieu, i.commentaire].filter(Boolean).join(' · ')}
                    </p>
                    {i.auteur && (
                      <p className="text-xs text-zinc-500">
                        par {i.auteur.prenoms} {i.auteur.nom} (
                        {LIBELLES_ROLE[i.auteur.role]})
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Carte>

          {gestion && (
            <Carte titre="Modifier la description">
              <FormulaireAction
                action={modifierAppareil.bind(null, appareil.id)}
                libelle="Enregistrer"
              >
                <ChampsAppareil appareil={appareil} />
              </FormulaireAction>
            </Carte>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Carte titre="Signaler">
            <FormulaireSignalement
              action={signalerAppareil.bind(null, appareil.id)}
              possibles={signalementsPossibles(profil.role, appareil.statut)}
            />
          </Carte>
          {gestion && (
            <Carte
              titre={
                appareil.aPhoto ? 'Remplacer la photo' : 'Ajouter une photo'
              }
            >
              <FormulaireAction
                action={envoyerPhoto.bind(null, appareil.id)}
                libelle="Envoyer la photo"
              >
                <Champ
                  libelle="Photo"
                  aide="JPEG, PNG ou WebP, 3 Mo au maximum."
                >
                  <input
                    type="file"
                    name="photo"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    required
                    className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:file:bg-zinc-800"
                  />
                </Champ>
              </FormulaireAction>
            </Carte>
          )}
        </div>
      </div>
    </>
  );
}
