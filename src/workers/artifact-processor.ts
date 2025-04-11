/**
 * Web Worker for processing artifacts without blocking the main thread.
 * Handles downloading, unzipping, and storing in IndexedDB.
 */

import { getUsableArtifacts } from "../artifact-data";
import { saveArtifact } from "../db/save-artifact";

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
      console.log("Worker: Starting artifact processing for runId", e.data.runId);
      // Patch: Pass runId directly to downloadAndStoreArtifacts
      const { downloadAndStoreArtifacts } = await import("../download-artifacts");
      const artifactArray = await downloadAndStoreArtifacts(
        (phase, percent, detail) => {
          console.log(`Worker: Progress - ${phase}: ${percent}%${detail ? ` - ${detail}` : ""}`);
          // Report progress back to main thread
          const progress: ProgressMessage = {
            type: "progress",
            phase,
            percent,
            detail
          };
          self.postMessage(progress);
        },
        (error) => {
          console.error("Worker: Error during processing:", error);
          // Report errors back to main thread
          const errorMsg: ErrorMessage = {
            type: "error",
            message: error.message
          };
          self.postMessage(errorMsg);
        },
        e.data.runId // Pass runId directly
      );

      // Convert array to object keyed by artifact name
      const artifacts = Object.fromEntries(
        artifactArray.map(a => [a.name, a.data])
      );

      console.log("Worker: Raw artifacts loaded", {
        keys: Object.keys(artifacts),
        sampleData: Object.entries(artifacts).map(([key, data]) => ({
          key,
          isArray: Array.isArray(data),
          length: Array.isArray(data) ? data.length : null,
          firstItem: Array.isArray(data) && data.length > 0 ?
            Object.keys(data[0]).filter(k => k !== 'comments') : null
        }))
      });

      type TransformedData = {
        [org: string]: {
          [repo: string]: {
            [issue: string]: Record<string, any>;
          };
        };
      };

      // Use shared mapToObject utility from artifact-data.ts
      const { mapToObject } = await import("../artifact-data");

      // Convert all artifact data to plain JS objects
      const plainArtifacts = Object.fromEntries(
        Object.entries(artifacts).map(([name, data]) => [name, mapToObject(data)])
      );

      // Transform data into org/repo/issue structure
      console.log("Worker: Beginning data transformation...");
      // Always use runId as the org key for storage and return
      const runId = e.data.runId;
      let transformed: TransformedData = { [runId]: {} };
      let firstArtifactLogged = false;
      for (const [key, data] of Object.entries(plainArtifacts)) {
        // Example key: results-ubiquity-os-marketplace or small-test-fixture
        const [_, __, ...repoParts] = key.split('-');
        const repo = repoParts.join('-') || key; // fallback to key if no repoParts

        if (!transformed[runId][repo]) transformed[runId][repo] = {};

        // Log the full data for the first artifact
        if (!firstArtifactLogged) {
          if (Array.isArray(data) && data.length > 0) {
            console.log(`Worker: FULL artifact[${key}] =`, data.slice(0, 3));
          } else {
            console.log(`Worker: FULL artifact[${key}] (raw JSON) =`, JSON.stringify(data, null, 2));
          }
          firstArtifactLogged = true;
        }

        // Ensure data is an array before processing
        if (Array.isArray(data)) {
          console.log(`Worker: Processing ${data.length} items for ${runId}/${repo} (type: ${typeof data[0]})`);
          if (data.length === 0) {
            console.log(`Worker: Artifact[${key}] is an empty array`);
          }
          data.forEach((issue, index) => {
            if (issue && typeof issue === 'object') {
              // Convert contributor-level maps to objects
              const contributors = mapToObject(issue);
              // Only include keys where value is an object with userId (i.e., contributor analytics)
              const filteredContributors: Record<string, any> = {};
              for (const [contrib, analytics] of Object.entries(contributors)) {
                if (analytics && typeof analytics === "object" && "userId" in analytics) {
                  filteredContributors[contrib] = analytics;
                }
              }
              transformed[runId][repo][index.toString()] = filteredContributors;
            }
          });
        } else {
          console.log(`Worker: Artifact[${key}] is not an array, type: ${typeof data}`);
          // Log the raw JSON for debugging
          console.log(`Worker: Artifact[${key}] (raw JSON) =`, JSON.stringify(data, null, 2));
        }
      }

      // Store transformed data in IndexedDB
      console.log("Worker: Storing transformed data in IndexedDB...");
      console.log("Worker: Transformed structure:", {
        orgs: Object.keys(transformed),
        reposByOrg: Object.fromEntries(
          Object.entries(transformed).map(([org, repos]) => [
            org,
            Object.keys(repos)
          ])
        ),
        totalIssues: Object.values(transformed).reduce((acc, repos) =>
          acc + Object.values(repos).reduce((racc, issues) =>
            racc + Object.keys(issues).length, 0
          ), 0
        )
      });
      // Only save under the runId key
      await saveArtifact(runId, new Blob([JSON.stringify(transformed[runId])]));
      console.log("Worker: All transformed data saved to IndexedDB");

      console.log("Worker: Processing complete, sending transformed data");
      const complete: CompleteMessage = {
        type: "complete",
        data: transformed
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
