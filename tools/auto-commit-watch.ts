import { spawn } from "node:child_process";
import chokidar from "chokidar";

// Debounce time in ms
const DEBOUNCE_MS = 1000;
let timeout: NodeJS.Timeout | null = null;
let lastCommitTime = 0;

function getTimeString() {
  const now = new Date();
  return now.toTimeString().slice(0, 8); // "HH:MM:SS"
}

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: "inherit" });
    proc.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

async function commitAndPush() {
  const time = getTimeString();
  try {
    await run("git", ["add", "-A"]);
    await run("git", ["commit", "-m", `chore: auto commit ${time}`]);
    await run("git", ["push"]);
    lastCommitTime = Date.now();
    console.log(`[auto-commit-watch] Committed and pushed at ${time}`);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("nothing to commit")
    ) {
      // No changes, ignore
      return;
    }
    console.error("[auto-commit-watch] Error during commit/push:", err);
  }
}

const watcher = chokidar.watch(".", {
  ignored: [
    /(^|[\/\\])\../, // dotfiles and .git
    "node_modules",
    "dist",
    "bun.lock",
    "bunfig.toml",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "tools/auto-commit-watch.ts",
  ],
  ignoreInitial: true,
  persistent: true,
});

console.log("[auto-commit-watch] Watching for file changes...");

watcher.on("all", () => {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(commitAndPush, DEBOUNCE_MS);
});
