import { MotifAnnonce, TypeAnnonce } from '../generated/prisma/enums.js';
import {
  erreurProgrammation,
  heureFr,
  instantDakar,
  jourFr,
  motifTexte,
  titreAnnonce,
  variablesAnnonce,
} from './annonces.regles.js';

describe('annonces', () => {
  const sortie = instantDakar('2026-10-07', '11:30');

  it("compose l'instant à l'heure de Dakar et le formate", () => {
    expect(sortie.toISOString()).toBe('2026-10-07T11:30:00.000Z');
    expect(jourFr(sortie)).toBe('07/10/2026');
    expect(heureFr(sortie)).toBe('11h30');
  });

  it('remplace « Autre » par la précision saisie', () => {
    expect(motifTexte(MotifAnnonce.GREVE)).toBe('grève');
    expect(motifTexte(MotifAnnonce.AUTRE, 'inondation de la cour')).toBe(
      'inondation de la cour',
    );
    expect(motifTexte(MotifAnnonce.AUTRE, '  ')).toBe('autre motif');
  });

  it('donne un titre lisible', () => {
    expect(
      titreAnnonce(TypeAnnonce.LIBERATION_ANTICIPEE, sortie, ['6e A', '6e B']),
    ).toBe('Libération anticipée à 11h30 – 6e A, 6e B');
    expect(titreAnnonce(TypeAnnonce.PAS_DE_COURS, sortie, null)).toBe(
      'Pas de cours le 07/10/2026 – toute l’école',
    );
  });

  it('prépare les variables des messages', () => {
    expect(
      variablesAnnonce({
        dateDebut: sortie,
        creneau: 'le matin',
        motif: MotifAnnonce.COUPURE_ELECTRICITE,
        motifDetail: null,
        message: 'Le portail ouvre à 11h15.',
      }),
    ).toEqual({
      date: '07/10/2026',
      heure: '11h30',
      creneau: 'le matin',
      motif: "coupure d'électricité",
      details: '\n\nLe portail ouvre à 11h15.',
    });
  });

  it('contrôle la date d’un envoi programmé', () => {
    const maintenant = new Date('2026-10-06T10:00:00Z');
    expect(
      erreurProgrammation(new Date('2026-10-06T18:00:00Z'), maintenant),
    ).toBeNull();
    expect(
      erreurProgrammation(new Date('2026-10-06T10:00:30Z'), maintenant),
    ).toMatch(/une minute/);
    expect(
      erreurProgrammation(new Date('2027-01-01T00:00:00Z'), maintenant),
    ).toMatch(/60 jours/);
    expect(erreurProgrammation(new Date('n/a'), maintenant)).toMatch(
      /invalide/,
    );
  });
});
