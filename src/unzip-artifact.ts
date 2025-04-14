import { strFromU8, unzipSync } from 'fflate';

// Define valid zip file signature (PK\x03\x04)
const ZIP_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const AGGREGATED_JSON_FILENAME = "aggregated_results.json";

/**
 * Validate zip file signature
 */
function isValidZip(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  return data.subarray(0, 4).every((byte, i) => byte === ZIP_SIGNATURE[i]);
}

/**
 * Extracts the parsed content of aggregated_results.json from a ZIP file using fflate.
 * @param zipData The Uint8Array containing the ZIP file data.
 * @returns The parsed JSON content (expected to be an array).
 * @throws {Error} When ZIP is invalid, aggregated_results.json is not found, or parsing fails.
 */
export async function unzipArtifact(zipData: Uint8Array): Promise<unknown[]> {
  if (!isValidZip(zipData)) {
    throw new Error('Invalid ZIP file format: Corrupted or not a ZIP file');
  }

  if (zipData.length < 22) { // Minimum size for an empty zip
    throw new Error('ZIP file is too small to be valid');
  }

  try {
    const unzipped = unzipSync(zipData);
    console.log("Unzipped files:", Object.keys(unzipped)); // Log filenames

    // Look for exact match only
    const aggregatedData = unzipped[AGGREGATED_JSON_FILENAME];
    if (!aggregatedData) {
      throw new Error(`${AGGREGATED_JSON_FILENAME} not found in ZIP archive. Files found: ${Object.keys(unzipped).join(', ')}`);
    }

    console.log(`Found ${AGGREGATED_JSON_FILENAME}, size: ${aggregatedData.length}`);

    // Decode the Uint8Array to a string
    console.log("Decoding Uint8Array to string...");
    const jsonString = strFromU8(aggregatedData);
    console.log(`Decoded string length: ${jsonString.length}`);

    // Parse the JSON string
    console.log("Parsing JSON string...");
    const parsedJson = JSON.parse(jsonString);
    console.log("JSON parsing complete.");

    if (!Array.isArray(parsedJson)) {
      throw new Error("Expected aggregated_results.json to contain an array");
    }

    return parsedJson;

  } catch (error: unknown) {
    console.error("Error during unzipping or parsing:", error);
    throw new Error(`Failed to process ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
