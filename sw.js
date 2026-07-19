// iWorkPDF Service Worker v5 — cache intelligent (bump = purge des anciens caches)
// v5 : FIX CRITIQUE "Offline" au clic sur un outil (PC + Android + iOS).
// Cloudflare Pages redirige /tools/merge.html → /tools/merge (308 "pretty URLs").
// Une Response avec redirected:true ne PEUT PAS être servie à une navigation
// (le navigateur la rejette → page morte). On reconstruit donc chaque réponse
// sans le flag redirected avant de la mettre en cache / de la servir.
// v4 : suppression de la fausse réponse "/* offline */" des CDN + sb=null géré.
// v6 : liens internes sans .html (plus de 308 Cloudflare du tout) ;
// précache des deux variantes (/tools/merge et /tools/merge.html).
const CACHE_VERSION = 'iworkpdf-v6';
const STATIC_CACHE = 'iworkpdf-static-v6';
const FONT_CACHE = 'iworkpdf-fonts-v6';

// Reconstruit une Response "propre" (sans flag redirected) — sinon le
// navigateur refuse de l'utiliser pour une navigation.
async function cleanResponse(resp) {
  if (!resp || !resp.redirected) return resp;
  const body = await resp.blob();
  return new Response(body, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
}

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
  '/icon-192.png',
  '/icon-512.png',
  '/pricing',
  // Pages outils : variante canonique sans .html (liens internes)
  // + variante .html (anciens favoris/liens externes)
  ...['compress','merge','delete','split','rotate','security','watermark',
      'img2pdf','pagenums','pdf2jpg','repair','crop','sign','extract']
    .flatMap(id => [`/tools/${id}`, `/tools/${id}.html`]),
];

const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

// Install : précache tous les assets statiques
self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(c =>
        // fetch + cleanResponse au lieu de c.add : Cloudflare redirige les .html
        // (308) et une réponse redirigée en cache casserait les navigations.
        Promise.allSettled(STATIC_ASSETS.map(async url => {
          try {
            const r = await fetch(url);
            if (r.ok) await c.put(url, await cleanResponse(r));
          } catch {}
        }))
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
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(FONT_CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        })
        // Pas de fausse réponse JS vide : on laisse l'erreur réseau remonter,
        // shared.js gère l'absence de supabase (sb=null) sans crasher.
      )
    );
    return;
  }

  // Assets statiques iWorkPDF → stale-while-revalidate
  if (url.hostname === self.location.hostname) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(async resp => {
          if (resp.ok && e.request.method === 'GET') {
            const clean = await cleanResponse(resp.clone());
            cache.put(e.request, clean.clone());
          }
          return resp;
        }).catch(() => null);

        // Retourne le cache immédiatement si disponible, met à jour en arrière-plan
        if (cached) return cleanResponse(cached);
        const resp = await fetchPromise; // null si échec réseau
        if (resp) return cleanResponse(resp);
        return new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
  }
});
