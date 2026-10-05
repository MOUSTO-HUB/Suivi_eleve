import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import { Champ, parametre, Saisie, styles } from '@/components/ui';
import { demanderCode, seConnecter, verifierCode } from './actions';

export const metadata: Metadata = { title: 'Connexion · Suivi_eleve' };

const onglet = (actif: boolean) =>
  `flex-1 rounded-md px-3 py-2 text-center text-sm font-medium ${
    actif
      ? 'bg-white text-emerald-800 shadow-sm dark:bg-zinc-800 dark:text-emerald-300'
      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400'
  }`;

/** Parents : numéro puis code SMS. Personnel : email et mot de passe. */
export default async function PageConnexion(props: PageProps<'/connexion'>) {
  const params = await props.searchParams;
  const suite = parametre(params.suite);
  const telephone = parametre(params.telephone);
  // Un retour vers une page du personnel (session expirée) ouvre l'onglet Personnel.
  const espace = parametre(params.espace);
  const parent =
    espace === 'parent' || (!espace && (!suite || suite.startsWith('/parent')));

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Suivi_eleve
        </h1>
        <p className="mb-6 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          La scolarité de votre enfant, informée en temps réel.
        </p>
        <nav className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          <Link href="/connexion?espace=parent" className={onglet(parent)}>
            Parents
          </Link>
          <Link
            href={`/connexion?espace=personnel${suite ? `&suite=${encodeURIComponent(suite)}` : ''}`}
            className={onglet(!parent)}
          >
            Personnel de l&apos;école
          </Link>
        </nav>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {!parent ? (
            <FormulaireAction
              action={seConnecter}
              libelle="Se connecter"
              libelleEnCours="Connexion…"
            >
              <input type="hidden" name="suite" value={suite ?? ''} />
              <Champ libelle="Email">
                <Saisie
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </Champ>
              <Champ libelle="Mot de passe">
                <Saisie
                  type="password"
                  name="motDePasse"
                  autoComplete="current-password"
                  required
                />
              </Champ>
            </FormulaireAction>
          ) : telephone ? (
            <>
              <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                Si ce numéro est connu de l&apos;école, un code à 6 chiffres
                vient d&apos;être envoyé par SMS au {telephone}.
              </p>
              <FormulaireAction
                action={verifierCode}
                libelle="Se connecter"
                libelleEnCours="Vérification…"
              >
                <input type="hidden" name="telephone" value={telephone} />
                <Champ libelle="Code reçu par SMS">
                  <Saisie
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="123456"
                    required
                    autoFocus
                  />
                </Champ>
              </FormulaireAction>
              <Link
                href="/connexion?espace=parent"
                className={`mt-4 block text-center text-sm ${styles.lien}`}
              >
                Changer de numéro ou recevoir un nouveau code
              </Link>
            </>
          ) : (
            <FormulaireAction
              action={demanderCode}
              libelle="Recevoir le code par SMS"
              libelleEnCours="Envoi…"
            >
              <Champ
                libelle="Votre numéro de téléphone"
                aide="Le numéro donné à l'école lors de l'inscription."
              >
                <Saisie
                  type="tel"
                  name="telephone"
                  autoComplete="tel"
                  placeholder="77 123 45 67"
                  required
                  autoFocus
                />
              </Champ>
            </FormulaireAction>
          )}
        </div>
      </div>
    </main>
  );
}
