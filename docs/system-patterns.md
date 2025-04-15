# System Patterns

## Architecture Overview
- **Frontend:** Plain HTML, CSS, and TypeScript.
- **Bundling:** esbuild, invoked via Bun scripts.
- **Package Management & Scripting:** Bun.
- **Artifact Handling:** Downloads the single `final-aggregated-results.zip` artifact from GitHub and unzips it directly in the browser using JavaScript (`fflate`).
- **Backend:** Deno Deploy acting strictly as auth proxy for GitHub API calls (artifact list/metadata). Direct artifact downloads use GitHub URLs.

## Key Components
- `src/main.ts`: App entry point.
- `src/download-artifacts.ts`: Fetches metadata for, downloads, and orchestrates processing of the single `final-aggregated-results.zip` artifact.
- `src/unzip-artifact.ts`: Unzips the artifact ZIP using `fflate` and extracts/parses `aggregated_results.json`.
- `src/data-transform.ts`: Transforms the parsed artifact data into the nested format required for analytics.
- `src/db/`: IndexedDB setup and access for caching transformed data.
- `tools/`: Build, watch, and server scripts (for main app).

## Artifact Download & Storage Flow
1. Frontend determines the target GitHub Actions `runId`.
2. Frontend fetches metadata for the `final-aggregated-results` artifact for that run via GitHub API (using auth proxy if needed).
3. Frontend downloads the artifact ZIP directly from GitHub's `archive_download_url` (requires auth header).
4. Use JavaScript (`fflate`) to unzip the downloaded data in the browser/worker.
5. Extract and parse the `aggregated_results.json` file content.
6. Transform the parsed array data into the nested `OrgRepoData` structure.
7. Store the transformed data in IndexedDB, keyed by `runId`.
8. Provide feedback in console/UI.

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
