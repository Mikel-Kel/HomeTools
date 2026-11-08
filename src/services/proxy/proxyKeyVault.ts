/* =========================
   Coffre de la clé du proxy

   La clé X-Proxy-Key n'est pas dans le bundle (repo public) :
   saisie une fois par appareil, elle est chiffrée en
   AES-GCM par une clé générée par le navigateur, non
   exportable, rangée avec elle en IndexedDB sous
   ht:<envId>:proxy-key (contrat multi-environnements, §7
   et §10). Rien n'est en clair dans le stockage du
   navigateur ; la clé déchiffrée ne vit qu'en mémoire
   (proxyClient.ts).

   Base dédiée, indépendante de celle du dossier local.
========================= */

const DB_NAME = "hometools-vault";
const STORE_NAME = "secrets";
const RECORD_NAME = "proxy-key";

interface VaultRecord {
  key: CryptoKey;
  iv: Uint8Array;
  data: ArrayBuffer;
  savedAt: number;
}

export interface StoredProxyKey {
  env: string;
  value: string;
}

function recordKey(
  env: string
): string {
  return `ht:${env}:${RECORD_NAME}`;
}

function envOfRecordKey(
  key: IDBValidKey
): string | null {
  const match =
    typeof key === "string"
      ? /^ht:(.+):proxy-key$/.exec(key)
      : null;

  return match
    ? match[1]
    : null;
}

function openDB(): Promise<IDBDatabase> {

  return new Promise((resolve, reject) => {

    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);

  });

}

function requestToPromise<T>(
  req: IDBRequest<T>
): Promise<T> {

  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

}

/*
  Clé du coffre le plus récent de l'appareil. L'environnement
  n'est pas encore connu à ce stade (/api/whoami exige la
  clé) : environmentGuard.ts vérifie ensuite qu'il
  correspond. Coffre absent ou illisible : null.
*/
export async function loadProxyKey(): Promise<StoredProxyKey | null> {

  const db = await openDB();

  const store =
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);

  const [keys, records] =
    await Promise.all([
      requestToPromise(store.getAllKeys()),
      requestToPromise(store.getAll() as IDBRequest<VaultRecord[]>),
    ]);

  let env: string | null = null;
  let record: VaultRecord | null = null;

  for (let index = 0; index < keys.length; index++) {
    const candidateEnv =
      envOfRecordKey(keys[index]);

    const candidate =
      records[index];

    if (candidateEnv && (!record || candidate.savedAt > record.savedAt)) {
      env = candidateEnv;
      record = candidate;
    }
  }

  if (!env || !record) {
    return null;
  }

  try {
    const plain =
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: record.iv },
        record.key,
        record.data
      );

    return {
      env,
      value: new TextDecoder().decode(plain),
    };

  } catch {
    return null;
  }

}

/* Range la clé sous l'environnement, avec une clé de chiffrement neuve. */
export async function saveProxyKey(
  env: string,
  value: string
): Promise<void> {

  const key =
    await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

  const iv =
    crypto.getRandomValues(new Uint8Array(12));

  const data =
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(value)
    );

  const record: VaultRecord = {
    key,
    iv,
    data,
    savedAt: Date.now(),
  };

  const db = await openDB();

  const tx =
    db.transaction(STORE_NAME, "readwrite");

  tx.objectStore(STORE_NAME).put(record, recordKey(env));

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

}
