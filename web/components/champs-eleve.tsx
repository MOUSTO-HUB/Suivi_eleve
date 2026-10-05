import { Champ, Liste, Saisie } from './ui';
import { LIBELLES_LIEN, type Eleve, type LienTuteur } from '@/lib/types';

const AIDE_TELEPHONE = 'Format international, ex. +221 77 123 45 67';

/** Champs d'identité d'un élève (inscription et modification). */
export function ChampsIdentite({ eleve }: { eleve?: Eleve }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Champ libelle="Prénoms" obligatoire>
        <Saisie
          name="prenoms"
          defaultValue={eleve?.prenoms}
          required
          maxLength={100}
        />
      </Champ>
      <Champ libelle="Nom" obligatoire>
        <Saisie name="nom" defaultValue={eleve?.nom} required maxLength={100} />
      </Champ>
      <Champ libelle="Genre" obligatoire>
        <Liste name="genre" defaultValue={eleve?.genre ?? ''} required>
          <option value="" disabled>
            Choisir…
          </option>
          <option value="FEMININ">Féminin</option>
          <option value="MASCULIN">Masculin</option>
        </Liste>
      </Champ>
      <Champ
        libelle="Date de naissance"
        obligatoire
        aide="L'âge est calculé automatiquement."
      >
        <Saisie
          type="date"
          name="dateNaissance"
          defaultValue={eleve?.dateNaissance}
          required
        />
      </Champ>
      <Champ libelle="Téléphone de l'élève" aide={AIDE_TELEPHONE}>
        <Saisie
          type="tel"
          name="telephone"
          defaultValue={eleve?.telephone ?? ''}
        />
      </Champ>
    </div>
  );
}

/** Champs d'un tuteur ; `prefixe` distingue plusieurs tuteurs dans un même formulaire. */
export function ChampsTuteur({
  prefixe = '',
  obligatoire = false,
  lienParDefaut = 'PERE',
}: {
  prefixe?: string;
  obligatoire?: boolean;
  lienParDefaut?: LienTuteur;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Champ libelle="Prénoms" obligatoire={obligatoire}>
        <Saisie
          name={`${prefixe}prenoms`}
          required={obligatoire}
          maxLength={100}
        />
      </Champ>
      <Champ libelle="Nom" obligatoire={obligatoire}>
        <Saisie name={`${prefixe}nom`} required={obligatoire} maxLength={100} />
      </Champ>
      <Champ libelle="Lien avec l'élève">
        <Liste name={`${prefixe}lien`} defaultValue={lienParDefaut}>
          {Object.entries(LIBELLES_LIEN).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </Liste>
      </Champ>
      <Champ
        libelle="Contact_tuteur_1"
        obligatoire={obligatoire}
        aide={`${AIDE_TELEPHONE}. Un numéro déjà connu rattache le tuteur existant.`}
      >
        <Saisie type="tel" name={`${prefixe}contact1`} required={obligatoire} />
      </Champ>
      <Champ libelle="Contact_tuteur_2" aide={AIDE_TELEPHONE}>
        <Saisie type="tel" name={`${prefixe}contact2`} />
      </Champ>
      <Champ libelle="Email">
        <Saisie type="email" name={`${prefixe}email`} />
      </Champ>
    </div>
  );
}
