// Service worker de Suivi_eleve : rend le site installable et affiche une page hors ligne.
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
