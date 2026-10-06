import { depuisJour, versJour } from '../common/dates.js';
import {
  ajouterMois,
  finEssai,
  montantGnf,
  periodePayee,
  situationAbonnement,
  TARIFS_GNF,
} from './abonnements.regles.js';

const jour = (j: string) => depuisJour(j);
const texte = (d: Date) => versJour(d);

describe('abonnements des écoles', () => {
  it('applique le tarif : 150 000 GNF par mois, 10 mois pour une année', () => {
    expect(TARIFS_GNF.MENSUEL).toBe(150_000);
    expect(TARIFS_GNF.ANNUEL).toBe(10 * TARIFS_GNF.MENSUEL);
    expect(montantGnf(1_500_000)).toBe('1 500 000 GNF');
  });

  it('donne 30 jours d’essai à une nouvelle école', () => {
    expect(texte(finEssai(new Date('2026-10-06T15:00:00Z')))).toBe(
      '2026-11-04',
    );
  });

  it('ajoute des mois sans déborder sur le mois suivant', () => {
    expect(texte(ajouterMois(jour('2026-01-31'), 1))).toBe('2026-02-28');
    expect(texte(ajouterMois(jour('2028-01-31'), 1))).toBe('2028-02-29');
    expect(texte(ajouterMois(jour('2026-11-15'), 12))).toBe('2027-11-15');
  });

  describe('état', () => {
    const fin = jour('2026-11-30');
    const etat = (
      aujourdHui: string,
      { aPaye = true, suspendueLe = null as Date | null } = {},
    ) =>
      situationAbonnement(
        { finAbonnement: fin, suspendueLe, aPaye },
        new Date(`${aujourdHui}T10:00:00Z`),
      ).etat;

    it('essai ou actif, puis à renouveler les 7 derniers jours', () => {
      expect(etat('2026-11-01', { aPaye: false })).toBe('ESSAI');
      expect(etat('2026-11-23')).toBe('ACTIF');
      expect(etat('2026-11-24')).toBe('A_RENOUVELER');
      expect(etat('2026-11-30')).toBe('A_RENOUVELER'); // dernier jour payé
    });

    it('15 jours de grâce en retard, puis suspendue', () => {
      expect(etat('2026-12-01')).toBe('EN_RETARD');
      expect(etat('2026-12-15')).toBe('EN_RETARD');
      expect(etat('2026-12-16')).toBe('SUSPENDUE');
    });

    it('une suspension à la main l’emporte', () => {
      expect(etat('2026-11-01', { suspendueLe: jour('2026-10-20') })).toBe(
        'SUSPENDUE',
      );
    });

    it('donne les jours restants et la fin de la grâce', () => {
      const s = situationAbonnement(
        { finAbonnement: fin, suspendueLe: null, aPaye: true },
        new Date('2026-11-27T22:00:00Z'),
      );
      expect(s.joursRestants).toBe(3);
      expect(texte(s.finGrace)).toBe('2026-12-15');
    });
  });

  describe('période payée', () => {
    const fin = jour('2026-11-30');
    const periode = (
      formule: 'MENSUEL' | 'ANNUEL',
      payeLe: string,
      finActuelle = fin,
    ) => {
      const p = periodePayee(formule, finActuelle, jour(payeLe));
      return [texte(p.debut), texte(p.fin)];
    };

    it('prolonge à la suite de la période précédente', () => {
      expect(periode('MENSUEL', '2026-11-25')).toEqual([
        '2026-12-01',
        '2026-12-31',
      ]);
      expect(periode('ANNUEL', '2026-11-25')).toEqual([
        '2026-12-01',
        '2027-11-30',
      ]);
    });

    it('paiement en avance : les mois s’ajoutent', () => {
      expect(periode('MENSUEL', '2026-10-01')).toEqual([
        '2026-12-01',
        '2026-12-31',
      ]);
    });

    it('pendant la grâce : les jours de retard utilisés sont dus', () => {
      expect(periode('MENSUEL', '2026-12-10')).toEqual([
        '2026-12-01',
        '2026-12-31',
      ]);
    });

    it('école déjà suspendue : la période repart du jour du paiement', () => {
      expect(periode('MENSUEL', '2027-01-20')).toEqual([
        '2027-01-20',
        '2027-02-19',
      ]);
    });
  });
});
