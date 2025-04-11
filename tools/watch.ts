import * as esbuild from "esbuild";
import type { BuildOptions } from "esbuild";

// Shared build options
const buildOptions: BuildOptions = {
  bundle: true,
  format: "esm" as const,
  platform: "browser",
  target: "esnext",
  sourcemap: true,
  logLevel: "info",
  minify: false,
  banner: {
    js: '// Built: ' + new Date().toISOString()
  }
};

// Create context for main bundle
const mainCtx = await esbuild.context({
  ...buildOptions,
  entryPoints: ["src/main.ts"],
  outfile: "dist/bundle.js",
});

// Create context for worker bundle
const workerCtx = await esbuild.context({
  ...buildOptions,
  entryPoints: ["src/workers/artifact-processor.ts"],
  outfile: "dist/artifact-processor.js",
});

// Start watching both bundles
await Promise.all([
  mainCtx.watch(),
  workerCtx.watch()
]);

console.log("Watching for changes with esbuild (main + worker)...");

// Clean up both contexts on exit
process.on('SIGINT', () => {
  mainCtx.dispose();
  workerCtx.dispose();
  process.exit(0);
});
