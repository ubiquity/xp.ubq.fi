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
- Implement developer performance analytics visualizations (leaderboard, time series) with IndexedDB-backed instant data loading.

## Next Steps
- Enhance UI feedback during ZIP processing.
- Optimize WASM memory usage for large artifacts.
- Add progress indicators for download/unzip operations.
- Implement error recovery for failed unzip operations.
- Build leaderboard and time series views for contributor XP analytics.
- Refine IndexedDB caching for instant analytics UI.

## Active Decisions
- Focus is on Bun + TypeScript + esbuild + browser APIs, with WASM integration for specific tasks.
- Minimal dependencies and simple architecture.
- All analytics and visualizations must run off IndexedDB-cached data.
- Visualization UI must remain framework-free and minimal.
- All UI work must use only essential CSS, no colors, and only PX units in multiples of 4px. All design/visual interest is in the data visualizations.
