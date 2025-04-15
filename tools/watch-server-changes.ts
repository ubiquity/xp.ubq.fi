import { globSync } from "glob";
import { watch } from "node:fs";

console.log("Starting server file watcher...");

// Find all TypeScript files in the project
const watchPaths = globSync("**/*.ts", {
  ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
});

console.log("Watching TypeScript files:");
watchPaths.forEach((path: string) => console.log(`  ${path}`));

// Set up a single watcher for the project directory
watch(".", { recursive: true }, (_: unknown, filename: string | null) => {
  if (filename && filename.endsWith(".ts")) {
    console.log("SERVER_CHANGE_DETECTED");
  }
});

// Keep the process alive
setInterval(() => {}, 1000);
