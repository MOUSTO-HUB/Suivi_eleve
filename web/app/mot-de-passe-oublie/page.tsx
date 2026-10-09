import type { Metadata } from 'next';
import Link from 'next/link';
import { CadrePublic } from '@/components/cadre-public';
import { FormulaireAction } from '@/components/formulaire-action';
import { Champ, Saisie, styles } from '@/components/ui';
import { VerificationRobot } from '@/components/verification-robot';
import { demanderLien } from '../connexion/actions';

export const metadata: Metadata = {
  title: 'Mot de passe oublié · Suivi_eleve',
};

/** Personnel : lien de réinitialisation envoyé par email. */
export default function MotDePasseOublie() {
  return (
    <CadrePublic titre="Mot de passe oublié">
      <p className="mb-4 text-sm text-slate-600">
        Saisissez l’email de votre compte : vous recevrez un lien pour choisir
        un nouveau mot de passe, valable 30 minutes. Les parents n’ont pas de
        mot de passe : ils se connectent avec le code reçu par SMS.
      </p>
      <FormulaireAction
        action={demanderLien}
        libelle="Recevoir le lien"
        libelleEnCours="Envoi…"
      >
        <Champ libelle="Email">
          <Saisie
            type="email"
            name="email"
            autoComplete="username"
            required
            autoFocus
          />
        </Champ>
        <VerificationRobot />
      </FormulaireAction>
      <Link
        href="/connexion?espace=personnel"
        className={`mt-4 block text-center text-sm ${styles.lien}`}
      >
        Retour à la connexion
      </Link>
    </CadrePublic>
  );
}
