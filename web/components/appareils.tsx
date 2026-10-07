import { FormulaireAction } from './formulaire-action';
import { Badge, Champ, Liste, Saisie } from './ui';
import type { EtatFormulaire } from '@/lib/api';
import {
  LIBELLES_SIGNALEMENT,
  LIBELLES_STATUT_APPAREIL,
  LIBELLES_TYPE_APPAREIL,
  type Appareil,
  type StatutAppareil,
  type TypeSignalement,
} from '@/lib/types';

const COULEURS: Record<StatutAppareil, 'gris' | 'vert' | 'orange'> = {
  ACTIF: 'vert',
  RESTITUE: 'vert',
  PERDU: 'orange',
  TROUVE: 'orange',
  CONFISQUE: 'orange',
};

export function BadgeStatut({ statut }: { statut: StatutAppareil }) {
  return (
    <Badge couleur={COULEURS[statut]}>{LIBELLES_STATUT_APPAREIL[statut]}</Badge>
  );
}

/** Description d'un appareil (enregistrement et modification). */
export function ChampsAppareil({ appareil }: { appareil?: Appareil }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Champ libelle="Type" obligatoire>
        <Liste
          name="type"
          defaultValue={appareil?.type ?? 'TELEPHONE'}
          required
        >
          {Object.entries(LIBELLES_TYPE_APPAREIL).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </Liste>
      </Champ>
      <Champ libelle="Marque">
        <Saisie
          name="marque"
          defaultValue={appareil?.marque ?? ''}
          maxLength={60}
        />
      </Champ>
      <Champ libelle="Modèle">
        <Saisie
          name="modele"
          defaultValue={appareil?.modele ?? ''}
          maxLength={60}
        />
      </Champ>
      <Champ libelle="Couleur">
        <Saisie
          name="couleur"
          defaultValue={appareil?.couleur ?? ''}
          maxLength={40}
        />
      </Champ>
      <Champ libelle="Numéro de série">
        <Saisie
          name="numeroSerie"
          defaultValue={appareil?.numeroSerie ?? ''}
          maxLength={80}
        />
      </Champ>
      <Champ
        libelle="IMEI"
        aide="Téléphones : 15 chiffres, affichés en composant *#06#."
      >
        <Saisie
          name="imei"
          defaultValue={appareil?.imei ?? ''}
          inputMode="numeric"
          maxLength={20}
        />
      </Champ>
      <div className="sm:col-span-2">
        <Champ
          libelle="Signes distinctifs"
          aide="Coque, autocollant, rayure… pour le reconnaître."
        >
          <Saisie
            name="signesDistinctifs"
            defaultValue={appareil?.signesDistinctifs ?? ''}
            maxLength={500}
          />
        </Champ>
      </div>
    </div>
  );
}

/** Formulaire de signalement limité aux choix possibles pour ce rôle et ce statut. */
export function FormulaireSignalement({
  action,
  possibles,
}: {
  action: (
    e: EtatFormulaire | null,
    d: FormData,
  ) => Promise<EtatFormulaire | null>;
  possibles: TypeSignalement[];
}) {
  if (!possibles.length) {
    return (
      <p className="text-sm text-slate-500">
        Aucun signalement possible pour cet appareil avec votre rôle.
      </p>
    );
  }
  return (
    <FormulaireAction
      action={action}
      libelle="Enregistrer le signalement"
      reinitialiserSiSucces
    >
      <Champ libelle="Signalement" obligatoire>
        <Liste name="type" defaultValue={possibles[0]} required>
          {possibles.map((t) => (
            <option key={t} value={t}>
              {LIBELLES_SIGNALEMENT[t]}
            </option>
          ))}
        </Liste>
      </Champ>
      <Champ libelle="Lieu">
        <Saisie
          name="lieu"
          maxLength={120}
          placeholder="Ex. salle 12, cour, bus"
        />
      </Champ>
      <Champ
        libelle="Commentaire"
        aide="Transmis à la famille dans le message."
      >
        <Saisie name="commentaire" maxLength={500} />
      </Champ>
    </FormulaireAction>
  );
}
