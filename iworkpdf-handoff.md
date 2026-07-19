# iWorkPDF — Handoff / contexte pour un nouveau chat

## Le projet
**iWorkPDF** — boîte à outils PDF gratuite, privacy-first, 14 outils qui tournent 100% dans le navigateur. Marque **YENDYX**.
- **En ligne** : https://iworkpdf.yendyx.com (Cloudflare Pages, connecté à GitHub)
- **Repo** : github.com/dypaab/iworkpdf — branche `main`
- **Dossier local** : C:\Users\Admin\Documents\creator\iworkpdf

## Stack
- Vanilla JS/HTML/CSS. Traitement PDF local : **pdf-lib** + **PDF.js**.
- Chiffrement AES-256 : **qpdf-wasm AUTO-HÉBERGÉ** dans `/vendor/qpdf/` (qpdf.js + qpdf.wasm, 1.3 Mo). Le dist expose `window.Module` (PAS `createModule`). Ne pas revenir au CDN.
- **Supabase** (projet `iispzrdathkixcgriyrr`) : auth + partage cloud 48h + 4 edge functions **DÉPLOYÉES** (contact, track-pageview, cleanup, delete-account).
- **Cloudflare Pages** (git-connecté, chaque push déploie). `_headers` porte CSP + cache.
- **PAS de service worker sur le site web** (voir Historique des incidents). `sw.js` v8 = network-first, enregistré UNIQUEMENT en PWA installée (standalone) ; sur le web les SW hérités sont auto-désinstallés.

## Architecture
- 14 pages `/tools/<id>.html` partageant `shared.js` / `shared.css` / `tool-theme.css`.
- **URLs internes SANS .html** (`/tools/merge`, `/pricing`) — Cloudflare fait des 308 sur les .html (« pretty URLs »), source d'un incident majeur. Sitemap/canonicals extensionless.
- Assets versionnés `?v20260719x` (cache-busting) + `Cache-Control: max-age=0, must-revalidate` sur JS/CSS → tout déploiement visible immédiatement. `/vendor/*` = immutable 1 an.
- UI injectée par JS (barre outils, burger mobile, liens footer, layout 2 colonnes) → 0 édition des 15 pages.
- Layout outils ≥900px : `layoutToolPage()` (shared.js, appelé par `setupDrop`) scinde `#tool-body` en `.tp-left` (zone de travail) + `.tp-right` (panneau sticky : options + bouton). Style iLovePDF.
- Mobile ≤600px : outils-first (hero minimal), burger ☰, grille outils en liste, flèches ‹ › pour réordonner (le drag HTML5 ne marche pas au tactile).
- Icônes : `TOOL_ICONS` style « duo solide » (aplats pleins couleur catégorie `CAT_COLORS`, action en creux `var(--sf)`), tuiles teintées `color-mix`.
- Accueil : hero 2 colonnes avec illustration SVG « 100% local » (vectorielle, PAS d'emoji dans les SVG — ils ne se rendent pas), puces de catégories filtrantes, ordre Hero→Outils→Pourquoi→Comment→Comparaison→FAQ.

## Historique des incidents (NE PAS RÉPÉTER)
1. **SW v3-v6 = pages « Offline » partout** : (a) fallback CDN `/* offline */` remplaçait supabase-js par du JS vide → crash shared.js ; (b) réponses `redirected:true` (308 Cloudflare) rejetées par le navigateur pour les navigations ; (c) sur certains réseaux (proxy d'entreprise) les fetch initiés par un SW échouent tous → précache vide → 503. Décision : **pas de SW sur le web**. Page `/reset` conservée en secours.
2. **CSP pièges** : `connect-src` doit inclure `'self'` (sinon le fetch du qpdf.wasm échoue) et n'inclut PAS `data:` → ne jamais utiliser `fetch(dataURL)`, utiliser `canvas.toBlob` (cause du « 0% de gain » historique de la compression).
3. **`Security.wipeMemory(buf)` UNIQUEMENT APRÈS `save()`** : pdf-lib garde des VUES sur les octets (embedJpg, copyPages, load) → wiper avant = pages blanches/corrompues (bug historique img2pdf + merge).
4. **`overflow-x:auto` sur `.tools-nav`** découpait le menu déroulant absolu → scroller `.tn-links`, jamais la barre.
5. **Casse des dispatchs** : `runImg2Pdf`, `runPageNums` (vérifier les noms exacts en ajoutant un outil).
6. `setRbn` doit connaître chaque `type` ('angle','sec','signpos') sinon l'option est silencieusement ignorée.

## Spécificités outils
- **compress** : profils `QPROF` (0.2 Minimale 700px/q.25, 0.4 Max 900px/q.35, 0.75 Reco, 0.9 Léger). JPEG décodés via `createImageBitmap(octets)` (couvre tout), autres via PDF.js. Downscale = la vraie source de gain. Progression en Ko réels. Référence : 2Mo→700Ko en Minimale (iLovePDF ~500Ko grâce à l'optim polices, hors de portée navigateur).
- **merge** : cartes-documents (1 carte = 1 PDF), rotation 90° par document appliquée à la fusion, drag desktop + flèches tactile. État `mergeDocs[i]` aligné sur `activeFiles[i]`.
- **delete** : `removePage()` en place (JAMAIS copyPages → perdrait sommaire/liens internes).
- **extract** : extrait les images INTÉGRÉES (≠ pdf2jpg qui rasterise les pages). Exclut les SMask (sinon « images noires 1 Ko »), min 64px/3Ko, JPEG CMYK via PDF.js.
- **watermark** : centré géométriquement, tient compte du `/Rotate` des pages.
- **sign** : positions bas D/C/G + case « toutes les pages ».
- **pdf2jpg / img2pdf** : case « ordre inversé ».
- **crop** : aperçu = vraie 1re page (PDF.js) + cadre + voile sombre, marges mm → dimensions réelles.
- **security** : qpdf local, progression 15→40→48→55→85→100.

## Supabase (hors git)
- Edge functions déployées via MCP le 19/07/2026. `contact`/`track-pageview`/`cleanup` : verify_jwt=false (auth custom ou public) ; `delete-account` : verify_jwt=true.
- **Secrets faits par l'utilisateur** : RESEND_API_KEY, CONTACT_TO, CONTACT_FROM (formulaire contact testé OK).
- **À FAIRE** : CRON_SECRET + programmer le cron horaire de `cleanup` (Authorization: Bearer <CRON_SECRET>). Vérifier bucket `pdf-files` privé + policies. Templates emails dans Auth.

## À FAIRE / Roadmap
1. Cron `cleanup` (ci-dessus).
2. Export **ZIP** pour Split / PDF→JPG / Extract (mobile bloque les téléchargements multiples).
3. Remplacer les emojis restants (trust banner, proof bar, boutons 💾/☁️) par des vecteurs.
4. PWA : si réactivation du SW souhaitée, il est prêt (v8) mais tester en standalone uniquement.
5. Compte Yendyx unifié (SSO multi-produits) — plan d'archi à rédiger après stabilisation.
6. Autres outils façon iLovePDF (1 commit par outil).

## Préférences / pièges à connaître
- Utilisateur **francophone**, veut **concis et direct**. Benchmark constant = **iLovePDF** (il envoie des captures ; les reproduire fidèlement).
- **Logo** : utiliser le fichier exact `logo_seul_sans_fond.png`, JAMAIS le redessiner.
- L'agent **ne peut pas** : push GitHub (l'utilisateur fait `git push`), accéder au dashboard Cloudflare. Supabase accessible via MCP (deploy fonctions, SQL) mais PAS les secrets.
- Vérifier le déployé : `git ls-remote origin refs/heads/main` vs local ; `web_fetch` sur le site (ajouter `?x=y` pour contourner la dédup).
- Tests : `node --check` par fichier + comptage d'accolades CSS. Pas de jsdom.
- À chaque modif CSS/JS : bumper `?v20260719x` dans les 23 pages HTML (sed) — plus critique depuis max-age=0, mais garde les caches téléphone honnêtes.
- Le sandbox bash perd parfois le mount → `request_cowork_directory` pour le remonter ; locks git : `rm -f .git/*.lock` (activer la suppression de fichiers si besoin).
