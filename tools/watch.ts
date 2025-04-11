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

function logRebuild(name: string, error?: esbuild.BuildFailure) {
  if (error) {
    console.error(`[esbuild] ${name} rebuild failed:`, error.errors?.[0]?.text || error.message);
  } else {
    console.log(`[esbuild] ${name} rebuilt successfully at ${new Date().toLocaleTimeString()}`);
  }
}

// Create context for main bundle
const mainCtx = await esbuild.context({
  ...buildOptions,
  entryPoints: ["src/main.ts"],
  outfile: "dist/bundle.js",
  plugins: [{
    name: "main-rebuild-logger",
    setup(build) {
      build.onEnd(result => {
        if (result.errors.length > 0) {
          logRebuild("main", { errors: result.errors, message: "Build failed" } as any);
        } else {
          logRebuild("main");
        }
      });
    }
  }]
});

// Create context for worker bundle
const workerCtx = await esbuild.context({
  ...buildOptions,
  entryPoints: ["src/workers/artifact-processor.ts"],
  outfile: "dist/artifact-processor.js",
  plugins: [{
    name: "worker-rebuild-logger",
    setup(build) {
      build.onEnd(result => {
        if (result.errors.length > 0) {
          logRebuild("worker", { errors: result.errors, message: "Build failed" } as any);
        } else {
          logRebuild("worker");
        }
      });
    }
  }]
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
