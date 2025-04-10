import { expect, test } from "bun:test";

let wasmUnzipper: any;
let wasmInitialized = false;

async function initWasm() {
  if (!wasmInitialized) {
    wasmUnzipper = await import("../wasm-unzipper/pkg/wasm_unzipper.js");
    await wasmUnzipper.default();
    wasmInitialized = true;
  }
}

const fixtureFiles = [
  "results-ubiquity-os-marketplace.zip",
  "results-ubiquity-os.zip",
  "results-ubiquity.zip",
];

for (const filename of fixtureFiles) {
  test(`Rust WASM unzipper extracts JSONs under 50ms for ${filename}`, async () => {
    await initWasm();

    const fixturePath = `tests/fixtures/artifacts/source/${filename}`;
    const file = Bun.file(fixturePath);
    if (!(await file.exists())) {
      throw new Error(`Fixture not found: ${fixturePath}`);
    }
    const zipData = new Uint8Array(await file.arrayBuffer());

    const t0 = performance.now();
    const jsonArray = wasmUnzipper.extract_jsons(zipData);
    const t1 = performance.now();

    const elapsed = t1 - t0;
    console.log(`${filename}: Rust WASM unzip+parse took ${elapsed.toFixed(2)}ms`);
    console.log(`${filename}: Extracted ${jsonArray.length} JSON files`);

    expect(elapsed).toBeLessThan(50);
    expect(jsonArray.length).toBeGreaterThan(0);
  });
}
