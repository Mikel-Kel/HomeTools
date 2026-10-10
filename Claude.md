# HomeTools — PWA (front-end)

Application personnelle de gestion financière et d'archives documentaires.
Développeur unique : Michel. Utilisée depuis un Mac (MacBook Air M1, `airmike`) et des iPads.

## Stack

- Vue 3 + TypeScript + Vite, PWA
- Déployée sur GitHub Pages : `https://mikel-kel.github.io/HomeTools/`
- **Le repo est public** (GitHub Pages ne fonctionne plus en privé) → aucun secret dans le code ni dans le build
- Serveur de développement : `npm run dev` (http://localhost:5173)

## Build, commit et déploiement

- Michel utilise l'outillage AppleScript maison du sous-dossier `tooling/` pour le build, les commits et le déploiement :
  - `GitWorkflow.applescript` : workflow Git (build, commit, push)
  - `GitTooling.applescript` : fonctions communes utilisées par les workflows Git
  - `S3Workflow.applescript` : workflow lié à Object Storage
  - `LaunchAgentsWorkflow.applescript` : workflow lié aux LaunchAgents
  - `Git release (deprecated).applescript` : **obsolète, ne pas utiliser ni modifier**
- Avant toute utilisation : lire le script concerné pour comprendre ce qu'il fait réellement.
- Ces scripts peuvent afficher des dialogues (`display dialog`, `choose from list`) : ne jamais les lancer via `osascript`
  depuis une session, ils resteraient bloqués. Préparer les modifications, puis indiquer à Michel quel workflow lancer.
- Ce sont des fichiers AppleScript : les règles d'encodage (Mac Roman possible) et les pièges du repo backend s'appliquent
  aussi en cas de modification.
- Cet outillage est en version initiale : signaler ses limites ou bugs rencontrés et proposer des améliorations,
  sans le modifier sans l'accord de Michel.
- Après chaque modification du code : vérifier que le build passe (y compris la vérification TypeScript) avant de rendre la main.

## Architecture

- Trois backends de stockage sélectionnables dans la vue d'authentification :
  - **Local Drive** : fichiers locaux du Mac, via le proxy
  - **Google Drive** : sert aussi de bus d'événements entre la PWA et le backend Mac
  - **Object Storage** : Hetzner S3 (bucket `hometools-prod`), via le proxy
- Tout accès S3 passe par le proxy Flask local (repo séparé `hometools-proxy`), exposé via Tailscale :
  `https://airmike.tail73b300.ts.net`, authentification par header `X-Proxy-Key`.
  Hetzner refuse les requêtes SigV4 signées par le navigateur (CORS) : ne jamais réintroduire d'accès S3 direct.
- Endpoints locaux du proxy : `/api/local/read` (lecture de fichiers, normalisation NFC/NFD des noms accentués),
  `/api/local/open` (ouverture native d'un PDF sur le Mac).
- Coffre d'identifiants chiffré (PBKDF2 / AES-GCM) avec verrouillage automatique après inactivité.
- Thème : tokens `--positive`, `--negative`, `--warning` dans `theme.css`, variantes clair/sombre.

## Contrat d'échange avec le backend Mac (Housekeeping)

Ces fichiers sont produits ou consommés par les scripts AppleScript du repo backend. Ne pas changer leur format sans modifier les deux côtés.

- `diagnostics/homeMessages.json` : messages de statut affichés dans `HomeView.vue` (pastilles colorées).
  Réinitialisé et alimenté chaque nuit par `housekeeping.applescript`. Tableaux JSON triés du plus récent au plus ancien.
- `events/` : événements émis par la PWA, récupérés et traités côté Mac (`pullObjectStorageEvents`, `processEvents`, `processEvent_*`).
- `events/status/` : fichiers de statut de traitement (boucle de retour Card24). Surveillés par `SpendingView.vue`
  (watcher Drive, persistance localStorage, timeout de sécurité de 5 minutes).

## Points ouverts connus

- `VITE_PROXY_API_KEY` : toute variable `VITE_*` est injectée en clair dans le bundle public.
  Objectif : retirer la clé du build et la stocker dans le coffre chiffré, saisie une fois par appareil.
- Écritures « pending » fantômes : un iPad affiche des écritures en pending absentes des données de référence (Object Storage).
  Pistes : cache du service worker sur les données, état pending persisté en localStorage/IndexedDB jamais purgé,
  fichiers homonymes en double sur Google Drive (create au lieu d'update).

## Règles de travail

- Fichiers complets et propres, prêts pour la production : aucun reliquat de POC, code de test ou code commenté transitoire.
- Travail par petites étapes : une modification, vérification (build + type-check), puis on continue.
- Michel décide de l'architecture : proposer les options et attendre son accord avant tout changement structurel.
- Respecter la langue et le style des commentaires existants.
- Ne jamais lire ni afficher de fichier `.env` ou contenant des secrets.
