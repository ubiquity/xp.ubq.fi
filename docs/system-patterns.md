# System Patterns

## Architecture Overview
- **Frontend:** Plain HTML, CSS, and TypeScript.
- **Bundling:** esbuild, invoked via Bun scripts.
- **Package Management & Scripting:** Bun.
- **Artifact Handling:** Downloads and unzips GitHub artifacts directly in browser.
- **WASM Integration:** Rust code compiled to WASM for unzipping artifacts.
- **Backend:** Deno Deploy acting strictly as auth proxy due to compute limitations (50ms).

## Key Components
- `src/main.ts`: App entry point.
- `src/download-artifact.ts`: Fetches individual artifact data.
- `src/download-artifacts.ts`: Orchestrates downloading and saving multiple artifacts.
- `src/db/`: IndexedDB setup and access.
- `tools/`: Build, watch, and server scripts (for main app).
- `wasm/`: Contains all WASM-related code:
  - `wasm/wasm-unzipper/`: Rust source for the unzipper WASM module.
  - `wasm/src/`: TypeScript wrappers and helpers for WASM integration.
  - `wasm/tools/`: Build tools specific to WASM components.
  - `wasm/tests/`: Tests for WASM components.

## Artifact Download & Storage Flow
1. Frontend authenticates through Deno Deploy proxy.
2. Frontend fetches list of artifacts from GitHub.
3. For each artifact:
   - Download ZIP through auth proxy.
   - Use WASM to unzip in browser.
   - Store processed data in IndexedDB.
4. Provide feedback in console/UI.

## Design Patterns
- **Separation of concerns:** Download logic, storage logic, and UI kept modular.
- **Minimal dependencies:** Avoid frameworks, use browser APIs.
- **Script-driven build/dev:** Bun scripts manage build and dev flow.

## Out of Scope
- Complex backend operations (limited by Deno Deploy's 50ms compute window).
