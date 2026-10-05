import { TypeNotification } from '../generated/prisma/enums.js';
import { CANAUX_MODELE, MODELES_PAR_DEFAUT } from './modeles.defaut.js';
import {
  doitMettreAJour,
  enumerer,
  preparerSms,
  PRIORITE_FILE,
  REGLES_TYPE,
  rendre,
  variablesDuModele,
  versGsm7,
} from './notifications.regles.js';

describe('rendre', () => {
  it('remplace les variables et nettoie les vides', () => {
    expect(
      rendre('Sortie de {classe} à {heure} ({motif}).', {
        classe: '6e A',
        heure: '11h',
      }),
    ).toBe('Sortie de 6e A à 11h.');
  });

  it('liste les variables d’un modèle', () => {
    expect(variablesDuModele('{a} et {b}, encore {a}')).toEqual(['a', 'b']);
  });
});

describe('SMS', () => {
  it('garde les accents de l’alphabet GSM et remplace les autres', () => {
    expect(versGsm7('élève à l’école, fête, ça, où, Noël… «ok»')).toBe(
      'élève à l\'école, fete, ca, où, Noel... "ok"',
    );
  });

  it('remplace un caractère impossible par ?', () => {
    expect(versGsm7('ok 😀')).toBe('ok ?');
  });

  it('met sur une ligne et coupe à 160 caractères', () => {
    const sms = preparerSms(`Bonjour,\n\n${'a'.repeat(200)}`);
    expect(sms).toHaveLength(160);
    expect(sms.startsWith('Bonjour, a')).toBe(true);
    expect(sms.endsWith('...')).toBe(true);
  });

  it('les SMS par défaut tiennent en 160 caractères avec des valeurs réalistes', () => {
    const variables = {
      classe: '6e A, 5e B',
      heure: '11h00',
      motif: "coupure d'électricité",
      prenom_eleve: 'Mame Diarra',
      montant: '25 000',
      mois: 'octobre 2026',
      date_limite: '05/11/2026',
      jours_retard: '35 jours',
      libelle: "la mensualité d'octobre 2026",
      date_echeance: '05/10/2026',
      date: '06/10/2026',
      creneau: 'après-midi',
      numero_recu: 'R-2026-0042',
      periode: 'Trimestre 1',
      moyenne: '14,25',
      rang: '12e',
      decision: 'admise en classe supérieure',
      titre: 'Journée portes ouvertes',
      lieu: 'cour',
    };
    for (const type of Object.keys(MODELES_PAR_DEFAUT) as TypeNotification[]) {
      if (MODELES_PAR_DEFAUT[type].SMS.contenu.includes('{details}')) continue;
      const sms = preparerSms(
        rendre(MODELES_PAR_DEFAUT[type].SMS.contenu, variables),
      );
      expect(sms.endsWith('...'), `${type} : ${sms}`).toBe(false);
    }
  });
});

describe('règles par type', () => {
  it('suit le tableau du cahier des charges', () => {
    expect(REGLES_TYPE.LIBERATION_ANTICIPEE).toEqual({
      canaux: ['SMS', 'EMAIL', 'PUSH'],
      priorite: 'URGENTE',
      obligatoire: true,
    });
    expect(REGLES_TYPE.RECU_PAIEMENT.canaux).toEqual(['EMAIL', 'PUSH']);
    expect(REGLES_TYPE.USAGE_APPAREIL.canaux).not.toContain('SMS');
    expect(PRIORITE_FILE.URGENTE).toBeLessThan(PRIORITE_FILE.BASSE);
  });

  it('a un modèle par type et par canal', () => {
    for (const type of Object.keys(REGLES_TYPE) as TypeNotification[]) {
      for (const canal of CANAUX_MODELE) {
        expect(MODELES_PAR_DEFAUT[type][canal].contenu.length).toBeGreaterThan(
          0,
        );
      }
    }
  });
});

describe('outils', () => {
  it('énumère les prénoms', () => {
    expect(enumerer(['Awa'])).toBe('Awa');
    expect(enumerer(['Awa', 'Ali', 'Awa'])).toBe('Awa et Ali');
    expect(enumerer(['Awa', 'Ali', 'Fatou'])).toBe('Awa, Ali et Fatou');
  });

  it('ne fait jamais reculer un statut', () => {
    expect(doitMettreAJour('ENVOYEE', 'DELIVREE')).toBe(true);
    expect(doitMettreAJour('ENVOYEE', 'ECHOUEE')).toBe(true);
    expect(doitMettreAJour('DELIVREE', 'DELIVREE')).toBe(false);
    expect(doitMettreAJour('LUE', 'DELIVREE')).toBe(false);
    expect(doitMettreAJour('LUE', 'ECHOUEE')).toBe(false);
  });
});
