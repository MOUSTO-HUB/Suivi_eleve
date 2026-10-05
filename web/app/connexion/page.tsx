import type { Metadata } from 'next';
import { FormulaireAction } from '@/components/formulaire-action';
import { Champ, parametre, Saisie } from '@/components/ui';
import { seConnecter } from './actions';

export const metadata: Metadata = { title: 'Connexion · Suivi_eleve' };

export default async function PageConnexion(props: PageProps<'/connexion'>) {
  const suite = parametre((await props.searchParams).suite);
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Suivi_eleve
        </h1>
        <p className="mb-6 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Espace du personnel de l&apos;école
        </p>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
        </div>
      </div>
    </main>
  );
}
