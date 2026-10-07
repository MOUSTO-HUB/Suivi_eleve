import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import {
  Badge,
  Carte,
  cellule,
  Champ,
  EnTete,
  Liste,
  Saisie,
  styles,
  Tableau,
} from '@/components/ui';
import { lireApiOuNull } from '@/lib/api';
import { peutGererDossiers } from '@/lib/profil';
import { LIBELLES_LIEN, type TuteurDetail } from '@/lib/types';
import { modifierTuteur } from '../actions';

export const metadata: Metadata = { title: 'Tuteur · Suivi_eleve' };

export default async function FicheTuteur(props: PageProps<'/tuteurs/[id]'>) {
  const { id } = await props.params;
  const [tuteur, gestion] = await Promise.all([
    lireApiOuNull<TuteurDetail>(`/tuteurs/${id}`),
    peutGererDossiers(),
  ]);
  if (!tuteur) notFound();

  return (
    <>
      <EnTete
        titre={`${tuteur.prenoms} ${tuteur.nom}`}
        sousTitre={`${tuteur.contact1}${tuteur.contact2 ? ` · ${tuteur.contact2}` : ''}`}
        actions={
          <Link className={styles.boutonSecondaire} href="/tuteurs">
            Retour à la liste
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Carte titre="Élèves rattachés">
            <Tableau entetes={['Élève', 'Matricule', 'Classe', 'Lien', '']}>
              {tuteur.eleves.map((e) => (
                <tr key={e.id}>
                  <td className={cellule}>
                    <Link className={styles.lien} href={`/eleves/${e.id}`}>
                      {e.nom} {e.prenoms}
                    </Link>
                  </td>
                  <td className={`${cellule} font-mono text-xs`}>
                    {e.matricule}
                  </td>
                  <td className={cellule}>{e.classe?.nom ?? '—'}</td>
                  <td className={cellule}>{LIBELLES_LIEN[e.lien]}</td>
                  <td className={`${cellule} flex gap-1`}>
                    {e.principal && <Badge couleur="vert">Principal</Badge>}
                    {e.statut === 'ARCHIVE' && (
                      <Badge couleur="orange">Archivé</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </Tableau>
          </Carte>
        </div>
        <Carte titre={gestion ? 'Coordonnées' : 'Coordonnées (lecture seule)'}>
          {gestion ? (
            <FormulaireAction
              action={modifierTuteur.bind(null, tuteur.id)}
              libelle="Enregistrer"
            >
              <Champ libelle="Prénoms" obligatoire>
                <Saisie name="prenoms" defaultValue={tuteur.prenoms} required />
              </Champ>
              <Champ libelle="Nom" obligatoire>
                <Saisie name="nom" defaultValue={tuteur.nom} required />
              </Champ>
              <Champ
                libelle="Contact_tuteur_1"
                obligatoire
                aide="Format international."
              >
                <Saisie
                  type="tel"
                  name="contact1"
                  defaultValue={tuteur.contact1}
                  required
                />
              </Champ>
              <Champ libelle="Contact_tuteur_2">
                <Saisie
                  type="tel"
                  name="contact2"
                  defaultValue={tuteur.contact2 ?? ''}
                />
              </Champ>
              <Champ libelle="Email">
                <Saisie
                  type="email"
                  name="email"
                  defaultValue={tuteur.email ?? ''}
                />
              </Champ>
              <Champ libelle="Langue des messages">
                <Liste name="langue" defaultValue={tuteur.langue}>
                  <option value="FR">Français</option>
                  <option value="WO">Wolof</option>
                  <option value="EN">Anglais</option>
                </Liste>
              </Champ>
            </FormulaireAction>
          ) : (
            <dl className="flex flex-col gap-2 text-sm">
              <dt className="text-slate-500">Email</dt>
              <dd>{tuteur.email ?? '—'}</dd>
            </dl>
          )}
        </Carte>
      </div>
    </>
  );
}
