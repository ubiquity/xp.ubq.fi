import { saveArtifact } from "./db/save-artifact";
import { downloadArtifactZip } from "./download-artifact";
import { fetchArtifactsList } from "./fetch-artifacts-list";
import { getRunIdFromQuery } from "./utils";

export async function downloadAndStoreArtifacts(): Promise<void> {
  const runId = getRunIdFromQuery();
  if (!runId) {
    console.error("No run ID provided in query params");
    return;
  }

  try {
    const artifacts = await fetchArtifactsList(runId);
    console.log(`Found ${artifacts.length} artifacts`);

    for (const artifact of artifacts) {
      console.log(`Downloading artifact: ${artifact.name}`);
      const json = await downloadArtifactZip(artifact);
      const jsonString = JSON.stringify(json, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      await saveArtifact(artifact.name, blob);
      console.log(`Saved artifact: ${artifact.name}`);
    }
  } catch (error) {
    console.error("Error downloading or saving artifacts:", error);
  }
}
