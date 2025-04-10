# System Patterns

## Architecture Overview
- **Frontend:** Plain HTML, CSS, and TypeScript.
- **Bundling:** esbuild, invoked via Bun scripts.
- **Package Management & Scripting:** Bun.
- **Artifact Handling:** Fetches JSON data from API, stores in browser IndexedDB.
- **Serving:** Minimal static server (Deno or replaceable).

## Key Components
- `src/main.ts`: App entry point.
- `src/download-artifact.ts`: Fetches individual artifact data.
- `src/download-artifacts.ts`: Orchestrates downloading and saving multiple artifacts.
- `src/db/`: IndexedDB setup and access.
- `tools/`: Build, watch, and server scripts.

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
- Rust/WASM components are **not** part of this architecture.
- No backend logic beyond static serving.
