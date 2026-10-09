import { chiffrer, dechiffrer } from './chiffrement.js';

describe('chiffrement des secrets', () => {
  const cle = 'une-cle-de-test-0123456789-abcdefghij';

  it('chiffre puis déchiffre, avec un résultat différent à chaque fois', () => {
    const a = chiffrer('JBSWY3DPEHPK3PXP', cle);
    expect(a).not.toContain('JBSWY3DPEHPK3PXP');
    expect(chiffrer('JBSWY3DPEHPK3PXP', cle)).not.toBe(a);
    expect(dechiffrer(a, cle)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('refuse une autre clé ou une valeur modifiée', () => {
    const a = chiffrer('secret', cle);
    expect(() => dechiffrer(a, 'autre-cle')).toThrow();
    const [iv, etiquette] = a.split('.');
    expect(() => dechiffrer(`${iv}.${etiquette}.AAAA`, cle)).toThrow();
  });
});
