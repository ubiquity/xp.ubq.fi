import { downloadAndStoreArtifacts } from "./download-artifacts";

/**
 * Recursively converts Maps (and nested Maps) to plain JS objects/arrays.
 */
export function mapToObject(obj: any): any {
  if (obj instanceof Map) {
    const result: Record<string, any> = {};
    for (const [key, value] of obj.entries()) {
      result[key] = mapToObject(value);
    }
    return result;
  } else if (Array.isArray(obj)) {
    return obj.map(mapToObject);
  } else if (typeof obj === "object" && obj !== null) {
    const result: Record<string, any> = {};
    for (const key in obj) {
      result[key] = mapToObject(obj[key]);
    }
    return result;
  }
  return obj;
}

/**
 * Downloads, unzips, and returns all artifact data as a plain JS object.
 * @param runId The run ID to fetch artifacts for.
 * @param onProgress Optional progress callback.
 * @param onError Optional error callback.
 */
export async function getUsableArtifacts(
  runId: string,
  onProgress?: (phase: string, percent: number, detail?: string) => void,
  onError?: (error: Error) => void
): Promise<Record<string, any>> {
  const artifacts = await downloadAndStoreArtifacts(onProgress, onError);

  // Build a plain object with all artifact data, converting Maps to objects
  const result: Record<string, any> = {};
  artifacts.forEach((artifact) => {
    result[artifact.name] = mapToObject(artifact.data);
  });
  return result;
}
