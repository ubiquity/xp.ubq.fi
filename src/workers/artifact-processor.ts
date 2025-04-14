/**
 * Web Worker for processing artifacts without blocking the main thread.
 * Handles downloading, unzipping, and storing in IndexedDB.
 */

import type { AggregatedResultEntry } from "../data-transform";
import { transformAggregatedToOrgRepoData } from "../data-transform";
import { saveArtifact } from "../db/save-artifact";
import { downloadAndProcessAggregatedArtifact } from "../download-artifacts";

function isValidAggregatedResult(data: unknown): data is AggregatedResultEntry[] {
  if (!Array.isArray(data)) return false;

  return data.every(entry =>
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as any).org === 'string' &&
    typeof (entry as any).repo === 'string' &&
    typeof (entry as any).issueId === 'string' &&
    typeof (entry as any).metadata === 'object' &&
    (entry as any).metadata !== null
  );
}

// Type definitions for messages
type WorkerMessage = {
  type: "process-artifacts";
  runId: string;
};

type WorkerResponse =
  | {
      type: "progress";
      phase: string;
      percent: number;
      detail: string;
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "complete";
      data: Record<string, unknown>;
    };

// Handle incoming messages
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type === "process-artifacts") {
    try {
      const runId = e.data.runId;
      console.log("Worker: Starting artifact processing for runId", runId);

      // Call the new function to download and parse the single aggregated artifact
      const parsedJson = await downloadAndProcessAggregatedArtifact(
        (phase, percent, detail) => self.postMessage({ type: "progress", phase, percent, detail }),
        (error) => self.postMessage({ type: "error", message: error.message }),
        runId
      );

      if (!isValidAggregatedResult(parsedJson)) {
        throw new Error("Invalid data structure from artifact");
      }

      const transformedData = transformAggregatedToOrgRepoData(parsedJson, runId);

      if (!transformedData[runId]) {
        throw new Error("Failed to transform data: no data for runId");
      }

      await saveArtifact(runId, new Blob([JSON.stringify(transformedData[runId])]));
      self.postMessage({ type: "complete", data: transformedData });

    } catch (error) {
      self.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error during processing"
      });
    }
  }
};
