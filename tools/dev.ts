import * as esbuild from "esbuild";
import { spawn, exec, ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Simplified logging function
function log(prefix: string, message: string, color = colors.cyan): void {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

// Server process
let serverProcess: ChildProcess | null = null;
let watcherProcess: ChildProcess | null = null;

// Create dist directory
try {
  await mkdir("dist", { recursive: true });
} catch (err) {
  // Directory probably exists already
}

// Kill processes on exit
function cleanup() {
  if (serverProcess) {
    log("CLEANUP", "Stopping server...", colors.yellow);
    serverProcess.kill();
  }

  if (watcherProcess) {
    log("CLEANUP", "Stopping watcher...", colors.yellow);
    watcherProcess.kill();
  }
}

// Set up exit handlers
process.on("SIGINT", () => {
  log("SYSTEM", "Shutting down...", colors.red);
  cleanup();
  process.exit(0);
});

process.on("exit", cleanup);

// Build frontend
log("BUILD", "Building frontend...", colors.magenta);
try {
  // Initial build
  await esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bundle.js",
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "esnext",
    sourcemap: true,
  });

  log("BUILD", "Initial build complete", colors.green);

  // Start watcher
  const ctx = await esbuild.context({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bundle.js",
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "esnext",
    sourcemap: true,
    logLevel: "info",
  });

  ctx.watch();
  log("WATCH", "Frontend file watcher started", colors.blue);

  // Start server watcher for auto-restart
  watcherProcess = exec("bun run tools/watch-server-changes.ts");

  // Safety check for stdout
  if (watcherProcess.stdout) {
    watcherProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(output);

      if (output.includes("SERVER_CHANGE_DETECTED")) {
        log("SERVER", "Detected server changes, restarting...", colors.yellow);

        if (serverProcess) {
          serverProcess.kill();
        }

        log("SERVER", "Starting server...", colors.green);
        serverProcess = spawn("bun", ["run", "tools/server.ts"], {
          stdio: "inherit",
        });
      }
    });
  } else {
    log("ERROR", "Failed to get watcher output stream", colors.red);
  }

  // Start the server initially
  log("SERVER", "Starting server...", colors.green);
  serverProcess = spawn("bun", ["run", "tools/server.ts"], {
    stdio: "inherit",
  });

} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  log("ERROR", `Build failed: ${errorMessage}`, colors.red);
  process.exit(1);
}
