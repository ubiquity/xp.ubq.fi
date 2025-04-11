# System Patterns

## Architecture Overview
- **Frontend:** Plain HTML, CSS, and TypeScript.
- **Bundling:** esbuild, invoked via Bun scripts.
- **Package Management & Scripting:** Bun.
- **Artifact Handling:** Fetches JSON data from API, stores in browser IndexedDB.
- **WASM Integration:** Rust code compiled to WASM for specific tasks (e.g., unzipping).
- **Serving:** Minimal static server (Deno or replaceable).

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
1. Fetch list of artifacts from API.
2. For each artifact:
   - Fetch artifact data (JSON).
   - Save as Blob in IndexedDB.
3. Provide feedback in console/UI.

## Design Patterns
- **Separation of concerns:** Download logic, storage logic, and UI kept modular.
- **Minimal dependencies:** Avoid frameworks, use browser APIs.
- **Script-driven build/dev:** Bun scripts manage build and dev flow.

## Out of Scope
- No backend logic beyond static serving.
