'use client';

import { useState } from 'react';
import { Champ, Liste, Saisie } from '@/components/ui';
import {
  formaterTelephone,
  LISTE_PAYS,
  longueurTelephone,
  TELEPHONE_PAYS,
} from '@/lib/pays';
import type { Pays } from '@/lib/types';

/**
 * Pays et numéro du parent : l'exemple, l'aide et le nombre de chiffres
 * suivent le pays choisi, et le numéro est découpé comme l'exemple pendant la saisie.
 */
export function ChampsTelephone({ paysInitial }: { paysInitial: Pays }) {
  const [pays, setPays] = useState<Pays>(paysInitial);
  const [numero, setNumero] = useState('');
  const { chiffres, indicatif, exemple } = TELEPHONE_PAYS[pays];

  return (
    <>
      <Champ libelle="Pays">
        <Liste
          name="pays"
          value={pays}
          onChange={(e) => {
            const nouveau = e.target.value as Pays;
            setPays(nouveau);
            // Le numéro déjà saisi suit le découpage du nouveau pays.
            setNumero((n) => formaterTelephone(n, nouveau));
          }}
        >
          {LISTE_PAYS.map((p) => (
            <option key={p.code} value={p.code}>
              {p.libelle}
            </option>
          ))}
        </Liste>
      </Champ>
      <Champ
        libelle="Votre numéro de téléphone"
        aide={`Le numéro donné à l'école lors de l'inscription : ${chiffres} chiffres, sans l'indicatif +${indicatif}.`}
      >
        <Saisie
          type="tel"
          name="telephone"
          inputMode="tel"
          autoComplete="tel"
          placeholder={exemple}
          maxLength={longueurTelephone(numero, pays)}
          value={numero}
          onChange={(e) => setNumero(formaterTelephone(e.target.value, pays))}
          required
          autoFocus
        />
      </Champ>
    </>
  );
}
