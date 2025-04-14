/**
 * Manages artifact processing worker initialization and communication.
 */

import type { LeaderboardEntry, OrgRepoData, TimeSeriesEntry } from "../data-transform";
import { getLeaderboardData, getTimeSeriesData } from "../data-transform";
import { getArtifact } from "../db/get-artifact";

type WorkerCallbacks = {
  onProgress: (phase: string, percent: number, detail: string) => void;
  onError: (error: Error) => void;
  onComplete: (data: { leaderboard: LeaderboardEntry[], timeSeries: TimeSeriesEntry[] }) => void;
};

const DEFAULT_CALLBACKS: WorkerCallbacks = {
  onProgress: () => {},
  onError: (error) => { throw error; },
  onComplete: () => {},
};

let worker: Worker | null = null;

/**
 * Initializes or returns the artifact processing worker
 */
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      "/artifact-processor.js",
      { type: "module" }
    );
  }
  return worker;
}

/**
 * Attempts to load artifact data from IndexedDB.
 * Returns undefined if no data is found.
 */
async function loadFromIndexedDB(runId: string): Promise<OrgRepoData | undefined> {
  console.log(`Attempting to load from IndexedDB for runId="${runId}"...`);

  const orgData = await getArtifact(runId);
  if (!orgData) return undefined;

  const text = await orgData.text();
  const orgRepos = JSON.parse(text);

  if (typeof orgRepos !== 'object' || orgRepos === null) {
    throw new Error("Invalid data format in IndexedDB");
  }

  const data = { [runId]: orgRepos } as OrgRepoData;
  console.log(`Loaded data for runId="${runId}" with ${Object.keys(orgRepos).length} repos`);

  return data;
}

/**
 * Loads artifact data, first trying IndexedDB then falling back to worker processing.
 */
export async function loadArtifactData(
  runId: string,
  partialCallbacks: Partial<WorkerCallbacks> = {}
): Promise<void> {
  const callbacks: WorkerCallbacks = { ...DEFAULT_CALLBACKS, ...partialCallbacks };
  try {
    const cachedData = await loadFromIndexedDB(runId);
    if (cachedData) {
      const orgData = cachedData[runId];
      callbacks.onComplete({
        leaderboard: getLeaderboardData({ [runId]: orgData }),
        timeSeries: getTimeSeriesData({ [runId]: orgData })
      });
    } else {
      callbacks.onComplete({
        leaderboard: [],
        timeSeries: []
      });
    }
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    return;
  }

  // Always start worker-based processing to get fresh data
  console.log("Starting worker-based processing...");
  const worker = getWorker();
  console.log("Worker initialized");

  worker.onmessage = async ({ data: msg }) => {
    switch (msg.type) {
      case "progress":
        callbacks.onProgress(msg.phase, msg.percent, msg.detail);
        break;

      case "error":
        callbacks.onError(new Error(msg.message));
        break;

      case "complete":
        if (typeof msg.data !== 'object' || !msg.data || !(runId in msg.data)) {
          throw new Error("Invalid data received from worker");
        }

        const orgData = msg.data[runId] as OrgRepoData[string];

        try {
          const blob = new Blob([JSON.stringify(orgData)], { type: "application/json" });
          const { saveArtifact } = await import("../db/save-artifact");
          await saveArtifact(runId, blob);
        } catch (error) {
          console.error("Failed to update IndexedDB:", error);
        }

        callbacks.onComplete({
          leaderboard: getLeaderboardData({ [runId]: orgData }),
          timeSeries: getTimeSeriesData({ [runId]: orgData })
        });
        break;

      default:
        throw new Error(`Unknown message type: ${(msg as { type: string }).type}`);
    }
  };

  worker.postMessage({ type: "process-artifacts", runId });
}

/**
 * Terminates the worker if it exists
 */
export function cleanupWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
