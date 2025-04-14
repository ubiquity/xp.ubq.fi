import { unzipArtifact } from "./unzip-artifact";
import { getRunIdFromQuery } from "./utils";

export type ProgressCallback = (
  phase: string,
  percent: number,
  detail: string // Remove optional
) => void;

export type ErrorCallback = (error: Error) => void;

const TARGET_ARTIFACT_NAME = "final-aggregated-results";



/**
 * Downloads and processes the single 'final-aggregated-results' artifact.
 * Returns the parsed JSON array from 'aggregated_results.json'.
 */
export async function downloadAndProcessAggregatedArtifact(
  onProgress: ProgressCallback,
  onError: ErrorCallback,
  explicitRunId?: string
): Promise<unknown[]> {
  try {
    const runId = explicitRunId ?? getRunIdFromQuery();
    if (!runId) {
      throw new Error("No run ID provided in query params");
    }
    onProgress('Fetching Metadata', 0, `Run ID: ${runId}`);

    // 1. Fetch metadata for the target artifact using backend API
    const metaRes = await fetch(`/api/artifacts?runId=${encodeURIComponent(runId)}`);
    if (!metaRes.ok) {
      throw new Error(`Failed to fetch artifacts list for run ${runId}: ${metaRes.status} ${metaRes.statusText}`);
    }
    const { artifacts } = await metaRes.json();

    if (!Array.isArray(artifacts)) {
      throw new Error("Invalid response: artifacts must be an array");
    }

    const artifactMeta = artifacts.find((a) => a.name === TARGET_ARTIFACT_NAME);
    if (!artifactMeta) {
      throw new Error(`Artifact "${TARGET_ARTIFACT_NAME}" not found for run ${runId}`);
    }
    onProgress('Fetching Metadata', 20, `Found artifact: ${artifactMeta.name}`);

    // 2. Download the artifact ZIP using the backend API
    const archiveUrl = `/api/download-artifact?id=${encodeURIComponent(artifactMeta.id)}&run=${encodeURIComponent(runId)}`;
    console.log(`Downloading artifact from: ${archiveUrl}`);
    onProgress('Downloading', 20, `Downloading ${artifactMeta.name}...`);

    const zipRes = await fetch(archiveUrl, {
      redirect: 'follow'
    });

    if (!zipRes.ok) {
      throw new Error(`Failed to download artifact ZIP: ${zipRes.status} ${zipRes.statusText} from ${archiveUrl}`);
    }
    const arrayBuffer = await zipRes.arrayBuffer();
    const zipData = new Uint8Array(arrayBuffer);
    console.log(`Downloaded ZIP size: ${zipData.length}`);
    onProgress('Downloading', 60, `Downloaded ${zipData.length} bytes.`);

    // 3. Unzip and parse aggregated_results.json
    onProgress('Unzipping', 60, `Unzipping ${artifactMeta.name}...`);
    const parsedJson = await unzipArtifact(zipData); // Use the JS unzipper
    console.log(`Unzipped and parsed. Result type: ${Array.isArray(parsedJson) ? 'array' : typeof parsedJson}, Length: ${Array.isArray(parsedJson) ? parsedJson.length : 'N/A'}`);
    onProgress('Unzipping', 100, `Processing complete.`);

    // 4. Return the parsed JSON array
    onProgress('Complete', 100, 'Artifact processed successfully.');
    return parsedJson;

  } catch (error) {
    onError(error instanceof Error ? error : new Error("Unknown error occurred during artifact processing"));
    throw error; // Re-throw instead of returning empty array
  }
}
