import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bouton, Carte, Champ, Ecran, Message, Texte } from '@/components/ui';
import { envoyer, ErreurApi, lire } from '@/lib/api';
import { CATEGORIES_COMPORTEMENT } from '@/lib/format';
import type { EleveTrouve, Page } from '@/lib/types';
import { degrade, useStyles, useTheme, type Couleurs } from '@/lib/theme';

function Choix<T extends string | number>({
  options,
  valeur,
  surChoix,
}: {
  options: readonly (readonly [T, string])[];
  valeur: T | null;
  surChoix: (v: T) => void;
}) {
  const { couleurs } = useTheme();
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.choix}>
      {options.map(([v, libelle]) => (
        <Pressable
          key={String(v)}
          onPress={() => surChoix(v)}
          accessibilityRole="radio"
          accessibilityState={{ checked: valeur === v }}
          style={[
            styles.option,
            valeur === v && [styles.optionActive, degrade(couleurs.degrade)],
          ]}
        >
          <Text
            style={[
              styles.optionTexte,
              valeur === v && { color: couleurs.surPrimaire },
            ]}
          >
            {libelle}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Signalement rapide depuis la classe ou la cour (gravité 3 : validé par la direction). */
export default function SignalerComportement() {
  const [recherche, setRecherche] = useState('');
  const [trouves, setTrouves] = useState<EleveTrouve[]>([]);
  const [eleve, setEleve] = useState<EleveTrouve | null>(null);
  const [type, setType] = useState<'POSITIF' | 'NEGATIF'>('NEGATIF');
  const [categorie, setCategorie] = useState<string | null>(null);
  const [gravite, setGravite] = useState<1 | 2 | 3>(1);
  const [description, setDescription] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const q = recherche.trim();
  const rechercheActive = q.length >= 2 && !eleve;
  const affiches = rechercheActive ? trouves : [];

  useEffect(() => {
    if (!rechercheActive) return;
    const minuteur = setTimeout(() => {
      lire<Page<EleveTrouve>>(`/eleves?q=${encodeURIComponent(q)}&parPage=10`)
        .then((p) => setTrouves(p.elements))
        .catch(() => setTrouves([]));
    }, 300);
    return () => clearTimeout(minuteur);
  }, [q, rechercheActive]);

  const enregistrer = async () => {
    if (!eleve || !categorie) return;
    setEnCours(true);
    setErreur(null);
    try {
      await envoyer('/comportements', 'POST', {
        eleveId: eleve.id,
        type,
        categorie,
        gravite: type === 'NEGATIF' ? gravite : undefined,
        description: description.trim(),
      });
      router.back();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur inattendue.');
      setEnCours(false);
    }
  };

  return (
    <Ecran>
      {eleve ? (
        <Carte accent="primaire">
          <Texte gras>
            {eleve.prenoms} {eleve.nom}
          </Texte>
          <Texte discret>{eleve.classe?.nom ?? 'Sans classe'}</Texte>
          <Bouton
            libelle="Changer d'élève"
            variante="secondaire"
            surAppui={() => setEleve(null)}
          />
        </Carte>
      ) : (
        <>
          <Champ
            libelle="Élève"
            placeholder="Nom, prénom ou matricule"
            autoCorrect={false}
            value={recherche}
            onChangeText={setRecherche}
          />
          {affiches.map((e) => (
            <Carte key={e.id} surAppui={() => setEleve(e)}>
              <Texte gras>
                {e.prenoms} {e.nom}
              </Texte>
              <Texte discret>
                {e.classe?.nom ?? 'Sans classe'} · {e.matricule}
              </Texte>
            </Carte>
          ))}
        </>
      )}

      <Texte gras>Type</Texte>
      <Choix
        options={[
          ['NEGATIF', 'À signaler'],
          ['POSITIF', 'Félicitations'],
        ]}
        valeur={type}
        surChoix={(t) => {
          setType(t);
          setCategorie(null);
        }}
      />
      <Texte gras>Catégorie</Texte>
      <Choix
        options={CATEGORIES_COMPORTEMENT[type]}
        valeur={categorie}
        surChoix={setCategorie}
      />
      {type === 'NEGATIF' && (
        <>
          <Texte gras>Gravité</Texte>
          <Choix
            options={[
              [1, '1 · légère'],
              [2, '2 · moyenne'],
              [3, '3 · grave'],
            ]}
            valeur={gravite}
            surChoix={setGravite}
          />
          {gravite === 3 && (
            <Message type="info">
              Un fait grave est validé par la direction avant d&apos;être envoyé
              à la famille.
            </Message>
          )}
        </>
      )}
      <Champ
        libelle="Description des faits"
        aide="Factuelle et respectueuse : elle est transmise à la famille."
        multiline
        maxLength={1000}
        value={description}
        onChangeText={setDescription}
      />
      {erreur && <Message>{erreur}</Message>}
      <Bouton
        libelle="Enregistrer"
        enCours={enCours}
        desactive={!eleve || !categorie || !description.trim()}
        surAppui={enregistrer}
      />
    </Ecran>
  );
}

const creerStyles = (couleurs: Couleurs) =>
  StyleSheet.create({
    choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    option: {
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: couleurs.bordure,
      backgroundColor: couleurs.carte,
      justifyContent: 'center',
    },
    optionActive: {
      backgroundColor: couleurs.primaire,
      borderColor: 'transparent',
    },
    optionTexte: { fontSize: 16, color: couleurs.texte },
  });
