import { STORE_NAME } from "./db-constants";
import { getDb } from "./get-db";

export async function getArtifact(name: string): Promise<Blob | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(name);

    request.onsuccess = () => {
      const result = request.result;
      if (result instanceof Blob) {
        resolve(result);
      } else if (result === undefined) {
        resolve(null);
      } else {
        reject(new Error(`Invalid data type in IndexedDB: expected Blob, got ${typeof result}`));
      }
    };

    request.onerror = () => {
      reject(new Error(`Failed to get artifact "${name}": ${request.error?.message || 'Unknown error'}`));
    };

    tx.onerror = () => {
      reject(new Error(`Transaction failed for artifact "${name}": ${tx.error?.message || 'Unknown error'}`));
    };
  });
}
