import { extract_jsons, initWasm } from '../wasm/src/wasm-unzipper-embedded';

export async function unzipArtifact(zipData: Uint8Array): Promise<any[]> {
  try {
    // Initialize WASM if not already initialized
    await initWasm();

    // Extract and parse JSON content from the zip data
    const jsonData = extract_jsons(zipData);

    if (Array.isArray(jsonData)) {
      console.log(`Successfully extracted ${jsonData.length} JSON objects from zip`);
      return jsonData;
    } else {
      console.log('Unexpected extraction result:', jsonData);
      return [];
    }
  } catch (error) {
    console.error('Error unzipping artifact:', error);
    throw error;
  }
}
