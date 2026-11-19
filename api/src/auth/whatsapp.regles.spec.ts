import { createHmac } from 'node:crypto';
import {
  extraireCode,
  lienWhatsapp,
  messageConnexion,
  messagesRecus,
  nouveauCodeWhatsapp,
  signatureValide,
  telephoneExpediteur,
} from './whatsapp.regles.js';

describe('code de connexion WhatsApp', () => {
  it('fait 6 caractères lisibles, avec une lettre et un chiffre', () => {
    for (let i = 0; i < 200; i++) {
      const code = nouveauCodeWhatsapp();
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
      expect(code).toMatch(/\d/);
      expect(code).toMatch(/[A-Z]/);
    }
  });

  it('est retrouvé dans le message prérempli, même retouché', () => {
    expect(extraireCode(messageConnexion('K7M2PQ'))).toBe('K7M2PQ');
    expect(extraireCode('connexion suivi_eleve : k7m2pq')).toBe('K7M2PQ');
    expect(extraireCode('Bonjour, voici mon code K7M2PQ merci')).toBe('K7M2PQ');
  });

  it('ne prend pas un mot ordinaire ni un nombre pour un code', () => {
    expect(extraireCode('Bonjour madame')).toBeNull();
    expect(extraireCode('Mon numéro 622123')).toBeNull();
    expect(extraireCode('')).toBeNull();
  });
});

describe('lien WhatsApp', () => {
  it('ouvre la conversation avec le service et le message prérempli', () => {
    expect(
      lienWhatsapp('+224 621 00 00 00', 'Connexion Suivi_eleve : K7M2PQ'),
    ).toBe(
      'https://wa.me/224621000000?text=Connexion%20Suivi_eleve%20%3A%20K7M2PQ',
    );
  });
});

describe('webhook WhatsApp', () => {
  const secret = 'secret-application';
  const corps = Buffer.from('{"entry":[]}');
  const signe = (contenu: Buffer, cle = secret) =>
    `sha256=${createHmac('sha256', cle).update(contenu).digest('hex')}`;

  it('accepte seulement la signature calculée avec le secret de l’application', () => {
    expect(signatureValide(corps, signe(corps), secret)).toBe(true);
    expect(signatureValide(corps, signe(corps, 'autre'), secret)).toBe(false);
    expect(signatureValide(Buffer.from('{}'), signe(corps), secret)).toBe(
      false,
    );
    expect(signatureValide(corps, undefined, secret)).toBe(false);
    expect(signatureValide(undefined, signe(corps), secret)).toBe(false);
  });

  it('met le numéro de l’expéditeur au format E.164', () => {
    expect(telephoneExpediteur('224621000000')).toBe('+224621000000');
    expect(telephoneExpediteur('+224621000000')).toBeNull();
    expect(telephoneExpediteur(224621000000)).toBeNull();
  });

  it('extrait les messages texte et ignore le reste', () => {
    const notification = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '224621000000',
                    type: 'text',
                    text: { body: 'Connexion Suivi_eleve : K7M2PQ' },
                  },
                  { from: '224621000001', type: 'image', image: {} },
                ],
              },
            },
            { value: { statuses: [{ status: 'read' }] } },
          ],
        },
      ],
    };
    expect(messagesRecus(notification)).toEqual([
      { telephone: '+224621000000', texte: 'Connexion Suivi_eleve : K7M2PQ' },
    ]);
    expect(messagesRecus(null)).toEqual([]);
    expect(messagesRecus({ entry: 'x' })).toEqual([]);
  });
});
