import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Alerte,
  Badge,
  Carte,
  cellule,
  EnTete,
  Liste,
  Pagination,
  parametre,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import {
  dateHeureFr,
  LIBELLES_CATEGORIE,
  LIBELLES_STATUT_VALIDATION,
  peutGerer,
  peutSignaler,
  type Classe,
  type Comportement,
  type Page,
  type StatutValidation,
} from '@/lib/types';
import {
  rejeterComportement,
  supprimerComportement,
  validerComportement,
} from './actions';

export const metadata: Metadata = { title: 'Comportement · Suivi_eleve' };

type ListeComportements = Page<Comportement> & { aValider: number };

const COULEUR_STATUT: Record<StatutValidation, 'gris' | 'vert' | 'orange'> = {
  EN_ATTENTE: 'orange',
  VALIDE: 'vert',
  REJETE: 'gris',
};

function Titre({ c }: { c: Comportement }) {
  return (
    <>
      <Badge couleur={c.type === 'POSITIF' ? 'vert' : 'orange'}>
        {LIBELLES_CATEGORIE[c.categorie]}
        {c.type === 'NEGATIF' ? ` · gravité ${c.gravite}` : ''}
      </Badge>{' '}
      <Link className={styles.lien} href={`/eleves/${c.eleve.id}`}>
        {c.eleve.prenoms} {c.eleve.nom}
      </Link>{' '}
      <span className="text-xs text-slate-500">{c.eleve.classe?.nom}</span>
    </>
  );
}

export default async function PageComportements(
  props: PageProps<'/comportements'>,
) {
  const sp = await props.searchParams;
  const signale = parametre(sp.signale);
  const filtres = {
    classeId: parametre(sp.classeId),
    type: parametre(sp.type),
    statut: parametre(sp.statut),
  };
  const requete = new URLSearchParams({ page: parametre(sp.page) ?? '1' });
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur) requete.set(cle, valeur);
  }
  const profil = await profilCourant();
  const direction = profil.role === 'ADMIN';
  const [liste, aValider, convocations, classes] = await Promise.all([
    lireApi<ListeComportements>(`/comportements?${requete.toString()}`),
    direction
      ? lireApi<ListeComportements>(
          '/comportements?statut=EN_ATTENTE&parPage=50',
        )
      : Promise.resolve(null),
    lireApi<ListeComportements>('/comportements?convocations=true&parPage=10'),
    lireApi<Classe[]>('/classes'),
  ]);

  return (
    <>
      <EnTete
        titre="Comportement"
        sousTitre="Comportements marquants des élèves et convocations des parents"
        actions={
          peutSignaler(profil.role) && (
            <Link className={styles.bouton} href="/comportements/nouveau">
              Signaler un comportement
            </Link>
          )
        }
      />
      {signale && (
        <div className="mb-4">
          <Alerte type="succes">
            {signale === 'EN_ATTENTE'
              ? 'Comportement enregistré. Cas grave : la direction doit le valider avant que la famille soit prévenue.'
              : 'Comportement enregistré ; la famille est prévenue.'}
          </Alerte>
        </div>
      )}

      {aValider && aValider.total > 0 && (
        <Carte titre={`À valider (${aValider.total})`}>
          <ul className="flex flex-col divide-y divide-slate-100">
            {aValider.elements.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3 text-sm">
                <p>
                  <Titre c={c} />
                </p>
                <p className="whitespace-pre-line">{c.description}</p>
                {c.sanction && <p>Sanction : {c.sanction}</p>}
                {c.convocationLe && (
                  <p>Convocation : {dateHeureFr(c.convocationLe)}</p>
                )}
                <p className="text-xs text-slate-500">
                  Signalé par {c.auteur?.prenoms} {c.auteur?.nom} le{' '}
                  {dateHeureFr(c.date)}
                </p>
                <div className="flex flex-wrap items-start gap-3">
                  <FormulaireAction
                    action={validerComportement.bind(null, c.id)}
                    libelle="Valider et prévenir la famille"
                    className="flex flex-col gap-1"
                  />
                  <details>
                    <summary className="cursor-pointer py-2 text-sm text-red-700">
                      Refuser
                    </summary>
                    <FormulaireAction
                      action={rejeterComportement.bind(null, c.id)}
                      libelle="Confirmer le refus"
                      style="boutonDanger"
                      className="mt-2 flex flex-col gap-2"
                    >
                      <Saisie
                        name="motif"
                        required
                        maxLength={300}
                        placeholder="Motif du refus"
                      />
                    </FormulaireAction>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {convocations.total > 0 && (
        <div className="my-4">
          <Carte titre="Convocations à venir">
            <ul className="flex flex-col gap-2 text-sm">
              {convocations.elements.map((c) => (
                <li key={c.id}>
                  <span className="font-medium">
                    {c.convocationLe && dateHeureFr(c.convocationLe)}
                  </span>{' '}
                  · <Titre c={c} />
                </li>
              ))}
            </ul>
          </Carte>
        </div>
      )}

      <form
        role="search"
        className="my-4 grid gap-3 rounded-2xl border border-marque-100 bg-white shadow-sm shadow-marque-900/5 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <Liste
          name="classeId"
          defaultValue={filtres.classeId ?? ''}
          aria-label="Classe"
        >
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </Liste>
        <Liste name="type" defaultValue={filtres.type ?? ''} aria-label="Type">
          <option value="">Positifs et négatifs</option>
          <option value="POSITIF">Positifs</option>
          <option value="NEGATIF">Négatifs</option>
        </Liste>
        <Liste
          name="statut"
          defaultValue={filtres.statut ?? ''}
          aria-label="Statut"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(LIBELLES_STATUT_VALIDATION).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Liste>
        <button type="submit" className={styles.bouton}>
          Filtrer
        </button>
      </form>

      <Tableau
        entetes={['Date', 'Comportement', 'Faits', 'Statut', '']}
        vide={
          liste.total === 0
            ? 'Aucun comportement pour ces critères.'
            : undefined
        }
      >
        {liste.elements.map((c) => (
          <tr key={c.id} className="align-top">
            <td className={cellule}>{dateHeureFr(c.date)}</td>
            <td className={`${cellule} whitespace-normal`}>
              <Titre c={c} />
              {c.auteur && (
                <span className="block text-xs text-slate-500">
                  par {c.auteur.prenoms} {c.auteur.nom}
                </span>
              )}
            </td>
            <td className={`${cellule} max-w-md whitespace-normal`}>
              {c.description}
              {c.sanction && (
                <span className="block text-xs">Sanction : {c.sanction}</span>
              )}
              {c.convocationLe && (
                <span className="block text-xs">
                  Convocation : {dateHeureFr(c.convocationLe)}
                </span>
              )}
            </td>
            <td className={cellule}>
              <Badge couleur={COULEUR_STATUT[c.statut]}>
                {LIBELLES_STATUT_VALIDATION[c.statut]}
              </Badge>
              {c.motifRejet && (
                <span className="block text-xs">{c.motifRejet}</span>
              )}
            </td>
            <td className={cellule}>
              {peutGerer(profil.role) && (
                <FormulaireAction
                  action={supprimerComportement.bind(null, c.id)}
                  libelle="Supprimer"
                  style="boutonDanger"
                  confirmation="Supprimer ce comportement saisi par erreur ? Un message déjà envoyé n'est pas rappelé."
                  className="flex flex-col"
                />
              )}
            </td>
          </tr>
        ))}
      </Tableau>
      <Pagination
        page={liste.page}
        pages={liste.pages}
        total={liste.total}
        chemin="/comportements"
        parametres={filtres}
      />
    </>
  );
}
