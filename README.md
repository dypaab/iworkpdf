# 🌐 iWorkPDF — by Yendyx

Site web PDF multifonction, gratuit, 100% local + cloud Supabase optionnel.

---

## 🚀 Mise en ligne en 5 minutes

### Étape 1 — Supabase

1. Allez sur [supabase.com](https://supabase.com) → votre projet
2. **SQL Editor** → collez et exécutez `supabase_setup.sql`
3. **Storage** → "New bucket" → nom : `pdf-files` → **NE PAS cocher Public** (bucket **privé** : on utilise des URLs signées à durée limitée). Puis dans **Storage → Policies**, ajoutez pour SELECT/INSERT/DELETE : `bucket_id = 'pdf-files' AND (storage.foldername(name))[1] = auth.uid()::text` (chaque utilisateur n'accède qu'à son propre dossier).
4. **Project Settings → API** → copiez :
   - `Project URL`
   - `anon public key`

> ⚠️ **Sécurité** : le bucket doit rester **privé**. S'il est public, tous les fichiers uploadés deviennent accessibles par leur URL et l'expiration des liens ne protège plus rien.

### Étape 2 — Configurer index.html

Ouvrez `index.html` et remplacez lignes 200-201 :
```js
const SUPABASE_URL = 'https://VOTRE_PROJET.supabase.co';
const SUPABASE_KEY = 'VOTRE_ANON_KEY';
```

### Étape 3 — Déployer sur Vercel (gratuit)

```bash
# Option A — Interface web
# 1. Poussez le dossier sur GitHub
# 2. vercel.com → "Import project" → choisir le repo → Deploy ✅

# Option B — CLI
npm i -g vercel
cd iworkpdf
vercel --prod
```

### Étape 4 — Activer le nettoyage automatique 48h

```bash
# Installer Supabase CLI
npm install -g supabase

# Déployer la Edge Function avec cron toutes les heures
supabase functions deploy cleanup --schedule "0 * * * *"
```

---

## ✨ Fonctionnalités

| Outil | Traitement | Description |
|---|---|---|
| 🔀 Fusionner | Local | Combine plusieurs PDFs |
| 🗑 Supprimer pages | Local | Supprime des pages précises (ex: 1,3,5-8) |
| ✂️ Diviser | Local | Une page = un fichier téléchargé |
| 🔄 Rotation | Local | 90°, 180°, 270° |
| 🗜 Compresser | Local | Réduction de taille |
| 🔒 Sécurité | Local | Protection AES-256 par mot de passe (qpdf-wasm) |
| 💧 Filigrane | Local | Texte diagonal personnalisé |
| 🖼 Images → PDF | Local | JPG/PNG → PDF multi-pages |

*Chiffrement AES-256 réel via QPDF compilé en WebAssembly — 100% dans le navigateur, aucun upload.

---

## 🏗️ Architecture

```
Utilisateur
    │
    ▼
index.html (pdf-lib.js)         ← Traitement 100% local
    │
    ├── Mode Local               → Téléchargement direct
    │
    └── Mode Cloud (Supabase)
            │
            ├── Storage "pdf-files"   ← Fichier uploadé
            ├── Table "shared_files"  ← Métadonnées + expiry
            └── Edge Function cleanup ← Suppression auto 48h
```

---

## 🎨 Design System Yendyx

| Token | Valeur | Usage |
|---|---|---|
| `--bg` | `#0D1117` | Fond principal |
| `--surface` | `#161B2E` | Cards |
| `--cyan` | `#00B4D8` | Accent primaire |
| `--blue` | `#0077FF` | Gradient fin |
| `--grad` | cyan→blue | Boutons CTA, logos |

---

## 📁 Structure

```
iworkpdf/
├── index.html                    ← Application complète (1 fichier)
├── supabase_setup.sql            ← Script SQL à exécuter
├── supabase/
│   └── functions/
│       └── cleanup/
│           └── index.ts          ← Edge Function nettoyage 48h
└── README.md
```

---

*iWorkPDF by Yendyx — Vos fichiers restent sur votre appareil.*
