import type { Artifact } from "./types";

export async function fetchArtifactsList(runId: string): Promise<Artifact[]> {
  const url = `/api/artifacts?runId=${encodeURIComponent(runId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch artifacts list: ${response.status}`);
  }
  const data = await response.json();
  return data.artifacts as Artifact[];
}
