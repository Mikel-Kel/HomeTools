# HomeTools — PWA (front-end)

Application personnelle de gestion financière et d'archives documentaires.
Développeur unique : Michel. Utilisée depuis un Mac (MacBook Air M1, `airmike`) et des iPads.

Repos liés : backend AppleScript dans `../Backend`, proxy Flask dans `../hometools-proxy`. Chacun a son propre CLAUDE.md.

## Stack

- Vue 3 + TypeScript + Vite. Alias `@/` → `src/`, routeur en mode hash, base `/HomeTools/` en production.
- « PWA » = manifest + balises meta uniquement : **il n'y a pas de service worker**, donc aucun cache applicatif.
- Déployée sur GitHub Pages : `https://mikel-kel.github.io/HomeTools/`
- **Le repo est public** (GitHub Pages ne fonctionne plus en privé) → aucun secret dans le code ni dans le build.
  - Pas de `.env` versionné ; `.env.local` est ignoré (URL du proxy, `VITE_PROXY_URL`). La clé du proxy n'est jamais dans le build.
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
  (défaut : Local Drive sur l'appareil serveur de l'environnement, `isServer`, seul à pouvoir le choisir ; Object Storage ailleurs). Tout accès aux données passe par `src/services/driveAdapter.ts`,
  qui aiguille selon le backend actif. Le mode Google Drive a été retiré : une valeur `GOOGLE_DRIVE` encore
  mémorisée est effacée et l'appareil reprend son défaut.
  - **Local Drive** : File System Access API du navigateur (Chrome/Edge sur Mac uniquement, pas Safari), handle du dossier
    persisté en IndexedDB (un dossier par environnement). Ne passe pas par le proxy pour les données. Ne résout qu'un niveau de dossier à la fois : pas de `/` dans un nom de fichier.
  - **Object Storage** : Hetzner S3, bucket `hometools-prod`, toujours via le proxy.
- Proxy Flask local, exposé via Tailscale : `https://airmike.tail73b300.ts.net`, authentification par header `X-Proxy-Key`.
  Hetzner refuse les requêtes SigV4 signées par le navigateur (CORS) : ne jamais réintroduire d'accès S3 direct.
  - `/api/s3/read`, `write`, `head`, `list`, `delete` : utilisés par `src/services/s3/s3StorageAdapter.ts`.
  - PDF d'archives (`DocumentsArchiveView.vue`, ouverture par `src/services/archive/archiveDocumentOpen.ts`, quel que soit
    le backend actif ; page jamais masquée) : si `localArchive`
    et `isServer` (le Mac serveur), `/api/local/open` (ouverture native) puis repli sur `/api/local/read` (disque),
    puis, si la copie locale répond 404 (en retard ou fichier non téléchargé par iCloud), sur `/api/s3/read` (contrat 1.5.0, §10) ;
    ailleurs, iPad compris, `/api/s3/read` avec `store=archives` (octets bruts, contrat 1.3.0). Clé = chemin relatif
    du document, NFC/NFD tolérés par le proxy.
- Tout appel au proxy passe par `proxyFetch` (`src/services/proxy/proxyClient.ts`), seul module qui lit `VITE_PROXY_URL`
  et envoie `X-Proxy-Key`. La clé est saisie une fois par appareil (écran `AppUnavailable.vue`, aussi quand le proxy la
  refuse) et rangée chiffrée par `src/services/proxy/proxyKeyVault.ts` : base IndexedDB `hometools-vault`, clé AES-GCM
  générée par le navigateur et non exportable, un enregistrement `ht:<envId>:proxy-key` par environnement. Pas de phrase
  secrète (choix de Michel : appareils protégés par leur mot de passe). Pas d'authentification applicative.
- Thème : tokens `--positive`, `--negative`, `--warning` dans `src/assets/theme.css`, variantes clair/sombre (`[data-theme="dark"]`).
- Navigation : liste des pages dans `src/config/navigation.ts`, partagée par le menu de l'accueil et la barre
  d'icônes `AppNavRail.vue` (toutes les pages sauf l'accueil, montée dans `App.vue`). Une nouvelle page s'y ajoute.
  Page réservée à une capacité : champ `capability` de l'entrée (lue par `navigationItems()`) et `meta.capability`
  de la route (garde du routeur, retour à l'accueil sans la capacité).
  Appareils cibles : Mac et iPad (pas d'iPhone).
- Composants d'interface communs dans `src/components/ui/` : `PillButton`, `SegmentedControl`, `StatusPill`, `ScrollRow`
  (rangée défilante « ‹ › », aussi utilisée par `ChipSelector`). Les utiliser plutôt que de redéfinir des styles locaux.
- Fichiers JSON publiés par le Mac : les lire avec `useRemoteJson` (`src/composables/useRemoteJson.ts`), qui attend le stockage,
  charge, surveille et recharge sans clignotement, et les convertir avec la fonction de lecture de leur contrat
  (`src/contracts/<domaine>.ts`, helpers dans `src/contracts/read.ts`). Les types et noms de fichiers du contrat vivent dans ce dossier.
  Toutes les vues sont converties. Exceptions voulues : les Archives chargent par `loadJSONFromFolder` les fichiers que désigne
  leur index (tous lus par le contrat `archive.ts`), le Ledger charge par `useLedgerMovements` les fichiers par compte et
  par année que désigne son index, et les drafts d'allocation et statuts d'événements, lus fichier par fichier,
  restent hors de `useRemoteJson`.

## Multi-environnements

- Référence : contracts/MULTI_ENV_CONTRACT.md (copie ; la canonique est dans ../hometools-proxy/contracts/). Ne jamais la modifier ici sans la modifier d'abord là-bas.
- Le client n'envoie jamais d'environnement ; il le découvre via GET /api/whoami au démarrage. Toute requête S3 transmet store=data ou store=archives, jamais un bucket.
- Stockage navigateur uniquement via le module préfixé ht:<envId>: ; fonctionnalités conditionnées par capabilities.
- Repo public : aucune IP, aucun identifiant ni secret.
- Mise en œuvre : contrat côté PWA dans `src/contracts/environment.ts` (`CONTRACT_VERSION`), état et démarrage dans
  `src/services/environment/` (`environmentState`, `environmentGuard`, `browserStorage`). Tant que l'environnement n'est pas
  établi, seul `/api/whoami` part (`proxyFetch`), les pages ne sont pas montées et la navigation attend. Refus du proxy
  (`ENV_*`, `AUTH_INVALID`, `CONFIG_INVALID`), MAJOR différent ou environnement changé : écran bloquant `AppUnavailable.vue`.
  Libellé de l'environnement : barre d'icônes et accueil.

## Contrat d'échange avec le backend Mac (Housekeeping)

Ces fichiers sont produits ou consommés par les scripts AppleScript du repo Backend. Ne pas changer leur format sans modifier les deux côtés.

- `settings/AppParameters.json` : champ `version`, écrit au déploiement, lu au démarrage de l'app.
- `settings/appStatus.json` : maintenance (`{ version, maintenance, message, since }`), écrit par la section « HomeTools › Maintenance »
  de myTooling ; contrat `../Backend/docs/app-status-contract.md`. Maintenance active, ou proxy
  injoignable : écran plein `AppUnavailable.vue` (`src/services/appStatus/`). Local Drive jamais bloqué par une maintenance,
  mais bloqué comme le reste si `/api/whoami` échoue (revérifié à chaque navigation).
  État, journal et Restart / Stop / Start du proxy : myTooling, section « HomeTools › Proxy ».
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
- Nom d'un document archivé (`buildPhysicalName`, `src/services/archive/archiveNaming.ts`) :
  `AAAA/<Folder>/P<PartyID sur 5 chiffres>/<AAAA-MM-JJ>[-DTA<AAAAMMJJ>][-IF1<Info1>][-IF2<Info2>][-TAG<id>[_<id>…]][-AMT<centimes>].pdf`.
  Le backend reconstruit `archivetoc` et les tags à partir de ces noms (`scripts/python/archive_reconcile.py`) :
  ne pas changer cette grammaire sans adapter le script. Tags séparés par `_`.
- Page Documents (`DocumentsArchiveView.vue`) : chargement `useArchiveDocuments` (attend la configuration des dossiers,
  sinon les groupes garderaient leur libellé), filtres `useArchiveFilters` (dates de paiement `useArchivePayDates`),
  classement et suppression `useArchiveClassification` (`PWA-TOC_…`, document mis à jour tout de suite sous son nouveau
  nom), tableau `ArchiveTable.vue`, info-bulle des tags partagée `useTagTooltip` / `TagTooltip.vue`.
  - Fiche de classement (`DocumentArchivingSheet.vue`) : suggestions de Description puis d'Additional info
    (`useArchiveSuggestions`, historique déjà chargé par dossier et partie, périodes en jetons relatifs à la date du
    document par `src/services/archive/archiveTemplates.ts`, propres à la PWA, ni stockés ni échangés), pastilles
    `ArchiveSuggestions.vue`.
  - Documents de « A Classer » seulement, pré-remplissage (jamais d'une saisie de Michel) : relation tirée de
    l'IBAN du créancier de la QR-facture (alias `IBAN <iban>` d'une seule partie), puis de son nom, puis du nom de
    fichier libre (`archivePartyMatch.ts`, libellés et alias), dossier Bills
    s'il y a une QR-facture, sinon dossier habituel de la relation (hors Tourism / Various), date de la QR-facture si
    le nom n'en donne pas, Description et Additional info, montant de la QR-facture dans Bills (devise affichée hors
    CHF, indice « from QR-bill »).
  - QR-facture : champ facultatif `qrBill` des documents de `archive/toFile.json`, lu par le Mac au dépôt (contrat
    `../Backend/docs/archive-qrbill-contract.md`, lecteur `src/contracts/archive.ts`) ; le Mac n'écrit jamais le montant,
    Michel le valide en classant. Alias `IBAN <iban>` des parties créés par le lot 2 du contrat (2026-11-19).

- Budget (`BudgetView.vue`, route `/budget`) : hors de `navigation.ts`, ouverte par l'icône de l'en-tête de Spending et
  de Follow-up (rattachée à Follow-up par `related`). Contrat d'échange dans `../Backend/docs/budget-contract.md`
  (section `years` de `budget.json`, événements `PWA-BUD_…`, journal `budgetLog-<année>.json`).
  Saisie en brouillon par année (`src/composables/useBudgetDraft.ts`, localStorage préfixé) : « Save all » envoie un seul
  `BUDGET_BATCH_UPDATED` (`PWA-BUD_…_BATCH.json`) ; `BUDGET_UPDATED` n'est plus émis. Suppression d'une ligne et création
  d'année restent immédiates.

- Master data (catégories, parties, tags) : contrats dans `../Backend/docs/categories-contract.md`, `parties-contract.md`
  et `tags-contract.md` (table `Tags`, tags `Acc` numérotés à partir de 1, `0` = sans tag, seul tag hors budget = tag réservé 1 ;
  événements `PWA-CAT_…`, `PWA-PTY_…`, `PWA-TAG_…`). Tags de documents
  (§ 6, `TagType = 'Doc'`, identifiants inchangés car écrits dans les noms des PDF, suffixe d'événement `D<id>`).

- Règles d'allocation (lot 3) : contrat `../Backend/docs/allocation-rules-contract.md` (§ 12 candidats de
  `spending.json`, § 17 export `settings/allocationRules.json`, § 18 événements `PWA-RUL_…`). Candidats dans
  `AllocationView.vue` (« Other suggestions », la partie du draft suit le candidat choisi) ; liste des règles dans
  Master data, « Spending › Rules » (`RulesSection.vue`, lecteur `src/contracts/allocationRules.ts`), saisie par
  `RuleSheet.vue` (`RULE_SAVED` / `RULE_DELETED`, suffixe `R<id>`, aucun à la création) ; jetons des modèles de
  commentaire (§ 3) contrôlés et rendus par `checkCommentTemplate` / `renderCommentTemplate`, alignés sur
  `allocation_suggest.py` (le Mac reste juge). « Remember » dans `AllocationView.vue` (allocation sur une seule
  ligne) : `RULE_SAVED` avec `fromAllocation` par `useRememberRequest` (persistKey), statut repris et affiché par
  `SpendingView.vue` ; règle par texte quand le mouvement n'a pas de partie ou une partie générique.
  « Same as last » (`LastAllocationOption.vue`, `useLastAllocation`) : les deux dernières lignes distinctes (mêmes
  caractéristiques reprises = doublon) des drafts de `allocations/drafts/` (`savedAt`), hors mouvement ouvert ; reprend catégorie, sous-catégorie, tag et commentaire,
  jamais montant, partie ni date ; rien à proposer après une release.
  Lot 4 : alias suggérés (`suggestedParty`) dans Master data › Parties › To identify ; règles à revoir (`review`,
  filtre « To review », « Apply » de l'allocation de l'historique) et suppression groupée (`RULES_DELETED`,
  `…_BATCH.json`) dans Rules. `allocRule` des types d'opération n'est plus lu ni envoyé (§ 27).

- Indicateurs (nouvelle page, en cours) : contrat d'échange dans `../Backend/docs/indicators-contract.md`
  (exports `indicators/indicators.json` et `values-<famille>.json`, événements `PWA-IND_…`).

- Cave à vins (page « Wine cellar », capacité `wineCellar`) : contrat d'échange dans `../Backend/docs/wine-cellar-contract.md`
  (export `wine/cellar.json` en version 2 seulement, lecteur `src/contracts/wineCellar.ts`). Liste `WineCellarView.vue`, composants dans `src/components/wineCellar/` ; saisies par événements
  `PWA-WIN_…_<W|C|G|P|L|B><id ou NEW>.json` (`WINE_SAVED` en version 2), toutes émises par `useWineEvents` (`src/composables/wineCellar/`), « Pending »
  déduit des événements en attente dans `events/`. Données de base (pays, régions, producteurs, emplacements, tailles) :
  section « Wine cellar » de Master data (`WineSection.vue`). Photos des étiquettes
  (§ 5, champ `photo` = clé dans le magasin `data`) : lues par `loadFileFromPath` (`driveAdapter.ts`, binaire, deux
  backends), cache mémoire de session `useWinePhoto` ; vignettes de la liste chargées à l'approche de l'écran.
  Gestion depuis la PWA (W7) : image préparée par `prepareWineImage` (`src/services/wineCellar/`, JPEG redessiné dans
  le bon sens, 1600 px et 1 Mo au plus), envoyée en base64 dans `WINE_PHOTO_SAVED` / `WINE_PHOTO_DELETED` (fiche) ou
  dans `photo` de `WINE_SAVED` (création, héritage par `copyFrom`) ; nouvelle image = nouvelle clé.

- Saisie des dépenses depuis l'iPhone (app séparée `../iHomeTools`, capacité `mobileExpense`, contrat multi-environnements
  1.8.0, `owner` de l'appareil lu par `readWhoami`, même code que dans iHomeTools) :
  contrat `../Backend/docs/mobile-expense-contract.md` en version 0.4. HomeTools ne saisit rien ; il gère seulement,
  avec la capacité, la section « iPhone » de Master data (`IPhoneSection.vue`, sous-menus Cards et Sub-categories,
  lecteur `src/contracts/bankingCards.ts`, export `settings/bankingCards.json`, devises de `exchangeRates.json`).
  - Cards (`CardsSection.vue`, `CardSheet.vue`) : compte, devise, libellé, propriétaire et couleur, les cinq champs
    toujours envoyés dans `MOBILE_CARD_SAVED` (`PWA-MEX_…_C<cardId>.json`, `null` = aucun). Propriétaire choisi parmi
    `owners`, jamais déduit du porteur ; un propriétaire retiré reste affiché « (removed) » sur sa carte, jamais
    proposé ailleurs. Libellé unique par propriétaire (les cartes sans propriétaire entre elles). Couleur `#RRGGBB`.
  - Sub-categories (`OwnerSubCategoriesSection.vue`, `OwnerSubCategoriesSheet.vue`) : `ownerSubCategories`, un bloc
    par propriétaire ; `MOBILE_OWNER_SAVED` (`PWA-MEX_…_O<owner>.json`) envoie la liste complète, qui remplace
    l'ancienne. Seules les actives s'ajoutent, une clôturée déjà attribuée reste (« Closed ») ; propriétaire retiré :
    « Clear » seulement (liste vide). La case `mobileEntry` des sous-catégories (0.3) est abandonnée.
  - Liaison (lot M3, contrat 0.6, § 7) : candidat `source: "mobile"` en tête des suggestions de `spending.json`
    (`mobileExpenseId`, pastille « iPhone »). Allocation affiche alors le bandeau `MobileExpenseLink.vue` (détails de
    la saisie lus dans `mobile/mobile.json`, `src/contracts/mobileExpense.ts`) et « Not this expense » :
    `MOBILE_EXPENSE_UNLINKED` (`PWA-MEX_…_<id>_UNL.json`), puis relecture de `spending.json` (candidats gardés dans
    la vue, le mouvement du store n'est pas remplacé).
    Commerçant tapé sans partie correspondante (contrat 0.9, `mobilePartyName`) : ligne « Merchant » du bandeau et
    « Create party » (`PartySheet`, nom prérempli par `initialLabel`, aucun alias) ; la nouvelle partie (identifiant
    absent à l'ouverture de la fiche) devient celle de l'allocation (`setParty` de `useAllocation`, draft réenregistré).

- Portfolio (page « Portfolio », `PortfolioView.vue`, onglets Positions et Transactions ; titres dans
  Master data, section « Portfolio », `PortfolioSection.vue` et `SecuritySheet.vue`, avec leurs types, obligatoires,
  `SecurityTypesPanel.vue` et `SecurityTypeSheet.vue`, événements `…_Y<id|NEW>.json`) : contrat
  `../Backend/docs/portfolio-contract.md` en version 1.1 (lecteur `src/contracts/portfolio.ts`, exports
  `portfolio/portfolio.json` et `transactions.json`). Positions dans l'ordre des types, regroupées en option (« By type », somme des valeurs
  et poids publiés, seule addition faite par la PWA) ; journal filtré (`useTransactionFilters`) et groupé par trimestre (liquidités
  nettes, solde de fin de trimestre). Le Mac rejoue le journal et publie tous les calculs : aucun calcul de position ni de P&L dans la
  PWA. Saisies par événements `PWA-PFL_…_<S|T><id ou NEW>.json` (`_DEL` pour une suppression), refus affichés tels quels.
  Composants dans `src/components/portfolio/` ; champs par type, contrôles et charge utile de `TRANSACTION_SAVED` dans
  `src/services/portfolio/transactionForm.ts` (le Mac reste juge). Nouvelle saisie : propositions par type tirées du
  journal et des positions publiées (`transactionProposals.ts`, jamais cours ni change), « Duplicate » depuis une
  transaction existante, pastilles des commentaires déjà saisis. Détail d'une position (`PositionDetail.vue`) : effet
  cours + effet change = P&L latent, courbe de `market-history.json` avec repères `markers` de `LineChart` (entrées et
  sorties à `adjustedPrice`).

- Ledger (vue comptable, `LedgerView.vue`, route `/ledger`, niveau 2) : accessible seulement par l'icône de l'en-tête de
  Spending, hors de `navigation.ts`. Contrat `../Backend/docs/ledger-contract.md` en version 2 seulement (lecteur
  `src/contracts/ledger.ts`) : index `ledger/ledger-index.json` et fichiers `ledger/ledger-<accountId>-<année>.json`,
  chargés par `useLedgerMovements` (`src/composables/ledger/`) pour les seules années choisies, relus quand leur
  `updatedAt` change dans l'index. Pièces partagées avec Spending : `AccountSection`, `MovementRow`, `MovementFilters`
  (`src/components/spending/`), `useMovementFilters` (filtre propre au Ledger : date d'import, en extension).
  - Soldes calculés par le backend (`balanceSource` : `statement`, `carried`, `none`) ; italique sans relevé ou hors fin
    de journée. Les reports (type 998, `carried`) restent toujours affichés ; leur montant est un solde, pas un flux.
  - Filtre Owner, Currency, Import ou montant actif : l'en-tête montre le total des mouvements affichés (cadre pointillé)
    et la colonne Balance leur cumul depuis 0, reports exclus ; Period et dates ne changent pas les soldes.
  - Événements : `PWA-IMP_…_A<id>.json` (`IMPORT_DELETED`, effacement du dernier import, bouton visible quand le filtre
    Import désigne ce dernier import ; `useImportDeleteRequest`) et `PWA-LDG_…_A<id>.json` (`LEDGER_REFRESH_REQUESTED`,
    bouton Refresh de chaque compte, « Allocations changed — Refresh » quand l'index porte `allocationsChangedAt` ;
    `useLedgerRefreshRequest`). Le ledger n'est plus republié après les allocations : seul l'index les signale.
  - Mouvement à allouer : ouvre Allocation avec `?from=ledger` (retour au Ledger).

## Points ouverts connus

- Échéance d'une facture (à faire plus tard) : la QR-facture n'a pas de champ d'échéance, seulement parfois des
  conditions de paiement (balise `/40/` de `//S1/`, « net à N jours »), conservées brutes par le Mac dans
  `archiveqrbill.BillInfo`. Évolution possible du contrat `archive-qrbill-contract.md` : mesurer leur fréquence,
  puis publier un champ facultatif `dueDate` dans `qrBill`, que la fiche prendrait comme date de paiement avant la
  règle actuelle (15 ou fin du mois, vendredi si week-end, `computeNextDTADate`).
- Frais transactionnels du Portfolio (à faire plus tard) : `totals.feesChf` ne cumule que les transactions `FEE`
  (« Other fees » dans l'en-tête), les frais d'achat et de vente étant dans le prix de revient. Évolution possible du
  contrat `portfolio-contract.md` : un total en CHF de ces frais publié par le Mac (aucun calcul dans la PWA).
- Écart au budget dans Follow-up (à faire plus tard, comme iHomeTools) : par sous-catégorie, delta budget − consommé
  (réel + non confirmé), affiché « N left » ou « N over » ; vert sous (100 − p) % du budget, orange de (100 − p) % à
  100 %, rouge au-delà ; aucune couleur sans budget. `p` = `followUp.warningPercent` d'`AppParameters.json` (10 par
  défaut ou si invalide). Seule soustraction admise : le delta d'une ligne, jamais de total.
- Changer `PROXY_API_KEY` (`proxy.env`) une fois tous les appareils passés à la version avec coffre : l'ancienne clé
  figure dans les bundles déjà publiés sur `gh-pages`.

## Règles de travail

- Fichiers complets et propres, prêts pour la production : aucun reliquat de POC, code de test ou code commenté transitoire.
- Travail par petites étapes : une modification, vérification (build + type-check), puis on continue.
- Michel décide de l'architecture : proposer les options et attendre son accord avant tout changement structurel.
- Respecter la langue et le style des commentaires existants.
- Ne jamais lire ni afficher de fichier `.env*` ou contenant des secrets.
