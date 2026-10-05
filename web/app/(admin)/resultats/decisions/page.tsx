import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Alerte,
  Badge,
  cellule,
  EnTete,
  Liste,
  parametre,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { LIBELLES_DECISION, type Decisions } from '@/lib/types';
import { enregistrerDecisions, publierDecisions } from '../actions';

export const metadata: Metadata = {
  title: 'Décisions de fin d’année · Suivi_eleve',
};

export default async function PageDecisions(
  props: PageProps<'/resultats/decisions'>,
) {
  const classeId = parametre((await props.searchParams).classeId);
  if (!classeId) notFound();
  const decisions = await lireApi<Decisions>(
    `/resultats/decisions?classeId=${classeId}`,
  );

  return (
    <>
      <EnTete
        titre={`Décisions de fin d’année · ${decisions.classe.nom}`}
        sousTitre={`Année ${decisions.classe.anneeScolaire.libelle}`}
        actions={
          <Link className={styles.boutonSecondaire} href="/resultats">
            Retour
          </Link>
        }
      />
      <div className="mb-4">
        {decisions.publie ? (
          <Badge couleur="vert">Publiées</Badge>
        ) : (
          <Badge couleur="orange">Non publiées</Badge>
        )}
      </div>
      <FormulaireAction
        action={enregistrerDecisions.bind(null, classeId)}
        libelle="Enregistrer les décisions"
        className="flex flex-col gap-4"
      >
        <Tableau
          entetes={['Élève', 'Décision', 'Moyenne annuelle', 'Observation']}
        >
          {decisions.eleves.map((e) => (
            <tr key={e.id}>
              <td className={cellule}>
                <input type="hidden" name="eleveId" value={e.id} />
                {e.nom} {e.prenoms}
              </td>
              <td className={cellule}>
                <Liste
                  name={`decision-${e.id}`}
                  defaultValue={e.decision?.decision ?? ''}
                  disabled={!decisions.peutSaisir}
                  aria-label={`Décision pour ${e.prenoms}`}
                >
                  <option value="">—</option>
                  {Object.entries(LIBELLES_DECISION).map(
                    ([valeur, libelle]) => (
                      <option key={valeur} value={valeur}>
                        {libelle}
                      </option>
                    ),
                  )}
                </Liste>
              </td>
              <td className={cellule}>
                <Saisie
                  name={`moyenne-${e.id}`}
                  defaultValue={
                    e.decision?.moyenneAnnuelle == null
                      ? ''
                      : String(e.decision.moyenneAnnuelle).replace('.', ',')
                  }
                  inputMode="decimal"
                  disabled={!decisions.peutSaisir}
                  className="w-24"
                  aria-label={`Moyenne annuelle de ${e.prenoms}`}
                />
              </td>
              <td className={`${cellule} w-full`}>
                <Saisie
                  name={`observation-${e.id}`}
                  defaultValue={e.decision?.observation ?? ''}
                  maxLength={300}
                  disabled={!decisions.peutSaisir}
                  aria-label={`Observation pour ${e.prenoms}`}
                />
              </td>
            </tr>
          ))}
        </Tableau>
        {!decisions.peutSaisir && (
          <Alerte type="info">
            Les décisions sont saisies par le professeur principal ou la
            direction.
          </Alerte>
        )}
      </FormulaireAction>
      {decisions.peutPublier && (
        <div className="mt-6">
          <FormulaireAction
            action={publierDecisions.bind(null, classeId)}
            libelle="Publier les décisions et prévenir les familles"
            confirmation="Publier les décisions de fin d’année de cette classe ?"
            className="flex flex-col gap-2"
          />
        </div>
      )}
    </>
  );
}
