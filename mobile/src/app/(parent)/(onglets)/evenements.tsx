import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Carte, couleurs, Ecran, Etat, Pastille, Texte } from '@/components/ui';
import { dateFr, heureFr, jourIso } from '@/lib/format';
import { useRequete } from '@/lib/requete';
import type { Evenement } from '@/lib/types';

/** Calendrier : événements des trois prochains mois, regroupés par mois. */
export default function Evenements() {
  const r = useRequete<Evenement[]>(
    `/evenements?du=${jourIso(0)}&au=${jourIso(92)}`,
  );
  const evenements = r.donnees ?? [];
  const parMois = new Map<string, Evenement[]>();
  for (const e of evenements) {
    const mois = new Date(e.dateDebut).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Dakar',
    });
    parMois.set(mois, [...(parMois.get(mois) ?? []), e]);
  }

  return (
    <Ecran enChargement={r.chargement} surRafraichir={r.recharger}>
      <Etat
        chargement={r.chargement && !r.donnees}
        erreur={r.erreur}
        vide={
          r.donnees !== null &&
          !evenements.length &&
          'Aucun événement prévu pour le moment.'
        }
        surReessayer={r.recharger}
      />
      {[...parMois].map(([mois, liste]) => (
        <View key={mois} style={{ gap: 10 }}>
          <Text style={styles.mois}>{mois}</Text>
          {liste.map((e) => {
            const enAttente =
              e.demandeReponse &&
              e.statut === 'ENVOYEE' &&
              e.enfants.some((x) => x.reponse === null);
            return (
              <Carte
                key={e.id}
                surAppui={() => router.push(`/evenement/${e.id}`)}
                accent={
                  e.statut === 'ANNULEE'
                    ? undefined
                    : enAttente
                      ? 'alerte'
                      : 'primaire'
                }
              >
                <View style={styles.rangee}>
                  <View style={styles.date}>
                    <Text style={styles.jour}>
                      {new Date(e.dateDebut).getUTCDate()}
                    </Text>
                    <Text style={styles.heure}>{heureFr(e.dateDebut)}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={[
                        styles.titre,
                        e.statut === 'ANNULEE' && styles.annule,
                      ]}
                    >
                      {e.titre}
                    </Text>
                    {e.lieu && <Texte discret>{e.lieu}</Texte>}
                    {e.dateFin && dateFr(e.dateFin) !== dateFr(e.dateDebut) && (
                      <Texte discret>Jusqu&apos;au {dateFr(e.dateFin)}</Texte>
                    )}
                    {e.statut === 'ANNULEE' ? (
                      <Pastille ton="danger">Annulé</Pastille>
                    ) : enAttente ? (
                      <Pastille ton="alerte">Réponse attendue</Pastille>
                    ) : e.demandeReponse ? (
                      <Pastille ton="ok">Répondu</Pastille>
                    ) : null}
                  </View>
                </View>
              </Carte>
            );
          })}
        </View>
      ))}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  mois: {
    fontSize: 18,
    fontWeight: '700',
    color: couleurs.texte,
    textTransform: 'capitalize',
    marginTop: 4,
  },
  rangee: { flexDirection: 'row', gap: 14 },
  date: {
    width: 64,
    alignItems: 'center',
    backgroundColor: couleurs.primaireClair,
    borderRadius: 10,
    paddingVertical: 8,
  },
  jour: { fontSize: 26, fontWeight: '800', color: couleurs.primaire },
  heure: { fontSize: 14, color: couleurs.primaire },
  titre: { fontSize: 18, fontWeight: '600', color: couleurs.texte },
  annule: { textDecorationLine: 'line-through', color: couleurs.secondaire },
});
