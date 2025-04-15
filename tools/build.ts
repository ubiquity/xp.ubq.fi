import * as esbuild from "esbuild";

const define = {
  __GITHUB_OWNER__: JSON.stringify("ubiquity-os-marketplace"),
  __GITHUB_REPO__: JSON.stringify("text-conversation-rewards"),
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
