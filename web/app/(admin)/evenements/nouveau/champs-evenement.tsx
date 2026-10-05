'use client';

import { useState } from 'react';
import { Champ, Saisie, Zone } from '@/components/ui';
import type { Classe } from '@/lib/types';

/** Champs de l'événement : public, question aux parents et mode d'envoi. */
export function ChampsEvenement({
  classes,
  dateMin,
}: {
  classes: Classe[];
  dateMin: string;
}) {
  const [cible, setCible] = useState<'ECOLE' | 'CLASSES'>('ECOLE');
  const [reponse, setReponse] = useState(false);
  const [envoi, setEnvoi] = useState<'immediat' | 'programme'>('immediat');
  const [date, setDate] = useState('');

  return (
    <div className="flex flex-col gap-5">
      <Champ
        libelle="Titre"
        obligatoire
        aide="Repris dans le SMS : restez court."
      >
        <Saisie
          name="titre"
          required
          maxLength={80}
          placeholder="Ex. Kermesse de fin de trimestre"
        />
      </Champ>
      <Champ libelle="Description" obligatoire>
        <Zone name="description" rows={4} required maxLength={2000} />
      </Champ>

      <div className="grid gap-4 sm:grid-cols-3">
        <Champ libelle="Date" obligatoire>
          <Saisie
            type="date"
            name="date"
            min={dateMin}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Champ>
        <Champ libelle="Heure" obligatoire>
          <Saisie type="time" name="heure" required />
        </Champ>
        <Champ libelle="Jusqu'au" aide="Si l'événement dure plusieurs jours.">
          <Saisie type="date" name="dateFin" min={date || dateMin} />
        </Champ>
      </div>
      <Champ libelle="Lieu" obligatoire>
        <Saisie name="lieu" required maxLength={120} />
      </Champ>
      <Champ
        libelle="Modalités d'organisation"
        aide="Tenue, matériel, participation financière, heure de retour…"
      >
        <Zone name="modalites" rows={3} maxLength={1000} />
      </Champ>
      <Champ
        libelle="Pièce jointe"
        aide="PDF ou image (JPEG, PNG, WebP), 5 Mo au maximum : programme, autorisation à signer…"
      >
        <Saisie
          type="file"
          name="fichier"
          accept="application/pdf,image/jpeg,image/png,image/webp"
        />
      </Champ>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Qui est concerné ?</legend>
        <div className="flex gap-4 text-sm">
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

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-2 font-medium">Réponse des parents</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="reponse"
            value="oui"
            checked={reponse}
            onChange={(e) => setReponse(e.target.checked)}
          />
          Demander une réponse oui / non pour chaque enfant
        </label>
        {reponse && (
          <Champ libelle="Question posée" obligatoire>
            <Saisie
              name="question"
              required
              maxLength={200}
              placeholder="Ex. Autorisez-vous votre enfant à participer à la sortie ?"
            />
          </Champ>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-2 font-medium">Prévenir les familles</legend>
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
          À une date choisie
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
        <p className="text-xs text-zinc-500">
          Un rappel part automatiquement la veille de l&apos;événement à 18h.
        </p>
      </fieldset>
    </div>
  );
}
