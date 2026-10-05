import {
  erreurMotDePasse,
  motDePasseProvisoire,
} from './utilisateurs.regles.js';

describe('comptes du personnel', () => {
  it('refuse un mot de passe trop court ou sans chiffre', () => {
    expect(erreurMotDePasse('Court1')).toContain('au moins 10');
    expect(erreurMotDePasse('seulementdeslettres')).toContain('chiffres');
    expect(erreurMotDePasse('1234567890')).toContain('lettres');
    expect(erreurMotDePasse('École-2026-Dakar')).toBeNull();
  });

  it('génère des mots de passe provisoires valides et différents', () => {
    const vus = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const m = motDePasseProvisoire();
      expect(m).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(m).not.toMatch(/[01OlI]/);
      expect(erreurMotDePasse(m)).toBeNull();
      vus.add(m);
    }
    expect(vus.size).toBe(200);
  });
});
