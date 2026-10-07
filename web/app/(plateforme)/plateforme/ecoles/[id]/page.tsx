import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  BadgeAbonnement,
  ChampsEcole,
  echeanceFr,
} from '@/components/plateforme';
import {
  Alerte,
  Carte,
  cellule,
  Champ,
  EnTete,
  Liste,
  Saisie,
  styles,
  Tableau,
  Zone,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import {
  dateFr,
  dateHeureFr,
  gnf,
  LIBELLES_FORMULE,
  LIBELLES_MOYEN,
  LIBELLES_PAYS,
  type DetailEcolePlateforme,
  type FormuleAbonnement,
  type MoyenPaiementAbonnement,
} from '@/lib/types';
import {
  annulerPaiement,
  enregistrerPaiement,
  modifierEcole,
  reactiver,
  reinitialiserDirection,
  suspendre,
} from '../../actions';

export const metadata: Metadata = {
  title: 'École · Concepteur · Suivi_eleve',
};

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** « 0 élève », « 1 élève », « 20 élèves ». */
const nombre = (n: number, singulier: string, pluriel = `${singulier}s`) =>
  `${n} ${n > 1 ? pluriel : singulier}`;

export default async function Ecole(
  props: PageProps<'/plateforme/ecoles/[id]'>,
) {
  const { id } = await props.params;
  const e = await lireApi<DetailEcolePlateforme>(`/plateforme/ecoles/${id}`);
  const { abonnement } = e;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/plateforme/ecoles" className={styles.lien}>
          ← Toutes les écoles
        </Link>
      </p>
      <EnTete
        titre={e.nom}
        sousTitre={`${LIBELLES_PAYS[e.pays]} · inscrite le ${dateHeureFr(e.creeLe).slice(0, 10)} · ${nombre(e.eleves, 'élève')}, ${nombre(e.familles, 'famille')}, ${nombre(e.classes, 'classe')}, ${nombre(e.personnel, 'membre du personnel', 'membres du personnel')}`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Carte titre="Abonnement">
          <div className="flex flex-wrap items-center gap-3">
            <BadgeAbonnement abonnement={abonnement} />
            {abonnement.essai && abonnement.etat !== 'ESSAI' && (
              <span className="text-sm text-slate-500">(essai gratuit)</span>
            )}
          </div>
          <p className="mt-3 text-sm">
            {abonnement.essai ? 'Essai' : 'Payé'} jusqu’au{' '}
            <strong>{dateFr(e.finAbonnement)}</strong> (
            {echeanceFr(abonnement.joursRestants)}).
          </p>
          {abonnement.etat === 'EN_RETARD' && (
            <p className="mt-1 text-sm text-amber-700">
              Suspension automatique après le {dateFr(abonnement.finGrace)}.
            </p>
          )}
          {e.suspendueLe ? (
            <div className="mt-4">
              <Alerte>
                Suspendue à la main le {dateHeureFr(e.suspendueLe)} :{' '}
                {e.motifSuspension}
              </Alerte>
              <div className="mt-3">
                <FormulaireAction
                  action={reactiver.bind(null, e.id)}
                  libelle="Réactiver l'école"
                  confirmation={`Réactiver ${e.nom} ? Le personnel et les familles pourront de nouveau se connecter.`}
                />
              </div>
            </div>
          ) : (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-red-700">
                Suspendre l’école
              </summary>
              <div className="mt-3">
                <FormulaireAction
                  action={suspendre.bind(null, e.id)}
                  libelle="Suspendre"
                  style="boutonDanger"
                  confirmation={`Suspendre ${e.nom} ? Plus personne ne pourra se connecter et aucun message ne partira (les données sont conservées).`}
                >
                  <Champ libelle="Motif">
                    <Zone name="motif" rows={2} required maxLength={300} />
                  </Champ>
                </FormulaireAction>
              </div>
            </details>
          )}
        </Carte>

        <Carte titre="Enregistrer un paiement reçu">
          <FormulaireAction
            action={enregistrerPaiement.bind(null, e.id)}
            libelle="Enregistrer le paiement"
            reinitialiserSiSucces
          >
            <Champ libelle="Formule">
              <Liste name="formule" defaultValue="MENSUEL" required>
                {(Object.keys(LIBELLES_FORMULE) as FormuleAbonnement[]).map(
                  (f) => (
                    <option key={f} value={f}>
                      {LIBELLES_FORMULE[f]} — {gnf(e.tarifs[f])}
                    </option>
                  ),
                )}
              </Liste>
            </Champ>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ libelle="Moyen de paiement">
                <Liste name="moyen" defaultValue="ORANGE_MONEY" required>
                  {(
                    Object.keys(LIBELLES_MOYEN) as MoyenPaiementAbonnement[]
                  ).map((m) => (
                    <option key={m} value={m}>
                      {LIBELLES_MOYEN[m]}
                    </option>
                  ))}
                </Liste>
              </Champ>
              <Champ libelle="Date du paiement">
                <Saisie
                  type="date"
                  name="payeLe"
                  defaultValue={aujourdhui()}
                  max={aujourdhui()}
                  required
                />
              </Champ>
            </div>
            <Champ
              libelle="Référence (facultatif)"
              aide="Ex. numéro de transaction"
            >
              <Saisie name="reference" maxLength={100} />
            </Champ>
            <Champ
              libelle="Montant reçu en GNF (facultatif)"
              aide="Laissez vide pour le tarif de la formule ; à remplir seulement en cas de remise."
            >
              <Saisie name="montant" inputMode="numeric" pattern="[0-9 ]*" />
            </Champ>
          </FormulaireAction>
        </Carte>
      </div>

      <div className="mt-6">
        <Carte titre="Paiements d’abonnement">
          <Tableau
            entetes={[
              'Payé le',
              'Formule',
              'Montant',
              'Moyen',
              'Période couverte',
              '',
            ]}
            vide={e.paiements.length ? undefined : 'Aucun paiement enregistré.'}
          >
            {e.paiements.map((p, i) => (
              <tr key={p.id}>
                <td className={cellule}>{dateFr(p.payeLe)}</td>
                <td className={cellule}>
                  {p.formule === 'ANNUEL' ? 'Annuel' : 'Mensuel'}
                </td>
                <td className={`${cellule} font-medium`}>{gnf(p.montant)}</td>
                <td className={cellule}>
                  {LIBELLES_MOYEN[p.moyen]}
                  {p.reference && (
                    <span className="block text-xs text-slate-500">
                      {p.reference}
                    </span>
                  )}
                </td>
                <td className={cellule}>
                  du {dateFr(p.periodeDebut)} au {dateFr(p.periodeFin)}
                </td>
                <td className={cellule}>
                  {i === 0 && (
                    <FormulaireAction
                      action={annulerPaiement.bind(null, e.id, p.id)}
                      libelle="Annuler"
                      style="boutonDanger"
                      confirmation={`Annuler ce paiement de ${gnf(p.montant)} ? L'abonnement reviendra au ${dateFr(p.periodeDebut)} moins un jour.`}
                    />
                  )}
                </td>
              </tr>
            ))}
          </Tableau>
        </Carte>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Carte titre="Direction de l’école">
          <ul className="flex flex-col gap-4">
            {e.direction.map((d) => (
              <li key={d.id} className="flex flex-col gap-2">
                <div>
                  <p className="font-medium">
                    {d.prenoms} {d.nom}
                    {!d.actif && (
                      <span className="ml-2 text-xs text-slate-500">
                        (désactivé)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600">
                    {d.email} ·{' '}
                    {d.derniereConnexion
                      ? `dernière connexion le ${dateHeureFr(d.derniereConnexion)}`
                      : 'jamais connecté'}
                  </p>
                </div>
                <FormulaireAction
                  action={reinitialiserDirection.bind(null, e.id, d.id)}
                  libelle="Nouveau mot de passe provisoire"
                  style="boutonSecondaire"
                  confirmation={`Générer un nouveau mot de passe pour ${d.prenoms} ${d.nom} ? Ses sessions seront fermées.`}
                />
              </li>
            ))}
          </ul>
        </Carte>

        <Carte titre="Informations de l’école">
          <FormulaireAction
            action={modifierEcole.bind(null, e.id)}
            libelle="Enregistrer"
          >
            <ChampsEcole valeurs={e} />
          </FormulaireAction>
        </Carte>
      </div>
    </>
  );
}
