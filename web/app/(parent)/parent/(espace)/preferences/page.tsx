import type { Metadata } from 'next';
import { FormulaireAction } from '@/components/formulaire-action';
import { NotificationsAppareil } from '@/components/notifications-push';
import { TitreParent } from '@/components/parent';
import { Carte } from '@/components/ui';
import { lireApi } from '@/lib/api';
import {
  ICONES_NOTIFICATION,
  LIBELLES_TYPE_NOTIFICATION,
  type PreferenceNotification,
} from '@/lib/types';
import { enregistrerPreferences } from '../../actions';

export const metadata: Metadata = { title: 'Préférences · Suivi_eleve' };

const CANAUX = [
  ['sms', 'SMS', 'SMS'],
  ['email', 'EMAIL', 'Email'],
  ['push', 'PUSH', 'Application'],
] as const;

/** Canaux par type de message ; les messages importants restent obligatoires. */
export default async function Preferences() {
  const [prefs, { clePublique }] = await Promise.all([
    lireApi<PreferenceNotification[]>('/notifications/preferences'),
    lireApi<{ clePublique: string | null }>('/notifications/push-web'),
  ]);
  const modifiables = prefs.filter((p) => !p.obligatoire);
  return (
    <>
      <TitreParent
        titre="Comment recevoir les messages"
        sousTitre="Les messages importants (sortie anticipée, absence, comportement, retard de paiement…) sont toujours envoyés par tous les moyens."
      />
      {clePublique && <NotificationsAppareil clePublique={clePublique} />}
      <FormulaireAction
        action={enregistrerPreferences.bind(
          null,
          modifiables.map((p) => p.type),
        )}
        libelle="Enregistrer"
      >
        <Carte>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 font-medium">Message</th>
                {CANAUX.map(([, , libelle]) => (
                  <th key={libelle} className="py-2 text-center font-medium">
                    {libelle}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prefs.map((p) => (
                <tr key={p.type}>
                  <td className="py-3">
                    <span aria-hidden>{ICONES_NOTIFICATION[p.type]} </span>
                    {LIBELLES_TYPE_NOTIFICATION[p.type]}
                    {p.obligatoire && (
                      <span className="block text-xs text-slate-500">
                        Toujours envoyé
                      </span>
                    )}
                  </td>
                  {CANAUX.map(([cle, canal, libelle]) => (
                    <td key={cle} className="py-3 text-center">
                      {p.canauxDisponibles.includes(canal) ? (
                        <input
                          type="checkbox"
                          name={`${p.type}:${cle}`}
                          defaultChecked={p[cle]}
                          disabled={p.obligatoire}
                          aria-label={`${LIBELLES_TYPE_NOTIFICATION[p.type]} par ${libelle}`}
                          className="h-5 w-5 accent-marque-700"
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Carte>
      </FormulaireAction>
    </>
  );
}
