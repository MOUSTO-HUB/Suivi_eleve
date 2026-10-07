import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Badge,
  Carte,
  Champ,
  EnTete,
  Saisie,
  styles,
  Zone,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import {
  LIBELLES_CANAL,
  LIBELLES_TYPE_NOTIFICATION,
  type ModeleType,
} from '@/lib/types';
import { enregistrerModele, reinitialiserModele } from '../actions';

export const metadata: Metadata = {
  title: 'Modèles de messages · Suivi_eleve',
};

export default async function PageModeles() {
  const modeles = await lireApi<ModeleType[]>('/notifications/modeles');

  return (
    <>
      <EnTete
        titre="Modèles de messages"
        sousTitre="Textes envoyés aux familles. Les mots entre accolades sont remplacés à l'envoi."
        actions={
          <Link className={styles.boutonSecondaire} href="/notifications">
            Retour au journal
          </Link>
        }
      />
      <div className="flex flex-col gap-4">
        {modeles.map((m) => (
          <details
            key={m.type}
            className="rounded-2xl border border-marque-100 bg-carte shadow-sm shadow-marque-900/5 p-4"
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-medium text-slate-900">
              {LIBELLES_TYPE_NOTIFICATION[m.type]}
              {m.obligatoire && <Badge couleur="orange">Toujours envoyé</Badge>}
              {m.canaux.some((c) => c.personnalise) && (
                <Badge couleur="vert">Personnalisé</Badge>
              )}
              <span className="text-xs font-normal text-slate-500">
                Canaux :{' '}
                {m.canauxParDefaut.map((c) => LIBELLES_CANAL[c]).join(', ')}
              </span>
            </summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {m.canaux.map((c) => (
                <Carte
                  key={c.canal}
                  titre={LIBELLES_CANAL[c.canal]}
                  actions={
                    c.personnalise && (
                      <FormulaireAction
                        action={reinitialiserModele.bind(null, m.type, c.canal)}
                        libelle="Rétablir le texte par défaut"
                        style="boutonSecondaire"
                        confirmation="Rétablir le modèle par défaut ?"
                        className="flex flex-col"
                      />
                    )
                  }
                >
                  <FormulaireAction
                    action={enregistrerModele.bind(null, m.type, c.canal)}
                    libelle="Enregistrer"
                  >
                    {c.canal !== 'SMS' && (
                      <Champ libelle={c.canal === 'EMAIL' ? 'Objet' : 'Titre'}>
                        <Saisie
                          name="sujet"
                          defaultValue={c.sujet ?? ''}
                          maxLength={150}
                        />
                      </Champ>
                    )}
                    <Champ
                      libelle="Texte"
                      aide={
                        c.canal === 'SMS'
                          ? '160 caractères au plus une fois les variables remplacées.'
                          : undefined
                      }
                    >
                      <Zone
                        name="contenu"
                        defaultValue={c.contenu}
                        rows={c.canal === 'EMAIL' ? 8 : 3}
                        maxLength={2000}
                        required
                      />
                    </Champ>
                    <p className="text-xs text-slate-500">
                      Variables : {c.variables.map((v) => `{${v}}`).join(' ')}
                    </p>
                    <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                      <p className="mb-1 font-medium">
                        Aperçu
                        {c.canal === 'SMS'
                          ? ` (${c.apercu.length} caractères)`
                          : ''}
                      </p>
                      {c.apercuSujet && (
                        <p className="font-semibold">{c.apercuSujet}</p>
                      )}
                      <p className="whitespace-pre-line">{c.apercu}</p>
                    </div>
                  </FormulaireAction>
                </Carte>
              ))}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
