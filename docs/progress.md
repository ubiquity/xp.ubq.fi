# Progress

## What Works
- Bun + esbuild build and dev environment.
- Minimal frontend app with HTML, CSS, and TypeScript.
- Fetching list of artifacts from API.
- Downloading and storing artifact JSON data in IndexedDB.
- Artifact download test is enabled and passing.
- Clean separation from Rust/WASM components.

## What's Left to Build
- Improve UI for managing and viewing artifacts.
- Add more tests for error handling and edge cases.
- Optimize build/dev scripts if needed.
- Optional: Deployment automation or serverless integration.

## Known Issues
- No UI for browsing stored artifacts yet.
- Error handling could be more robust.
- No integration with real backend API (if applicable).

## Current Status
The project is a clean, minimal Bun + esbuild + TypeScript frontend with working artifact download and storage. Rust/WASM components are ignored and out of scope.
