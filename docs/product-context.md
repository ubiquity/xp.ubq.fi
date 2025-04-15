# Product Context

## Why This Project Exists
Developers need a **minimal, fast, framework-free frontend template** that integrates easily with modern tooling like Bun and esbuild. Additionally, it should support downloading and processing GitHub artifacts directly in the browser, working around server compute limitations.

## Problems It Solves
- Avoids heavy frameworks and complex setups.
- Provides a simple way to fetch and unzip GitHub artifacts in the browser.
- Enables client-side processing to work around server compute limits.
- Enables rapid development with Bun's fast runtime and esbuild's bundling.
- Simplifies deployment with minimal backend requirements.
- Provides actionable developer analytics without backend compute.

## How It Should Work
- User opens the app in a browser.
- Frontend authenticates through Deno Deploy proxy.
- The app fetches a list of artifacts from GitHub.
- User can trigger download of artifact ZIPs.
- Browser unzips artifacts using WASM.
- Processed artifacts are saved in IndexedDB.
- Display developer performance analytics (leaderboard, time series) instantly from IndexedDB-cached data.
- The UI remains minimal and responsive.

## User Experience Goals
- **Fast** load and interaction times.
- **Minimalist** UI with no unnecessary complexity.
- **Transparent** artifact handling with clear feedback.
- **Easy to extend** or customize for specific needs.
- Instant analytics and visualizations; clear, interactive insights for contributors.
- All UI will use only essential CSS, no colors, and only PX units in multiples of 4px.

## UI & CSS Constraints
- Absolutely minimal CSS: only what is strictly necessary for layout and usability.
- No colors, no custom fonts, no visual embellishments.
- All spacing, sizing, and layout units must be in PX, and only in multiples of 4px (e.g., 4px, 8px, 12px, 16px, etc.).
- All design/visual interest will be in the data visualizations themselves, not in the layout or UI.

## Out of Scope
- No complex UI frameworks.
- No heavy backend processing (limited by Deno Deploy's 50ms compute window).
