#!/usr/bin/env bun

import { build, type BuildOptions } from "esbuild";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

// Ensure dist directory exists
try {
  // Use fs/promises instead of Bun.mkdir
  const { mkdir } = await import("node:fs/promises");
  await mkdir("dist", { recursive: true });
} catch {
  // Directory already exists, ignore
}

const mainBuildOptions: BuildOptions = {
  entryPoints: ["src/main.ts"],
  outfile: "dist/bundle.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "esnext",
  sourcemap: true,
};

const workerBuildOptions: BuildOptions = {
  entryPoints: ["src/workers/artifact-processor.ts"],
  outfile: "dist/artifact-processor.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "esnext",
  sourcemap: true,
};

const BUILD_TIMEOUT_MS = 30000; // 30 seconds

async function runBuildWithTimeout(options: BuildOptions, label: string): Promise<void> {
  const buildPromise = build(options);
  const timeoutPromise = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} build timed out after ${BUILD_TIMEOUT_MS / 1000} seconds`)), BUILD_TIMEOUT_MS)
  );
  await Promise.race([buildPromise, timeoutPromise]);
}

async function cleanAndReinstall() {
  console.warn("🧹 Cleaning node_modules and bun.lock...");
  try {
    if (existsSync("node_modules")) {
      await rm("node_modules", { recursive: true, force: true });
    }
    if (existsSync("bun.lock")) {
      await rm("bun.lock", { force: true });
    }
    console.log("✅ Cleaned successfully.");
  } catch (err) {
    console.error("❌ Failed to clean:", err);
    // Continue anyway, maybe install will fix it
  }

  console.log("📦 Reinstalling dependencies with bun install...");
  await new Promise<void>((resolve, reject) => {
    const installProcess = spawn("bun", ["install"], { stdio: "inherit" });
    installProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Dependencies reinstalled successfully.");
        resolve();
      } else {
        reject(new Error(`bun install failed with code ${code}`));
      }
    });
    installProcess.on("error", (err) => {
      reject(new Error(`Failed to start bun install: ${err.message}`));
    });
  });
}

// Build frontend with retry logic
async function buildFrontendWithRetry() {
  let attempt = 1;
  while (attempt <= 2) {
    console.log(`📦 Building frontend (Attempt ${attempt})...`);
    try {
      await runBuildWithTimeout(mainBuildOptions, "Main bundle");
      await runBuildWithTimeout(workerBuildOptions, "Worker bundle");
      console.log("✅ Frontend and worker built successfully");
      return; // Success
    } catch (error) {
      console.error(`❌ Frontend build failed (Attempt ${attempt}):`, error instanceof Error ? error.message : String(error));
      if (attempt === 1) {
        console.warn("⚠️ Build failed, attempting recovery...");
        try {
          await cleanAndReinstall();
        } catch (reinstallError) {
          console.error("❌ Recovery failed during reinstall:", reinstallError);
          // Exit if reinstall fails
          process.exit(1);
        }
      } else {
        console.error("❌ Build failed after retry. Exiting.");
        process.exit(1);
      }
    }
    attempt++;
  }
}

await buildFrontendWithRetry();

// Function to open URL - not using Bun.serve to avoid the hanging problem
function openURL(url: string) {
  const command = process.platform === "darwin" ? "open" :
                  process.platform === "win32" ? "start" : "xdg-open";
  return spawn(command, [url], { stdio: "ignore" });
}

// Start the server
const url = "http://localhost:3000?run=test";
console.log("🚀 Starting server on:", url);

// We'll use exec for cleaner output
const server = spawn("bun", ["--watch", "tools/server.ts"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: "3000"
  }
});

// Handle process exit
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down...");
  server.kill();
  process.exit(0);
});

// Browser opening disabled to prevent auto-opening on every run


console.log("\n✨ Development environment ready!");
console.log("   Press Ctrl+C to stop\n");
