import type { Metadata } from 'next';
import { ChampsIdentite, ChampsTuteur } from '@/components/champs-eleve';
import { FormulaireAction } from '@/components/formulaire-action';
import { Carte, Champ, EnTete, Liste, Saisie } from '@/components/ui';
import { lireApi } from '@/lib/api';
import type { Classe } from '@/lib/types';
import { creerEleve } from '../actions';

export const metadata: Metadata = { title: 'Nouvel élève · Suivi_eleve' };

export default async function PageNouvelEleve() {
  const classes = await lireApi<Classe[]>('/classes');
  return (
    <>
      <EnTete
        titre="Nouvel élève"
        sousTitre="Le matricule est attribué automatiquement à l'enregistrement."
      />
      <FormulaireAction
        action={creerEleve}
        libelle="Inscrire l'élève"
        className="flex flex-col gap-6"
      >
        <Carte titre="Élève">
          <ChampsIdentite />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Champ libelle="Classe">
              <Liste name="classeId" defaultValue="">
                <option value="">Sans classe pour l&apos;instant</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} ({c.effectif} élèves)
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ
              libelle="Date d'inscription"
              aide="Par défaut : aujourd'hui."
            >
              <Saisie type="date" name="dateInscription" />
            </Champ>
          </div>
        </Carte>
        <Carte titre="Tuteur principal">
          <ChampsTuteur prefixe="tuteur1_" obligatoire />
        </Carte>
        <Carte titre="Second tuteur (facultatif)">
          <ChampsTuteur prefixe="tuteur2_" lienParDefaut="MERE" />
        </Carte>
      </FormulaireAction>
    </>
  );
}
