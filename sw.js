// iWorkPDF Service Worker v8 — OFFLINE POUR L'APP INSTALLÉE UNIQUEMENT.
// Enregistré SEULEMENT en mode standalone (PWA installée) — jamais sur le
// site web classique (voir le snippet de register dans les pages).
//
// Leçons des incidents v3–v6 (pages « Offline » sur tous les appareils) :
// 1. JAMAIS de réponse 503 fabriquée : si le réseau et le cache échouent,
//    on s'auto-répare (unregister + reload) au lieu de tuer la page.
// 2. NETWORK-FIRST pour les navigations : en ligne, l'utilisateur reçoit
//    toujours la vraie page ; le cache ne sert qu'en secours hors ligne.
// 3. Réponses « redirected » reconstruites (Cloudflare 308 pretty URLs),
//    sinon le navigateur les rejette pour une navigation.
// 4. Sur certains réseaux (proxys d'entreprise), les fetch initiés par le
//    SW échouent alors que ceux de la page passent → d'où l'auto-réparation.

const STATIC_CACHE = 'iworkpdf-static-v8';
const FONT_CACHE = 'iworkpdf-fonts-v8';

const TOOL_IDS = ['compress','merge','delete','split','rotate','security','watermark',
                  'img2pdf','pagenums','pdf2jpg','repair','crop','sign','extract'];

const STATIC_ASSETS = [
  '/', '/index.html', '/404.html', '/pricing',
  '/shared.css', '/tool-theme.css',
  '/shared.js', '/security.js', '/legacy-tools.js', '/pdf-security.js',
  ...TOOL_IDS.map(id => `/${id}.js`),
  '/manifest.json', '/logo_seul_sans_fond.png', '/icon-192.png', '/icon-512.png',
  ...TOOL_IDS.flatMap(id => [`/tools/${id}`, `/tools/${id}.html`]),
];

const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

// Response « propre » (sans flag redirected) — sinon rejetée pour une navigation.
async function cleanResponse(resp) {
  if (!resp || !resp.redirected) return resp;
  const body = await resp.blob();
  return new Response(body, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
}

// Cherche en cache : URL exacte, puis variantes avec/sans .html
async function cacheLookup(cache, pathname) {
  let c = await cache.match(pathname);
  if (!c && pathname.endsWith('.html')) c = await cache.match(pathname.replace(/\.html$/, ''));
  if (!c && !pathname.endsWith('.html') && !pathname.endsWith('/')) c = await cache.match(pathname + '.html');
  return c;
}

// Auto-réparation : le SW se désinstalle et fait recharger la page sans lui.
// Utilisé UNIQUEMENT quand réseau ET cache ont échoué pour une navigation.
async function selfDestructResponse() {
  try { await self.registration.unregister(); } catch {}
  return new Response(
    '<!DOCTYPE html><meta charset="utf-8"><script>location.reload();</script>',
    { headers: { 'Content-Type': 'text/html' } }
  );
}

self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(c =>
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

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== FONT_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // API Supabase → toujours réseau, jamais interceptée
  if (url.hostname.includes('supabase')) return;

  // NAVIGATIONS → network-first, cache en secours, auto-réparation en dernier recours
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        const resp = await fetch(e.request);
        const clean = await cleanResponse(resp);
        if (clean.ok) cache.put(url.pathname, clean.clone());
        return clean;
      } catch {
        const cached = await cacheLookup(cache, url.pathname);
        if (cached) return cleanResponse(cached);
        return selfDestructResponse();
      }
    })());
    return;
  }

  // Polices Google + CDN JS → cache-first (immuables), réseau sinon
  if (url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('cdn.jsdelivr.net')) {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      const resp = await fetch(e.request); // échec → erreur réseau normale (pas de 503 fabriqué)
      if (resp.ok) {
        const c = await caches.open(FONT_CACHE);
        c.put(e.request, resp.clone());
      }
      return resp;
    })());
    return;
  }

  // Assets same-origin → network-first, cache en secours (JS/CSS toujours frais en ligne)
  if (url.hostname === self.location.hostname) {
    e.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        const resp = await fetch(e.request);
        if (resp.ok) {
          const clean = await cleanResponse(resp.clone());
          cache.put(e.request, clean);
        }
        return resp;
      } catch (err) {
        const cached = await cache.match(e.request);
        if (cached) return cleanResponse(cached);
        throw err; // erreur réseau normale du navigateur — jamais de fausse page
      }
    })());
  }
});
