import { strFromU8, unzipSync } from 'fflate';

// Define valid zip file signature (PK\x03\x04)
const ZIP_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const POSSIBLE_INPUT_FILENAMES = ["workflow-inputs.json", "input.json", "inputs.json"];

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

    // Look for any of the possible input files
    let inputData: Uint8Array | undefined;
    let foundFilename: string | undefined;

    for (const filename of POSSIBLE_INPUT_FILENAMES) {
      inputData = unzipped[filename];
      if (inputData) {
        foundFilename = filename;
        break;
      }
    }

    if (!inputData || !foundFilename) {
      throw new Error(`No input file found in ZIP archive. Files found: ${Object.keys(unzipped).join(', ')}`);
    }

    console.log(`Found ${foundFilename}, size: ${inputData.length}`);

    // Decode the Uint8Array to a string
    console.log("Decoding Uint8Array to string...");
    const jsonString = strFromU8(inputData);
    console.log(`Decoded string length: ${jsonString.length}`);

    // Parse the JSON string
    console.log("Parsing JSON string...");
    const parsedJson = JSON.parse(jsonString);
    console.log("JSON parsing complete.");

    // Input data could be either an object or an array
    return Array.isArray(parsedJson) ? parsedJson : [parsedJson];

  } catch (error: unknown) {
    console.error("Error during unzipping or parsing:", error);
    throw new Error(`Failed to process ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
