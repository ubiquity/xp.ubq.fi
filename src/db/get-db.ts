import { DB_NAME, DB_VERSION, STORE_NAME } from "./db-constants";

export function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this browser"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      // Verify the store exists
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        reject(new Error(`Required object store "${STORE_NAME}" is missing`));
        return;
      }

      resolve(db);
    };

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error?.message || 'Unknown error'}`));
    };

    request.onblocked = () => {
      reject(new Error('Database opening was blocked'));
    };
  });
}
