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

export type ArtifactData = {
  name: string;
  data: any[];
};

/**
 * Main function to download and process all artifacts
 */
export async function downloadAndStoreArtifacts(
  onProgress: ProgressCallback = defaultProgress,
  onError: ErrorCallback = defaultError
): Promise<ArtifactData[]> {
  try {
    const runId = getRunIdFromQuery();
    if (!runId) {
      throw new Error("No run ID provided in query params");
    }

    const results: ArtifactData[] = [];
    const artifactsList = runId === "test" ? [
      { id: 1, name: "results-ubiquity-os-marketplace", archive_download_url: "/api/download-artifact?id=results-ubiquity-os-marketplace&run=test" },
      { id: 2, name: "results-ubiquity-os", archive_download_url: "/api/download-artifact?id=results-ubiquity-os&run=test" },
      { id: 3, name: "results-ubiquity", archive_download_url: "/api/download-artifact?id=results-ubiquity&run=test" },
    ] : await fetchArtifactsList(runId);

    // Process each artifact sequentially
    for (let i = 0; i < artifactsList.length; i++) {
      const artifact = artifactsList[i];
      const artifactNumber = i + 1;
      const totalProgress = Math.floor((artifactNumber - 1) / artifactsList.length * 100);

      try {
        // Download and process the artifact
        const extractedFiles = runId === "test"
          ? await loadLocalArtifactZip(
              artifact.name,
              (phase, phasePercent, detail) => {
                const artifactWeight = 100 / artifactsList.length;
                const overallPercent = totalProgress + (phasePercent / 100) * (artifactWeight / 2);
                onProgress(phase, overallPercent, detail || `${artifact.name} (${artifactNumber}/${artifactsList.length})`);
              }
            )
          : await downloadArtifactZip(artifact, runId).then(data => unzipArtifact(data));

        // Store the results
        results.push({
          name: artifact.name,
          data: extractedFiles
        });

        // Report progress
        const progress = Math.floor(artifactNumber / artifactsList.length * 100);
        onProgress('Processing', progress, `Completed ${artifactNumber}/${artifactsList.length}`);

      } catch (error) {
        console.error(`[ERROR] Processing artifact ${artifact.name}:`, error);
        if (error instanceof Error) {
          onError(error);
        } else {
          onError(new Error(`Unknown error processing ${artifact.name}`));
        }
        // Continue with next artifact even if this one fails
      }
    }

    onProgress('Complete', 100, 'All artifacts processed');
    return results;

  } catch (error) {
    console.error("[ERROR] Fatal error in downloadAndStoreArtifacts:", error);
    if (error instanceof Error) {
      onError(error);
    } else {
      onError(new Error("Unknown error occurred during artifact processing"));
    }
    return []; // Return empty array on error
  }
}
