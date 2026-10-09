import { activerApplication } from '@/app/(admin)/compte/actions';
import { FormulaireCodesSecours } from '@/components/codes-secours';
import { Carte, Champ, EnTete, Saisie } from '@/components/ui';
import { envoyerApi } from '@/lib/api';

interface Preparation {
  secret: string;
  lien: string;
  qrCode: string;
  jeton: string;
}

/** Ajout de l'application d'authentification : QR code, puis premier code pour confirmer. */
export async function AjoutApplication({ retour }: { retour: string }) {
  // Nouvelle clé à chaque affichage ; rien n'est enregistré avant la confirmation.
  const p = await envoyerApi<Preparation>(
    '/auth/double-auth/application/preparation',
    'POST',
  );
  return (
    <>
      <EnTete
        titre="Application d’authentification"
        sousTitre="Un code à 6 chiffres, renouvelé toutes les 30 secondes, vous sera demandé à chaque connexion."
      />
      <div className="grid max-w-3xl gap-6 md:grid-cols-2">
        <Carte titre="1. Scanner le QR code">
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>
              Installez Google Authenticator ou Microsoft Authenticator sur
              votre téléphone.
            </li>
            <li>
              Dans l’application, touchez « + » puis « Scanner un QR code ».
            </li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- image générée (data:) */}
          <img
            src={p.qrCode}
            alt="QR code à scanner avec l’application d’authentification"
            width={220}
            height={220}
            className="mx-auto rounded-lg bg-white p-2"
          />
          <p className="mt-4 text-xs text-slate-600">
            Impossible de scanner ? Saisissez cette clé dans l’application :
          </p>
          <p className="mt-1 font-mono text-sm break-all select-all">
            {p.secret.match(/.{1,4}/g)?.join(' ')}
          </p>
          <a
            href={p.lien}
            className="mt-2 inline-block text-xs text-marque-700 underline md:hidden"
          >
            Ouvrir dans l’application de ce téléphone
          </a>
        </Carte>
        <Carte titre="2. Confirmer">
          <FormulaireCodesSecours
            action={activerApplication}
            libelle="Activer"
            retour={retour}
          >
            <input type="hidden" name="jeton" value={p.jeton} />
            <Champ libelle="Code affiché par l’application">
              <Saisie
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                placeholder="123456"
                required
              />
            </Champ>
            <Champ libelle="Votre mot de passe (confirmation)">
              <Saisie
                type="password"
                name="motDePasse"
                autoComplete="current-password"
                required
              />
            </Champ>
          </FormulaireCodesSecours>
        </Carte>
      </div>
    </>
  );
}
