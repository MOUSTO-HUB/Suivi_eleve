'use client';

import { useState } from 'react';
import { Champ, Liste, Saisie, Zone } from '@/components/ui';
import {
  aujourdHui,
  LIBELLES_MOTIF_ANNONCE,
  type Classe,
  type TypeAnnonce,
} from '@/lib/types';

const CRENEAUX = ['toute la journée', 'le matin', "l'après-midi"];

/** Champs qui s'adaptent au type d'annonce, à la cible et au mode d'envoi. */
export function ChampsAnnonce({
  typeInitial,
  classes,
}: {
  typeInitial: TypeAnnonce;
  classes: Classe[];
}) {
  const [type, setType] = useState<TypeAnnonce>(typeInitial);
  const [cible, setCible] = useState<'ECOLE' | 'CLASSES'>('CLASSES');
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState<'immediat' | 'programme'>('immediat');
  const liberation = type === 'LIBERATION_ANTICIPEE';

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-2 text-sm font-medium">Annonce</legend>
        {(
          [
            [
              'LIBERATION_ANTICIPEE',
              'Libération anticipée',
              'Les élèves sortent plus tôt que prévu (message urgent).',
            ],
            [
              'PAS_DE_COURS',
              'Pas de cours',
              'Cours annulés un jour ou un créneau.',
            ],
          ] as const
        ).map(([valeur, libelle, aide]) => (
          <label
            key={valeur}
            className={`flex max-w-xs cursor-pointer flex-col rounded-md border p-3 text-sm ${
              type === valeur
                ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950'
                : 'border-zinc-300 dark:border-zinc-700'
            }`}
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name="type"
                value={valeur}
                checked={type === valeur}
                onChange={() => setType(valeur)}
              />
              {libelle}
            </span>
            <span className="text-xs text-zinc-500">{aide}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Qui est concerné ?</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="cible"
              value="CLASSES"
              checked={cible === 'CLASSES'}
              onChange={() => setCible('CLASSES')}
            />
            Certaines classes
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="cible"
              value="ECOLE"
              checked={cible === 'ECOLE'}
              onChange={() => setCible('ECOLE')}
            />
            Toute l&apos;école
          </label>
        </div>
        {cible === 'CLASSES' && (
          <div className="grid grid-cols-2 gap-2 rounded-md border border-zinc-200 p-3 text-sm sm:grid-cols-4 dark:border-zinc-700">
            {classes.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input type="checkbox" name="classeIds" value={c.id} />
                {c.nom}{' '}
                <span className="text-xs text-zinc-500">({c.effectif})</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Champ libelle="Date" obligatoire>
          <Saisie
            type="date"
            name="date"
            defaultValue={aujourdHui()}
            required
          />
        </Champ>
        {liberation ? (
          <Champ libelle="Heure de sortie" obligatoire>
            <Saisie type="time" name="heure" required />
          </Champ>
        ) : (
          <Champ
            libelle="Créneau"
            obligatoire
            aide="Ex. toute la journée, le matin, de 8h à 10h"
          >
            <Saisie
              name="creneau"
              list="creneaux"
              defaultValue="toute la journée"
              required
              maxLength={80}
            />
            <datalist id="creneaux">
              {CRENEAUX.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Champ>
        )}
        <Champ libelle="Motif" obligatoire>
          <Liste
            name="motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            required
          >
            <option value="" disabled>
              Choisir…
            </option>
            {Object.entries(LIBELLES_MOTIF_ANNONCE).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </Liste>
        </Champ>
        {motif === 'AUTRE' && (
          <Champ libelle="Précisez le motif" obligatoire>
            <Saisie name="motifDetail" required maxLength={120} />
          </Champ>
        )}
      </div>

      <Champ
        libelle="Message complémentaire"
        aide="Ajouté à l'email et dans l'application (pas au SMS)."
      >
        <Zone name="message" rows={3} maxLength={1000} />
      </Champ>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-2 font-medium">Envoi</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="envoi"
            value="immediat"
            checked={envoi === 'immediat'}
            onChange={() => setEnvoi('immediat')}
          />
          Tout de suite
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="envoi"
            value="programme"
            checked={envoi === 'programme'}
            onChange={() => setEnvoi('programme')}
          />
          Programmer (ex. la veille à 18h)
        </label>
        {envoi === 'programme' && (
          <div className="max-w-xs">
            <Saisie
              type="datetime-local"
              name="programmeeLe"
              required
              aria-label="Date et heure d'envoi"
            />
          </div>
        )}
      </fieldset>
    </div>
  );
}
