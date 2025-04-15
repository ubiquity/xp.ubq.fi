console.log(">>> Starting final-artifact-e2e.test.ts (using JS unzip)");
// Import the JS-based unzip function
import { unzipArtifact } from "../src/unzip-artifact";

// Bun automatically loads .env, no need for dotenv import

const ARTIFACT_NAME = "final-aggregated-results";
const AGGREGATED_JSON = "aggregated_results.json";

// Helper to fetch artifact metadata from GitHub API
async function fetchArtifactMetadata(): Promise<{ id: number; name: string } | null> {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    throw new Error("Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN in .env");
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/artifacts`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch artifacts list: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const artifact = data.artifacts.find((a: any) => a.name === ARTIFACT_NAME);
  if (!artifact) {
    const available = data.artifacts.map((a: any) => a.name).join(", ");
    console.error(`Artifact ${ARTIFACT_NAME} not found in repo ${owner}/${repo}`);
    console.error("Available artifacts:", available);
    throw new Error(`Artifact ${ARTIFACT_NAME} not found. See above for available artifacts.`);
  }
  return { id: artifact.id, name: artifact.name };
}

test("Download, unzip, and parse aggregated_results.json from final-aggregated-results.zip", async () => {
  console.log(">>> Test started: Download, unzip, and parse aggregated_results.json");
  // 1. Fetch artifact metadata (id)
  const artifactMeta = await fetchArtifactMetadata();
  console.log(">>> Artifact metadata fetched:", artifactMeta);
  if (!artifactMeta) throw new Error("Artifact metadata not found");

  // 2. Download the artifact ZIP using GitHub API (archive_download_url)
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  // Fetch artifact list again to get archive_download_url
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/artifacts`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  const data = await res.json();
  const artifact = data.artifacts.find((a: any) => a.id === artifactMeta.id);
  if (!artifact) throw new Error("Artifact not found by id after metadata fetch");
  const archiveUrl = artifact.archive_download_url;
  if (!archiveUrl) throw new Error("archive_download_url missing from artifact metadata");

  const zipRes = await fetch(archiveUrl, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!zipRes.ok) throw new Error(`Failed to download artifact ZIP: ${zipRes.status} ${zipRes.statusText}`);
  const arrayBuffer = await zipRes.arrayBuffer();
  const zipData = new Uint8Array(arrayBuffer);
  console.log(">>> Artifact ZIP downloaded. Size:", zipData.length);

  // 3. Unzip and parse aggregated_results.json using JS implementation
  console.log(">>> Calling JS unzipArtifact...");
  const parsed = await unzipArtifact(zipData); // Add await for async function
  console.log(">>> JS unzipArtifact finished.");

  // 4. Print summary for CLI inspection
  console.log("Parsed aggregated_results.json. Entry count:", Array.isArray(parsed) ? parsed.length : "N/A");
  if (Array.isArray(parsed) && parsed.length > 0) {
    console.log("Sample entry:", JSON.stringify(parsed[0], null, 2));
  }

  // 5. Assert structure (basic)
  expect(Array.isArray(parsed)).toBe(true);
  expect(parsed.length).toBeGreaterThan(0);
  expect(parsed[0]).toHaveProperty("org");
  expect(parsed[0]).toHaveProperty("repo");
  expect(parsed[0]).toHaveProperty("issueId");
  expect(parsed[0]).toHaveProperty("metadata");
  console.log(">>> Basic structure assertions passed.");
});
