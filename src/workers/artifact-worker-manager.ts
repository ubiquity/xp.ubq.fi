/**
 * Manages artifact processing worker initialization and communication.
 */

import type { LeaderboardEntry, TimeSeriesEntry } from "../data-transform";
import { getLeaderboardData, getTimeSeriesData } from "../data-transform";
import { groupArtifactsByOrgRepoIssue } from "../utils";
import { getArtifact } from "../db/get-artifact";

type WorkerCallbacks = {
  onProgress?: (phase: string, percent: number, detail?: string) => void;
  onError?: (error: Error) => void;
  onComplete?: (data: { leaderboard: LeaderboardEntry[], timeSeries: TimeSeriesEntry[] }) => void;
};

let worker: Worker | null = null;

/**
 * Initializes or returns the artifact processing worker
 */
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("../../dist/artifact-processor.js", import.meta.url),
      { type: "module" }
    );
  }
  return worker;
}

/**
 * Attempts to load artifact data from IndexedDB.
 * Returns undefined if no data is found.
 */
async function loadFromIndexedDB(runId: string): Promise<any | undefined> {
  try {
    console.log(`Attempting to load from IndexedDB for runId="${runId}"...`);
    const dbKey = runId;
    const orgData = await getArtifact(dbKey);
    console.log(`Data exists for key "${dbKey}":`, !!orgData);
    if (!orgData) return undefined;

    // Parse organization blob into JSON
    const text = await orgData.text();
    const orgRepos = JSON.parse(text) as Record<string, Record<string, unknown>>;

    // Create final data structure
    const data = {
      [dbKey]: orgRepos
    };

    console.log("Successfully loaded from IndexedDB:", {
      key: dbKey,
      repos: Object.keys(orgRepos),
      diagnostics: {
        repoKeys: Object.keys(orgRepos),
        sampleDataByRepo: Object.fromEntries(
          Object.entries(orgRepos).map(([repo, issues]) => [
            repo,
            {
              issueCount: Object.keys(issues).length,
              sampleIssue: Object.entries(issues)[0]?.[1] || null
            }
          ])
        )
      },
      rawData: data
    });
    return data;
  } catch (error) {
    console.warn("Failed to load from IndexedDB:", error);
    return undefined;
  }
}

/**
 * Loads artifact data, first trying IndexedDB then falling back to worker processing.
 */
export async function loadArtifactData(
  runId: string,
  callbacks: WorkerCallbacks = {}
): Promise<void> {
  // First try loading from IndexedDB and show immediately if present
  const cachedData = await loadFromIndexedDB(runId);
  if (cachedData) {
    console.log("Loaded data from IndexedDB");
    const orgData = cachedData[runId] ?? {};
    callbacks.onComplete?.({
      leaderboard: getLeaderboardData({ [runId]: orgData }),
      timeSeries: getTimeSeriesData({ [runId]: orgData })
    });
    // Do NOT return; continue to load fresh data in the background
  } else {
    // No cached data, clear the UI immediately
    callbacks.onComplete?.({
      leaderboard: [],
      timeSeries: []
    });
  }

  // Always start worker-based processing to get fresh data
  console.log("Starting worker-based processing...");
  const worker = getWorker();
  console.log("Worker initialized");

  worker.onmessage = async (e) => {
    const msg = e.data;
    switch (msg.type) {
      case "progress":
        callbacks.onProgress?.(msg.phase, msg.percent, msg.detail);
        break;
      case "error":
        callbacks.onError?.(new Error(msg.message));
        break;
      case "complete":
        console.log("Worker completed, transforming data...");
        console.log("Raw artifact data structure:", {
          orgs: Object.keys(msg.data as object),
          reposByOrg: Object.fromEntries(
            Object.entries(msg.data as Record<string, Record<string, unknown>>).map(([org, repos]) => [
              org,
              Object.keys(repos)
            ])
          )
        });
        console.log("Grouped data structure (skipped):", {
          orgs: Object.keys(msg.data as object),
          reposByOrg: Object.fromEntries(
            Object.entries(msg.data as Record<string, Record<string, unknown>>).map(([org, repos]) => [
              org,
              {
                repos: Object.keys(repos),
                totalIssues: Object.values(repos).reduce(
                  (acc: number, issues: unknown) =>
                    acc + Object.keys(issues as object).length,
                  0
                )
              }
            ])
          )
        });

        // Save fresh data to IndexedDB
        try {
          const dbKey = runId;
          const blob = new Blob([JSON.stringify(msg.data[dbKey] ?? {})], { type: "application/json" });
          const { saveArtifact } = await import("../db/save-artifact");
          await saveArtifact(dbKey, blob);
          console.log(`Updated IndexedDB with fresh data for key "${dbKey}".`);
        } catch (err) {
          console.warn("Failed to update IndexedDB with fresh data:", err);
        }

        // Update the view with fresh data
        const orgData = msg.data[runId] ?? {};
        callbacks.onComplete?.({
          leaderboard: getLeaderboardData({ [runId]: orgData }),
          timeSeries: getTimeSeriesData({ [runId]: orgData })
        });
        break;
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
