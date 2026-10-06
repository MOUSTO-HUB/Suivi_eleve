import type { Metadata } from 'next';
import { FormulaireAction } from '@/components/formulaire-action';
import { ChampsEcole } from '@/components/plateforme';
import { Carte, Champ, EnTete, Saisie } from '@/components/ui';
import { creerEcole } from '../../actions';

export const metadata: Metadata = {
  title: 'Nouvelle école · Concepteur · Suivi_eleve',
};

export default function NouvelleEcole() {
  return (
    <>
      <EnTete
        titre="Nouvelle école"
        sousTitre="L'école commence par 1 mois d'essai gratuit. Son année scolaire (3 trimestres) et le compte de sa direction sont créés en même temps."
      />
      <div className="max-w-xl">
        <Carte>
          <FormulaireAction
            action={creerEcole}
            libelle="Créer l'école"
            libelleEnCours="Création…"
            reinitialiserSiSucces
          >
            <ChampsEcole />
            <h2 className="mt-2 font-medium">Compte de la direction</h2>
            <Champ libelle="Prénom(s) du directeur ou de la directrice">
              <Saisie name="directionPrenoms" required maxLength={80} />
            </Champ>
            <Champ libelle="Nom">
              <Saisie name="directionNom" required maxLength={80} />
            </Champ>
            <Champ
              libelle="Email (identifiant de connexion)"
              aide="Un mot de passe provisoire s'affichera une seule fois après la création : transmettez-le à la direction."
            >
              <Saisie type="email" name="directionEmail" required />
            </Champ>
          </FormulaireAction>
        </Carte>
      </div>
    </>
  );
}
