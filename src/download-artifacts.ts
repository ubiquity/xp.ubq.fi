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
 * Includes retry logic and enhanced error reporting.
 */
export async function downloadAndProcessAggregatedArtifact(
  onProgress: ProgressCallback,
  onError: ErrorCallback,
  explicitRunId?: string,
  maxRetries: number = 3
): Promise<unknown[]> {
  try {
    const runId = explicitRunId ?? getRunIdFromQuery();
    if (!runId) {
      throw new Error("No run ID provided in query params");
    }
    onProgress('Fetching Metadata', 0, `Run ID: ${runId}`);

    // 1. Fetch metadata for the target artifact using backend API with retries
    let metaRes: Response | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        metaRes = await fetch(`/api/artifacts?runId=${encodeURIComponent(runId)}`);
        if (metaRes.ok) break;

        console.warn(`Attempt ${attempt}/${maxRetries} failed: ${metaRes.status} ${metaRes.statusText}`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt === maxRetries) throw lastError;
      }
    }

    if (!metaRes?.ok) {
      throw new Error(`Failed to fetch artifacts list for run ${runId} after ${maxRetries} attempts: ${metaRes?.status} ${metaRes?.statusText}`);
    }

    const { artifacts } = await metaRes.json();
    console.log(`Received artifacts list for run ${runId}:`, artifacts);

    if (!Array.isArray(artifacts)) {
      throw new Error(`Invalid response: artifacts must be an array. Received: ${typeof artifacts}`);
    }

    if (artifacts.length === 0) {
      throw new Error(`No artifacts found for run ${runId}. The run may still be in progress or may have failed.`);
    }

    const artifactMeta = artifacts.find((a) => a.name === TARGET_ARTIFACT_NAME);
    if (!artifactMeta) {
      console.error(`Available artifacts:`, artifacts.map(a => a.name));
      throw new Error(
        `Artifact "${TARGET_ARTIFACT_NAME}" not found for run ${runId}. ` +
        `Available artifacts: ${artifacts.map(a => a.name).join(', ')}`
      );
    }
    onProgress('Fetching Metadata', 20, `Found artifact: ${artifactMeta.name}`);

    // 2. Download the artifact ZIP using the backend API with retry logic
    const archiveUrl = `/api/download-artifact?id=${encodeURIComponent(artifactMeta.id)}&run=${encodeURIComponent(runId)}`;
    console.log(`Initiating download from: ${archiveUrl}`);
    onProgress('Downloading', 20, `Downloading ${artifactMeta.name}...`);

    let zipRes: Response | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        zipRes = await fetch(archiveUrl, {
          redirect: 'follow',
          headers: {
            'Accept': 'application/zip',
            'Cache-Control': 'no-cache'
          }
        });

        if (zipRes.ok) break;

        console.warn(
          `Download attempt ${attempt}/${maxRetries} failed:`,
          `Status: ${zipRes.status}`,
          `Status Text: ${zipRes.statusText}`
        );

        if (attempt < maxRetries) {
          const delay = 1000 * attempt;
          console.log(`Retrying download in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (e) {
        console.error(`Download attempt ${attempt} error:`, e);
        if (attempt === maxRetries) throw e;
      }
    }

    if (!zipRes?.ok) {
      throw new Error(
        `Failed to download artifact ZIP after ${maxRetries} attempts: ` +
        `${zipRes?.status} ${zipRes?.statusText} from ${archiveUrl}`
      );
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await zipRes.arrayBuffer();
    } catch (e) {
      throw new Error(
        `Failed to read artifact ZIP data: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    const zipData = new Uint8Array(arrayBuffer);
    if (zipData.length === 0) {
      throw new Error('Downloaded artifact ZIP is empty');
    }
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
