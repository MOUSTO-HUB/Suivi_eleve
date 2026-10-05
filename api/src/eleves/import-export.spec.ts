import { BadRequestException } from '@nestjs/common';
import { depuisJour } from '../common/dates.js';
import { Genre, LienTuteur } from '../generated/prisma/enums.js';
import {
  analyserLigne,
  celluleCsv,
  cleEleve,
  lireDate,
  lireGenre,
  lireLien,
  lireLignes,
  normaliserEntete,
  parserCsv,
} from './import-export.js';

const aujourdHui = depuisJour('2026-10-05');

describe('parserCsv', () => {
  it('détecte le point-virgule et gère guillemets, BOM et CRLF', () => {
    const csv =
      '﻿prenoms;nom;classe\r\n"Awa; Fatou";Diop;6e A\r\n"Il dit ""oui""";Fall;\r\n';
    expect(parserCsv(csv)).toEqual([
      ['prenoms', 'nom', 'classe'],
      ['Awa; Fatou', 'Diop', '6e A'],
      ['Il dit "oui"', 'Fall', ''],
    ]);
  });

  it('détecte la virgule et lit une dernière ligne sans retour', () => {
    expect(parserCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('lireLignes', () => {
  it('reconnaît les en-têtes accentués et les alias, ignore les lignes vides', () => {
    const lignes = lireLignes([
      [
        'Prénoms',
        'Nom',
        'Sexe',
        'Date de naissance',
        'Prénoms tuteur',
        'Nom tuteur',
        'Contact 1',
      ],
      ['Awa', 'Diop', 'F', '15/03/2014', 'Malick', 'Diop', '771234567'],
      ['', '', '', '', '', '', ''],
      ['Ali', 'Ba', 'M', '2013-01-02', 'Omar', 'Ba', '781234567'],
    ]);
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toEqual({
      ligne: 2,
      valeurs: {
        prenoms: 'Awa',
        nom: 'Diop',
        genre: 'F',
        date_naissance: '15/03/2014',
        tuteur_prenoms: 'Malick',
        tuteur_nom: 'Diop',
        contact_tuteur_1: '771234567',
      },
    });
    expect(lignes[1].ligne).toBe(4);
  });

  it('signale les colonnes obligatoires absentes', () => {
    expect(() => lireLignes([['prenoms', 'nom']])).toThrow(BadRequestException);
  });
});

describe('lecture des valeurs', () => {
  it('normalise un en-tête', () => {
    expect(normaliserEntete('  Date de Naissance ')).toBe('date_de_naissance');
  });

  it.each([
    ['M', Genre.MASCULIN],
    ['garçon', Genre.MASCULIN],
    ['F', Genre.FEMININ],
    ['Féminin', Genre.FEMININ],
    ['x', null],
  ])('genre %s', (entree, attendu) => {
    expect(lireGenre(entree)).toBe(attendu);
  });

  it.each([
    [undefined, LienTuteur.AUTRE],
    ['Père', LienTuteur.PERE],
    ['mere', LienTuteur.MERE],
    ['Tuteur légal', LienTuteur.TUTEUR_LEGAL],
    ['voisin', null],
  ])('lien %s', (entree, attendu) => {
    expect(lireLien(entree)).toBe(attendu);
  });

  it.each([
    ['15/03/2014', '2014-03-15'],
    ['5/3/2014', '2014-03-05'],
    ['15-03-2014', '2014-03-15'],
    ['2014-03-15', '2014-03-15'],
    ['mars 2014', null],
  ])('date %s', (entree, attendu) => {
    expect(lireDate(entree)).toBe(attendu);
  });

  it('échappe les cellules CSV', () => {
    expect(celluleCsv('simple')).toBe('simple');
    expect(celluleCsv('a;b')).toBe('"a;b"');
    expect(celluleCsv('dit "oui"')).toBe('"dit ""oui"""');
    expect(celluleCsv(null)).toBe('');
  });

  it('construit une clé de doublon insensible aux accents et à la casse', () => {
    expect(cleEleve('Aïssatou', 'DIOP', '2014-01-01')).toBe(
      cleEleve('aissatou', 'Diop', '2014-01-01'),
    );
  });
});

describe('analyserLigne', () => {
  const contexte = { classes: new Map([['6e_a', 'classe-6a']]) };

  it('produit une demande de création complète', () => {
    const resultat = analyserLigne(
      {
        ligne: 2,
        valeurs: {
          prenoms: 'Awa',
          nom: 'Diop',
          genre: 'F',
          date_naissance: '15/03/2014',
          classe: '6E A',
          tuteur_prenoms: 'Malick',
          tuteur_nom: 'Diop',
          lien_tuteur: 'père',
          contact_tuteur_1: '77 123 45 67',
          contact_tuteur_2: '00221781234567',
          email_tuteur: 'Malick@Exemple.SN',
        },
      },
      contexte,
      aujourdHui,
    );
    expect(resultat.erreurs).toEqual([]);
    expect(resultat.donnees).toEqual({
      prenoms: 'Awa',
      nom: 'Diop',
      genre: Genre.FEMININ,
      dateNaissance: '2014-03-15',
      telephone: undefined,
      classeId: 'classe-6a',
      tuteurs: [
        {
          prenoms: 'Malick',
          nom: 'Diop',
          contact1: '+221771234567',
          contact2: '+221781234567',
          email: 'malick@exemple.sn',
          lien: LienTuteur.PERE,
          principal: true,
        },
      ],
    });
  });

  it('liste toutes les erreurs de la ligne', () => {
    const resultat = analyserLigne(
      {
        ligne: 7,
        valeurs: {
          prenoms: 'Awa',
          genre: 'Z',
          date_naissance: '31/02/2014',
          classe: '5e B',
          tuteur_prenoms: 'Malick',
          tuteur_nom: 'Diop',
          contact_tuteur_1: '12',
          email_tuteur: 'pas-un-email',
        },
      },
      contexte,
      aujourdHui,
    );
    expect(resultat.donnees).toBeUndefined();
    expect(resultat.erreurs).toEqual([
      'Nom manquant(e).',
      'Genre invalide : « Z » (M ou F).',
      'Date de naissance invalide : 2014-02-31.',
      'Classe inconnue : « 5e B ».',
      'Contact_tuteur_1 invalide : « 12 ».',
      'Email du tuteur invalide : « pas-un-email ».',
    ]);
  });
});
