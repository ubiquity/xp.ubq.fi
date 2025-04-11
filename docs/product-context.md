# Product Context

## Why This Project Exists
Developers need a **minimal, fast, framework-free frontend template** that integrates easily with modern tooling like Bun and esbuild. Additionally, it should support downloading and processing GitHub artifacts directly in the browser, working around server compute limitations.

## Problems It Solves
- Avoids heavy frameworks and complex setups.
- Provides a simple way to fetch and unzip GitHub artifacts in the browser.
- Enables client-side processing to work around server compute limits.
- Enables rapid development with Bun's fast runtime and esbuild's bundling.
- Simplifies deployment with minimal backend requirements.

## How It Should Work
- User opens the app in a browser.
- Frontend authenticates through Deno Deploy proxy.
- The app fetches a list of artifacts from GitHub.
- User can trigger download of artifact ZIPs.
- Browser unzips artifacts using WASM.
- Processed artifacts are saved in IndexedDB.
- The UI remains minimal and responsive.

## User Experience Goals
- **Fast** load and interaction times.
- **Minimalist** UI with no unnecessary complexity.
- **Transparent** artifact handling with clear feedback.
- **Easy to extend** or customize for specific needs.

## Out of Scope
- No complex UI frameworks.
- No heavy backend processing (limited by Deno Deploy's 50ms compute window).
