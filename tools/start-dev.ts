#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { build } from "esbuild";

// Ensure dist directory exists
try {
  // Use fs/promises instead of Bun.mkdir
  const { mkdir } = await import("node:fs/promises");
  await mkdir("dist", { recursive: true });
} catch {
  // Directory already exists, ignore
}

// Build frontend once before starting
console.log("📦 Building frontend...");
try {
  await build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bundle.js",
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "esnext",
    sourcemap: true,
  });
  console.log("✅ Frontend built successfully");
} catch (error) {
  console.error("❌ Frontend build failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}

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

// Open browser after short delay to ensure server is ready
setTimeout(() => {
  console.log("🌐 Opening browser...");
  openURL(url);
}, 1000);

// Watch frontend with esbuild (non-blocking)
console.log("👀 Watching frontend files...");
spawn("bun", ["run", "tools/watch.ts"], {
  stdio: "inherit",
  detached: true
});

console.log("\n✨ Development environment ready!");
console.log("   Press Ctrl+C to stop\n");
