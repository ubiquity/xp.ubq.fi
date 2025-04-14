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
export async function unzipArtifact(zipData: Uint8Array): Promise<any[]> { // Mark as async
  if (!isValidZip(zipData)) {
    throw new Error('Invalid ZIP file format: Corrupted or not a ZIP file');
  }

  if (zipData.length < 22) { // Minimum size for an empty zip
    throw new Error('ZIP file is too small to be valid');
  }

  try {
    const unzipped = unzipSync(zipData);
    console.log("Unzipped files:", Object.keys(unzipped)); // Log filenames

    // Find the aggregated_results.json file (case-insensitive check just in case)
    let aggregatedData: Uint8Array | undefined;
    let foundFilename = '';
    for (const filename in unzipped) {
      if (filename.toLowerCase().endsWith(AGGREGATED_JSON_FILENAME)) {
         // Handle potential directory prefix if GitHub adds one
         if (filename === AGGREGATED_JSON_FILENAME || filename.split('/').pop() === AGGREGATED_JSON_FILENAME) {
            aggregatedData = unzipped[filename];
            foundFilename = filename;
            break;
         }
      }
    }

    if (!aggregatedData) {
      throw new Error(`${AGGREGATED_JSON_FILENAME} not found in the ZIP archive. Found: ${Object.keys(unzipped).join(', ')}`);
    }

    console.log(`Found ${foundFilename}, size: ${aggregatedData.length}`);

    // Decode the Uint8Array to a string
    console.log("Decoding Uint8Array to string...");
    const jsonString = strFromU8(aggregatedData);
    console.log(`Decoded string length: ${jsonString.length}`);

    // Parse the JSON string
    console.log("Parsing JSON string...");
    const parsedJson = JSON.parse(jsonString);
    console.log("JSON parsing complete.");

    if (!Array.isArray(parsedJson)) {
        console.warn("Parsed JSON is not an array, returning as is.");
        // Depending on requirements, might want to throw an error or wrap in array
        return parsedJson; // Or throw new Error("Expected aggregated_results.json to contain an array");
    }

    return parsedJson;

  } catch (error: unknown) {
    console.error("Error during unzipping or parsing:", error);
    throw new Error(`Failed to process ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
