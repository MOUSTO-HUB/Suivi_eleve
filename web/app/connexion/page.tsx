import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Logo } from '@/components/bandeau';
import { FormulaireAction } from '@/components/formulaire-action';
import { DesabonnementDeconnexion } from '@/components/notifications-push';
import { Champ, Liste, parametre, Saisie, styles } from '@/components/ui';
import { estPays, LISTE_PAYS, paysParDefaut, TELEPHONE_PAYS } from '@/lib/pays';
import { demanderCode, seConnecter, verifierCode } from './actions';

export const metadata: Metadata = { title: 'Connexion · Suivi_eleve' };

const onglet = (actif: boolean) =>
  `flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
    actif
      ? 'bg-white text-marque-800 shadow-md'
      : 'text-white/85 hover:bg-white/10 hover:text-white'
  }`;

/** Parents : numéro puis code SMS. Personnel : email et mot de passe. */
export default async function PageConnexion(props: PageProps<'/connexion'>) {
  const params = await props.searchParams;
  const suite = parametre(params.suite);
  const telephone = parametre(params.telephone);
  // Dernier pays choisi sur cet appareil, sinon celui du déploiement.
  const memorise = (await cookies()).get('pays')?.value;
  const pays = estPays(memorise) ? memorise : paysParDefaut();
  // Un retour vers une page du personnel (session expirée) ouvre l'onglet Personnel.
  const espace = parametre(params.espace);
  const parent =
    espace === 'parent' || (!espace && (!suite || suite.startsWith('/parent')));

  return (
    <main className="fond-bandeau flex flex-1 items-center justify-center px-4 py-12">
      <DesabonnementDeconnexion />
      <div className="w-full max-w-sm">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
          <Logo className="h-12 w-12" />
          Suivi_eleve
        </h1>
        <p className="mt-2 mb-6 text-sm text-marque-100">
          La scolarité de votre enfant, informée en temps réel.
        </p>
        <nav className="mb-4 flex gap-1 rounded-xl bg-white/15 p-1 ring-1 ring-white/25 backdrop-blur">
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
        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-marque-950/40">
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
              <p className="mb-4 rounded-md bg-marque-50 p-3 text-sm text-marque-800">
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
              <Champ libelle="Pays">
                <Liste name="pays" defaultValue={pays}>
                  {LISTE_PAYS.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.libelle}
                    </option>
                  ))}
                </Liste>
              </Champ>
              <Champ
                libelle="Votre numéro de téléphone"
                aide="Le numéro donné à l'école lors de l'inscription."
              >
                <Saisie
                  type="tel"
                  name="telephone"
                  autoComplete="tel"
                  placeholder={TELEPHONE_PAYS[pays].exemple}
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
