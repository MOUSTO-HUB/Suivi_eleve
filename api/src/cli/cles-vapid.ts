// Clés VAPID des notifications du site installé (Web Push). À lancer une seule fois :
//   node dist/cli/cles-vapid.js
// puis copier les deux lignes affichées dans .env.production. Changer ces clés
// oblige chaque parent à réactiver les notifications sur ses appareils.
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_CLE_PUBLIQUE=${publicKey}`);
console.log(`VAPID_CLE_PRIVEE=${privateKey}`);
