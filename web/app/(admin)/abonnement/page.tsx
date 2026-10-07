import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { contactAbonnement } from '@/components/abonnement';
import { BadgeAbonnement, echeanceFr } from '@/components/plateforme';
import { Carte, cellule, EnTete, Tableau } from '@/components/ui';
import { lireApi } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import { dateFr, gnf, LIBELLES_MOYEN, type MonAbonnement } from '@/lib/types';

export const metadata: Metadata = { title: 'Abonnement · Suivi_eleve' };

/** Direction : abonnement de l'école au service Suivi_eleve. */
export default async function Abonnement() {
  if ((await profilCourant()).role !== 'ADMIN') redirect('/eleves');
  const a = await lireApi<MonAbonnement>('/abonnement');
  return (
    <>
      <EnTete
        titre="Abonnement Suivi_eleve"
        sousTitre={`${gnf(a.tarifs.MENSUEL)} par mois, ou ${gnf(a.tarifs.ANNUEL)} par an (2 mois offerts), hors taxes (TVA en sus).`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Carte titre="État">
          <BadgeAbonnement abonnement={a.abonnement} />
          <p className="mt-3 text-sm">
            {a.abonnement.essai ? 'Essai gratuit' : 'Abonnement payé'} jusqu’au{' '}
            <strong>{dateFr(a.finAbonnement)}</strong> (
            {echeanceFr(a.abonnement.joursRestants)}).
          </p>
          {a.abonnement.etat === 'EN_RETARD' && (
            <p className="mt-2 text-sm text-amber-700">
              Sans renouvellement, l’accès sera suspendu après le{' '}
              {dateFr(a.abonnement.finGrace)}. Les données de l’école sont
              conservées et tout revient dès le paiement.
            </p>
          )}
        </Carte>
        <Carte titre="Renouveler">
          <p className="text-sm">
            Payez par Orange Money, MTN Mobile Money, Wave, virement ou en
            espèces, puis contactez {contactAbonnement()} en indiquant le nom de
            l’école et la référence du paiement. L’abonnement est prolongé dès
            réception.
          </p>
        </Carte>
      </div>
      <div className="mt-6">
        <Carte titre="Paiements">
          <Tableau
            entetes={[
              'Payé le',
              'Formule',
              'Montant',
              'Moyen',
              'Période couverte',
            ]}
            vide={
              a.paiements.length ? undefined : 'Aucun paiement pour le moment.'
            }
          >
            {a.paiements.map((p) => (
              <tr key={p.id}>
                <td className={cellule}>{dateFr(p.payeLe)}</td>
                <td className={cellule}>
                  {p.formule === 'ANNUEL' ? 'Annuel' : 'Mensuel'}
                </td>
                <td className={cellule}>{gnf(p.montant)}</td>
                <td className={cellule}>{LIBELLES_MOYEN[p.moyen]}</td>
                <td className={cellule}>
                  du {dateFr(p.periodeDebut)} au {dateFr(p.periodeFin)}
                </td>
              </tr>
            ))}
          </Tableau>
        </Carte>
      </div>
    </>
  );
}
