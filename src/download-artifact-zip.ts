import type { Artifact } from "./types";

export async function downloadArtifactZip(artifact: Artifact): Promise<any> {
  const response = await fetch(`/api/download-artifact?id=${encodeURIComponent(artifact.id.toString())}`);
  if (!response.ok) {
    throw new Error(`Failed to download artifact ${artifact.name}: ${response.status}`);
  }
  return await response.json();
}
