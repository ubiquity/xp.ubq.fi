// Script to read the WASM file and output a base64 encoded string

const wasmPath = "wasm-unzipper/pkg/wasm_unzipper_bg.wasm";
const wasmFile = Bun.file(wasmPath);

async function main() {
  if (!(await wasmFile.exists())) {
    console.error(`WASM file not found at: ${wasmPath}`);
    process.exit(1);
  }

  // Read the WASM file as an ArrayBuffer
  const wasmBuffer = await wasmFile.arrayBuffer();

  // Convert to base64
  const base64Wasm = Buffer.from(wasmBuffer).toString('base64');

  console.log(`// Base64 encoded WASM: ${wasmPath}`);
  console.log(`export const wasmBase64 = "${base64Wasm}";`);
}

main().catch(err => {
  console.error("Error processing WASM file:", err);
  process.exit(1);
});
