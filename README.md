# Minimal Bun + esbuild Frontend Template

A minimal starter template for building frontend apps with **HTML**, **CSS**, and **TypeScript**, bundled with **esbuild**, and managed with **Bun**. Includes artifact download and storage functionality.

---

## Features

- Plain HTML, CSS, and TypeScript (no frameworks)
- Fast bundling with esbuild
- Bun for scripting and package management
- Minimal static file server (using Deno or can be replaced)
- Artifact download and storage system

---

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Build the frontend

```bash
bun run build
```

### 3. Start development server

In separate terminals, run:

```bash
bun run watch
```

and

```bash
bun run dev:server
```

Or run all at once:

```bash
bun run all
```

### 4. Open in browser

Navigate to the URL printed by the server (e.g., `http://localhost:PORT`).

---

## Project Structure

```
src/
  index.html                 # Main HTML file
  style.css                  # Styles
  main.ts                    # Entry TypeScript file
  download-artifact.ts       # Fetches artifact data (JSON)
  download-artifacts.ts      # Orchestrates artifact download and storage
  fetch-artifacts-list.ts    # Fetches list of artifacts
  github-auth.ts             # GitHub authentication helpers
  utils.ts                   # Utility functions
  types.ts                   # Shared types

  db/
    db-constants.ts          # DB constants
    get-artifact.ts          # Retrieve artifacts from storage
    get-db.ts                # IndexedDB setup
    save-artifact.ts         # Save artifacts to storage

tools/
  build.ts                   # esbuild bundler script
  watch.ts                   # esbuild watch mode
  server.ts                  # Static file server (Deno or replaceable)
  dev-server.ts              # Dev server script

tests/
  download-artifacts.test.ts # Tests for artifact download flow
```

---

## Deployment

- Bundle your app with `bun run build`.
- Deploy the output with your preferred static hosting.
- The `tools/server.ts` can be adapted or replaced for serverless/static hosting.

---

## License

MIT
