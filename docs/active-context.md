# Active Context

## Recent Changes
- Removed misleading references to ZIP files in artifact download code.
- Renamed `download-artifact-zip.ts` to `download-artifact.ts`.
- Updated imports accordingly.
- Enabled and fixed the artifact download test.
- Updated project name and README to reflect Bun + esbuild + TypeScript focus.
- Modified `wasm-unzipper.test.ts` to use a smaller fixture (`small-test-fixture.zip`) to prevent client crashes due to excessive data processing.
- Reorganized all WASM-related code (Rust source, TS helpers, tools, tests) into a dedicated `wasm/` directory structure.
- Updated `package.json` build script for the new WASM path.
- Refactored `wasm/src/wasm-unzipper-embedded.ts` into smaller modules (`wasm-helpers.ts`) to improve organization.

## Current Focus
- Maintain a minimal, framework-free frontend app.
- Support artifact download and storage using browser APIs.
- Keep build/dev flow simple with Bun and esbuild.
- Ensure tests cover artifact download logic.
- Ensure tests for the `wasm-unzipper` component are robust, including handling potential order variations in JSON output.
- Integrate WASM components effectively into the frontend workflow.

## Next Steps
- Improve UI/UX for artifact management if needed.
- Add more tests for edge cases.
- Optimize build/dev scripts if necessary.

## Active Decisions
- Focus is on Bun + TypeScript + esbuild + browser APIs, with WASM integration for specific tasks.
- Minimal dependencies and simple architecture.
