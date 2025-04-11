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

## Analytics & Visualization Patterns
- **IndexedDB-backed analytics:** All performance analytics and visualizations run off data cached in IndexedDB for instant UI load.
- **Modular architecture:** Data transformation utilities, visualization modules (leaderboard and time series charts), and UI controls are separated for maintainability.
- **Minimal, dependency-free charting:** Charts are rendered using SVG or Canvas directly in TypeScript. If a library is needed, only minimal, framework-free options (e.g., uPlot, Chart.js via CDN) are considered.
- **Extensible UI:** Visualization UI is designed to be minimal, responsive, and easy to extend, following the project's framework-free philosophy.

## UI & CSS Constraints
- Absolutely minimal CSS: only what is strictly necessary for layout and usability.
- No colors, no custom fonts, no visual embellishments.
- All spacing, sizing, and layout units must be in PX, and only in multiples of 4px (e.g., 4px, 8px, 12px, 16px, etc.).
- All design/visual interest will be in the data visualizations themselves, not in the layout or UI.

## Out of Scope
- Complex backend operations (limited by Deno Deploy's 50ms compute window).
