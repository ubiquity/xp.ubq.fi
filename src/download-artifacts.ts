import { saveArtifact } from "./db/save-artifact";
import { downloadArtifactZip } from "./download-artifact";
import { fetchArtifactsList } from "./fetch-artifacts-list";
import { getRunIdFromQuery } from "./utils";
import { unzipArtifact } from "./unzip-artifact";

// Define callback types for progress reporting and error handling
export type ProgressCallback = (
  phase: string,
  percent: number,
  detail?: string
) => void;

export type ErrorCallback = (error: Error) => void;

// Default callbacks that just log to console
const defaultProgress: ProgressCallback = (phase, percent, detail) => {
  console.log(`[PROGRESS] ${phase}: ${percent.toFixed(0)}% ${detail ? '- ' + detail : ''}`);
};

const defaultError: ErrorCallback = (error) => {
  console.error('[ERROR]', error);
};

/**
 * Downloads and loads a single artifact ZIP file from the test fixtures
 */
async function loadLocalArtifactZip(
  artifactName: string,
  onProgress: ProgressCallback
): Promise<any> {
  // Report start of download
  onProgress('Download', 0, artifactName);

  const url = `/api/download-artifact?id=${encodeURIComponent(artifactName)}&run=test`;
  console.log(`[DOWNLOAD] Fetching from URL: ${url}`);

  // Set headers to get raw ZIP data
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/zip'
    }
  });
  console.log(`[DOWNLOAD] Fetch response status: ${response.status}`);

  if (!response.ok) {
    throw new Error(`Failed to load artifact ${artifactName}: ${response.status}`);
  }

  // Get the ZIP data as ArrayBuffer and convert to Uint8Array
  const arrayBuffer = await response.arrayBuffer();
  const zipData = new Uint8Array(arrayBuffer);
  console.log(`[DOWNLOAD] Got ZIP data, size: ${zipData.length} bytes`);

  // Report download complete
  onProgress('Download', 100, artifactName);

  // Report start of unzipping
  onProgress('Unzipping', 0, artifactName);

  // Extract JSON files from the ZIP
  const files = await unzipArtifact(zipData);
  console.log(`[UNZIP] Successfully extracted ${files.length} files`);

  // Report unzipping complete
  onProgress('Unzipping', 100, artifactName);

  return files;
}

/**
 * Main function to download and store all artifacts
 */
export async function downloadAndStoreArtifacts(
  onProgress: ProgressCallback = defaultProgress,
  onError: ErrorCallback = defaultError
): Promise<void> {
  try {
    const runId = getRunIdFromQuery();
    if (!runId) {
      throw new Error("No run ID provided in query params");
    }

    // Test mode with local fixtures
    if (runId === "test") {
      console.log("[ARTIFACTS] Running in test mode, loading local fixture artifacts...");
      onProgress('Initializing', 10, 'Loading test fixtures');

      const testArtifacts = [
        { id: "results-ubiquity-os-marketplace", name: "results-ubiquity-os-marketplace" },
        { id: "results-ubiquity-os", name: "results-ubiquity-os" },
        { id: "results-ubiquity", name: "results-ubiquity" },
      ];

      // Process each artifact sequentially
      for (let i = 0; i < testArtifacts.length; i++) {
        const artifact = testArtifacts[i];
        const artifactNumber = i + 1;
        const totalProgress = Math.floor((artifactNumber - 1) / testArtifacts.length * 100);

        onProgress('Processing', totalProgress, `Artifact ${artifactNumber}/${testArtifacts.length}: ${artifact.name}`);

        try {
          // Get raw ZIP data and unzip in the browser
          const extractedFiles = await loadLocalArtifactZip(
            artifact.name,
            (phase, phasePercent, detail) => {
              // Calculate overall progress: combine artifact progress with phase progress
              const artifactWeight = 100 / testArtifacts.length;
              const overallPercent =
                totalProgress +
                (phasePercent / 100) * (artifactWeight / 2); // Each phase (download/unzip) is half of artifact weight

              onProgress(
                phase,
                overallPercent,
                detail || `${artifact.name} (${artifactNumber}/${testArtifacts.length})`
              );
            }
          );

          onProgress('Processing', totalProgress + 75 / testArtifacts.length, `Saving ${artifact.name}`);

          // Convert to JSON and save
          const jsonString = JSON.stringify(extractedFiles, null, 2);
          console.log(`[PROCESS] JSON string length: ${jsonString.length} bytes`);
          const blob = new Blob([jsonString], { type: "application/json" });
          console.log(`[PROCESS] Created blob, size: ${blob.size} bytes`);

          // Save to IndexedDB
          await saveArtifact(artifact.name, blob);
          console.log(`[STORAGE] Saved artifact: ${artifact.name}`);

          // Update progress to artifact completion
          onProgress(
            'Processing',
            Math.floor(artifactNumber / testArtifacts.length * 100),
            `Completed ${artifactNumber}/${testArtifacts.length}`
          );
        } catch (error) {
          console.error(`[ERROR] Processing artifact ${artifact.name}:`, error);
          // Continue with next artifact even if this one fails
          if (error instanceof Error) {
            onError(error);
          } else {
            onError(new Error(`Unknown error processing ${artifact.name}`));
          }
        }
      }

      onProgress('Complete', 100, 'All test artifacts processed');
      return;
    }

    // Real mode with GitHub artifacts
    onProgress('Fetching', 0, 'Getting artifacts list');
    const artifacts = await fetchArtifactsList(runId);
    console.log(`[ARTIFACTS] Found ${artifacts.length} artifacts`);
    onProgress('Fetching', 100, `Found ${artifacts.length} artifacts`);

    // Process artifacts from GitHub
    for (let i = 0; i < artifacts.length; i++) {
      const artifact = artifacts[i];
      const artifactNumber = i + 1;
      const totalProgress = Math.floor((artifactNumber - 1) / artifacts.length * 100);

      onProgress('Processing', totalProgress, `Artifact ${artifactNumber}/${artifacts.length}: ${artifact.name}`);

      try {
        // Download artifact
        onProgress('Downloading', 0, artifact.name);
        const zipData = await downloadArtifactZip(artifact, runId);
        onProgress('Downloading', 100, artifact.name);

        // Unzip artifact
        onProgress('Unzipping', 0, artifact.name);
        const extractedFiles = await unzipArtifact(zipData);
        onProgress('Unzipping', 100, artifact.name);

        // Save artifact
        onProgress('Saving', 0, artifact.name);
        const jsonString = JSON.stringify(extractedFiles, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        await saveArtifact(artifact.name, blob);
        onProgress('Saving', 100, artifact.name);

        console.log(`[STORAGE] Saved artifact: ${artifact.name}`);

        // Update progress to artifact completion
        onProgress(
          'Processing',
          Math.floor(artifactNumber / artifacts.length * 100),
          `Completed ${artifactNumber}/${artifacts.length}`
        );
      } catch (error) {
        console.error(`[ERROR] Processing artifact ${artifact.name}:`, error);
        // Continue with next artifact even if this one fails
        if (error instanceof Error) {
          onError(error);
        } else {
          onError(new Error(`Unknown error processing ${artifact.name}`));
        }
      }
    }

    onProgress('Complete', 100, 'All artifacts processed');
  } catch (error) {
    console.error("[ERROR] Fatal error in downloadAndStoreArtifacts:", error);
    if (error instanceof Error) {
      onError(error);
    } else {
      onError(new Error("Unknown error occurred during artifact processing"));
    }
  }
}
