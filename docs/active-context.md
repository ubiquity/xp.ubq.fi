# Active Context

## Recent Changes
- Major architectural change: shifted artifact unzipping to client-side due to Deno Deploy's 50ms compute limit.
- Backend now acts solely as an auth proxy for GitHub API calls.
- Frontend handles direct artifact ZIP downloads (`final-aggregated-results.zip`) and processing.
- Switched from WASM to JavaScript (`fflate`) for browser-side artifact unzipping.
- Implemented data transformation for the new aggregated artifact format.
- Updated documentation to reflect new architecture and responsibilities.
- Refactored dev mode widget: now appends its content to itself (the custom element) and is instantiated via the `<dev-mode-widget>` tag in HTML, not programmatically.
- Exception: Fallback and defensive logic is retained for developer tools to ensure graceful adaptation during development.

## Current Focus
- Maintain minimal framework-free frontend with enhanced client-side capabilities.
- Ensure performant JS-based unzipping and JSON parsing, especially for large artifacts.
- Keep auth proxy lightweight within Deno Deploy constraints.
- Ensure robust error handling for the entire artifact download/unzip/parse/transform pipeline.
- Support direct GitHub artifact integration using `archive_download_url`.
- Maintain efficient IndexedDB storage patterns for transformed data.
- Implement developer performance analytics visualizations (leaderboard, time series) using the new, enriched data.

## Next Steps
- Enhance UI feedback during download/unzip/parse operations.
- Add progress indicators for download/unzip/parse operations.
- Implement comprehensive testing for JS unzip/parse (edge cases, errors).
- Build leaderboard and time series views for contributor XP analytics.
- Refine IndexedDB caching strategy for instant analytics UI.

## Blockers
- None currently. The data model upgrade has unblocked analytics implementation.

## Active Decisions
- Focus is on Bun + TypeScript + esbuild + browser APIs. JS libraries (`fflate`) used for specific tasks like unzipping.
- Minimal dependencies and simple architecture.
- All analytics and visualizations must run off IndexedDB-cached data.
- Visualization UI must remain framework-free and minimal.
- All UI work must use only essential CSS, no colors, and only PX units in multiples of 4px. All design/visual interest is in the data visualizations.
- Developer tools (dev mode widget) are allowed to retain fallback and defensive logic as an explicit exception to the general rule of failing on invalid/missing data.
