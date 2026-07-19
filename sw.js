// iWorkPDF Service Worker v3 — cache intelligent (bump = purge des anciens caches)
const CACHE_VERSION = 'iworkpdf-v3';
const STATIC_CACHE = 'iworkpdf-static-v3';
const FONT_CACHE = 'iworkpdf-fonts-v3';

// Assets statiques à précacher
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/shared.css',
  '/tool-theme.css',
  '/shared.js',
  '/security.js',
  '/legacy-tools.js',
  '/compress.js',
  '/merge.js',
  '/delete.js',
  '/split.js',
  '/rotate.js',
  '/watermark.js',
  '/pdf-security.js',
  '/img2pdf.js',
  '/pagenums.js',
  '/pdf2jpg.js',
  '/repair.js',
  '/crop.js',
  '/sign.js',
  '/extract.js',
  '/manifest.json',
  '/logo_seul_sans_fond.png',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/tools/compress.html',
  '/tools/merge.html',
  '/tools/delete.html',
  '/tools/split.html',
  '/tools/rotate.html',
  '/tools/security.html',
  '/tools/watermark.html',
  '/tools/img2pdf.html',
  '/tools/pagenums.html',
  '/tools/pdf2jpg.html',
  '/tools/repair.html',
  '/tools/crop.html',
  '/tools/sign.html',
  '/tools/extract.html',
];

const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
];

// Install : précache tous les assets statiques
self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(c =>
        Promise.allSettled(STATIC_ASSETS.map(url => c.add(url).catch(() => {})))
      ),
      caches.open(FONT_CACHE).then(c =>
        Promise.allSettled(CDN_ASSETS.map(url => c.add(url).catch(() => {})))
      ),
    ]).then(() => self.skipWaiting())
  );
});

// Activate : purge les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch : stratégies selon le type de ressource
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase → toujours réseau (jamais cacher les requêtes API)
  if (url.hostname.includes('supabase')) return;

  // Google Fonts → cache-first (rarement mis à jour)
  if (url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com')) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(resp => {
          const clone = resp.clone();
          caches.open(FONT_CACHE).then(c => c.put(e.request, clone));
          return resp;
        })
      )
    );
    return;
  }

  // CDN (pdf-lib, supabase-js) → cache-first
  if (url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(resp => {
          const clone = resp.clone();
          caches.open(FONT_CACHE).then(c => c.put(e.request, clone));
          return resp;
        }).catch(() => new Response('/* offline */', { headers: { 'Content-Type': 'application/javascript' } }))
      )
    );
    return;
  }

  // Assets statiques iWorkPDF → stale-while-revalidate
  if (url.hostname === self.location.hostname) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(resp => {
          if (resp.ok && e.request.method === 'GET') {
            cache.put(e.request, resp.clone());
          }
          return resp;
        }).catch(() => null);

        // Retourne le cache immédiatement si disponible, met à jour en arrière-plan
        return cached || fetchPromise || new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
  }
});
