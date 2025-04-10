import { STORE_NAME } from "./db-constants";
import { getDb } from "./get-db";

export async function saveArtifact(name: string, blob: Blob): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(blob, name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
