# Tech Context

## Core Technologies
- **Bun:** Package manager, runtime, and script runner.
- **esbuild:** Fast bundler for TypeScript and JavaScript.
- **TypeScript:** Main language for app logic.
- **Rust/WASM:** For performance-critical tasks or leveraging Rust libraries.
- **Browser APIs:** Fetch API for network requests, IndexedDB for storage.

## Development Setup
- Use `bun install` to manage dependencies.
- Build with `bun run build`.
- Watch mode with `bun run watch`.
- Dev server with `bun run dev:server`.
- Run all with `bun run all`.
- Tests with `bun test`.

## Technical Constraints
- No frontend frameworks (React, Vue, etc.).
- Minimal dependencies beyond core tooling.
- Backend limited to auth proxy due to Deno Deploy's 50ms compute constraint.
- ZIP processing must happen client-side using WASM.

## Dependencies
- WASM unzipper: Critical for browser-side artifact processing.
- `jose`: For JWT/JWE handling in auth proxy.
- `npm-run-all`: For running multiple scripts concurrently.
- `@types/bun`, `bun-types`: Type definitions.
- `typescript`, `esbuild`: Tooling.

## Environment
- `.env.example` provides environment variable templates.
- Bun automatically loads `.env` files.
