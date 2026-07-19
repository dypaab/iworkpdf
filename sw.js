// iWorkPDF Service Worker v7 — STUB D'AUTO-DESTRUCTION.
// Le SW est désactivé : sur certains réseaux (proxys d'entreprise, etc.) les
// fetch initiés par un service worker échouent alors que ceux de la page
// passent → précache vide → toutes les pages répondaient « Offline » (503).
// Ce stub remplace l'ancien SW chez les navigateurs déjà infectés :
// il purge tous les caches, se désinscrit, et n'intercepte RIEN.
// Ne réactiver un SW qu'après une refonte testée (network-first, jamais 503).

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch {}
    try {
      await self.registration.unregister();
    } catch {}
    // Recharge les onglets contrôlés pour qu'ils repartent sans SW
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.navigate(c.url));
    } catch {}
  })());
});

// AUCUN listener 'fetch' : le navigateur gère toutes les requêtes nativement.
