import { getUsableArtifacts } from "./artifact-data";
import { getRunIdFromQuery } from "./utils";

async function init() {
  try {
    const runId = getRunIdFromQuery();
    if (!runId) {
      console.error('No run ID found in URL');
      return;
    }

    // Get usable artifacts as a plain JS object
    const artifacts = await getUsableArtifacts(
      runId,
      (phase: string, percent: number, detail?: string) => {
        console.log(`${phase}: ${Math.round(percent)}%${detail ? ` - ${detail}` : ''}`);
      },
      (error: Error) => {
        console.error(error);
      }
    );

    // Make data available globally for debugging
    (window as any).artifactsData = artifacts;

    // Deep JSON output with colorized label (JSON itself cannot be colorized natively)
    console.dir(artifacts, {
      depth: null,
      colors: true,
      customInspect: true,
      showHidden: true,
      maxArrayLength: null,
      maxStringLength: null,
      compact: false,
    });

    console.log('%c✨ Developer Note: Access all artifacts data via window.artifactsData', 'color: #00c853; font-weight: bold;');

  } catch (error) {
    console.error(error);
  }
}

init();
