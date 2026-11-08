import { environment } from "./environmentState";

/* =========================
   Stockage du navigateur par environnement

   Contrat multi-environnements, §10 : toute clé
   localStorage, sessionStorage et IndexedDB est préfixée
   ht:<envId>:. Les modules de l'app ne donnent que le nom
   court (« theme », « filters.budget.year »…).

   Avant que l'environnement soit connu, une lecture rend
   null et une écriture est ignorée. Stockage indisponible
   (navigation privée…) : même comportement.
========================= */

type StorageArea =
  | "local"
  | "session";

export function envStorageKey(
  name: string
): string | null {
  const env =
    environment.value?.env;

  return env
    ? `ht:${env}:${name}`
    : null;
}

function storageOf(
  area: StorageArea
): Storage {
  return area === "local"
    ? window.localStorage
    : window.sessionStorage;
}

function readItem(
  area: StorageArea,
  name: string
): string | null {
  const key =
    envStorageKey(name);

  if (!key) {
    return null;
  }

  try {
    return storageOf(area).getItem(key);
  } catch {
    return null;
  }
}

function writeItem(
  area: StorageArea,
  name: string,
  value: string
) {
  const key =
    envStorageKey(name);

  if (!key) {
    return;
  }

  try {
    storageOf(area).setItem(key, value);
  } catch {
    /* stockage indisponible */
  }
}

function removeItem(
  area: StorageArea,
  name: string
) {
  const key =
    envStorageKey(name);

  if (!key) {
    return;
  }

  try {
    storageOf(area).removeItem(key);
  } catch {
    /* stockage indisponible */
  }
}

export function getLocalItem(name: string) {
  return readItem("local", name);
}

export function setLocalItem(name: string, value: string) {
  writeItem("local", name, value);
}

export function removeLocalItem(name: string) {
  removeItem("local", name);
}

export function getSessionItem(name: string) {
  return readItem("session", name);
}

export function setSessionItem(name: string, value: string) {
  writeItem("session", name, value);
}

export function removeSessionItem(name: string) {
  removeItem("session", name);
}

/* =========================
   Migration des clés d'avant le contrat

   Unique et sans drapeau : chaque ancienne clé encore
   présente est déplacée sous ht:hometools: (§10), sauf si
   la nouvelle existe déjà, puis effacée. Le handle du
   dossier local (IndexedDB) est migré par localDirectory.ts.
========================= */

export const LEGACY_ENV =
  "hometools";

const LEGACY_LOCAL_KEYS: Record<string, string> = {
  "hometools-storage-backend": "storage-backend",
  "theme": "theme",
  "card24PendingEvent": "card24PendingEvent",
};

const LEGACY_SESSION_KEYS: Record<string, string> = {
  "spendingFilters": "spendingFilters",
};

const LEGACY_FILTERS_PREFIX =
  "hometools.filters.";

function moveLegacyKey(
  storage: Storage,
  from: string,
  name: string
) {
  const value =
    storage.getItem(from);

  if (value === null) {
    return;
  }

  const to =
    `ht:${LEGACY_ENV}:${name}`;

  if (storage.getItem(to) === null) {
    storage.setItem(to, value);
  }

  storage.removeItem(from);
}

export function migrateLegacyBrowserStorage() {
  try {
    const local =
      window.localStorage;

    for (const [from, name] of Object.entries(LEGACY_LOCAL_KEYS)) {
      moveLegacyKey(local, from, name);
    }

    const session =
      window.sessionStorage;

    for (const [from, name] of Object.entries(LEGACY_SESSION_KEYS)) {
      moveLegacyKey(session, from, name);
    }

    const filterKeys =
      Object.keys(session).filter(
        key => key.startsWith(LEGACY_FILTERS_PREFIX)
      );

    for (const from of filterKeys) {
      moveLegacyKey(
        session,
        from,
        "filters." + from.slice(LEGACY_FILTERS_PREFIX.length)
      );
    }

  } catch {
    /* stockage indisponible : rien à migrer */
  }
}
