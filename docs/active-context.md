# Active Context

## Recent Changes
- Removed misleading references to ZIP files in artifact download code.
- Renamed `download-artifact-zip.ts` to `download-artifact.ts`.
- Updated imports accordingly.
- Enabled and fixed the artifact download test.
- Updated project name and README to reflect Bun + esbuild + TypeScript focus.
- Ignored all Rust/WASM-related code and tests as out of scope.

## Current Focus
- Maintain a minimal, framework-free frontend app.
- Support artifact download and storage using browser APIs.
- Keep build/dev flow simple with Bun and esbuild.
- Ensure tests cover artifact download logic.

## Next Steps
- Improve UI/UX for artifact management if needed.
- Add more tests for edge cases.
- Optimize build/dev scripts if necessary.
- Keep ignoring Rust/WASM components unless explicitly re-scoped.

## Active Decisions
- Rust/WASM is **not** part of the current project scope.
- Focus is on Bun + TypeScript + esbuild + browser APIs.
- Minimal dependencies and simple architecture.
