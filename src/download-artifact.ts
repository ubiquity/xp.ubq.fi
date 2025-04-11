import type { Artifact } from "./types";
import { unzipArtifact } from "./unzip-artifact";

export async function downloadArtifactZip(artifact: Artifact, runId?: string): Promise<any[]> {
  const runParam = runId === "test" ? "&run=test" : "";
  const url = `/api/download-artifact?id=${encodeURIComponent(artifact.id.toString())}${runParam}`;
  console.log("Fetching artifact from URL:", url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download artifact ${artifact.name}: ${response.status}`);
  }

  // Get the ZIP data as ArrayBuffer and convert to Uint8Array
  const arrayBuffer = await response.arrayBuffer();
  const zipData = new Uint8Array(arrayBuffer);

  // Extract JSON files from the ZIP data
  const files = await unzipArtifact(zipData);
  return files;
}
