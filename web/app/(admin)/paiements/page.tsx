import type { Metadata } from 'next';
import Link from 'next/link';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Badge,
  Carte,
  cellule,
  Champ,
  EnTete,
  Liste,
  Pagination,
  parametre,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApi, lireApiOuNull } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import {
  aujourdHui,
  dateFr,
  dateHeureFr,
  montant,
  peutRelancerPaiements,
  type Classe,
  type ClasseDetail,
  type ListeRappels,
} from '@/lib/types';
import { creerRappel, regler, relancer, supprimer } from './actions';

export const metadata: Metadata = { title: 'Paiements · Suivi_eleve' };

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/**
 * Rappels de paiement : la comptabilité reste dans les outils de l'école.
 * Le comptable signale un paiement en attente ; l'application prévient la famille
 * et calcule le retard depuis la date de paiement normale.
 */
export default async function PagePaiements(props: PageProps<'/paiements'>) {
  const sp = await props.searchParams;
  const classeSaisie = parametre(sp.saisie);
  const filtres = {
    statut: parametre(sp.statut) ?? 'EN_COURS',
    classeId: parametre(sp.classeId),
  };
  const requete = new URLSearchParams({ page: parametre(sp.page) ?? '1' });
  if (filtres.statut !== 'TOUS') requete.set('statut', filtres.statut);
  if (filtres.classeId) requete.set('classeId', filtres.classeId);

  const profil = await profilCourant();
  const monnaie = profil.ecole?.monnaie ?? 'FCFA';
  const comptable = peutRelancerPaiements(profil.role);
  const [rappels, classes, classe] = await Promise.all([
    lireApi<ListeRappels>(`/rappels-paiement?${requete.toString()}`),
    lireApi<Classe[]>('/classes'),
    classeSaisie
      ? lireApiOuNull<ClasseDetail>(`/classes/${classeSaisie}`)
      : Promise.resolve(null),
  ]);
  const [annee, mois] = aujourdHui().split('-').map(Number);
  const suggestions = [
    `Mensualité de ${MOIS[mois - 1]} ${annee}`,
    `Mensualité de ${MOIS[(mois + 10) % 12]} ${mois === 1 ? annee - 1 : annee}`,
    "Frais d'inscription",
  ];

  return (
    <>
      <EnTete
        titre="Paiements"
        sousTitre="Rappels aux familles pour les paiements en attente. Les familles sont relancées automatiquement 3 jours avant la date, le lendemain, puis chaque semaine (4 relances automatiques au plus). La comptabilité reste tenue dans les outils de l'école."
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Carte titre="En attente">
          <p className="text-3xl font-semibold text-slate-900">
            {montant(rappels.enAttente.montant, monnaie)}
          </p>
          <p className="text-sm text-slate-600">
            pour {rappels.enAttente.eleves} élève(s)
          </p>
        </Carte>

        {comptable && (
          <div className="lg:col-span-2">
            <Carte titre="Signaler un paiement en attente">
              <form className="mb-4 flex items-end gap-3">
                <Champ libelle="Classe">
                  <Liste
                    name="saisie"
                    defaultValue={classeSaisie ?? ''}
                    required
                  >
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </Liste>
                </Champ>
                <button type="submit" className={styles.boutonSecondaire}>
                  Afficher les élèves
                </button>
              </form>
              {classe && (
                <FormulaireAction
                  action={creerRappel}
                  libelle="Prévenir la famille"
                  confirmation="Envoyer ce rappel de paiement à la famille ?"
                  reinitialiserSiSucces
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Champ libelle="Élève" obligatoire>
                      <Liste name="eleveId" defaultValue="" required>
                        <option value="" disabled>
                          Choisir…
                        </option>
                        {classe.eleves.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nom} {e.prenoms}
                          </option>
                        ))}
                      </Liste>
                    </Champ>
                    <Champ
                      libelle="À payer"
                      obligatoire
                      aide="Ex. Mensualité d'octobre 2026"
                    >
                      <Saisie
                        name="libelle"
                        list="libelles"
                        required
                        maxLength={60}
                      />
                      <datalist id="libelles">
                        {suggestions.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </Champ>
                    <Champ libelle={`Montant (${monnaie})`} obligatoire>
                      <Saisie
                        name="montant"
                        inputMode="numeric"
                        required
                        placeholder="25 000"
                      />
                    </Champ>
                    <Champ
                      libelle="Date de paiement normale"
                      obligatoire
                      aide="Le retard est calculé à partir de cette date."
                    >
                      <Saisie type="date" name="dateEcheance" required />
                    </Champ>
                  </div>
                </FormulaireAction>
              )}
            </Carte>
          </div>
        )}
      </div>

      <form
        role="search"
        className="mb-4 grid gap-3 rounded-2xl border border-marque-100 bg-carte shadow-sm shadow-marque-900/5 p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <Liste name="statut" defaultValue={filtres.statut} aria-label="Statut">
          <option value="EN_COURS">En attente</option>
          <option value="REGLE">Réglés</option>
          <option value="TOUS">Tous</option>
        </Liste>
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
        <button type="submit" className={styles.bouton}>
          Filtrer
        </button>
      </form>

      <Tableau
        entetes={[
          'Élève',
          'À payer',
          'Montant',
          'Date normale',
          'Retard',
          'Rappels',
          '',
        ]}
        vide={
          rappels.total === 0 ? 'Aucun paiement pour ces critères.' : undefined
        }
      >
        {rappels.elements.map((r) => (
          <tr key={r.id} className="align-top">
            <td className={cellule}>
              <Link className={styles.lien} href={`/eleves/${r.eleve.id}`}>
                {r.eleve.nom} {r.eleve.prenoms}
              </Link>
              <span className="block text-xs text-slate-500">
                {r.eleve.classe?.nom}
              </span>
            </td>
            <td className={cellule}>{r.libelle}</td>
            <td className={`${cellule} font-medium`}>
              {montant(r.montant, monnaie)}
            </td>
            <td className={cellule}>{dateFr(r.dateEcheance)}</td>
            <td className={cellule}>
              {r.statut === 'REGLE' ? (
                <Badge couleur="vert">
                  Réglé
                  {r.regleLe
                    ? ` le ${dateHeureFr(r.regleLe).slice(0, 10)}`
                    : ''}
                </Badge>
              ) : r.joursRetard > 0 ? (
                <Badge couleur="orange">
                  {r.joursRetard} jour{r.joursRetard > 1 ? 's' : ''}
                </Badge>
              ) : (
                <Badge>À venir</Badge>
              )}
            </td>
            <td className={cellule}>
              {r.nombreEnvois}
              {r.dernierEnvoiLe && (
                <span className="block text-xs text-slate-500">
                  dernier : {dateHeureFr(r.dernierEnvoiLe)}
                </span>
              )}
              {r.statut === 'EN_COURS' && (
                <span className="block text-xs text-slate-500">
                  {r.prochaineRelanceAuto
                    ? `prochain automatique : ${dateFr(r.prochaineRelanceAuto)}`
                    : 'relances automatiques terminées'}
                </span>
              )}
            </td>
            <td className={cellule}>
              {comptable && r.statut === 'EN_COURS' && (
                <div className="flex flex-wrap gap-2">
                  <FormulaireAction
                    action={relancer.bind(null, r.id)}
                    libelle="Relancer"
                    style="boutonSecondaire"
                    confirmation={`Relancer la famille (${r.joursRetard} jour(s) de retard) ?`}
                    className="flex flex-col gap-1"
                  />
                  <FormulaireAction
                    action={regler.bind(null, r.id)}
                    libelle="Réglé"
                    confirmation="Le paiement a-t-il bien été constaté ?"
                    className="flex flex-col gap-1"
                  />
                  <FormulaireAction
                    action={supprimer.bind(null, r.id)}
                    libelle="Supprimer"
                    style="boutonDanger"
                    confirmation="Supprimer ce rappel saisi par erreur ? Les messages déjà envoyés ne sont pas rappelés."
                    className="flex flex-col gap-1"
                  />
                </div>
              )}
            </td>
          </tr>
        ))}
      </Tableau>
      <Pagination
        page={rappels.page}
        pages={rappels.pages}
        total={rappels.total}
        chemin="/paiements"
        parametres={filtres}
      />
    </>
  );
}
