import { watch } from "node:fs";
import { resolve } from "node:path";

console.log("Starting server file watcher...");

// Files and directories to watch for server changes
const watchPaths = [
  "tools/server.ts",
  "deno/artifact-proxy.ts",
  "src/db",
  "src/download-artifact.ts",
  "src/download-artifacts.ts",
  "src/fetch-artifacts-list.ts",
  "src/github-auth.ts",
  "src/unzip-artifact.ts",
  "src/utils.ts",
  "wasm/src"
];

// Set up watchers for each path
watchPaths.forEach(path => {
  console.log(`Watching: ${path}`);

  watch(path, { recursive: true }, () => {
    console.log("SERVER_CHANGE_DETECTED");
  });
});

// Keep the process alive
setInterval(() => {}, 1000);
