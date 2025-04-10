import { ORG, REPO } from "./constants";
import type { Artifact } from "./types";

export async function fetchArtifactsList(runId: string): Promise<Artifact[]> {
  const url = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${runId}/artifacts`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch artifacts list: ${response.status}`);
  }
  const data = await response.json();
  return data.artifacts as Artifact[];
}
