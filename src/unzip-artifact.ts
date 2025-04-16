import { strFromU8, unzipSync } from 'fflate';

// Define valid zip file signature (PK)
const ZIP_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const POSSIBLE_FILENAMES = [
  // Primary result file
  "aggregated_results.json",

  // Input files
  "workflow-inputs.json",
  "input.json",
  "inputs.json",
  "results.json"
];

// File we're specifically looking for in this case
const TARGET_FILENAME = "aggregated_results.json";

const MIN_ZIP_SIZE = 22; // Minimum size for an empty zip
const MAX_JSON_SIZE = 100 * 1024 * 1024; // 100MB limit for JSON files

/**
 * Validate zip file signature and structure
 */
function validateZip(data: Uint8Array): void {
  if (data.length < MIN_ZIP_SIZE) {
    throw new Error(`ZIP file is too small: ${data.length} bytes (minimum ${MIN_ZIP_SIZE} required)`);
  }

  if (!data.subarray(0, 4).every((byte, i) => byte === ZIP_SIGNATURE[i])) {
    throw new Error('Invalid ZIP signature: File is corrupted or not a ZIP file');
  }
}

/**
 * Validate JSON string before parsing
 */
function validateJsonString(jsonString: string): void {
  if (jsonString.length > MAX_JSON_SIZE) {
    throw new Error(`JSON file too large: ${jsonString.length} bytes (maximum ${MAX_JSON_SIZE} allowed)`);
  }

  if (jsonString.trim().length === 0) {
    throw new Error('JSON file is empty');
  }

  // Basic structure validation
  const firstChar = jsonString.trim()[0];
  const lastChar = jsonString.trim()[jsonString.trim().length - 1];

  if (!((firstChar === '[' && lastChar === ']') || (firstChar === '{' && lastChar === '}'))) {
    throw new Error('Invalid JSON structure: Must start with [ or { and end with matching bracket');
  }
}

/**
 * Extracts the parsed content from a JSON file within a ZIP archive using fflate.
 * @param zipData The Uint8Array containing the ZIP file data.
 * @returns The parsed JSON content (expected to be an array).
 * @throws {Error} When ZIP is invalid, target JSON file is not found, or parsing fails.
 */
export async function unzipArtifact(zipData: Uint8Array): Promise<unknown[]> {
  // Added comment to attempt cache busting for worker v2
  try {
    // Validate ZIP structure
    validateZip(zipData);

    // Unzip the archive
    console.log("Unzipping archive...");
    const unzipped = unzipSync(zipData);
    const files = Object.keys(unzipped);
    console.log(`Found ${files.length} files in archive:`, files);

    if (files.length === 0) {
      throw new Error('ZIP archive is empty');
    }

    // First look for the target file
    let fileData: Uint8Array | undefined = unzipped[TARGET_FILENAME];
    let foundFilename = TARGET_FILENAME;

    // If not found, try case-insensitive search for target file
    if (!fileData) {
      const matchingFile = files.find(f => f.toLowerCase() === TARGET_FILENAME.toLowerCase());
      if (matchingFile) {
        fileData = unzipped[matchingFile];
        foundFilename = matchingFile;
      }
    }

    // If still not found, look through other possible filenames
    if (!fileData) {
      for (const filename of POSSIBLE_FILENAMES) {
        if (filename === TARGET_FILENAME) continue; // Skip as we already checked it

        const exactMatch = unzipped[filename];
        if (exactMatch) {
          fileData = exactMatch;
          foundFilename = filename;
          break;
        }

        // Try case-insensitive search
        const lowerFilename = filename.toLowerCase();
        const matchingFile = files.find(f => f.toLowerCase() === lowerFilename);
        if (matchingFile) {
          fileData = unzipped[matchingFile];
          foundFilename = matchingFile;
          break;
        }
      }
    }

    if (!fileData || !foundFilename) {
      throw new Error(
        'Required file not found in ZIP archive. ' +
        `Looking for: ${TARGET_FILENAME} ` +
        `(fallbacks: ${POSSIBLE_FILENAMES.join(', ')}). ` +
        `Files found: ${files.join(', ')}`
      );
    }

    console.log(`Processing ${foundFilename} (${fileData.length} bytes)`);

    // Decode and validate the JSON string
    console.log("Decoding and validating JSON...");
    const jsonString = strFromU8(fileData);
    validateJsonString(jsonString);

    // Parse the JSON string
    console.log("Parsing JSON data...");
    const parsedJson = JSON.parse(jsonString);

    // Ensure we return an array
    if (Array.isArray(parsedJson)) {
      console.log(`Successfully parsed JSON array with ${parsedJson.length} items`);
      return parsedJson;
    } else {
      console.log("Parsed JSON is an object, converting to single-item array");
      return [parsedJson];
    }

  } catch (error: unknown) {
    // Add context to any errors
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error("Failed to process artifact:", message);

    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON format: ${message}`);
    }

    throw new Error(`Failed to process ZIP file: ${message}`);
  }
}
