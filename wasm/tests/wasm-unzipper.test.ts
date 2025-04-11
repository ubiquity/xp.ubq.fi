import { expect, test } from "bun:test";

// Helper function to compare arrays of objects ignoring order
function compareJsonArraysUnordered(arr1: any[], arr2: any[]): boolean {
  if (arr1.length !== arr2.length) {
    console.error(`Array lengths differ: ${arr1.length} vs ${arr2.length}`);
    return false;
  }

  // Stable stringify function that sorts keys
  const stableStringify = (obj: any): string => {
    const sortedObj = Object.keys(obj)
      .sort()
      .reduce((acc: any, key) => {
        const value = obj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Recursively sort nested objects
          acc[key] = JSON.parse(stableStringify(value)); // Parse back after recursive stringify
        } else if (Array.isArray(value)) {
           // Recursively sort objects within arrays
           acc[key] = value.map(item => typeof item === 'object' && item !== null ? JSON.parse(stableStringify(item)) : item);
        }
        else {
          acc[key] = value;
        }
        return acc;
      }, {});
    return JSON.stringify(sortedObj);
  };

  const set1 = new Set(arr1.map(item => stableStringify(item)));
  const set2 = new Set(arr2.map(item => stableStringify(item)));

  if (set1.size !== arr1.length || set2.size !== arr2.length) {
    // This indicates duplicate objects within one of the arrays, which might be unexpected.
    // Or it could mean the stringification wasn't stable if key order varies.
    console.error("Duplicate objects detected within arrays after stringification, or unstable stringification.");
    // We'll still compare the sets for membership.
  }

   if (set1.size !== set2.size) {
      console.error(`Set sizes differ after stringification: ${set1.size} vs ${set2.size}`);
      return false;
  }

  for (const itemStr of set1) {
    if (!set2.has(itemStr)) {
      console.error(`Mismatch found: Element from array 1 not found in array 2: ${itemStr.substring(0, 100)}...`);
      return false;
    }
  }

  // Since lengths and set sizes are equal, and all items in set1 are in set2, they contain the same elements.
  return true;
}

let wasmUnzipper: any;
let wasmInitialized = false;

async function initWasm() {
  if (!wasmInitialized) {
    // Assuming the wasm package is built and available relative to the test file
    // Adjust the path if your project structure is different
    try {
      wasmUnzipper = await import("../wasm-unzipper/pkg/wasm_unzipper.js");
      await wasmUnzipper.default(); // Initialize the WASM module
      wasmInitialized = true;
    } catch (e) {
      console.error("Failed to load or initialize WASM module:", e);
      // Optionally re-throw or handle the error appropriately for your tests
      throw new Error("WASM initialization failed. Ensure '../wasm-unzipper/pkg/wasm_unzipper.js' exists and is valid.");
    }
  }
}

// Define the small fixture file and its compiled counterpart
const smallFixtureZip = "small-test-fixture.zip";
const smallFixtureCompiled = "small-test-fixture.json";

test(`Rust WASM unzipper extracts JSONs under 50ms for ${smallFixtureZip}`, async () => {
  await initWasm();

  const fixturePath = `tests/fixtures/artifacts/${smallFixtureZip}`;
  const file = Bun.file(fixturePath);
  if (!(await file.exists())) {
    throw new Error(`Fixture not found: ${fixturePath}`);
  }
  const zipData = new Uint8Array(await file.arrayBuffer());

  const t0 = performance.now();
  const jsonArray = wasmUnzipper.extract_jsons(zipData);
  const t1 = performance.now();

  const elapsed = t1 - t0;
  console.log(`${smallFixtureZip}: Rust WASM unzip+parse took ${elapsed.toFixed(2)}ms`);
  console.log(`${smallFixtureZip}: Extracted ${jsonArray.length} JSON files`);

  // Basic performance and extraction check
  expect(elapsed).toBeLessThan(50); // Keep performance check
  expect(jsonArray.length).toBe(5); // Expect exactly 5 files based on the new fixture
});

test(`Extracted JSONs match compiled output for ${smallFixtureZip}`, async () => {
  await initWasm();

  const fixturePath = `tests/fixtures/artifacts/${smallFixtureZip}`;
  const file = Bun.file(fixturePath);
  if (!(await file.exists())) {
    throw new Error(`Fixture not found: ${fixturePath}`);
  }
  const zipData = new Uint8Array(await file.arrayBuffer());
  // Extracted is now an array of JSON strings; parse each string
  const extractedRaw = wasmUnzipper.extract_jsons(zipData);

  // Helper to recursively convert Map to plain object
  function mapToObj(val: any): any {
    if (val instanceof Map) {
      const obj: any = {};
      for (const [k, v] of val.entries()) {
        obj[k] = mapToObj(v);
      }
      return obj;
    } else if (Array.isArray(val)) {
      return val.map(mapToObj);
    }
    return val;
  }

  const extracted = extractedRaw.map(mapToObj);

  // Load the expected output from the new compiled fixture
  const compiledFile = Bun.file(`tests/fixtures/compiled/${smallFixtureCompiled}`);
  if (!(await compiledFile.exists())) {
    throw new Error(`Compiled fixture not found: tests/fixtures/compiled/${smallFixtureCompiled}`);
  }
  const compiledText = await compiledFile.text();
  const expected = JSON.parse(compiledText);

  // Use the custom comparison function to check correctness against the small fixture
  const areEqual = compareJsonArraysUnordered(extracted, expected);
  expect(areEqual).toBe(true);
});
