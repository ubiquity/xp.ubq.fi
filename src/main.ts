import { downloadAndStoreArtifacts } from "./download-artifacts";
import { getRunIdFromQuery } from "./utils";

async function init() {
  try {
    const runId = getRunIdFromQuery();
    if (!runId) {
      console.error('No run ID found in URL');
      return;
    }

    const artifacts = await downloadAndStoreArtifacts(
      (phase: string, percent: number, detail?: string) => {
        console.log(`${phase}: ${Math.round(percent)}%${detail ? ` - ${detail}` : ''}`);
      },
      (error: Error) => {
        console.error(error);
      }
    );

    // Make data available globally
    (window as any).artifactsData = {};
    artifacts.forEach(artifact => {
      (window as any).artifactsData[artifact.name] = artifact.data;
    });


  // Log the full structure
  console.log('%c Full artifacts data:', 'font-weight: bold; font-size: 14px; color: #2196f3');
  artifacts.forEach((artifact) => {
    console.group(artifact.name);
    for (const [key, value] of artifact.data) {
      console.log(key + ':', value);
    }
    console.groupEnd();
  });

  console.log('%c✨ Developer Note: Access all artifacts data via window.artifactsData', 'color: #00c853; font-weight: bold;');



  } catch (error) {
    console.error(error);
  }
}

init();
