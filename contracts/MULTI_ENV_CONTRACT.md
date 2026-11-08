# Contrat multi-environnements HomeTools

**Version : 1.3.1** — 2026-11-08
**Statut : en vigueur**

Ce document est la référence unique pour tout le refactoring multi-environnements (proxy, scripts AppleScript, PWA/WebApp). En cas de divergence entre le code et ce contrat, c'est le contrat qui fait foi : on corrige le code, ou on fait évoluer le contrat d'abord (voir §0).

---

## 0. Gouvernance et versionnement

- **Copie canonique** : repo `hometools-proxy`, fichier `contracts/MULTI_ENV_CONTRACT.md`.
- **Fichiers compagnons** : `environments.schema.json` et `environments.example.json`, toujours à côté du contrat.
- **Copies** : identiques, dans `contracts/` du repo frontend (PWA) et dans `docs/` du repo backend (AppleScript). L'en-tête de version doit être le même partout. Le repo PWA étant public, ni ce contrat ni ses fichiers compagnons ne contiennent d'IP, d'identifiants ou de secrets réels.
- **Règle d'or** : on modifie le contrat **avant** le code, dans un commit dédié qui met à jour le §12 (journal).
- **Versionnement sémantique** :
  - **PATCH** : clarification rédactionnelle, sans effet sur le code.
  - **MINOR** : ajout rétrocompatible (nouveau champ optionnel, nouvel endpoint, nouvelle capacité avec défaut `false`, nouveau code d'erreur).
  - **MAJOR** : suppression, renommage ou changement de sens d'un élément existant. Pendant une transition MAJOR, le proxy accepte N et N-1 ; la PWA refuse de démarrer si le MAJOR du proxy diffère du sien (§5.4).

---

## 1. Vocabulaire

| Terme | Définition |
|---|---|
| **Environnement** (`envId`) | Univers de production isolé : données, BdD, buckets, dossiers, événements, diagnostics. Format : `^[a-z][a-z0-9-]{1,31}$`. Valeurs v1 : `hometools`, `fantoine`. |
| **Appareil** | Machine membre du tailnet, identifiée par son IP Tailscale (`100.x.y.z`). Un appareil appartient à exactement un environnement. |
| **Serveur** | L'appareil qui héberge proxy, BdD et scripts (airmike). |
| **Profil** | Description d'un environnement dans `environments.json` (§3). |
| **Capacité** | Droit fonctionnel booléen attaché à un environnement (§3.4). |

---

## 2. Invariants (non négociables)

- **I1 — Résolution unique.** L'environnement d'une requête est déterminé **uniquement par le proxy**, à partir de l'IP Tailscale de l'appareil (§4). Aucun client ne peut choisir ni forcer un environnement : aucun paramètre, en-tête ou champ `env` envoyé par un client n'est jamais pris en compte.
- **I2 — Pas de défaut.** Un appareil inconnu, une requête sans provenance Tailscale ou un environnement désactivé reçoivent un refus (403). Il n'existe aucun environnement « par défaut ».
- **I3 — Isolation totale.** Aucune ressource d'un environnement n'est lisible ou modifiable depuis un autre : buckets S3, schéma MySQL, dossiers locaux, événements, diagnostics, coffre de secrets PWA, stockage navigateur.
- **I4 — Pas de valeur en dur.** Aucun chemin, bucket, schéma ou identifiant de dossier n'est codé en dur dans le code. Tout provient du profil. Exceptions : l'emplacement du fichier `environments.json` lui-même (§3.1) et l'emplacement du code, commun à tous les environnements (dossier des scripts compilés et de leurs bibliothèques).
- **I5 — Secrets hors configuration.** Aucun secret dans `environments.json` ni dans un repo (§7).
- **I6 — Capacités appliquées côté serveur.** Une capacité absente vaut `false`. Le proxy et les scripts appliquent les capacités ; l'interface ne fait que les refléter.
- **I7 — Environnement explicite côté scripts.** Tout script backend reçoit l'environnement en argument : `envId`, ou la configuration d'exécution qui le porte (§9.1). Absence ou valeur inconnue : erreur immédiate, jamais de défaut.
- **I8 — Non-régression.** Tant que l'environnement `fantoine` n'est pas activé (phase P4, §11), le comportement de `hometools` doit rester strictement identique à l'existant.

---

## 3. Configuration : `environments.json`

### 3.1 Emplacement

- Chemin unique, absolu, hors de tout repo et hors de tout dossier synchronisé (Google Drive) :
  `/Users/Michel/.config/hometools/environments.json`
- Lu par le proxy (qui tourne en root : chemins absolus obligatoires) et par les scripts AppleScript.
- Validé contre `environments.schema.json` au chargement. Proxy : refuse de démarrer si le fichier est invalide. Scripts : abandon avec `ERR`.
- Le proxy recharge le fichier quand sa date de modification change ; aucun redémarrage n'est nécessaire pour ajouter un appareil.

### 3.2 Structure

```json
{
  "contractVersion": "1.0.0",
  "identities": {
    "<IP Tailscale>": { "env": "<envId>", "device": "<nom lisible>", "kind": "mac|ios", "isServer": false }
  },
  "environments": {
    "<envId>": {
      "label": "<nom affiché>",
      "enabled": true,
      "baseDir": "<chemin absolu>",
      "appParameters": "AppParameters.json",
      "mysql": { "schema": "<schéma>", "user": "<utilisateur>" },
      "s3": { "dataBucket": "<bucket>", "archivesBucket": "<bucket>", "prefix": "",
              "endpoint": "<URL https>", "awsProfile": "<profil AWS CLI>" },
      "events": {},
      "localArchive": { "root": "<chemin absolu>" },
      "capabilities": { "localArchive": false, "card24": false },
      "jobs": ["<nom de job>"]
    }
  }
}
```

### 3.3 Règles par champ

| Champ | Règle |
|---|---|
| `identities` | Clé = IP Tailscale IPv4. `env` doit exister dans `environments`. Exactement **un** appareil a `isServer: true`. |
| `enabled` | `false` : l'environnement est refusé partout (proxy et scripts), sans suppression de données. |
| `baseDir` | Racine des fichiers de l'environnement : `logs/`, `diagnostics/`, `AppParameters.json`, etc. Pour `hometools` : valeur actuelle, inchangée. |
| `appParameters` | Relatif à `baseDir`. Contenu métier inchangé par ce contrat. |
| `mysql` | Un schéma et un utilisateur dédiés par environnement (§8). `hometools` : schéma `Home`. Pas d'hôte dans le profil : la base est sur le serveur (`localhost`). |
| `s3.prefix` | Préfixe ajouté à toutes les clés. Vide si l'environnement possède ses buckets. |
| `s3.endpoint`, `s3.awsProfile` | Endpoint S3 (URL `https`) et profil AWS CLI utilisés par les scripts (§7). Facultatifs pour le schéma ; un script qui accède à S3 s'arrête en `ERR` s'ils manquent. Le proxy ne les lit pas : il a ses propres réglages (§7). |
| `events` | Objet vide : les emplacements des événements se déduisent du profil, `<baseDir>/events/` sur le Mac et `events/` dans le magasin `data` (`s3.dataBucket`, préfixe `s3.prefix`). `driveFolderId` est obsolète et ignoré ; sa suppression du schéma sera une évolution MAJOR. |
| `localArchive` | Requis si et seulement si `capabilities.localArchive` vaut `true`. |
| `jobs` | Liste des jobs Housekeeping exécutés pour cet environnement (§9.4). |

### 3.4 Capacités v1

| Capacité | Effet |
|---|---|
| `localArchive` | Autorise `/api/local/read` sur `localArchive.root`. `/api/local/open` exige en plus que l'appareil appelant soit le serveur (`isServer: true`). |
| `card24` | Autorise le job Card24 et les vues de suivi associées. |

---

## 4. Résolution d'identité (proxy)

1. gunicorn écoute **uniquement** sur `127.0.0.1`. Toute requête arrive donc via `tailscale serve`.
2. Une requête sans en-tête `X-Forwarded-For` est refusée : `403 ENV_NO_PROVENANCE`.
3. L'IP retenue est la **première** valeur de `X-Forwarded-For`.
4. IP absente de `identities` : `403 ENV_UNKNOWN_DEVICE`.
5. Environnement `enabled: false` : `403 ENV_DISABLED`.
6. Chaque requête est journalisée avec `env`, `device`, méthode, chemin et statut. Aucune donnée métier ni secret n'est journalisé.
7. L'en-tête `X-Proxy-Key` reste exigé en défense complémentaire. Il n'identifie **pas** l'environnement.
8. Exceptions : `GET /health` (sonde technique, réponse `{ "ok": true }` sans aucune autre donnée) et les requêtes `OPTIONS` (preflights CORS du navigateur, sans données) ne sont soumis ni à la résolution d'identité ni à `X-Proxy-Key`. `GET /health` est aussi la sonde de l'outillage local (app myTooling, section « HomeTools › Proxy »), interrogé en direct et via `tailscale serve` : sa route, l'absence d'authentification et sa réponse `200 { "ok": true }` ne changent pas sans mettre myTooling à jour.

---

## 5. Contrat HTTP

### 5.1 En-têtes de réponse (toutes les réponses)

- `X-HomeTools-Contract: <version du contrat implémentée>`
- `X-HomeTools-Env: <envId>` (absent sur les erreurs 403 d'identité, sur les erreurs `503 CONFIG_INVALID` et sur les exceptions du §4.8)

### 5.2 `GET /api/whoami`

Premier appel de la PWA, avant toute autre requête.

```json
{
  "contractVersion": "1.0.0",
  "env": "hometools",
  "label": "HomeTools",
  "device": "iPad Michel",
  "kind": "ios",
  "isServer": false,
  "capabilities": { "localArchive": true, "card24": true }
}
```

- `capabilities` contient **toutes** les capacités connues du contrat, avec leur valeur explicite.
- Ne renvoie jamais de chemins, buckets, schémas ou autres identifiants internes.

### 5.3 Endpoints existants

- Les chemins et formats actuels sont conservés. Leur sémantique devient « relative à l'environnement de l'appelant ».
- **S3** : le client fournit un magasin logique (`data` ou `archives`) et une clé relative. Il ne fournit jamais de nom de bucket. Le proxy calcule `bucket = s3.<store>Bucket` et `key = s3.prefix + cléRelative`. Les listings renvoient des clés relatives, préfixe retiré. Les clés dont un élément de chemin vaut `..` (ex. `../a`, `a/../b`), commençant par `/` ou contenant des caractères de contrôle sont rejetées (`400 INVALID_KEY`). Des points à l'intérieur d'un nom (ex. `see ....pdf`) sont acceptés.
  - Le magasin est transmis par le paramètre `store` : en query, ou dans le corps JSON pour `PUT /api/s3/write`. Une valeur autre que `data` ou `archives` est rejetée (`400 MISSING_PARAM`).
  - **Transition** : jusqu'à la fin de la phase P3, un `store` absent vaut `data`. Le rendre obligatoire ensuite sera une évolution MAJOR.
  - **Lecture** : `GET /api/s3/read` renvoie les octets bruts de l'objet, sans décodage, avec le `Content-Type` enregistré sur l'objet (`application/octet-stream` s'il est absent). Les deux magasins sont concernés : un objet texte est lu par le client avec son propre décodage (UTF-8), un PDF d'archives en binaire.
  - **Normalisation Unicode** : pour `GET /api/s3/read` et `GET /api/s3/head`, le proxy essaie la clé telle quelle, puis ses formes NFC et NFD. Il répond `404 NOT_FOUND` seulement si aucune n'existe. La clé renvoyée par `head` est celle qu'envoie le client. `write`, `delete` et `list` utilisent la clé exacte, sans essayer d'autre forme.
- **Local** : `/api/local/read` exige la capacité `localArchive` et reste confiné à `localArchive.root` ; ses clés suivent les mêmes règles que les clés S3 (`400 INVALID_KEY`). `/api/local/open` exige `localArchive` **et** `isServer`.
- **Diagnostics et statuts** : servis depuis les emplacements de l'environnement de l'appelant uniquement. Le proxy n'a pas d'endpoint dédié : la PWA les lit dans le magasin `data` (`diagnostics/`, `events/status/`), donc dans les buckets de l'environnement de l'appelant.

### 5.4 Erreurs

Format unique :

```json
{ "error": { "code": "CAPABILITY_DENIED", "message": "texte lisible" } }
```

| Code | HTTP | Cas |
|---|---|---|
| `ENV_NO_PROVENANCE` | 403 | Pas de `X-Forwarded-For` |
| `ENV_UNKNOWN_DEVICE` | 403 | IP non déclarée |
| `ENV_DISABLED` | 403 | Environnement désactivé |
| `CAPABILITY_DENIED` | 403 | Capacité absente ou appareil non serveur |
| `INVALID_KEY` | 400 | Clé S3 ou chemin invalide |
| `AUTH_INVALID` | 401 | `X-Proxy-Key` absente ou fausse |
| `CONFIG_INVALID` | 503 | `environments.json` invalide après rechargement |
| `NOT_FOUND` | 404 | Objet S3, fichier local ou route absents |
| `MISSING_PARAM` | 400 | Paramètre obligatoire absent ou valeur non reconnue (ex. `store`) |
| `STORAGE_ERROR` | 500 | Échec S3, disque ou ouverture native |

**Compatibilité** : la PWA compare le MAJOR de `contractVersion` (via `/api/whoami`) avec le sien. S'ils diffèrent, elle affiche un écran bloquant explicite et n'effectue aucune autre requête.

---

## 6. Stockage S3

- Les buckets existants `hometools-prod` et `archives-prod` restent ceux de `hometools`, sans préfixe et sans migration de données.
- Chaque nouvel environnement reçoit ses propres buckets (ex. `fantoine-prod`, `fantoine-archives`), sous réserve de disponibilité des noms chez Hetzner.

---

## 7. Secrets

- **Proxy** : fichier de secrets `proxy.env`, hors de tout repo. Les secrets propres à un environnement suivent la forme `NOM__<ENVID_MAJUSCULES>` (ex. `S3_SECRET__FANTOINE`) ; les secrets communs gardent leur nom actuel.
- **Scripts AppleScript** : Trousseau macOS, service `hometools-<usage>-<envId>` (ex. `hometools-mysql-fantoine`), lu via `security find-generic-password -s <service> -w`. Un identifiant associé au secret (ex. Card24) est porté par l'attribut compte de l'élément.
- **Accès S3 des scripts** : profil AWS CLI nommé par `s3.awsProfile`, dans `~/.aws/credentials` de l'utilisateur du serveur (hors de tout repo) ; pas de clé S3 dans le Trousseau.
- Aucun secret dans les logs, les diagnostics, les réponses HTTP ou le stockage navigateur en clair.

---

## 8. MySQL

- Un schéma par environnement : `hometools` → `Home` (existant) ; `fantoine` → `Fantoine` (créé à partir de la structure de `Home`, sans données).
- Utilisateur MySQL : déclaré par `mysql.user` du profil. Cible : un utilisateur dédié par environnement, avec des droits limités à **son** schéma, et son mot de passe dans le Trousseau (§7, `hometools-mysql-<envId>`). **Transition** : `root` (connexion locale, sans mot de passe) reste admis pour un environnement tant que son utilisateur dédié n'est pas créé. L'isolation de la base (I3) repose alors sur `mysql.schema` du profil et sur l'absence de schéma en dur (I4), et non sur les droits MySQL. Le passage à l'utilisateur dédié ne demande aucun changement de code : il suffit de changer `mysql.user` et de créer l'élément du Trousseau.
- Aucune requête n'utilise de nom de schéma en dur : le schéma vient de `mysql.schema`.

---

## 9. Scripts backend (AppleScript)

### 9.1 Interface d'appel

- **Script d'entrée** (lancé par un LaunchAgent, à la main ou par un outil extérieur) : `envId` en premier argument (`on run argv`).
- **Script enfant** (lancé par un autre script) : premier argument = configuration d'exécution JSON, construite une seule fois par le script d'entrée à partir du profil (via `HomeToolsEnv`). Elle contient un objet `env` dont `env.id` vaut l'`envId` ; toutes les valeurs d'environnement en proviennent.
- `envId` absent ou inconnu, environnement désactivé, ou configuration sans `env.id` : `logLine("ERR ", ...)` puis arrêt.

### 9.2 Bibliothèque partagée `HomeToolsEnv`

Script bibliothèque unique, chargé par `load script`. Handlers minimaux :

| Handler | Rôle |
|---|---|
| `loadEnv(envId)` | Lit et valide `environments.json`, renvoie le profil sous forme de record. |
| `envPath(envId, key)` | Chemin absolu dérivé de `baseDir` (`logs`, `diagnostics`, `appParameters`, …). |
| `hasCapability(envId, name)` | Booléen ; `false` si la capacité est absente. |
| `envSecret(envId, usage)` | Lecture Trousseau (§7). |
| `envSecretAccount(envId, usage)` | Attribut compte du même élément du Trousseau (§7). |

### 9.3 Fichiers par environnement

- Logs : `<baseDir>/logs/YYYY-MM-DD Housekeeping.log`. Format des lignes inchangé : l'environnement est donné par l'emplacement du fichier, sans préfixe dans les lignes.
- Diagnostics : `<baseDir>/diagnostics/homeMessages.json`. Mêmes règles qu'aujourd'hui (écriture atomique `jq` + `mktemp`/`mv`, ordre du plus récent au plus ancien).
- Événements et statuts : emplacements définis par `events` (§3.3).

### 9.4 Orchestration

- Housekeeping itère sur les environnements `enabled` et, pour chacun, n'exécute que les jobs listés dans `jobs`. Les interrupteurs de nuit d'`AppParameters.json` (`housekeeping.<job>`) filtrent à l'intérieur de cette liste : un job absent de `jobs` n'est jamais exécuté, un job présent peut être désactivé la nuit.
- Surveillances de dossiers (LaunchAgents à `WatchPaths`) : un LaunchAgent par environnement, qui passe son `envId` au script d'entrée.
- L'échec d'un environnement est journalisé et n'empêche pas le traitement des autres.

---

## 10. Frontend (PWA et WebApp)

- **Un seul protocole.** PWA et WebApp passent toutes deux par l'URL `ts.net` et le proxy, y compris la WebApp sur le serveur. Aucun accès direct à `localhost`.
- **Démarrage.** `/api/whoami` est appelé en premier. En cas d'erreur, un écran bloquant affiche le code et le message (§5.4).
- **Store d'environnement.** Il contient `env`, `label`, `device`, `kind`, `isServer` et `capabilities`. Le libellé de l'environnement est visible en permanence dans l'interface.
- **Aucune notion d'environnement dans les requêtes** (I1). Les URLs, clés et noms de fichiers restent relatifs.
- **Stockage navigateur.** Toutes les clés localStorage et IndexedDB sont préfixées `ht:<envId>:`. Migration unique des clés existantes vers `ht:hometools:` au premier démarrage sous contrat 1.x.
- **Coffre de secrets.** Un coffre par environnement (clé de stockage préfixée) ; chiffrement inchangé.
- **Fonctionnalités.** Vues et actions conditionnées par `capabilities` ; une capacité absente masque la fonctionnalité.

---

## 11. Phases de migration

| Phase | Contenu | Critère de sortie |
|---|---|---|
| **P0** | Contrat publié dans les 3 repos ; `environments.json` créé avec `hometools` seul | Fichier valide contre le schéma |
| **P1** | Proxy conforme (§4, §5, §6) | `hometools` strictement inchangé ; appareil inconnu refusé (403) |
| **P2** | Scripts conformes (§9) | Nuit Housekeeping identique à l'existant |
| **P3** | PWA/WebApp conformes (§10) | Mac et iPad de Michel identiques à l'existant ; libellé affiché |
| **P4** | Création de `fantoine` : buckets, schéma, utilisateur MySQL, dossiers, appareils déclarés | Isolation vérifiée dans les deux sens |

Chaque phase est testée et validée avant d'entamer la suivante.

---

## 12. Journal des versions

| Version | Date | Changement |
|---|---|---|
| 1.0.0 | 2026-10-30 | Version initiale |
| 1.0.1 | 2026-11-02 | §0 : emplacement des copies et fichiers compagnons ; §7 : nom du fichier de secrets du proxy |
| 1.0.2 | 2026-11-02 | §3.1 : `environments.json` déplacé hors de Google Drive. Rectificatif publié en PATCH : le chemin n'avait encore aucun utilisateur |
| 1.1.0 | 2026-11-02 | §4.8 : exceptions `/health` et `OPTIONS` ; §5.1 : cas sans `X-HomeTools-Env` ; §5.3 : paramètre `store` (absent = `data` jusqu'à la fin de P3), diagnostics et statuts lus dans le magasin `data` ; §5.4 : codes `NOT_FOUND`, `MISSING_PARAM`, `STORAGE_ERROR` |
| 1.1.1 | 2026-11-05 | §9.3 : pas de préfixe d'environnement dans les lignes de journal (le fichier est propre à l'environnement). Rectificatif publié en PATCH : l'exigence n'avait encore aucune implémentation |
| 1.2.0 | 2026-11-05 | I4 : exception pour l'emplacement du code ; I7 et §9.1 : `envId` pour les scripts d'entrée, configuration d'exécution portant `env.id` pour les scripts enfants ; §3.2 et §3.3 : `s3.endpoint` et `s3.awsProfile` (facultatifs), hôte MySQL `localhost`, `events` vide et `driveFolderId` obsolète ; §7 : identifiant dans l'attribut compte, accès S3 des scripts par profil AWS CLI ; §9.2 : `envSecretAccount` ; §9.4 : interrupteurs de nuit et un LaunchAgent par environnement |
| 1.2.1 | 2026-11-08 | §5.3 : `INVALID_KEY` ne vise que `..` comme élément de chemin (un nom d'archive existant contient `....`), et s'applique aussi aux clés de `/api/local/*`. Rectificatif publié en PATCH : seul le proxy applique cette règle, depuis la phase P1 en cours, et aucun client ne dépend du refus |
| 1.2.2 | 2026-11-08 | §4.8 : `GET /health` est aussi la sonde de myTooling (pilotage du proxy) ; sa forme est figée. Clarification publiée en PATCH : aucun changement de comportement |
| 1.3.0 | 2026-11-08 | §5.3 : `GET /api/s3/read` renvoie les octets bruts de l'objet avec son `Content-Type` (lecture des PDF d'archives par S3 hors du Mac) ; `read` et `head` essaient la clé telle quelle, puis en NFC et NFD. Évolution MINOR : le contenu des lectures qui réussissaient est inchangé, seul l'en-tête `Content-Type` change, et la PWA ne le lit pas |
| 1.3.1 | 2026-11-08 | §8 : `root` admis comme utilisateur MySQL d'un environnement pendant une transition ; l'utilisateur dédié reste la cible. Rectificatif publié en PATCH : aucun code ne change, les scripts acceptent déjà les deux (`passwordService` vide pour `root`) |
