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
- Unblock analytics/timeline work by ensuring artifact data includes timestamp, node_id, and precise URL for every XP event (enriched at build time, not runtime).

## Blockers
- **Timeline and analytics views are currently blocked.**
- The root cause is that artifact data does not include enriched XP event metadata (timestamp, node_id, and precise URL for each XP event).
- The current artifact only points to the parent issue, not the specific comment/PR/etc.
- Fetching this data at runtime is not feasible due to the volume of fetches and the IndexedDB-backed instant analytics requirement.
- The required solution is to enrich artifact data at build time (using the GitHub API) to include all necessary metadata for each XP event.

## Active Decisions
- Focus is on Bun + TypeScript + esbuild + browser APIs, with WASM integration for specific tasks.
- Minimal dependencies and simple architecture.
- All analytics and visualizations must run off IndexedDB-cached data.
- Visualization UI must remain framework-free and minimal.
- All UI work must use only essential CSS, no colors, and only PX units in multiples of 4px. All design/visual interest is in the data visualizations.
