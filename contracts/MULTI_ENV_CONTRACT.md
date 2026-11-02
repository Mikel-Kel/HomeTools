# Contrat multi-environnements HomeTools

**Version : 1.1.0** — 2026-11-02
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
- **I4 — Pas de valeur en dur.** Aucun chemin, bucket, schéma ou identifiant de dossier n'est codé en dur dans le code. Tout provient du profil. Seule exception : l'emplacement du fichier `environments.json` lui-même (§3.1).
- **I5 — Secrets hors configuration.** Aucun secret dans `environments.json` ni dans un repo (§7).
- **I6 — Capacités appliquées côté serveur.** Une capacité absente vaut `false`. Le proxy et les scripts appliquent les capacités ; l'interface ne fait que les refléter.
- **I7 — Environnement explicite côté scripts.** Tout script backend reçoit l'environnement en argument. Absence ou valeur inconnue : erreur immédiate, jamais de défaut.
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
      "s3": { "dataBucket": "<bucket>", "archivesBucket": "<bucket>", "prefix": "" },
      "events": { "driveFolderId": "<id dossier Drive>" },
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
| `mysql` | Un schéma et un utilisateur dédiés par environnement (§8). `hometools` : schéma `Home`. |
| `s3.prefix` | Préfixe ajouté à toutes les clés. Vide si l'environnement possède ses buckets. |
| `events` | Emplacement des événements PWA ↔ Mac propres à l'environnement. Champs susceptibles d'être complétés après inventaire du code existant (évolution MINOR). |
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
8. Exceptions : `GET /health` (sonde technique, réponse `{ "ok": true }` sans aucune autre donnée) et les requêtes `OPTIONS` (preflights CORS du navigateur, sans données) ne sont soumis ni à la résolution d'identité ni à `X-Proxy-Key`.

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
- **S3** : le client fournit un magasin logique (`data` ou `archives`) et une clé relative. Il ne fournit jamais de nom de bucket. Le proxy calcule `bucket = s3.<store>Bucket` et `key = s3.prefix + cléRelative`. Les listings renvoient des clés relatives, préfixe retiré. Les clés contenant `..`, commençant par `/` ou contenant des caractères de contrôle sont rejetées (`400 INVALID_KEY`).
  - Le magasin est transmis par le paramètre `store` : en query, ou dans le corps JSON pour `PUT /api/s3/write`. Une valeur autre que `data` ou `archives` est rejetée (`400 MISSING_PARAM`).
  - **Transition** : jusqu'à la fin de la phase P3, un `store` absent vaut `data`. Le rendre obligatoire ensuite sera une évolution MAJOR.
- **Local** : `/api/local/read` exige la capacité `localArchive` et reste confiné à `localArchive.root`. `/api/local/open` exige `localArchive` **et** `isServer`.
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
- **Scripts AppleScript** : Trousseau macOS, service `hometools-<usage>-<envId>` (ex. `hometools-mysql-fantoine`), lu via `security find-generic-password -s <service> -w`.
- Aucun secret dans les logs, les diagnostics, les réponses HTTP ou le stockage navigateur en clair.

---

## 8. MySQL

- Un schéma par environnement : `hometools` → `Home` (existant) ; `fantoine` → `Fantoine` (créé à partir de la structure de `Home`, sans données).
- Un utilisateur MySQL par environnement, avec des droits limités à **son** schéma.
- Aucune requête n'utilise de nom de schéma en dur : le schéma vient de `mysql.schema`.

---

## 9. Scripts backend (AppleScript)

### 9.1 Interface d'appel

- Tout script exécutable reçoit `envId` comme premier argument (`on run argv`).
- Argument absent ou inconnu, ou environnement désactivé : `logLine("ERR ", ...)` puis arrêt.

### 9.2 Bibliothèque partagée `HomeToolsEnv`

Script bibliothèque unique, chargé par `load script`. Handlers minimaux :

| Handler | Rôle |
|---|---|
| `loadEnv(envId)` | Lit et valide `environments.json`, renvoie le profil sous forme de record. |
| `envPath(envId, key)` | Chemin absolu dérivé de `baseDir` (`logs`, `diagnostics`, `appParameters`, …). |
| `hasCapability(envId, name)` | Booléen ; `false` si la capacité est absente. |
| `envSecret(envId, usage)` | Lecture Trousseau (§7). |

### 9.3 Fichiers par environnement

- Logs : `<baseDir>/logs/YYYY-MM-DD Housekeeping.log`. Le préfixe de chaque ligne inclut l'environnement : `[<envId>] <JOB_NAME>`.
- Diagnostics : `<baseDir>/diagnostics/homeMessages.json`. Mêmes règles qu'aujourd'hui (écriture atomique `jq` + `mktemp`/`mv`, ordre du plus récent au plus ancien).
- Événements et statuts : emplacements définis par `events` (§3.3).

### 9.4 Orchestration

- Housekeeping itère sur les environnements `enabled` et, pour chacun, n'exécute que les jobs listés dans `jobs`.
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
