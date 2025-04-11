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

Promise.all([mainBuild, workerBuild])
  .then(() => {
    console.log("Build complete (main + worker)");
  })
  .catch(console.error);
