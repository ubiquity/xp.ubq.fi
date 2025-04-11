
import * as esbuild from "esbuild";

// Build main bundle
const mainBuild = esbuild.build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/bundle.js",
  bundle: true,
  format: "esm",
  target: "esnext",
  sourcemap: true,
});

// Build worker bundle
const workerBuild = esbuild.build({
  entryPoints: ["src/workers/artifact-processor.ts"],
  outfile: "dist/artifact-processor.js",
  bundle: true,
  format: "esm",
  target: "esnext",
  sourcemap: true,
});

import { copyFileSync, mkdirSync, existsSync } from "fs";

// Ensure dist/ exists
if (!existsSync("dist")) {
  mkdirSync("dist");
}

// Copy static assets
copyFileSync("src/index.html", "dist/index.html");
if (existsSync("src/style.css")) {
  copyFileSync("src/style.css", "dist/style.css");
}

Promise.all([mainBuild, workerBuild])
  .then(() => {
    console.log("Build complete (main + worker + static assets)");
  })
  .catch(console.error);
