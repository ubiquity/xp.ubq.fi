/**
 * Web Worker for processing artifacts without blocking the main thread.
 * Handles downloading, unzipping, and storing in IndexedDB.
 */

import { saveArtifact } from "../db/save-artifact";
// Import the new download function and the new transformation function
import { transformAggregatedToOrgRepoData } from "../data-transform";
import { downloadAndProcessAggregatedArtifact } from "../download-artifacts";

// Type definitions for messages
type WorkerMessage = {
  type: "process-artifacts";
  runId: string;
};

type ProgressMessage = {
  type: "progress";
  phase: string;
  percent: number;
  detail?: string;
};

type ErrorMessage = {
  type: "error";
  message: string;
};

type CompleteMessage = {
  type: "complete";
  data: any;
};

// Handle incoming messages
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type === "process-artifacts") {
    try {
      const runId = e.data.runId;
      console.log("Worker: Starting artifact processing for runId", runId);

      // Call the new function to download and parse the single aggregated artifact
      const parsedJsonArray = await downloadAndProcessAggregatedArtifact(
        (phase, percent, detail) => {
          // Report progress back to main thread
          const progress: ProgressMessage = {
            type: "progress",
            phase,
            percent,
            detail,
          };
          self.postMessage(progress);
        },
        (error) => {
          // Report errors back to main thread
          const errorMsg: ErrorMessage = {
            type: "error",
            message: error.message,
          };
          self.postMessage(errorMsg);
        },
        runId // Pass runId directly
      );

      // Transform the parsed array into the nested OrgRepoData structure
      console.log("Worker: Transforming aggregated data...");
      const transformedData = transformAggregatedToOrgRepoData(parsedJsonArray, runId);

      // Store transformed data in IndexedDB
      console.log("Worker: Storing transformed data in IndexedDB...");
      // Only save the data under the runId key
      const dataToStore = transformedData[runId] ?? {};
      await saveArtifact(runId, new Blob([JSON.stringify(dataToStore)]));
      console.log("Worker: Transformed data saved to IndexedDB");

      console.log("Worker: Processing complete, sending transformed data");
      const complete: CompleteMessage = {
        type: "complete",
        data: transformedData, // Send the full transformed object back
      };
      self.postMessage(complete);

    } catch (error) {
      const errorMsg: ErrorMessage = {
        type: "error",
        message: error instanceof Error ? error.message : String(error)
      };
      self.postMessage(errorMsg);
    }
  }
};
