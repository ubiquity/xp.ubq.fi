import { saveArtifact } from "./db/save-artifact";
import { downloadArtifactZip } from "./download-artifact";
import { fetchArtifactsList } from "./fetch-artifacts-list";
import { getRunIdFromQuery } from "./utils";

import { unzipArtifact } from "./unzip-artifact";

async function loadLocalArtifactZip(artifactName: string): Promise<any> {
  console.log(`[UI] Starting to load artifact: ${artifactName}`);
  const url = `/api/download-artifact?id=${encodeURIComponent(artifactName)}&run=test`;
  console.log(`[UI] Fetching from URL: ${url}`);

  // Set headers to get raw ZIP data
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/zip'
    }
  });
  console.log(`[UI] Fetch response status: ${response.status}`);

  if (!response.ok) {
    throw new Error(`Failed to load artifact ${artifactName}: ${response.status}`);
  }

  // Get the ZIP data as ArrayBuffer and convert to Uint8Array
  const arrayBuffer = await response.arrayBuffer();
  const zipData = new Uint8Array(arrayBuffer);
  console.log(`[UI] Got ZIP data, size: ${zipData.length} bytes`);

  // Extract JSON files from the ZIP
  const files = await unzipArtifact(zipData);
  console.log(`[UI] Successfully extracted ${files.length} files`);
  return files;
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
        // Get raw ZIP data and unzip in the browser
        const extractedFiles = await loadLocalArtifactZip(artifact.name);
        console.log(`Processed ${artifact.name}:`, extractedFiles.length ? `${extractedFiles.length} items` : 'empty array');
        const jsonString = JSON.stringify(extractedFiles, null, 2);
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
      // Get raw ZIP data
      const zipData = await downloadArtifactZip(artifact, runId);
      // Extract JSON files
      const extractedFiles = await unzipArtifact(zipData);
      const jsonString = JSON.stringify(extractedFiles, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      await saveArtifact(artifact.name, blob);
      console.log(`Saved artifact: ${artifact.name}`);
    }
  } catch (error) {
    console.error("Error downloading or saving artifacts:", error);
  }
}
