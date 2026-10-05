import { calculerAge, depuisJour, versJour } from './dates.js';

describe('dates', () => {
  it('calcule un âge en années révolues', () => {
    const naissance = depuisJour('2014-03-15');
    expect(calculerAge(naissance, depuisJour('2026-03-14'))).toBe(11);
    expect(calculerAge(naissance, depuisJour('2026-03-15'))).toBe(12);
    expect(calculerAge(naissance, depuisJour('2026-12-31'))).toBe(12);
  });

  it('gère une naissance un 29 février', () => {
    const naissance = depuisJour('2016-02-29');
    expect(calculerAge(naissance, depuisJour('2026-02-28'))).toBe(9);
    expect(calculerAge(naissance, depuisJour('2026-03-01'))).toBe(10);
  });

  it('aller-retour AAAA-MM-JJ', () => {
    expect(versJour(depuisJour('2026-10-05'))).toBe('2026-10-05');
  });
});
