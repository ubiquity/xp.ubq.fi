import { STORE_NAME } from "./db-constants";
import { getDb } from "./get-db";

export async function saveArtifact(name: string, blob: Blob): Promise<void> {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid artifact name');
  }

  if (!(blob instanceof Blob)) {
    throw new Error('Invalid data: expected Blob');
  }

  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(blob, name);

    request.onsuccess = () => {
      // Wait for transaction to complete
      tx.oncomplete = () => resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to save artifact "${name}": ${request.error?.message || 'Unknown error'}`));
    };

    tx.onerror = () => {
      reject(new Error(`Transaction failed while saving "${name}": ${tx.error?.message || 'Unknown error'}`));
    };
  });
}
