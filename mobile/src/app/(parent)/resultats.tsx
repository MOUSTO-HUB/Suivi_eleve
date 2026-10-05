import { useState } from 'react';
import { View } from 'react-native';
import { ChoixEnfant } from '@/components/choix-enfant';
import {
  Bouton,
  Carte,
  Ecran,
  Etat,
  Ligne,
  Message,
  Texte,
  Titre,
} from '@/components/ui';
import { ErreurApi } from '@/lib/api';
import { useEnfants } from '@/lib/enfants';
import { noteFr, rangFr } from '@/lib/format';
import { ouvrirDocument } from '@/lib/fichiers';
import { useRequete } from '@/lib/requete';
import type { ResultatsEleve } from '@/lib/types';

/** Moyennes saisies par les professeurs, une fois publiées, et bulletins PDF. */
export default function Resultats() {
  const { enfant } = useEnfants();
  const r = useRequete<ResultatsEleve>(
    enfant ? `/resultats/eleves/${enfant.id}` : null,
  );
  const [telechargement, setTelechargement] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const publiees = (r.donnees?.periodes ?? []).filter(
    (p) => p.publie && p.resultat,
  );

  const bulletin = async (periodeId: string, libelle: string) => {
    if (!enfant) return;
    setTelechargement(periodeId);
    setErreur(null);
    try {
      await ouvrirDocument(
        `/resultats/eleves/${enfant.id}/bulletins/${periodeId}`,
        `bulletin-${enfant.prenoms}-${libelle}.pdf`.replace(/\s+/g, '-'),
      );
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur inattendue.');
    } finally {
      setTelechargement(null);
    }
  };

  return (
    <Ecran enChargement={r.chargement} surRafraichir={r.recharger}>
      <ChoixEnfant />
      <Etat
        chargement={r.chargement && !r.donnees}
        erreur={r.erreur}
        vide={
          r.donnees !== null &&
          !publiees.length &&
          "Aucun résultat publié pour l'instant."
        }
        surReessayer={r.recharger}
      />
      {r.donnees?.decision?.publie && (
        <Carte accent="primaire">
          <Texte gras>Décision de fin d&apos;année</Texte>
          <Titre>{r.donnees.decision.libelle}</Titre>
        </Carte>
      )}
      {publiees.map((p) => (
        <Carte key={p.id}>
          <Titre>{p.libelle}</Titre>
          <Ligne
            libelle="Moyenne générale"
            valeur={`${noteFr(p.resultat?.moyenne)} / 20`}
          />
          {p.resultat?.rang && (
            <Ligne
              libelle="Rang"
              valeur={`${rangFr(p.resultat.rang)} sur ${r.donnees?.effectif ?? '—'}`}
            />
          )}
          {p.resultat?.appreciation && (
            <Texte discret>« {p.resultat.appreciation} »</Texte>
          )}
          {p.matieres && p.matieres.length > 0 && (
            <View style={{ marginTop: 8, gap: 2 }}>
              <Texte gras>Par matière</Texte>
              {p.matieres.map((m) => (
                <View key={m.matiere.id}>
                  <Ligne libelle={m.matiere.nom} valeur={noteFr(m.moyenne)} />
                  {m.appreciation && <Texte discret>{m.appreciation}</Texte>}
                </View>
              ))}
            </View>
          )}
          <View style={{ marginTop: 8 }}>
            <Bouton
              libelle="Bulletin (PDF)"
              variante="secondaire"
              enCours={telechargement === p.id}
              surAppui={() => bulletin(p.id, p.libelle)}
            />
          </View>
        </Carte>
      ))}
      {erreur && <Message>{erreur}</Message>}
    </Ecran>
  );
}
