import type { Metadata } from 'next';
import { DoubleAuth } from '@/components/double-auth';
import { FormulaireAction } from '@/components/formulaire-action';
import { Carte, Champ, EnTete, Saisie } from '@/components/ui';
import { profilCourant } from '@/lib/profil';
import { LIBELLES_ROLE } from '@/lib/types';
import { changerMotDePasse } from './actions';

export const metadata: Metadata = { title: 'Mon compte · Suivi_eleve' };

export default async function MonCompte() {
  const profil = await profilCourant();
  return (
    <>
      <EnTete
        titre="Mon compte"
        sousTitre={`${profil.prenoms} ${profil.nom} · ${LIBELLES_ROLE[profil.role]}${profil.email ? ` · ${profil.email}` : ''}`}
      />
      <div className="flex max-w-md flex-col gap-6">
        <DoubleAuth lienApplication="/compte/application" />
        <Carte titre="Changer mon mot de passe">
          <FormulaireAction
            action={changerMotDePasse}
            libelle="Changer le mot de passe"
            reinitialiserSiSucces
          >
            <Champ libelle="Mot de passe actuel">
              <Saisie
                type="password"
                name="actuel"
                autoComplete="current-password"
                required
              />
            </Champ>
            <Champ
              libelle="Nouveau mot de passe"
              aide="Au moins 10 caractères, avec des lettres et des chiffres."
            >
              <Saisie
                type="password"
                name="nouveau"
                autoComplete="new-password"
                minLength={10}
                required
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
        </Carte>
      </div>
    </>
  );
}
