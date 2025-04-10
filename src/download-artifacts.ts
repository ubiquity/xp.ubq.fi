import { saveArtifact } from "./db/save-artifact";
import { downloadArtifactZip } from "./download-artifact-zip";
import { fetchArtifactsList } from "./fetch-artifacts-list";
import { getRunIdFromQuery } from "./utils";

export async function downloadAndStoreArtifacts(): Promise<void> {
  console.trace();
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
      const blob = await downloadArtifactZip(artifact);
      await saveArtifact(artifact.name, blob);
      console.log(`Saved artifact: ${artifact.name}`);
    }
  } catch (error) {
    console.error("Error downloading or saving artifacts:", error);
  }
}
