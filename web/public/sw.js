// Service worker de Suivi_eleve : rend le site installable, affiche une page hors ligne
// et les notifications envoyées par l'école (Web Push).
// Les pages et les données des élèves ne sont jamais mises en cache (informations privées).

const CACHE = 'suivi-eleve-v1';
const HORS_LIGNE = '/hors-ligne.html';
const FICHIERS = [HORS_LIGNE, '/icones/icone-192.png'];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FICHIERS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((cles) =>
        Promise.all(
          cles.filter((cle) => cle !== CACHE).map((cle) => caches.delete(cle)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evenement) => {
  if (evenement.request.mode !== 'navigate') return;
  evenement.respondWith(
    fetch(evenement.request).catch(() => caches.match(HORS_LIGNE)),
  );
});

// Message de l'école : { titre, texte, donnees: { url, lotId, … } }, chiffré de bout en bout.
self.addEventListener('push', (evenement) => {
  let message = {};
  try {
    message = evenement.data ? evenement.data.json() : {};
  } catch {
    message = { texte: evenement.data ? evenement.data.text() : '' };
  }
  const donnees = message.donnees || {};
  evenement.waitUntil(
    self.registration.showNotification(message.titre || 'Suivi_eleve', {
      body: message.texte || 'Nouveau message de l’école.',
      icon: '/icones/icone-192.png',
      badge: '/icones/icone-192.png',
      lang: 'fr',
      // Une seule notification par message, même s'il arrive deux fois.
      tag: donnees.lotId || undefined,
      data: { url: donnees.url || '/parent/messages' },
    }),
  );
});

// Clic : ouvre le message, dans une fenêtre déjà ouverte du site si possible.
self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  const cible = new URL(
    (evenement.notification.data && evenement.notification.data.url) ||
      '/parent/messages',
    self.location.origin,
  );
  // Seulement une page du site lui-même.
  const url =
    cible.origin === self.location.origin ? cible.href : self.location.origin;
  evenement.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((fenetres) => {
        const fenetre = fenetres.find(
          (f) => new URL(f.url).origin === self.location.origin,
        );
        if (!fenetre) return self.clients.openWindow(url);
        // navigate() échoue sur une fenêtre que ce service worker ne contrôle pas.
        return fenetre
          .navigate(url)
          .then((f) => (f || fenetre).focus())
          .catch(() => self.clients.openWindow(url));
      }),
  );
});
