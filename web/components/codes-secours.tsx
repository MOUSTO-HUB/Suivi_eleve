'use client';

import { startTransition, useActionState, type ReactNode } from 'react';
import type { EtatCodes } from '@/app/(admin)/compte/actions';
import { Alerte, styles } from './ui';

/**
 * Formulaire dont la réponse contient des codes de secours : ils sont affichés
 * une seule fois, à noter ou imprimer (téléphone perdu ou changé).
 */
export function FormulaireCodesSecours({
  action,
  libelle,
  style = 'bouton',
  retour = '?',
  children,
}: {
  action: (e: EtatCodes | null, d: FormData) => Promise<EtatCodes | null>;
  libelle: string;
  style?: keyof typeof styles;
  /** Page affichée une fois les codes notés. */
  retour?: string;
  children?: ReactNode;
}) {
  const [etat, envoyer, enCours] = useActionState(action, null);

  if (etat?.codes?.length)
    return (
      <div className="flex flex-col gap-4">
        {etat.succes && <Alerte type="succes">{etat.succes}</Alerte>}
        <p className="text-sm text-slate-700">
          Vos <strong>codes de secours</strong>, affichés une seule fois.
          Notez-les ou imprimez-les et gardez-les à l’abri : chacun remplace une
          fois le code de l’application si vous perdez votre téléphone.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-marque-100 p-3 font-mono text-sm">
          {etat.codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={styles.boutonSecondaire}
            onClick={() => window.print()}
          >
            Imprimer
          </button>
          <a href={retour} className={styles.bouton}>
            J’ai noté mes codes
          </a>
        </div>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => envoyer(donnees));
      }}
    >
      {children}
      {etat?.erreur && <Alerte>{etat.erreur}</Alerte>}
      <div>
        <button type="submit" disabled={enCours} className={styles[style]}>
          {enCours ? 'Enregistrement…' : libelle}
        </button>
      </div>
    </form>
  );
}
