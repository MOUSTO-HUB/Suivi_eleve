import type { Metadata } from 'next';
import Link from 'next/link';
import { CadrePublic } from '@/components/cadre-public';
import { FormulaireAction } from '@/components/formulaire-action';
import { Alerte, Champ, parametre, Saisie, styles } from '@/components/ui';
import { choisirMotDePasse } from '../../connexion/actions';

export const metadata: Metadata = {
  title: 'Nouveau mot de passe · Suivi_eleve',
};

/** Ouverte depuis le lien reçu par email (jeton à usage unique, 30 minutes). */
export default async function NouveauMotDePasse(
  props: PageProps<'/mot-de-passe/nouveau'>,
) {
  const jeton = parametre((await props.searchParams).jeton);
  return (
    <CadrePublic titre="Choisir un nouveau mot de passe">
      {jeton ? (
        <FormulaireAction
          action={choisirMotDePasse}
          libelle="Enregistrer le mot de passe"
        >
          <input type="hidden" name="jeton" value={jeton} />
          <Champ
            libelle="Nouveau mot de passe"
            aide="Au moins 10 caractères, avec des lettres et des chiffres. Toutes vos sessions ouvertes seront fermées."
          >
            <Saisie
              type="password"
              name="nouveau"
              autoComplete="new-password"
              minLength={10}
              required
              autoFocus
            />
          </Champ>
          <Champ libelle="Confirmer le nouveau mot de passe">
            <Saisie
              type="password"
              name="confirmation"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </Champ>
        </FormulaireAction>
      ) : (
        <Alerte>
          Lien incomplet. Ouvrez le lien reçu par email, ou refaites une
          demande.
        </Alerte>
      )}
      <Link
        href="/mot-de-passe-oublie"
        className={`mt-4 block text-center text-sm ${styles.lien}`}
      >
        Refaire une demande
      </Link>
    </CadrePublic>
  );
}
