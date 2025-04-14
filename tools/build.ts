import * as esbuild from "esbuild";

// Read environment variables for define
const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "";
// __GITHUB_TOKEN__ is deprecated, but if still referenced, set to empty string
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

// Shared define for both bundles
const define = {
  __GITHUB_OWNER__: JSON.stringify(GITHUB_OWNER),
  __GITHUB_REPO__: JSON.stringify(GITHUB_REPO),
  __GITHUB_TOKEN__: JSON.stringify(GITHUB_TOKEN),
};

// Build main bundle
const mainBuild = esbuild.build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/bundle.js",
  bundle: true,
  format: "esm",
  target: "esnext",
  sourcemap: true,
  define,
});

// Build worker bundle
const workerBuild = esbuild.build({
  entryPoints: ["src/workers/artifact-processor.ts"],
  outfile: "dist/artifact-processor.js",
  bundle: true,
  format: "esm",
  target: "esnext",
  sourcemap: true,
  define,
});

Promise.all([mainBuild, workerBuild])
  .then(() => {
    console.log("Build complete (main + worker)");
  })
  .catch(console.error);
