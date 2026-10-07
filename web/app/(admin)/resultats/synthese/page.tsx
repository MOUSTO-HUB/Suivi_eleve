import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Alerte,
  Badge,
  cellule,
  EnTete,
  parametre,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { dateHeureFr, noteFr, type GrilleSaisie } from '@/lib/types';
import { enregistrerGeneraux, publierResultats } from '../actions';

export const metadata: Metadata = { title: 'Synthèse de classe · Suivi_eleve' };

/** Toutes les moyennes de la classe, saisie de la moyenne générale et du rang, publication. */
export default async function PageSynthese(
  props: PageProps<'/resultats/synthese'>,
) {
  const sp = await props.searchParams;
  const classeId = parametre(sp.classeId);
  const periodeId = parametre(sp.periodeId);
  if (!classeId || !periodeId) notFound();
  const grille = await lireApi<GrilleSaisie>(
    `/resultats/saisie?classeId=${classeId}&periodeId=${periodeId}`,
  );
  const cible = { classeId, periodeId };
  const effectif = grille.eleves.length;

  return (
    <>
      <EnTete
        titre={`${grille.classe.nom} · ${grille.periode.libelle}`}
        sousTitre={`${effectif} élèves · professeur principal : ${
          grille.classe.enseignantPrincipal
            ? `${grille.classe.enseignantPrincipal.prenoms} ${grille.classe.enseignantPrincipal.nom}`
            : 'non désigné'
        }`}
        actions={
          <Link
            className={styles.boutonSecondaire}
            href={`/resultats?periodeId=${periodeId}`}
          >
            Retour
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {grille.publie ? (
          <Badge couleur="vert">
            Publié{grille.publieLe ? ` le ${dateHeureFr(grille.publieLe)}` : ''}
          </Badge>
        ) : (
          <Badge couleur="orange">Non publié</Badge>
        )}
        <span className="text-sm text-slate-600">
          Avancement :{' '}
          {grille.matieres
            .map((m) => `${m.nom} ${m.saisies}/${effectif}`)
            .join(' · ')}
        </span>
      </div>

      <FormulaireAction
        action={enregistrerGeneraux.bind(null, cible)}
        libelle="Enregistrer moyennes générales et rangs"
        className="flex flex-col gap-4"
      >
        <Tableau
          entetes={[
            'Élève',
            ...grille.matieres.map((m) => m.nom),
            'Moyenne générale',
            'Rang',
            'Appréciation générale',
            'Bulletin',
          ]}
        >
          {grille.eleves.map((e) => (
            <tr key={e.id}>
              <td className={cellule}>
                <input type="hidden" name="eleveId" value={e.id} />
                {e.nom} {e.prenoms}
              </td>
              {grille.matieres.map((m) => (
                <td key={m.id} className={`${cellule} text-center`}>
                  {noteFr(e.moyennes[m.id]?.moyenne)}
                </td>
              ))}
              <td className={cellule}>
                <Saisie
                  name={`moyenne-${e.id}`}
                  defaultValue={
                    e.resultat?.moyenne == null
                      ? ''
                      : String(e.resultat.moyenne).replace('.', ',')
                  }
                  inputMode="decimal"
                  disabled={!grille.peutSaisirGeneral}
                  className="w-24"
                  aria-label={`Moyenne générale de ${e.prenoms}`}
                />
              </td>
              <td className={cellule}>
                <Saisie
                  name={`rang-${e.id}`}
                  type="number"
                  min={1}
                  max={effectif}
                  defaultValue={e.resultat?.rang ?? ''}
                  disabled={!grille.peutSaisirGeneral}
                  className="w-20"
                  aria-label={`Rang de ${e.prenoms}`}
                />
              </td>
              <td className={cellule}>
                <Saisie
                  name={`appreciation-${e.id}`}
                  defaultValue={e.resultat?.appreciation ?? ''}
                  maxLength={300}
                  disabled={!grille.peutSaisirGeneral}
                  className="min-w-64"
                  aria-label={`Appréciation générale de ${e.prenoms}`}
                />
              </td>
              <td className={cellule}>
                <a
                  className={styles.lien}
                  href={`/telechargements/bulletin/${e.id}/${periodeId}`}
                >
                  PDF{grille.publie ? '' : ' (provisoire)'}
                </a>
              </td>
            </tr>
          ))}
        </Tableau>
        {!grille.peutSaisirGeneral && (
          <Alerte type="info">
            Moyenne générale, rang et appréciation sont saisis par le professeur
            principal ou la direction
            {grille.publie
              ? ', et seule la direction peut les corriger après publication'
              : ''}
            .
          </Alerte>
        )}
      </FormulaireAction>

      {grille.peutPublier && (
        <div className="mt-6 rounded-2xl border border-marque-100 bg-carte shadow-sm shadow-marque-900/5 p-5">
          <h2 className="mb-2 font-semibold">Publication</h2>
          <p className="mb-3 text-sm text-slate-600">
            Les familles reçoivent la moyenne générale et le rang par SMS, et le
            bulletin dans l&apos;application. Après publication, les professeurs
            ne peuvent plus modifier leurs saisies. Une seconde publication
            n&apos;envoie pas de nouveau message.
          </p>
          <FormulaireAction
            action={publierResultats.bind(null, cible)}
            libelle={
              grille.publie
                ? 'Republier (corrections)'
                : 'Publier les résultats'
            }
            confirmation={`Publier les résultats de ${grille.classe.nom} pour ${grille.periode.libelle} et prévenir les familles ?`}
            className="flex flex-col gap-2"
          />
        </div>
      )}
    </>
  );
}
