import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import { TitreParent } from '@/components/parent';
import { Alerte, Badge, Carte, styles } from '@/components/ui';
import { lireApiOuNull } from '@/lib/api';
import { dateFr, heureFr, type EvenementParent } from '@/lib/types';
import { repondre } from '../../../actions';

export const metadata: Metadata = { title: 'Événement · Suivi_eleve' };

/** Détail d'un événement ; réponse oui / non pour chaque enfant concerné. */
export default async function Evenement(
  props: PageProps<'/parent/evenements/[id]'>,
) {
  const { id } = await props.params;
  const e = await lireApiOuNull<EvenementParent>(`/evenements/${id}`);
  if (!e) notFound();
  const annule = e.statut === 'ANNULEE';
  const ouvert = !annule && new Date(e.dateDebut) > new Date();
  const debut = e.dateDebut.slice(0, 10);
  const fin = e.dateFin?.slice(0, 10);

  return (
    <>
      <TitreParent
        titre={e.titre}
        sousTitre={`${dateFr(debut)} à ${heureFr(e.dateDebut)}${fin && fin !== debut ? ` au ${dateFr(fin)}` : ''}${e.lieu ? ` · ${e.lieu}` : ''}`}
        retour="/parent/evenements"
      />
      {annule && (
        <div className="mb-4">
          <Alerte>Cet événement est annulé.</Alerte>
        </div>
      )}
      <div className="flex flex-col gap-4">
        <Carte>
          <p className="whitespace-pre-line text-base leading-relaxed">
            {e.description}
          </p>
          {e.modalites && (
            <>
              <h2 className="mt-4 font-semibold">Modalités</h2>
              <p className="whitespace-pre-line">{e.modalites}</p>
            </>
          )}
        </Carte>
        {e.pieceJointe && (
          <a
            href={`/telechargements/piece-jointe-evenement/${e.id}`}
            target="_blank"
            rel="noreferrer"
            className={styles.boutonSecondaire}
          >
            {e.pieceJointe === 'PDF'
              ? 'Ouvrir le document (PDF)'
              : "Voir l'image jointe"}
          </a>
        )}
        {e.demandeReponse && (
          <Carte titre="Votre réponse">
            <p className="mb-4">{e.question}</p>
            <ul className="flex flex-col gap-4">
              {e.enfants.map((enfant) => (
                <li
                  key={enfant.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <p className="font-semibold">
                    {enfant.prenoms}
                    {enfant.classe ? ` (${enfant.classe.nom})` : ''}
                  </p>
                  <p className="my-2">
                    {enfant.reponse === null ? (
                      <Badge couleur="orange">Pas encore répondu</Badge>
                    ) : (
                      <Badge couleur={enfant.reponse ? 'vert' : 'gris'}>
                        Vous avez répondu : {enfant.reponse ? 'oui' : 'non'}
                      </Badge>
                    )}
                  </p>
                  {ouvert && (
                    <div className="flex gap-3">
                      {[true, false].map((oui) => (
                        <FormulaireAction
                          key={String(oui)}
                          action={repondre.bind(null, e.id, enfant.id, oui)}
                          libelle={oui ? 'Oui' : 'Non'}
                          libelleEnCours="…"
                          style={
                            enfant.reponse === oui
                              ? 'bouton'
                              : 'boutonSecondaire'
                          }
                          className="flex flex-1 flex-col gap-2 [&_button]:w-full [&_button]:py-3 [&_button]:text-base"
                        />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {!ouvert && !annule && (
              <p className="mt-3 text-sm text-slate-500">
                L&apos;événement a commencé : les réponses sont closes.
              </p>
            )}
          </Carte>
        )}
      </div>
    </>
  );
}
