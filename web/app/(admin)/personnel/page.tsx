import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Badge,
  Carte,
  cellule,
  Champ,
  EnTete,
  Liste,
  Saisie,
  Tableau,
} from '@/components/ui';
import { lireApi } from '@/lib/api';
import { profilCourant } from '@/lib/profil';
import { dateHeureFr, heureFr, LIBELLES_ROLE, type Role } from '@/lib/types';
import {
  changerRole,
  creerCompte,
  modifierCompte,
  reinitialiser,
} from './actions';

export const metadata: Metadata = { title: 'Personnel · Suivi_eleve' };

interface Compte {
  id: string;
  prenoms: string;
  nom: string;
  email: string | null;
  role: Role;
  actif: boolean;
  derniereConnexion: string | null;
  /** Bloqué après 3 essais incorrects (30 minutes, puis 3 heures). */
  bloqueJusquA: string | null;
  /** Désactivé au 3e blocage : à réactiver. */
  verrouilleLe: string | null;
  doubleAuth: 'APPLICATION' | 'EMAIL' | null;
}

const estBloque = (c: Compte) =>
  c.bloqueJusquA !== null && new Date(c.bloqueJusquA) > new Date();

const ROLES: Role[] = [
  'ADMIN',
  'SECRETARIAT',
  'ENSEIGNANT',
  'SURVEILLANT',
  'COMPTABLE',
];

function ChoixRole({ defaut }: { defaut?: Role }) {
  return (
    <Liste name="role" defaultValue={defaut ?? 'ENSEIGNANT'} required>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {LIBELLES_ROLE[r]}
        </option>
      ))}
    </Liste>
  );
}

/** Comptes du personnel : création, rôle, désactivation, mot de passe (direction). */
export default async function Personnel() {
  const profil = await profilCourant();
  if (profil.role !== 'ADMIN') redirect('/acces-refuse');
  const comptes = await lireApi<Compte[]>('/utilisateurs');

  return (
    <>
      <EnTete
        titre="Personnel"
        sousTitre="Comptes de connexion de l'équipe. Les parents n'ont pas de compte à créer : ils se connectent avec leur numéro."
      />
      <div className="flex flex-col gap-6">
        <Carte titre="Nouveau compte">
          <FormulaireAction
            action={creerCompte}
            libelle="Créer le compte"
            reinitialiserSiSucces
            className="grid gap-4 sm:grid-cols-2"
          >
            <Champ libelle="Prénom(s)" obligatoire>
              <Saisie name="prenoms" required maxLength={80} />
            </Champ>
            <Champ libelle="Nom" obligatoire>
              <Saisie name="nom" required maxLength={80} />
            </Champ>
            <Champ libelle="Email (identifiant de connexion)" obligatoire>
              <Saisie type="email" name="email" required />
            </Champ>
            <Champ libelle="Rôle" obligatoire>
              <ChoixRole />
            </Champ>
          </FormulaireAction>
        </Carte>

        <Tableau
          entetes={['Nom', 'Email', 'Rôle', 'Dernière connexion', 'Actions']}
        >
          {comptes.map((c) => {
            const soi = c.id === profil.id;
            return (
              <tr key={c.id} className={c.actif ? '' : 'opacity-60'}>
                <td className={cellule}>
                  {c.prenoms} {c.nom}
                  {c.verrouilleLe ? (
                    <span className="ml-2">
                      <Badge couleur="orange">
                        Désactivé : trop d’essais incorrects
                      </Badge>
                    </span>
                  ) : !c.actif ? (
                    <span className="ml-2">
                      <Badge>Désactivé</Badge>
                    </span>
                  ) : (
                    estBloque(c) && (
                      <span className="ml-2">
                        <Badge couleur="orange">
                          Bloqué jusqu’à {heureFr(c.bloqueJusquA!)}
                        </Badge>
                      </span>
                    )
                  )}
                  {c.doubleAuth && (
                    <span className="ml-2">
                      <Badge couleur="vert">
                        Double auth. :{' '}
                        {c.doubleAuth === 'APPLICATION'
                          ? 'application'
                          : 'email'}
                      </Badge>
                    </span>
                  )}
                </td>
                <td className={cellule}>{c.email}</td>
                <td className={cellule}>
                  {soi ? (
                    LIBELLES_ROLE[c.role]
                  ) : (
                    <FormulaireAction
                      action={changerRole.bind(null, c.id)}
                      libelle="Changer"
                      style="boutonSecondaire"
                      className="flex items-center gap-2"
                    >
                      <ChoixRole defaut={c.role} />
                    </FormulaireAction>
                  )}
                </td>
                <td className={cellule}>
                  {c.derniereConnexion
                    ? dateHeureFr(c.derniereConnexion)
                    : 'jamais'}
                </td>
                <td className={cellule}>
                  {!soi && (
                    <div className="flex flex-col gap-2">
                      {c.actif && estBloque(c) && (
                        <FormulaireAction
                          action={modifierCompte.bind(null, c.id, {
                            actif: true,
                          })}
                          libelle="Débloquer"
                          style="boutonSecondaire"
                        />
                      )}
                      <FormulaireAction
                        action={reinitialiser.bind(null, c.id)}
                        libelle="Nouveau mot de passe"
                        style="boutonSecondaire"
                        confirmation={`Générer un nouveau mot de passe pour ${c.prenoms} ${c.nom} ? Ses sessions seront fermées.`}
                      />
                      <FormulaireAction
                        action={modifierCompte.bind(null, c.id, {
                          actif: !c.actif,
                        })}
                        libelle={c.actif ? 'Désactiver' : 'Réactiver'}
                        style={c.actif ? 'boutonDanger' : 'boutonSecondaire'}
                        confirmation={
                          c.actif
                            ? `Désactiver le compte de ${c.prenoms} ${c.nom} ? Il ne pourra plus se connecter.`
                            : undefined
                        }
                      />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </Tableau>
      </div>
    </>
  );
}
