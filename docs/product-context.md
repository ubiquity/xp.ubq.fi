# Product Context

## Why This Project Exists
Developers need a **minimal, fast, framework-free frontend template** that integrates easily with modern tooling like Bun and esbuild. Additionally, it should support downloading and storing build artifacts for inspection or offline use.

## Problems It Solves
- Avoids heavy frameworks and complex setups.
- Provides a simple way to fetch and store artifact data from CI/CD pipelines or APIs.
- Enables rapid development with Bun's fast runtime and esbuild's bundling.
- Simplifies deployment as static files.

## How It Should Work
- User opens the app in a browser.
- The app fetches a list of artifacts from a backend API.
- The user can trigger download and storage of these artifacts.
- Artifacts are saved in browser storage (IndexedDB).
- The UI remains minimal and responsive.

## User Experience Goals
- **Fast** load and interaction times.
- **Minimalist** UI with no unnecessary complexity.
- **Transparent** artifact handling with clear feedback.
- **Easy to extend** or customize for specific needs.

## Out of Scope
- Rust/WASM features are **not** part of the core product experience.
- No complex UI frameworks or backend logic.
