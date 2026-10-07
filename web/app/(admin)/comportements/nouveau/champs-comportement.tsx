'use client';

import { useState } from 'react';
import { Champ, Liste, Saisie, Zone } from '@/components/ui';
import {
  CATEGORIES_COMPORTEMENT,
  LIBELLES_CATEGORIE,
  type TypeComportement,
} from '@/lib/types';

const GRAVITES = [
  [1, 'Léger', 'La famille est prévenue aussitôt.'],
  [2, 'Sérieux', 'La famille est prévenue aussitôt.'],
  [3, 'Grave', 'Validation par la direction avant tout message.'],
] as const;

/** Les champs s'adaptent : catégories, gravité, sanction et convocation selon le type. */
export function ChampsComportement({ direction }: { direction: boolean }) {
  const [type, setType] = useState<TypeComportement>('NEGATIF');
  const [gravite, setGravite] = useState(1);
  const negatif = type === 'NEGATIF';

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex gap-3">
        <legend className="mb-2 text-sm font-medium">Comportement</legend>
        {(
          [
            ['NEGATIF', 'À signaler'],
            ['POSITIF', 'À féliciter'],
          ] as const
        ).map(([valeur, libelle]) => (
          <label
            key={valeur}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm ${
              type === valeur
                ? 'border-marque-600 bg-marque-50'
                : 'border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="type"
              value={valeur}
              checked={type === valeur}
              onChange={() => setType(valeur)}
            />
            {libelle}
          </label>
        ))}
      </fieldset>

      <Champ libelle="Catégorie" obligatoire>
        <Liste
          name="categorie"
          key={type}
          defaultValue={CATEGORIES_COMPORTEMENT[type][0]}
          required
        >
          {CATEGORIES_COMPORTEMENT[type].map((c) => (
            <option key={c} value={c}>
              {LIBELLES_CATEGORIE[c]}
            </option>
          ))}
        </Liste>
      </Champ>

      {negatif && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Gravité</legend>
          <div className="flex flex-wrap gap-3">
            {GRAVITES.map(([valeur, libelle, aide]) => (
              <label
                key={valeur}
                className={`flex max-w-xs cursor-pointer flex-col rounded-md border p-3 text-sm ${
                  gravite === valeur
                    ? 'border-marque-600 bg-marque-50'
                    : 'border-slate-300'
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="gravite"
                    value={valeur}
                    checked={gravite === valeur}
                    onChange={() => setGravite(valeur)}
                  />
                  {valeur} · {libelle}
                </span>
                <span className="text-xs text-slate-500">
                  {valeur === 3 && direction
                    ? 'Signalé par la direction : envoyé aussitôt.'
                    : aide}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Champ
        libelle="Faits"
        obligatoire
        aide="Transmis à la famille : restez factuel et respectueux."
      >
        <Zone name="description" rows={4} required maxLength={1000} />
      </Champ>

      {negatif && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ libelle="Sanction">
            <Saisie
              name="sanction"
              maxLength={300}
              placeholder="Ex. une heure de retenue"
            />
          </Champ>
          <Champ
            libelle="Convoquer les parents le"
            aide="Heure locale (GMT) ; facultatif."
          >
            <Saisie type="datetime-local" name="convocationLe" />
          </Champ>
        </div>
      )}
    </div>
  );
}
