/**
 * Manages artifact processing worker initialization and communication.
 */

import type { LeaderboardEntry, OrgRepoData, OrgRepoStructure, TimeSeriesEntry } from "../data-transform"; // Added OrgRepoStructure
import { getLeaderboardData, getTimeSeriesData } from "../data-transform";
import type { BreakdownResult } from "../analytics/contribution-breakdown";
import { calculateContributionBreakdown } from "../analytics/contribution-breakdown";
import type { QualityResult } from "../analytics/comment-quality";
import { calculateCommentQuality } from "../analytics/comment-quality";
import type { ReviewMetricsResult } from "../analytics/review-metrics"; // Import new type
import { calculateReviewMetrics } from "../analytics/review-metrics"; // Import new function
import { getArtifact } from "../db/get-artifact";
// Removed normalizeOrgRepoData import as it's no longer used here

type WorkerCallbacks = {
  onProgress: (phase: string, percent: number, detail: string) => void;
  onError: (error: Error) => void;
  // Add breakdown, quality, and review metrics to the completion payload
  onComplete: (data: { leaderboard: LeaderboardEntry[], timeSeries: TimeSeriesEntry[], breakdown: BreakdownResult, quality: QualityResult, reviews: ReviewMetricsResult, rawData?: OrgRepoData }) => void;
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
    // Try loading from cache first
    const cachedData = await loadFromIndexedDB(runId);

    if (cachedData) {
      const orgData = cachedData[runId]; // This is OrgRepoStructure
      // Removed call to normalizeOrgRepoData as it's a no-op and caused type errors
      callbacks.onComplete({
        leaderboard: getLeaderboardData(orgData), // Pass OrgRepoStructure directly
        timeSeries: getTimeSeriesData(orgData), // Pass OrgRepoStructure directly
        breakdown: calculateContributionBreakdown(orgData), // Calculate breakdown
        quality: calculateCommentQuality(orgData), // Calculate quality
        reviews: calculateReviewMetrics(orgData), // Calculate review metrics
        rawData: { [runId]: orgData } // Re-wrap for consistency if needed downstream, or adjust consumer
      });
      console.log("Cache hit! Using data from IndexedDB.");
      return; // <<<--- Return here if cache hit
    } else {
      console.log("Cache miss. Proceeding with worker fetch.");
      // Optionally, you could call onProgress here to indicate fetching starts
      // callbacks.onProgress("Fetching", 0, "Starting download...");
    }
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    return; // Return on error during cache check
  }

  // Only start worker if cache miss
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

        const orgData = msg.data[runId] as OrgRepoStructure; // Explicitly type as OrgRepoStructure
        // Removed call to normalizeOrgRepoData as it's a no-op and caused type errors

        try {
          // Save the original (non-normalized, as normalization is no-op) data
          const blob = new Blob([JSON.stringify(orgData)], { type: "application/json" });
          const { saveArtifact } = await import("../db/save-artifact");
          await saveArtifact(runId, blob);
        } catch (error) {
          console.error("Failed to update IndexedDB:", error);
        }

        callbacks.onComplete({
          leaderboard: getLeaderboardData(orgData), // Pass orgData directly
          timeSeries: getTimeSeriesData(orgData), // Pass orgData directly
          breakdown: calculateContributionBreakdown(orgData), // Calculate breakdown
          quality: calculateCommentQuality(orgData), // Calculate quality
          reviews: calculateReviewMetrics(orgData), // Calculate review metrics
          rawData: { [runId]: orgData } // Pass the re-wrapped raw data for consistency if needed downstream
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
