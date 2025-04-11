# Active Context

## Recent Changes
- Major architectural change: shifted artifact unzipping to client-side due to Deno Deploy's 50ms compute limit.
- Backend now acts solely as an auth proxy for GitHub artifacts.
- Frontend handles direct artifact ZIP downloads and processing.
- WASM unzipper component now critical for browser-side artifact processing.
- Updated documentation to reflect new architecture and responsibilities.

## Current Focus
- Maintain minimal framework-free frontend with enhanced client-side capabilities.
- Optimize WASM unzipper for efficient browser-side processing.
- Keep auth proxy lightweight within Deno Deploy constraints.
- Ensure robust error handling for ZIP processing.
- Support direct GitHub artifact integration.
- Maintain efficient IndexedDB storage patterns.

## Next Steps
- Enhance UI feedback during ZIP processing.
- Optimize WASM memory usage for large artifacts.
- Add progress indicators for download/unzip operations.
- Implement error recovery for failed unzip operations.

## Active Decisions
- Focus is on Bun + TypeScript + esbuild + browser APIs, with WASM integration for specific tasks.
- Minimal dependencies and simple architecture.
