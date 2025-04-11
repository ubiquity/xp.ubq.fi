import { saveArtifact } from "./db/save-artifact";
import { downloadArtifactZip } from "./download-artifact";
import { fetchArtifactsList } from "./fetch-artifacts-list";
import { getRunIdFromQuery } from "./utils";

async function loadLocalArtifactZip(artifactName: string): Promise<any> {
  console.log(`[API] Starting to load artifact: ${artifactName}`);
  const url = `/api/download-artifact?id=${encodeURIComponent(artifactName)}&run=test`;
  console.log(`[API] Fetching from URL: ${url}`);

  const response = await fetch(url);
  console.log(`[API] Fetch response status: ${response.status}`);

  if (!response.ok) {
    throw new Error(`Failed to load artifact ${artifactName}: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[API] Received JSON data for ${artifactName}`);

  // The API returns { files: [...] } format
  if (data && data.files && Array.isArray(data.files)) {
    console.log(`[API] Successfully parsed ${data.files.length} JSON objects from ${artifactName}`);
    return data.files;
  } else {
    console.log(`[API] Unexpected response format:`, data);
    return [];
  }
}

export async function downloadAndStoreArtifacts(): Promise<void> {
  const runId = getRunIdFromQuery();
  if (!runId) {
    console.error("No run ID provided in query params");
    return;
  }

  if (runId === "test") {
    console.log("Running in test mode, loading local fixture artifacts...");
    const testArtifacts = [
      { id: "results-ubiquity-os-marketplace", name: "results-ubiquity-os-marketplace" },
      { id: "results-ubiquity-os", name: "results-ubiquity-os" },
      { id: "results-ubiquity", name: "results-ubiquity" },
    ];

    try {
      for (const artifact of testArtifacts) {
        console.log(`Loading local artifact: ${artifact.name}`);
        const json = await loadLocalArtifactZip(artifact.name);
        console.log(`Loaded JSON data for ${artifact.name}:`, json.length ? `${json.length} items` : 'empty array');
        const jsonString = JSON.stringify(json, null, 2);
        console.log(`JSON string length: ${jsonString.length} bytes`);
        const blob = new Blob([jsonString], { type: "application/json" });
        console.log(`Created blob, size: ${blob.size} bytes`);
        await saveArtifact(artifact.name, blob);
        console.log(`Saved local artifact: ${artifact.name}`);
      }
    } catch (error) {
      console.error("Error loading or saving local artifacts:", error);
    }
    return;
  }

  try {
    const artifacts = await fetchArtifactsList(runId);
    console.log(`Found ${artifacts.length} artifacts`);

    for (const artifact of artifacts) {
      console.log(`Downloading artifact: ${artifact.name}`);
      const json = await downloadArtifactZip(artifact, runId);
      const jsonString = JSON.stringify(json, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      await saveArtifact(artifact.name, blob);
      console.log(`Saved artifact: ${artifact.name}`);
    }
  } catch (error) {
    console.error("Error downloading or saving artifacts:", error);
  }
}
