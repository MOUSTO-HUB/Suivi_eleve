import { depuisJour } from '../common/dates.js';
import { MODELES_PAR_DEFAUT } from '../notifications/modeles.defaut.js';
import { preparerSms, rendre } from '../notifications/notifications.regles.js';
import {
  doitRelancer,
  dureeFr,
  joursDeRetard,
  libelleDansPhrase,
  montantFr,
  prochaineRelanceAuto,
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
      'FCFA',
      aujourdHui,
    );
    expect(v).toEqual({
      libelle: "mensualité d'octobre 2026",
      montant: '25 000',
      monnaie: 'FCFA',
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

  it('écrit les montants dans la monnaie de l’école (Guinée : GNF)', () => {
    const v = variablesPaiement(
      {
        libelle: 'Frais de cantine',
        montant: 250000,
        dateEcheance: depuisJour('2026-11-15'),
      },
      [{ montant: 100000 }],
      'GNF',
      aujourdHui,
    );
    expect(
      rendre(MODELES_PAR_DEFAUT.RAPPEL_PAIEMENT.SMS.contenu, {
        ...v,
        prenom_eleve: 'Fanta',
      }),
    ).toBe(
      'Suivi_eleve : rappel, frais de cantine de Fanta : 250 000 GNF à régler avant le 15/11/2026.',
    );
    expect(v.total).toContain('350 000 GNF restent en attente');
  });
});

describe('relances automatiques', () => {
  // Date de paiement normale : 10 novembre 2026.
  const echeance = depuisJour('2026-11-10');
  const jour = (j: string) => new Date(`${j}T09:00:00Z`);
  const rappel = (
    dernierEnvoi: string | null,
    relancesAuto = 0,
    statut: 'EN_COURS' | 'REGLE' = 'EN_COURS',
  ) => ({
    statut,
    dateEcheance: echeance,
    dernierEnvoiLe: dernierEnvoi ? jour(dernierEnvoi) : null,
    relancesAuto,
  });

  it('rappelle 3 jours avant la date, une seule fois', () => {
    const signaleTot = rappel('2026-11-01');
    expect(doitRelancer(signaleTot, jour('2026-11-06'))).toBe(false);
    expect(doitRelancer(signaleTot, jour('2026-11-07'))).toBe(true);
    expect(doitRelancer(signaleTot, jour('2026-11-08'))).toBe(true);
    // Déjà rappelé le 7 : rien le 8 ni le 9.
    expect(doitRelancer(rappel('2026-11-07'), jour('2026-11-08'))).toBe(false);
    // Signalé 2 jours avant : le message de création suffit.
    expect(doitRelancer(rappel('2026-11-08'), jour('2026-11-09'))).toBe(false);
  });

  it('ne relance pas le jour même de la date', () => {
    expect(doitRelancer(rappel('2026-11-07'), jour('2026-11-10'))).toBe(false);
  });

  it('relance le lendemain de la date, puis toutes les semaines', () => {
    expect(doitRelancer(rappel('2026-11-07'), jour('2026-11-11'))).toBe(true);
    expect(doitRelancer(rappel('2026-11-11', 1), jour('2026-11-17'))).toBe(
      false,
    );
    expect(doitRelancer(rappel('2026-11-11', 1), jour('2026-11-18'))).toBe(
      true,
    );
    // Une tâche manquée (serveur arrêté) est rattrapée le jour suivant.
    expect(doitRelancer(rappel('2026-11-11', 1), jour('2026-11-20'))).toBe(
      true,
    );
  });

  it('compte 7 jours après une relance manuelle du comptable', () => {
    // Signalé en retard le 15 (message manuel) : prochaine relance le 22.
    expect(doitRelancer(rappel('2026-11-15'), jour('2026-11-16'))).toBe(false);
    expect(doitRelancer(rappel('2026-11-15'), jour('2026-11-22'))).toBe(true);
  });

  it('s’arrête après 4 relances automatiques ou une fois réglé', () => {
    expect(doitRelancer(rappel('2026-12-02', 4), jour('2026-12-20'))).toBe(
      false,
    );
    expect(
      doitRelancer(rappel('2026-11-07', 0, 'REGLE'), jour('2026-11-11')),
    ).toBe(false);
  });

  it('donne le jour de la prochaine relance automatique', () => {
    const date = (r: ReturnType<typeof rappel>, aujourdHui: string) =>
      prochaineRelanceAuto(r, jour(aujourdHui))?.toISOString().slice(0, 10) ??
      null;
    expect(date(rappel('2026-11-01'), '2026-11-02')).toBe('2026-11-07');
    expect(date(rappel('2026-11-07'), '2026-11-08')).toBe('2026-11-11');
    expect(date(rappel('2026-11-11', 1), '2026-11-12')).toBe('2026-11-18');
    expect(date(rappel('2026-12-02', 4), '2026-12-03')).toBeNull();
  });
});
