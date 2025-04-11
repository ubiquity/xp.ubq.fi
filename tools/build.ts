import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, existsSync } from "fs";

// Ensure dist/ exists
if (!existsSync("dist")) {
  mkdirSync("dist");
}

// Build main bundle directly to dist/
await esbuild.build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/bundle.js",
  bundle: true,
  format: "esm",
  target: "esnext",
  sourcemap: true,
});

// Build worker bundle directly to dist/
await esbuild.build({
  entryPoints: ["src/workers/artifact-processor.ts"],
  outfile: "dist/artifact-processor.js",
  bundle: true,
  format: "esm",
  target: "esnext",
  sourcemap: true,
});

// Copy static assets as-is
copyFileSync("src/index.html", "dist/index.html");
if (existsSync("src/style.css")) {
  copyFileSync("src/style.css", "dist/style.css");
}

console.log("Build complete: dist/ contains index.html, bundle.js, style.css, and artifact-processor.js");
