# Minimal Bun + esbuild + Deno Deploy Template

A minimal starter template for building frontend apps with **HTML**, **CSS**, and **TypeScript**, bundled with **esbuild**, and served via **Deno** — ready for serverless deployment.

---

## Features

- Plain HTML, CSS, and TypeScript (no frameworks)
- Fast bundling with esbuild
- Bun for scripting and package management
- Minimal Deno static file server
- Compatible with Deno Deploy

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
  index.html       # Main HTML file
  style.css        # Styles
  main.ts          # Entry TypeScript file

tools/
  build.ts         # esbuild bundler script
  watch.ts         # esbuild watch mode
  server.ts        # Deno static file server
```

---

## Deployment

- Bundle your app with `bun run build`.
- Deploy `dist/` and `src/` with your preferred static hosting or Deno Deploy.
- The `tools/server.ts` can be adapted for serverless environments.

---

## License

MIT
