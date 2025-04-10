import * as esbuild from "esbuild";

esbuild.build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/bundle.js",
  bundle: true,
  format: "esm",
  target: "esnext",
  sourcemap: true,
}).then(() => {
  console.log("Build complete");
}).catch((err) => {
  console.error(err);
});
