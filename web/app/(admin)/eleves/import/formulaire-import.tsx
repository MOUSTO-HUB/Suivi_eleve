'use client';

import { startTransition, useActionState } from 'react';
import { Alerte, cellule, Champ, styles, Tableau } from '@/components/ui';
import { importerEleves } from '../actions';

export function FormulaireImport() {
  const [etat, envoyer, enCours] = useActionState(importerEleves, null);
  const rapport = etat?.rapport;

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const donnees = new FormData(e.currentTarget);
          startTransition(() => envoyer(donnees));
        }}
      >
        <Champ
          libelle="Fichier"
          obligatoire
          aide="Excel (.xlsx) ou CSV, 2 000 lignes et 2 Mo au maximum."
        >
          <input
            type="file"
            name="fichier"
            accept=".xlsx,.csv"
            required
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </Champ>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="simulation" defaultChecked /> Vérifier
          seulement, sans rien enregistrer
        </label>
        {etat?.erreur && <Alerte>{etat.erreur}</Alerte>}
        <div>
          <button type="submit" disabled={enCours} className={styles.bouton}>
            {enCours ? 'Analyse en cours…' : 'Envoyer le fichier'}
          </button>
        </div>
      </form>

      {rapport && (
        <div className="flex flex-col gap-4">
          <Alerte type={rapport.erreurs.length ? 'info' : 'succes'}>
            {rapport.simulation
              ? `Vérification : ${rapport.valides} ligne(s) valide(s) sur ${rapport.totalLignes}. Rien n'a été enregistré : décochez « Vérifier seulement » pour importer.`
              : `Import terminé : ${rapport.crees} élève(s) inscrit(s) sur ${rapport.totalLignes} ligne(s).`}
          </Alerte>
          {rapport.erreurs.length > 0 && (
            <>
              <p className="text-sm font-medium text-slate-800">
                {rapport.erreurs.length} ligne(s) à corriger
                {rapport.simulation ? '' : ' (non importées)'} :
              </p>
              <Tableau entetes={['Ligne', 'Problème']}>
                {rapport.erreurs.map((e) => (
                  <tr key={e.ligne}>
                    <td className={`${cellule} font-mono`}>{e.ligne}</td>
                    <td className={`${cellule} whitespace-normal`}>
                      {e.messages.join(' ')}
                    </td>
                  </tr>
                ))}
              </Tableau>
            </>
          )}
        </div>
      )}
    </div>
  );
}
