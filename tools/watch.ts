import * as esbuild from "esbuild";

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  outfile: "dist/bundle.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "esnext",
  sourcemap: true,
  logLevel: "info",
  minify: false,
  banner: {
    js: '// Built: ' + new Date().toISOString()
  }
});

await ctx.watch();
console.log("Watching for changes with esbuild...");

process.on('SIGINT', () => {
  ctx.dispose();
  process.exit(0);
});
