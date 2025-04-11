import type { Artifact } from "./types";

export async function downloadArtifactZip(artifact: Artifact, runId?: string): Promise<Uint8Array> {
  const runParam = runId === "test" ? "&run=test" : "";
  const url = `/api/download-artifact?id=${encodeURIComponent(artifact.id.toString())}${runParam}`;
  console.log("Fetching artifact from URL:", url);

  // Set headers to get raw ZIP data
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/zip'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download artifact ${artifact.name}: ${response.status}`);
  }

  // Get the ZIP data as ArrayBuffer and convert to Uint8Array
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
