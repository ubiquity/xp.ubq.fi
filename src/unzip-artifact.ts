import { extract_jsons, initWasm } from '../wasm/src/wasm-unzipper-embedded';

// Define valid zip file signature (PK\x03\x04)
const ZIP_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

/**
 * Validate zip file signature
 */
function isValidZip(data: Uint8Array): boolean {
  if (data.length < 4) return false;

  return data[0] === ZIP_SIGNATURE[0] &&
         data[1] === ZIP_SIGNATURE[1] &&
         data[2] === ZIP_SIGNATURE[2] &&
         data[3] === ZIP_SIGNATURE[3];
}

/**
 * Extracts JSON data from ZIP file
 * @throws {Error} When ZIP is invalid or extraction fails
 */
export async function unzipArtifact(zipData: Uint8Array): Promise<any[]> {
  // Validate the ZIP data
  if (!isValidZip(zipData)) {
    console.error('Invalid ZIP file signature');
    throw new Error('Invalid ZIP file format: Corrupted or not a ZIP file');
  }

  if (zipData.length < 100) {
    console.error('ZIP file too small:', zipData.length, 'bytes');
    throw new Error('ZIP file is too small to be valid');
  }

  console.log(`Processing ZIP file (${zipData.length} bytes)`);

  try {
    // Initialize WASM if not already initialized
    await initWasm();
    console.log('WASM initialized successfully');

    // Extract and parse JSON content from the zip data
    const jsonData = extract_jsons(zipData);

    if (Array.isArray(jsonData)) {
      console.log(`Successfully extracted ${jsonData.length} JSON objects from zip`);
      return jsonData;
    } else {
      console.error('Unexpected extraction result:', jsonData);
      throw new Error('ZIP extraction failed: No valid JSON data found');
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error during ZIP extraction';

    console.error('Error unzipping artifact:', errorMessage);
    throw new Error(`Failed to process ZIP file: ${errorMessage}`);
  }
}
