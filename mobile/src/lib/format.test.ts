import { describe, expect, it } from 'vitest';
import {
  codeEtiquette,
  dateFr,
  montant,
  fusionnerNotifications,
  heureFr,
  lienNotification,
  noteFr,
  quandFr,
  rangFr,
  signalementsPossibles,
  telephoneE164,
} from './format';
import type { Notification } from './types';

const notif = (
  id: string,
  creeLe: string,
  extra: Partial<Notification> = {},
): Notification => ({
  id,
  type: 'ABSENCE',
  priorite: 'NORMALE',
  sujet: null,
  contenu: 'x',
  creeLe,
  lueLe: null,
  sourceType: null,
  sourceId: null,
  eleve: null,
  ...extra,
});

describe('mise en forme', () => {
  it('affiche dates, heures, montants et notes à la française (Dakar, UTC+0)', () => {
    expect(dateFr('2026-11-15')).toBe('15/11/2026');
    expect(dateFr('2026-11-15T23:30:00Z')).toBe('15/11/2026');
    expect(heureFr('2026-11-15T09:05:00Z')).toBe('09h05');
    expect(montant(1250000, 'FCFA')).toBe('1 250 000 FCFA');
    expect(montant(150000, 'GNF')).toBe('150 000 GNF');
    expect(noteFr(14.5)).toBe('14,50');
    expect(noteFr(null)).toBe('—');
    expect(rangFr(1)).toBe('1er');
    expect(rangFr(4)).toBe('4e');
  });

  it("dit « aujourd'hui » et « hier »", () => {
    const maintenant = new Date('2026-10-05T15:00:00Z');
    expect(quandFr('2026-10-05T08:30:00Z', maintenant)).toBe(
      "aujourd'hui à 08h30",
    );
    expect(quandFr('2026-10-04T18:00:00Z', maintenant)).toBe('hier à 18h00');
    expect(quandFr('2026-09-30T18:00:00Z', maintenant)).toBe('30/09/2026');
  });

  it('ramène le numéro saisi au format international, selon le pays', () => {
    expect(telephoneE164('77 123 45 67', 'SN')).toBe('+221771234567');
    expect(telephoneE164('00221 77 123 45 67', 'SN')).toBe('+221771234567');
    expect(telephoneE164('221771234567', 'SN')).toBe('+221771234567');
    expect(telephoneE164('621 12 34 56', 'GN')).toBe('+224621123456');
    expect(telephoneE164('224 621 12 34 56', 'GN')).toBe('+224621123456');
    expect(telephoneE164('07 12 34 56 78', 'CI')).toBe('+2250712345678');
    // Déjà international : le pays choisi ne change rien.
    expect(telephoneE164('+221 77 123 45 67', 'GN')).toBe('+221771234567');
    expect(telephoneE164('+33 6 12 34 56 78', 'SN')).toBe('+33612345678');
    // Longueur inattendue : rendu tel quel, l'API le refusera.
    expect(telephoneE164('7712345', 'SN')).toBe('7712345');
  });
});

describe('cache hors ligne', () => {
  it('garde les 50 plus récentes, sans doublon, la version reçue en dernier', () => {
    const anciennes = Array.from({ length: 50 }, (_, i) =>
      notif(`a${i}`, new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString()),
    );
    const lue = notif('a49', anciennes[49].creeLe, {
      lueLe: '2026-10-01T00:00:00Z',
    });
    const nouvelle = notif('n1', '2026-10-05T10:00:00Z');
    const fusion = fusionnerNotifications([nouvelle, lue], anciennes);
    expect(fusion).toHaveLength(50);
    expect(fusion[0].id).toBe('n1');
    expect(fusion[1]).toBe(lue);
    expect(fusion.map((n) => n.id)).not.toContain('a0');
  });
});

describe('liens', () => {
  it('ouvre l’événement concerné ou la bonne rubrique', () => {
    expect(
      lienNotification(
        notif('1', '', {
          type: 'EVENEMENT',
          sourceId: 'e1',
          sourceType: 'annonce',
        }),
      ),
    ).toBe('/evenement/e1');
    expect(lienNotification(notif('1', '', { type: 'RETARD_PAIEMENT' }))).toBe(
      '/paiements',
    );
    expect(
      lienNotification(notif('1', '', { type: 'LIBERATION_ANTICIPEE' })),
    ).toBeNull();
  });

  it("lit l'étiquette scannée ou le code saisi", () => {
    expect(
      codeEtiquette(
        'https://ecole.sn/appareils/scan/0193f2c4-aaaa-7bbb-8ccc-3f9a2b7c1d2e',
      ),
    ).toBe('0193f2c4-aaaa-7bbb-8ccc-3f9a2b7c1d2e');
    expect(codeEtiquette(' 3F9A2B7C ')).toBe('3f9a2b7c');
    expect(codeEtiquette('bonjour !')).toBeNull();
  });
});

describe('signalements', () => {
  it('propose seulement ce que le rôle peut faire selon le statut', () => {
    expect(signalementsPossibles('PARENT', 'ACTIF')).toEqual(['DECLARE_PERDU']);
    expect(signalementsPossibles('PARENT', 'PERDU')).toEqual([]);
    expect(signalementsPossibles('ENSEIGNANT', 'ACTIF')).toEqual([
      'TROUVE',
      'CONFISQUE',
      'USAGE_EN_CLASSE',
    ]);
  });
});
