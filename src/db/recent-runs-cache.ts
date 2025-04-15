import { getDb } from "./get-db";

const RECENT_RUNS_KEY = "recentRuns";
const WORKFLOW_INPUTS_PREFIX = "workflowInputs:";

export async function getRecentRuns(): Promise<any[] | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("artifacts", "readonly");
    const store = tx.objectStore("artifacts");
    const req = store.get(RECENT_RUNS_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function setRecentRuns(runs: any[]): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("artifacts", "readwrite");
    const store = tx.objectStore("artifacts");
    const req = store.put(runs, RECENT_RUNS_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getWorkflowInputs(runId: string): Promise<any | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("artifacts", "readonly");
    const store = tx.objectStore("artifacts");
    const req = store.get(WORKFLOW_INPUTS_PREFIX + runId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function setWorkflowInputs(runId: string, inputs: any): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("artifacts", "readwrite");
    const store = tx.objectStore("artifacts");
    const req = store.put(inputs, WORKFLOW_INPUTS_PREFIX + runId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
