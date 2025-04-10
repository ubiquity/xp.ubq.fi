import type { Artifact } from "./types";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export async function downloadArtifactZip(artifact: Artifact): Promise<Blob> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  }

  const response = await fetch(artifact.archive_download_url, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to download artifact ${artifact.name}: ${response.status}`);
  }
  return await response.blob();
}
