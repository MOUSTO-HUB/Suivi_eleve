import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeStatut, FormulaireSignalement } from '@/components/appareils';
import { Alerte, Carte, EnTete, styles } from '@/components/ui';
import { ErreurApi, lireApi } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import {
  designationAppareil,
  LIBELLES_LIEN,
  signalementsPossibles,
  type AppareilScanne,
} from '@/lib/types';
import { signalerAppareil } from '../../actions';

export const metadata: Metadata = { title: 'Appareil scanné · Suivi_eleve' };

/**
 * Page ouverte en scannant l'étiquette QR (EF-11). Le proxy impose la connexion :
 * seul le personnel voit le propriétaire et peut le joindre.
 */
export default async function PageScan(
  props: PageProps<'/appareils/scan/[code]'>,
) {
  const { code } = await props.params;
  const profil = await profilCourant();
  let appareil: AppareilScanne | null = null;
  let erreur: string | null = null;
  try {
    appareil = await lireApi<AppareilScanne>(
      `/appareils/qr/${encodeURIComponent(code)}`,
    );
  } catch (e) {
    if (!(e instanceof ErreurApi)) throw e;
    erreur =
      e.statut === 403
        ? 'Seul le personnel de l’école peut identifier le propriétaire d’un appareil.'
        : 'Aucun appareil enregistré ne correspond à cette étiquette.';
  }

  if (!appareil) {
    return (
      <>
        <EnTete titre="Appareil scanné" />
        <Alerte>{erreur}</Alerte>
      </>
    );
  }

  return (
    <>
      <EnTete
        titre={designationAppareil(appareil)}
        sousTitre={`Étiquette ${appareil.codeCourt}`}
        actions={
          <Link
            className={styles.boutonSecondaire}
            href={`/appareils/${appareil.id}`}
          >
            Fiche complète
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Carte
            titre="Propriétaire"
            actions={<BadgeStatut statut={appareil.statut} />}
          >
            <p className="text-lg font-semibold text-slate-900">
              <Link
                className={styles.lien}
                href={`/eleves/${appareil.eleve.id}`}
              >
                {appareil.eleve.prenoms} {appareil.eleve.nom}
              </Link>
            </p>
            <p className="text-sm text-slate-600">
              {appareil.eleve.classe?.nom ?? 'Sans classe'} · matricule{' '}
              {appareil.eleve.matricule}
            </p>
            {appareil.signesDistinctifs && (
              <p className="mt-2 text-sm">
                Signes distinctifs : {appareil.signesDistinctifs}
              </p>
            )}
          </Carte>
          <Carte titre="Joindre la famille">
            <ul className="flex flex-col gap-3 text-sm">
              {appareil.tuteurs.map((t) => (
                <li key={t.contact1}>
                  <span className="font-medium">
                    {t.prenoms} {t.nom}
                  </span>{' '}
                  <span className="text-slate-500">
                    ({LIBELLES_LIEN[t.lien]})
                  </span>
                  <span className="mt-1 flex flex-wrap gap-2">
                    {[t.contact1, t.contact2].filter(Boolean).map((tel) => (
                      <a
                        key={tel}
                        className={styles.boutonSecondaire}
                        href={`tel:${tel}`}
                      >
                        Appeler {tel}
                      </a>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
        </div>
        <Carte titre="Signaler">
          <FormulaireSignalement
            action={signalerAppareil.bind(null, appareil.id)}
            possibles={signalementsPossibles(profil.role, appareil.statut)}
          />
        </Carte>
      </div>
    </>
  );
}
