import Link from 'next/link';
import {
  COULEUR_ETAT_ABONNEMENT,
  dateFr,
  LIBELLES_ETAT_ABONNEMENT,
  LIBELLES_PAYS,
  type EcolePlateforme,
  type Pays,
  type SituationAbonnement,
} from '@/lib/types';
import { Badge, cellule, Champ, Liste, Saisie, styles, Tableau } from './ui';

/** « Actif », « En retard »… avec la couleur de l'état. */
export function BadgeAbonnement({
  abonnement,
}: {
  abonnement: SituationAbonnement;
}) {
  return (
    <Badge couleur={COULEUR_ETAT_ABONNEMENT[abonnement.etat]}>
      {LIBELLES_ETAT_ABONNEMENT[abonnement.etat]}
    </Badge>
  );
}

/** « dans 12 jours », « aujourd'hui », « depuis 3 jours ». */
export function echeanceFr(joursRestants: number): string {
  if (joursRestants === 0) return "dernier jour aujourd'hui";
  if (joursRestants > 0)
    return `encore ${joursRestants} jour${joursRestants > 1 ? 's' : ''}`;
  const retard = -joursRestants;
  return `terminé depuis ${retard} jour${retard > 1 ? 's' : ''}`;
}

export function TableauEcoles({
  ecoles,
  vide,
}: {
  ecoles: EcolePlateforme[];
  vide: string;
}) {
  return (
    <Tableau
      entetes={[
        'École',
        'Pays',
        'Abonnement',
        'Payé jusqu’au',
        'Élèves',
        'Familles',
      ]}
      vide={ecoles.length ? undefined : vide}
    >
      {ecoles.map((e) => (
        <tr key={e.id}>
          <td className={cellule}>
            <Link href={`/plateforme/ecoles/${e.id}`} className={styles.lien}>
              {e.nom}
            </Link>
          </td>
          <td className={cellule}>{LIBELLES_PAYS[e.pays]}</td>
          <td className={cellule}>
            <BadgeAbonnement abonnement={e.abonnement} />
          </td>
          <td className={cellule}>
            {dateFr(e.finAbonnement)}
            <span className="block text-xs text-slate-500">
              {echeanceFr(e.abonnement.joursRestants)}
            </span>
          </td>
          <td className={cellule}>{e.eleves}</td>
          <td className={cellule}>{e.familles}</td>
        </tr>
      ))}
    </Tableau>
  );
}
/** Champs communs à la création et à la modification d'une école. */
export function ChampsEcole({
  valeurs,
}: {
  valeurs?: {
    nom: string;
    pays: Pays;
    adresse: string | null;
    telephone: string | null;
    email: string | null;
  };
}) {
  return (
    <>
      <Champ libelle="Nom de l'école">
        <Saisie
          name="nom"
          defaultValue={valeurs?.nom}
          required
          maxLength={120}
        />
      </Champ>
      <Champ libelle="Pays">
        <Liste name="pays" defaultValue={valeurs?.pays ?? 'GN'} required>
          {(Object.keys(LIBELLES_PAYS) as Pays[]).map((p) => (
            <option key={p} value={p}>
              {LIBELLES_PAYS[p]}
            </option>
          ))}
        </Liste>
      </Champ>
      <Champ libelle="Adresse (facultatif)">
        <Saisie name="adresse" defaultValue={valeurs?.adresse ?? ''} />
      </Champ>
      <Champ
        libelle="Téléphone de l'école (facultatif)"
        aide="Format international, ex. +224 621 00 00 00"
      >
        <Saisie
          type="tel"
          name="telephone"
          defaultValue={valeurs?.telephone ?? ''}
        />
      </Champ>
      <Champ libelle="Email de l'école (facultatif)">
        <Saisie type="email" name="email" defaultValue={valeurs?.email ?? ''} />
      </Champ>
    </>
  );
}
