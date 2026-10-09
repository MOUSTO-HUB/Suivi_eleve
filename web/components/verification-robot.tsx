'use client';

import { useEffect, useRef, useState } from 'react';
import { obtenirDefiAltcha } from '@/app/connexion/actions';
import { resoudreAltcha } from '@/lib/altcha';

type Etat = 'attente' | 'calcul' | 'verifie' | 'erreur';

/**
 * Case « Je ne suis pas un robot » (ALTCHA, sans service extérieur). La réponse
 * va dans le champ caché `altcha`. Elle ne sert qu'une fois : après chaque envoi
 * du formulaire, une nouvelle est calculée sans redemander de cocher.
 */
export function VerificationRobot() {
  const [etat, setEtat] = useState<Etat>('attente');
  const [reponse, setReponse] = useState('');
  const conteneur = useRef<HTMLDivElement>(null);
  const enCours = useRef(false);

  const verifier = async () => {
    if (enCours.current) return;
    enCours.current = true;
    setEtat('calcul');
    setReponse('');
    try {
      const defi = await obtenirDefiAltcha();
      if (!defi) throw new Error();
      setReponse(await resoudreAltcha(defi));
      setEtat('verifie');
    } catch {
      setEtat('erreur');
    } finally {
      enCours.current = false;
    }
  };

  // Après l'envoi (lu juste avant par le formulaire), la réponse est consommée : on en prépare une autre.
  useEffect(() => {
    const formulaire = conteneur.current?.closest('form');
    if (!formulaire) return;
    const apresEnvoi = () =>
      setTimeout(() => {
        if (etat === 'verifie') void verifier();
      }, 0);
    formulaire.addEventListener('submit', apresEnvoi);
    return () => formulaire.removeEventListener('submit', apresEnvoi);
  });

  return (
    <div
      ref={conteneur}
      className="flex items-center gap-3 rounded-lg border border-slate-300 bg-carte px-3 py-2.5 text-sm"
    >
      <input type="hidden" name="altcha" value={reponse} />
      <input
        id="pas-un-robot"
        type="checkbox"
        className="h-5 w-5 accent-marque-600"
        checked={etat === 'verifie' || etat === 'calcul'}
        disabled={etat === 'calcul'}
        onChange={(e) => {
          if (e.target.checked) void verifier();
          else {
            setEtat('attente');
            setReponse('');
          }
        }}
      />
      <label htmlFor="pas-un-robot" className="flex-1 text-slate-800">
        {etat === 'calcul'
          ? 'Vérification…'
          : etat === 'verifie'
            ? 'Vérifié : vous n’êtes pas un robot'
            : etat === 'erreur'
              ? 'Vérification impossible, cochez à nouveau'
              : 'Je ne suis pas un robot'}
      </label>
      <span className="text-[10px] tracking-wide text-slate-400 uppercase">
        ALTCHA
      </span>
    </div>
  );
}
