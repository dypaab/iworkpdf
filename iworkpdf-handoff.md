# iWorkPDF — Handoff / contexte pour un nouveau chat

## Le projet
**iWorkPDF** — boîte à outils PDF gratuite, privacy-first, 14 outils qui tournent 100% dans le navigateur. Marque **YENDYX**.
- **En ligne** : https://iworkpdf.yendyx.com (Cloudflare Pages, connecté à GitHub)
- **Repo** : github.com/dypaab/iworkpdf — branche `main`
- **Dossier local** : C:\Users\Admin\Documents\creator\iworkpdf

## Stack
- Vanilla JS/HTML/CSS. Traitement PDF local : **pdf-lib** + **PDF.js**.
- Chiffrement AES-256 réel (protéger/déverrouiller) : **qpdf-wasm** (`pdf-security.js`, chargé depuis jsdelivr).
- **Supabase** : auth + partage cloud optionnel 48h (bucket privé, URLs signées, edge functions).
- **Cloudflare Pages** (hébergement, git-connecté). PWA (Service Worker `sw.js`).

## Architecture
- 14 pages `/tools/<id>.html` partageant `shared.js` / `shared.css` / `tool-theme.css`.
- Chaque outil a son JS (`merge.js`, `compress.js`, …). Contrats `run(id)` dans shared.js.
- Outils : merge, split, delete, rotate, compress, security, watermark, img2pdf, pagenums, pdf2jpg, repair, crop, sign, extract.
- Beaucoup d'UI est injectée par JS (barre d'outils, icônes en-tête, liens compte/contact) pour éviter d'éditer 15 pages.

## Fait cette session
- **Sécurité** : audit + fixes (bucket privé documenté, `cleanup` fail-closed si pas de CRON_SECRET, messages d'erreur génériques, `track-pageview` durci, horodatage serveur).
- **Chiffrement réel** AES-256 via qpdf-wasm (avant : « Protéger » ne faisait rien).
- **Thème clair par défaut** (avant : sombre). Centralisé dans `shared.css` → `html.light`.
- **Layout compact** des pages outils (tout visible sans défiler) : barre Privacy retirée du haut, destination + bouton + aperçus masqués tant qu'aucun fichier (`#tool-body:not(.has-files)`).
- **Barre d'outils horizontale** (style iLovePDF) : 4 outils sur pages outils, étalés pleine largeur sur l'accueil + menu « Tous les outils PDF ».
- **Écran de résultat** avec re-téléchargement après traitement.
- **Drop zones** des 14 outils standardisées (texte + bouton).
- **Nouvelles icônes** « document coloré » : `TOOL_ICONS` (glyphes) + couleurs par catégorie centralisées dans **`CAT_COLORS`** (shared.js) via `currentColor`. Changer une couleur = 1 ligne.
- **Visuel animé** de l'accueil (document central + tuiles d'outils qui flottent).
- **Logo** = fichier EXACT de l'utilisateur `logo_seul_sans_fond.png` (nav + favicon). ⚠️ NE JAMAIS recréer le logo — sujet ultra-sensible (longue série d'échecs quand l'agent l'a redessiné).
- **Compte** : mot de passe oublié (lien + événement `PASSWORD_RECOVERY` → modal nouveau mdp), suppression de compte (edge function `delete-account`), formulaire de contact (edge function `contact` via Resend). UI injectée par JS dans shared.js.
- **Emails brandés (texte seul)** : `supabase/emails/confirm-signup.html`, `reset-password.html`.
- **Cloudflare** : fichier `_headers` (port des en-têtes sécurité de vercel.json), `.assetsignore` (exclut node_modules).
- **Service Worker** bumpé en **v3** (purge du cache) après changement d'assets/logo.

## Workflow de déploiement (IMPORTANT)
- Cloudflare est branché sur GitHub → chaque `git push` redéploie.
- **L'agent commite en LOCAL uniquement** ; il ne peut PAS push (pas d'auth GitHub). C'est **l'utilisateur qui fait `git push`** depuis son terminal.
- Vérifier le SHA distant : `git ls-remote origin refs/heads/main`.

## À FAIRE (pending)
1. **`git push`** les commits locaux en attente (bump SW v3 + favicon = fichier user). Sinon pas déployés.
2. **Config Supabase** (seule partie hors git) :
   - Bucket `pdf-files` en **PRIVÉ** + policies Storage (chaque user = son dossier).
   - Auth → URL Configuration : Site URL + Redirect URLs = `https://iworkpdf.yendyx.com/**`.
   - Déployer les 4 edge functions : `cleanup`, `track-pageview`, `delete-account`, `contact`.
   - Secrets : `CRON_SECRET`, `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`.
   - Resend : vérifier le domaine `yendyx.com`, générer la clé API. (Idéalement aussi brancher Resend en SMTP Supabase pour fiabiliser confirmation/réinit.)
   - Coller les 2 templates emails dans Auth → Email Templates.
3. **HTTPS « non sécurisé »** : vérifier que le custom domain `iworkpdf.yendyx.com` est **Active** dans Cloudflare Pages, DNS **proxied** (nuage orange), cert SSL provisionné (quelques min). Accéder en `https://`.
4. **Favicon** : le fichier logo user a un **fond gris** → carré gris dans l'onglet. Pour un favicon propre, il faut une **version transparente** fournie par l'utilisateur (ne pas recréer).
5. Optionnel : rafraîchir icônes PWA (`icon-192/512.png`) + `og-image.png` avec le nouveau logo ; template email « Change Email ».

## Roadmap
- Ajouter d'autres outils façon iLovePDF (1 commit par outil).
- **Compte Yendyx unifié** (SSO multi-produits) : chaque produit a **son propre projet Supabase** → il faut une **couche d'identité centrale** (ex. « Yendyx Accounts » + Supabase Third-Party Auth, ou IdP dédié Clerk/WorkOS). Session partagée via cookie `.yendyx.com` en phase 2. Table `entitlements`. → Plan d'archi dédié à rédiger, APRÈS stabilisation d'iWorkPDF.

## Préférences / pièges à connaître
- Utilisateur **francophone**, veut **concis et direct**. Benchmark constant = **iLovePDF**.
- **Logo** : utiliser le fichier exact de l'utilisateur, jamais le redessiner.
- L'agent **ne peut pas** : push GitHub, accéder aux dashboards Cloudflare/Supabase, recevoir des images collées (il faut des **fichiers joints**).
- **jsdom cassé** dans le sandbox de l'agent → pas de test DOM ; utiliser `node --check` + petits tests `vm`.
- **Service Worker** : bumper `CACHE_VERSION` dans `sw.js` à chaque changement d'assets, sinon l'ancien est servi en cache (même après Ctrl+Shift+R).
- Couleurs centralisées : `CAT_COLORS` (icônes) et `html.light` (thème) dans shared.
