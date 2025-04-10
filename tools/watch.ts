import * as esbuild from "esbuild";

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  outfile: "dist/bundle.js",
  bundle: true,
  format: "esm",
  target: "esnext",
  sourcemap: true,
});

await ctx.watch();
console.log("Watching for changes with esbuild...");
