import { ConfigService } from '@nestjs/config';
import { CanauxService } from './canaux.service.js';

const canaux = (config: Record<string, string>) =>
  new CanauxService(new ConfigService(config));

describe('CanauxService en production', () => {
  const production = {
    NODE_ENV: 'production',
    SMS_FOURNISSEUR: 'console',
    EMAIL_FOURNISSEUR: 'console',
    PUSH_FOURNISSEUR: 'console',
  };

  it('refuse les fournisseurs factices par défaut', () => {
    expect(() => canaux(production)).toThrow(/interdit en production/);
  });

  it('accepte « console » seulement avec ENVOIS_SIMULES=oui (phase d’essai)', () => {
    expect(() =>
      canaux({ ...production, ENVOIS_SIMULES: 'oui' }),
    ).not.toThrow();
    expect(() =>
      canaux({
        ...production,
        ENVOIS_SIMULES: 'oui',
        SMS_FOURNISSEUR: 'simulation',
      }),
    ).toThrow(/interdit en production/);
    expect(() => canaux({ ...production, ENVOIS_SIMULES: 'non' })).toThrow(
      /interdit en production/,
    );
  });
});
