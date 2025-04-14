// Removed downloadArtifactZip and fetchArtifactsList imports as they are replaced
import { unzipArtifact } from "./unzip-artifact";
import { getRunIdFromQuery } from "./utils";

// Define callback types for progress reporting and error handling
export type ProgressCallback = (
  phase: string,
  percent: number,
  detail?: string
) => void;

export type ErrorCallback = (error: Error) => void;

// Default no-op callbacks
const defaultProgress: ProgressCallback = () => {};
const defaultError: ErrorCallback = () => {};

// Removed unused loadLocalArtifactZip function

const TARGET_ARTIFACT_NAME = "final-aggregated-results";

/**
 * Fetches metadata for the target artifact.
 */
// Declare placeholders for build-time replacement
declare const __GITHUB_OWNER__: string;
declare const __GITHUB_REPO__: string;
declare const __GITHUB_TOKEN__: string | undefined; // Token might be optional for public repos

async function fetchTargetArtifactMetadata(runId: string): Promise<{ id: number; name: string; archive_download_url: string } | null> {
  const owner = __GITHUB_OWNER__;
  const repo = __GITHUB_REPO__;
  const token = __GITHUB_TOKEN__; // Use defined placeholder

  if (!owner || !repo) {
    throw new Error("Build-time variables __GITHUB_OWNER__ or __GITHUB_REPO__ are not defined.");
  }

  if (!token) {
      console.warn("GITHUB_TOKEN not defined at build time, artifact download might fail if repo is private.");
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;
  console.log(`Fetching artifact list from: ${apiUrl}`);

  const res = await fetch(apiUrl, {
    headers: {
      ...(token && { Authorization: `token ${token}` }), // Conditionally add auth header
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch artifacts list for run ${runId}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const artifact = data.artifacts.find((a: any) => a.name === TARGET_ARTIFACT_NAME);

  if (!artifact) {
    console.warn(`Target artifact "${TARGET_ARTIFACT_NAME}" not found in run ${runId}. Available: ${data.artifacts.map((a: any) => a.name).join(', ')}`);
    return null; // Return null if not found
  }
  console.log(`Found target artifact: ${artifact.name}, ID: ${artifact.id}`);
  return { id: artifact.id, name: artifact.name, archive_download_url: artifact.archive_download_url };
}


/**
 * Downloads and processes the single 'final-aggregated-results' artifact.
 * Returns the parsed JSON array from 'aggregated_results.json'.
 */
export async function downloadAndProcessAggregatedArtifact(
  onProgress: ProgressCallback = defaultProgress,
  onError: ErrorCallback = defaultError,
  explicitRunId?: string
): Promise<any[]> { // Return the parsed JSON array directly
  try {
    const runId = explicitRunId ?? getRunIdFromQuery();
    if (!runId) {
      throw new Error("No run ID provided in query params");
    }
    onProgress('Fetching Metadata', 0, `Run ID: ${runId}`);

    // 1. Fetch metadata for the target artifact
    const artifactMeta = await fetchTargetArtifactMetadata(runId);
    if (!artifactMeta) {
        // Handle case where artifact isn't found (e.g., workflow didn't produce it)
        console.error(`Artifact "${TARGET_ARTIFACT_NAME}" not found for run ${runId}.`);
        onError(new Error(`Artifact "${TARGET_ARTIFACT_NAME}" not found.`));
        return []; // Return empty array or handle as appropriate
    }
    onProgress('Fetching Metadata', 20, `Found artifact: ${artifactMeta.name}`);

    // 2. Download the artifact ZIP using the archive_download_url
    const token = __GITHUB_TOKEN__; // Use defined placeholder
    const archiveUrl = artifactMeta.archive_download_url;
    console.log(`Downloading artifact from: ${archiveUrl}`);
    onProgress('Downloading', 20, `Downloading ${artifactMeta.name}...`);

    const zipRes = await fetch(archiveUrl, {
        headers: {
          ...(token && { Authorization: `token ${token}` }), // Conditionally add auth header
          // GitHub artifact download requires redirect following
        },
        redirect: 'follow' // Important: Follow redirects for artifact downloads
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
    if (error instanceof Error) {
      onError(error);
    } else {
      onError(new Error("Unknown error occurred during artifact processing"));
    }
    return []; // Return empty array on error
  }
}
