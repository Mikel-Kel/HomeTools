# HomeTools — PWA (front-end)

Application personnelle de gestion financière et d'archives documentaires.
Développeur unique : Michel. Utilisée depuis un Mac (MacBook Air M1, `airmike`) et des iPads.

Repos liés : backend AppleScript dans `../Backend`, proxy Flask dans `../hometools-proxy`. Chacun a son propre CLAUDE.md.

## Stack

- Vue 3 + TypeScript + Vite. Alias `@/` → `src/`, routeur en mode hash, base `/HomeTools/` en production.
- « PWA » = manifest + balises meta uniquement : **il n'y a pas de service worker**, donc aucun cache applicatif.
- Déployée sur GitHub Pages : `https://mikel-kel.github.io/HomeTools/`
- **Le repo est public** (GitHub Pages ne fonctionne plus en privé) → aucun secret dans le code ni dans le build.
  - Pas de `.env` versionné ; `.env.local` est ignoré (URL et clé du proxy).
  - Toute variable `VITE_*` finit en clair dans le bundle public.
- Commandes : `npm run dev` (http://localhost:5173), `npm run build` (`vue-tsc -b && vite build`). Pas de tests ni de lint.
  Le type-check utilise `tsconfig.json` (avec `noUnusedLocals` / `noUnusedParameters` : tout code inutilisé fait échouer le build).
- Après chaque modification du code : vérifier que le build passe (type-check inclus) avant de rendre la main.
  Le build réécrit `dist/` (ignoré) et `tsconfig.tsbuildinfo` (versionné).

## Commit et déploiement

Michel commite et déploie avec l'app myTooling (repo `../myTooling`, détails dans son CLAUDE.md). Ne pas commiter
depuis une session : préparer les modifications, puis indiquer à Michel quelle action lancer dans myTooling (projet HomeTools).

Ce que font les actions de myTooling pour ce repo :

- **Commit + Tag** : depuis `main` uniquement, `git fetch` et contrôles, **`npm run build` de vérification** (un échec bloque
  la release), `npm version`, `git add -A`, commit `Release vX.Y.Z – …`, tag annoté, push du commit et du seul nouveau tag.
  `git add -A` publie tout fichier non ignoré présent dans le dossier. Option « Deliver afterwards » pour enchaîner la livraison.
- **Deliver** : seulement si HEAD est exactement le dernier tag, commité et poussé ; `npm run build`, `npm run deploy`
  (`gh-pages -d dist`), puis écrit la version dans `settings/AppParameters.json` de la base HomeTools.
- **Clean** : aperçu puis mise à la corbeille de `dist`, des caches Vite et TypeScript et des `.js` générés dans `src/` ;
  option « Deep clean » (`node_modules` puis `npm ci`).
- **Restore** : `git reset --hard <tag>` + `git clean -fd`, après sauvegarde de HEAD dans une branche `backup/restore-<date>`
  et des modifications locales dans un stash.

Version : le tag git fait foi ; `package.json` est injecté dans l'app (`__APP_VERSION__`) ; l'app se déclare incompatible
si elle est plus ancienne que la version de `AppParameters.json` (`src/services/version/`), contrôlé sur tous les backends
après chaque navigation, au retour au premier plan et toutes les 30 min (au plus toutes les 5 min). Le dialogue propose
« Reload », qui recharge avec `?v=<version>` pour contourner le cache de `index.html` (GitHub Pages, 10 min).

## Architecture

- Deux backends de stockage, choisis dans `AuthenticationView.vue` et mémorisés en localStorage
  (défaut : Local Drive sur Mac, Object Storage ailleurs). Tout accès aux données passe par `src/services/driveAdapter.ts`,
  qui aiguille selon le backend actif. Le mode Google Drive a été retiré : une valeur `GOOGLE_DRIVE` encore
  mémorisée est effacée et l'appareil reprend son défaut.
  - **Local Drive** : File System Access API du navigateur (Chrome/Edge sur Mac uniquement, pas Safari), handle du dossier
    persisté en IndexedDB. Ne passe pas par le proxy. Ne résout qu'un niveau de dossier à la fois : pas de `/` dans un nom de fichier.
  - **Object Storage** : Hetzner S3, bucket `hometools-prod`, toujours via le proxy.
- Proxy Flask local, exposé via Tailscale : `https://airmike.tail73b300.ts.net`, authentification par header `X-Proxy-Key`.
  Hetzner refuse les requêtes SigV4 signées par le navigateur (CORS) : ne jamais réintroduire d'accès S3 direct.
  - `/api/s3/read`, `write`, `head`, `list`, `delete` : utilisés par `src/services/s3/s3StorageAdapter.ts`.
  - `/api/local/read` (lecture d'un PDF d'archive sur le disque du Mac, normalisation NFC/NFD) et `/api/local/open`
    (ouverture native sur le Mac) : utilisés par `DocumentsArchiveView.vue`, quel que soit le backend actif.
- Tout appel au proxy passe par `proxyFetch` (`src/services/proxy/proxyClient.ts`), seul module qui lit `VITE_PROXY_URL`
  et `VITE_PROXY_API_KEY`. Il n'y a pas d'authentification applicative ni de coffre d'identifiants.
- Thème : tokens `--positive`, `--negative`, `--warning` dans `src/assets/theme.css`, variantes clair/sombre (`[data-theme="dark"]`).
- Navigation : liste des pages dans `src/config/navigation.ts`, partagée par le menu de l'accueil et la barre
  d'icônes `AppNavRail.vue` (toutes les pages sauf l'accueil, montée dans `App.vue`). Une nouvelle page s'y ajoute.
  Appareils cibles : Mac et iPad (pas d'iPhone).
- Composants d'interface communs dans `src/components/ui/` : `PillButton`, `SegmentedControl`, `StatusPill`, `ScrollRow`
  (rangée défilante « ‹ › », aussi utilisée par `ChipSelector`). Les utiliser plutôt que de redéfinir des styles locaux.
- Fichiers JSON publiés par le Mac : les lire avec `useRemoteJson` (`src/composables/useRemoteJson.ts`), qui attend le stockage,
  charge, surveille et recharge sans clignotement, et les convertir avec la fonction de lecture de leur contrat
  (`src/contracts/<domaine>.ts`, helpers dans `src/contracts/read.ts`). Les types et noms de fichiers du contrat vivent dans ce dossier.
  Toutes les vues sont converties. Exceptions voulues : les Archives chargent par `loadJSONFromFolder` les fichiers que désigne
  leur index (tous lus par le contrat `archive.ts`), et les drafts d'allocation et statuts d'événements, lus fichier par fichier,
  restent hors de `useRemoteJson`.

## Contrat d'échange avec le backend Mac (Housekeeping)

Ces fichiers sont produits ou consommés par les scripts AppleScript du repo Backend. Ne pas changer leur format sans modifier les deux côtés.

- `settings/AppParameters.json` : champ `version`, écrit au déploiement, lu au démarrage de l'app.
- `settings/appStatus.json` : maintenance (`{ version, maintenance, message, since }`), écrit par la section « HomeTools › Maintenance »
  de myTooling ; contrat `../Backend/docs/app-status-contract.md`. Maintenance active, ou proxy
  injoignable en Object Storage : écran plein `AppUnavailable.vue` (`src/services/appStatus/`). Local Drive jamais bloqué.
- `diagnostics/homeMessages.json` : `{ "messages": [{ id, level, text }] }`, `level` = `ok` | `warning` | `error`, du plus récent
  au plus ancien. Pastilles de `HomeView.vue`. Réinitialisé et alimenté chaque nuit par `housekeeping.applescript`.
- `diagnostics/housekeepingLogIndex.json` et `diagnostics/housekeepingLog-{date}.json` : journaux affichés par `EventLogView.vue`.
  Le dossier `diagnostics/` doit rester plat (contrainte Local Drive ci-dessus).
- `events/` : événements émis par la PWA dans le backend actif, traités côté Mac (`pullObjectStorageEvents`, `processEvents`,
  `processEvent_*`). Nom `PWA-<TRI>_<AAAAMMJJHHMMSS>[_<suffixe>].json`, toujours préfixé, Local Drive compris (le Mac
  n'écrit un statut que pour ces noms ; anciens noms sans préfixe encore reconnus). Écriture par `emitEvent`
  (`src/services/events/eventFiles.ts`), suivi d'une demande par `useEventRequest` (`src/composables/useEventRequest.ts`).
  Sous-dossiers : `control`, `processing`, `processed`, `rejected`, `status`.
- Demande de ré-allocation : `events/PWA-REA_<AAAAMMJJHHMMSS>_<FITID>.json` (FITID complet dans le nom). Le badge « Pending »
  de `FollowUpDetails.vue` est déduit du stockage, jamais de l'appareil : REA encore présent à la racine de `events/` (demandé),
  ou `pending: true` sur la ligne dans `allocations/budget/FollowUpDetails-<année>.json` (traité, en attente de ré-allocation).
  Le backend publie `FollowUpDetails` avant de retirer le REA de `events/`. Les allocations d'un mouvement en attente sont
  conservées jusqu'à la release qui les remplace.
- `events/control/` : en Object Storage, toute écriture sous `events/`, `allocations/drafts/` ou `allocations/released/` émet
  un événement `STORAGE_PULL_REQUESTED` pour que le Mac rapatrie les fichiers (`src/services/s3/storagePullRequest.ts`).
  Le champ `paths` y est un alias de compatibilité de `downloadPaths`.
- `events/status/<nom de l'événement>` : `{ status: "success" | "error", message, finishedAt }`, conservés 24 h. Lus par
  `useEventRequest` : Card24 (`PWA-BAT_…_Card24Download.json`, persistance localStorage, timeout de 5 minutes) et
  housekeeping manuel. Classements d'archives (`PWA-TOC_…_<TOCID>.json`) : pas de suivi de statut.
- `settings/housekeepingSteps.json` : `{ generatedAt, steps: [{ key, label, group, manual, nightly, forces? }] }`, catalogue des étapes du
  housekeeping. Exécution manuelle : événement `PWA-HKP_<AAAAMMJJHHMMSS>.json`, `eventType` `HOUSEKEEPING_REQUESTED`,
  `payload: { steps: [clés], source }`. Seules les étapes `manual: true` sont acceptées ; les étapes listées dans `forces`
  (ex. `archiveReconcile` → `exportArchiveToc`) s'exécutent avec elles. Une réconciliation manuelle est toujours appliquée.
  Le Mac refuse une demande pendant un housekeeping (refus écrit en ERR) : `HousekeepingRun.vue` bloque le lancement, d'après
  le stockage, tant qu'un HKP attend dans `events/` ou `events/processing/`, ou que le dernier statut HKP `success` est plus
  récent que `housekeepingLogIndex.json` (réécrit en fin de run ; limite 1 h). Le housekeeping de nuit n'est pas détecté.
- Nom d'un document archivé (`buildPhysicalName`, `DocumentsArchiveView.vue`) :
  `AAAA/<Folder>/P<PartyID sur 5 chiffres>/<AAAA-MM-JJ>[-DTA<AAAAMMJJ>][-IF1<Info1>][-IF2<Info2>][-TAG<id>[_<id>…]][-AMT<centimes>].pdf`.
  Le backend reconstruit `archivetoc` et les tags à partir de ces noms (`scripts/python/archive_reconcile.py`) :
  ne pas changer cette grammaire sans adapter le script. Tags séparés par `_`.

- Budget (nouvelle page, en cours) : contrat d'échange dans `../Backend/docs/budget-contract.md`
  (section `years` de `budget.json`, événements `PWA-BUD_…`, journal `budgetLog-<année>.json`).

- Master data (catégories, parties, tags) : contrats dans `../Backend/docs/categories-contract.md`, `parties-contract.md`
  et `tags-contract.md` (table `Tags`, tags `Acc` numérotés à partir de 1, `0` = sans tag, seul tag hors budget = tag réservé 1 ;
  événements `PWA-CAT_…`, `PWA-PTY_…`, `PWA-TAG_…`). Tags de documents
  (§ 6, `TagType = 'Doc'`, identifiants inchangés car écrits dans les noms des PDF, suffixe d'événement `D<id>`).

- Indicateurs (nouvelle page, en cours) : contrat d'échange dans `../Backend/docs/indicators-contract.md`
  (exports `indicators/indicators.json` et `values-<famille>.json`, événements `PWA-IND_…`).

## Points ouverts connus

- `VITE_PROXY_API_KEY` est en clair dans le bundle public. Objectif : la retirer du build et la stocker dans un coffre chiffré
  (PBKDF2 / AES-GCM, verrouillage après inactivité), saisie une fois par appareil. **Ce coffre reste à construire.**

## Règles de travail

- Fichiers complets et propres, prêts pour la production : aucun reliquat de POC, code de test ou code commenté transitoire.
- Travail par petites étapes : une modification, vérification (build + type-check), puis on continue.
- Michel décide de l'architecture : proposer les options et attendre son accord avant tout changement structurel.
- Respecter la langue et le style des commentaires existants.
- Ne jamais lire ni afficher de fichier `.env*` ou contenant des secrets.
