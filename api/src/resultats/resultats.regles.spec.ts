import {
  erreurMoyenne,
  erreurRang,
  noteFr,
  rangFr,
  rangSur,
} from './resultats.regles.js';

describe('résultats', () => {
  it('affiche une note à la française', () => {
    expect(noteFr(14.5)).toBe('14,50');
    expect(noteFr(9)).toBe('9,00');
    expect(noteFr(null)).toBe('—');
  });

  it('affiche un rang', () => {
    expect(rangFr(1)).toBe('1er');
    expect(rangFr(12)).toBe('12e');
    expect(rangSur(5, 35)).toBe('5e sur 35');
    expect(rangSur(null, 35)).toBe('non communiqué');
  });

  it('contrôle une moyenne saisie', () => {
    expect(erreurMoyenne(0)).toBeNull();
    expect(erreurMoyenne(20)).toBeNull();
    expect(erreurMoyenne(14.25)).toBeNull();
    expect(erreurMoyenne(12.34)).toBeNull();
    expect(erreurMoyenne(8.07)).toBeNull();
    expect(erreurMoyenne(null)).toBeNull();
    expect(erreurMoyenne(20.5)).toMatch(/entre 0 et 20/);
    expect(erreurMoyenne(-1)).toMatch(/entre 0 et 20/);
    expect(erreurMoyenne(12.345)).toMatch(/2 décimales/);
  });

  it('contrôle un rang saisi', () => {
    expect(erreurRang(1, 30)).toBeNull();
    expect(erreurRang(30, 30)).toBeNull();
    expect(erreurRang(31, 30)).toMatch(/entre 1 et 30/);
    expect(erreurRang(0, 30)).toMatch(/entre 1 et 30/);
    expect(erreurRang(2.5, 30)).toMatch(/entre 1 et 30/);
  });
});
