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



  // --- Deep JSON rendering of artifactsData only ---

  // Recursively convert Maps to plain objects (deep)
  function mapToObject(obj: any): any {
    if (obj instanceof Map) {
      const result: Record<string, any> = {};
      for (const [key, value] of obj.entries()) {
        result[key] = mapToObject(value);
      }
      return result;
    } else if (Array.isArray(obj)) {
      return obj.map(mapToObject);
    } else if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, any> = {};
      for (const key in obj) {
        result[key] = mapToObject(obj[key]);
      }
      return result;
    }
    return obj;
  }

  // Deep JSON output with colorized label (JSON itself cannot be colorized natively)
  const deepObj = mapToObject(window.artifactsData);
  console.log('%c[Deep JSON]', 'color: #ff9800;', JSON.stringify(deepObj, null, 2));

  // --- End Deep JSON rendering ---

  console.log('%c✨ Developer Note: Access all artifacts data via window.artifactsData', 'color: #00c853; font-weight: bold;');



  } catch (error) {
    console.error(error);
  }
}

init();
