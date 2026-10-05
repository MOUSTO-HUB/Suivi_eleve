import { depuisJour } from '../common/dates.js';
import { MODELES_PAR_DEFAUT } from '../notifications/modeles.defaut.js';
import { preparerSms, rendre } from '../notifications/notifications.regles.js';
import {
  dureeFr,
  joursDeRetard,
  libelleDansPhrase,
  montantFr,
  typeRappel,
  variablesPaiement,
} from './paiements.regles.js';

const aujourdHui = new Date('2026-11-09T15:30:00Z');

describe('paiements', () => {
  it('calcule le retard en jours depuis la date normale', () => {
    expect(joursDeRetard(depuisJour('2026-10-05'), aujourdHui)).toBe(35);
    expect(joursDeRetard(depuisJour('2026-11-08'), aujourdHui)).toBe(1);
    expect(joursDeRetard(depuisJour('2026-11-09'), aujourdHui)).toBe(0);
    expect(joursDeRetard(depuisJour('2026-11-20'), aujourdHui)).toBe(-11);
  });

  it('choisit rappel ou retard', () => {
    expect(typeRappel(-3)).toBe('RAPPEL_PAIEMENT');
    expect(typeRappel(0)).toBe('RAPPEL_PAIEMENT');
    expect(typeRappel(1)).toBe('RETARD_PAIEMENT');
  });

  it('formate pour les messages', () => {
    expect(dureeFr(1)).toBe('1 jour');
    expect(dureeFr(35)).toBe('35 jours');
    expect(montantFr(125000)).toBe('125 000');
    expect(libelleDansPhrase("Mensualité d'octobre")).toBe(
      "mensualité d'octobre",
    );
    expect(libelleDansPhrase('APE 2026')).toBe('APE 2026');
  });

  it('prépare les variables, avec le total des autres sommes en attente', () => {
    const v = variablesPaiement(
      {
        libelle: "Mensualité d'octobre 2026",
        montant: 25000,
        dateEcheance: depuisJour('2026-10-05'),
      },
      [{ montant: 25000 }, { montant: 10000 }],
      aujourdHui,
    );
    expect(v).toEqual({
      libelle: "mensualité d'octobre 2026",
      montant: '25 000',
      date_echeance: '05/10/2026',
      jours_retard: '35 jours',
      total:
        '\n\nAu total, 60 000 FCFA restent en attente pour cet élève (3 paiements).',
    });
    const sms = preparerSms(
      rendre(MODELES_PAR_DEFAUT.RETARD_PAIEMENT.SMS.contenu, {
        ...v,
        prenom_eleve: 'Mame Diarra',
      }),
    );
    expect(sms).toBe(
      "Suivi_eleve : mensualité d'octobre 2026 de Mame Diarra (25 000 FCFA) à régler depuis le 05/10/2026 : 35 jours de retard. Merci de régulariser.",
    );
  });
});
