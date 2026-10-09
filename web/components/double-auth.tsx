import Link from 'next/link';
import {
  choisirEmail,
  desactiverDoubleAuth,
  nouveauxCodesSecours,
} from '@/app/(admin)/compte/actions';
import { FormulaireCodesSecours } from '@/components/codes-secours';
import { FormulaireAction } from '@/components/formulaire-action';
import { Carte, Champ, Saisie, styles } from '@/components/ui';
import { lireApi } from '@/lib/api';

interface EtatDoubleAuth {
  methode: 'APPLICATION' | 'EMAIL' | null;
  obligatoire: boolean;
  codesSecoursRestants: number;
}

const MotDePasse = () => (
  <Champ libelle="Votre mot de passe (confirmation)">
    <Saisie
      type="password"
      name="motDePasse"
      autoComplete="current-password"
      required
    />
  </Champ>
);

const DESCRIPTIONS = {
  APPLICATION:
    'Activée : à chaque connexion, saisissez le code affiché par votre application d’authentification.',
  EMAIL:
    'Activée : à chaque connexion, un code à 6 chiffres vous est envoyé par email.',
  aucune:
    'Désactivée : le mot de passe suffit pour vous connecter. Activez-la pour protéger votre compte même si votre mot de passe est découvert.',
};

/** « Mon compte » : choix de la double authentification (application ou email). */
export async function DoubleAuth({
  lienApplication,
}: {
  /** Page d'ajout de l'application (QR code). */
  lienApplication: string;
}) {
  const etat = await lireApi<EtatDoubleAuth>('/auth/double-auth');

  return (
    <Carte titre="Double authentification">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-slate-700">
          {DESCRIPTIONS[etat.methode ?? 'aucune']}
          {etat.obligatoire &&
            ' Elle est obligatoire pour votre rôle : vous pouvez choisir la méthode, pas la retirer.'}
        </p>

        {etat.methode !== 'APPLICATION' && (
          <div className="flex flex-col gap-2">
            <Link href={lienApplication} className={styles.bouton}>
              Utiliser une application d’authentification
            </Link>
            <p className="text-xs text-slate-500">
              Recommandé : Google Authenticator ou Microsoft Authenticator
              (gratuits), fonctionne même sans réseau.
            </p>
          </div>
        )}

        {etat.methode === 'APPLICATION' && (
          <details className="rounded-lg border border-marque-100 p-3">
            <summary className="cursor-pointer text-sm font-medium text-marque-800">
              Codes de secours : {etat.codesSecoursRestants} restant(s)
            </summary>
            <div className="mt-3">
              <FormulaireCodesSecours
                action={nouveauxCodesSecours}
                libelle="Générer de nouveaux codes"
                style="boutonSecondaire"
              >
                <MotDePasse />
              </FormulaireCodesSecours>
            </div>
          </details>
        )}

        {etat.methode !== 'EMAIL' && (
          <details className="rounded-lg border border-marque-100 p-3">
            <summary className="cursor-pointer text-sm font-medium text-marque-800">
              Recevoir plutôt un code par email
            </summary>
            <div className="mt-3">
              <FormulaireAction
                action={choisirEmail}
                libelle="Passer au code par email"
                style="boutonSecondaire"
              >
                <MotDePasse />
              </FormulaireAction>
            </div>
          </details>
        )}

        {etat.methode && !etat.obligatoire && (
          <details className="rounded-lg border border-red-100 p-3">
            <summary className="cursor-pointer text-sm font-medium text-red-700">
              Désactiver la double authentification
            </summary>
            <div className="mt-3">
              <FormulaireAction
                action={desactiverDoubleAuth}
                libelle="Désactiver"
                style="boutonDanger"
                confirmation="Désactiver la double authentification ? Le mot de passe suffira pour vous connecter."
              >
                <MotDePasse />
              </FormulaireAction>
            </div>
          </details>
        )}
      </div>
    </Carte>
  );
}
