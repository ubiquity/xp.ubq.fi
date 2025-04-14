import { readdir, stat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ORG, REPO } from "../src/constants.ts";
import { getInstallationToken } from "../src/github-auth.ts";

// Terminal colors for better visibility
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Helper for colored logging
function log(tag: string, message: string, color = colors.cyan) {
  console.log(`${color}[${tag}]${colors.reset} ${message}`);
}

// Performance tracking
const perfMarkers: Record<string, number> = {};

function startTimer(id: string) {
  perfMarkers[id] = performance.now();
  return perfMarkers[id];
}

function endTimer(id: string, logMessage = "") {
  const end = performance.now();
  const start = perfMarkers[id] || end;
  const duration = end - start;
  if (logMessage) {
    log("PERF", `${logMessage}: ${duration.toFixed(2)}ms`, colors.magenta);
  }
  return duration;
}

// Ensure files exist with proper error reporting
async function ensureFileExists(path: string): Promise<boolean> {
  try {
    const fileStat = await stat(path);
    return fileStat.isFile();
  } catch (err) {
    return false;
  }
}

async function fetchArtifactsListFromGitHub(runId: string) {
  startTimer("fetchArtifactsList");
  log("API", `Fetching artifacts list for run ID: ${runId}`, colors.blue);

  const token = await getInstallationToken();
  const url = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${runId}/artifacts`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    log("API", `Found ${data.artifacts.length} artifacts`, colors.green);
    endTimer("fetchArtifactsList", "Fetched artifacts list");
    return data.artifacts;
  } catch (error) {
    log("ERROR", `Failed to fetch artifacts: ${error.message}`, colors.red);
    throw error;
  }
}

// Create JSON responses with consistent format
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

// Configure server port - use 3000 as default
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    log("REQUEST", `${req.method} ${pathname}${url.search}`, colors.bright);

    // API: Download artifact
    if (pathname.startsWith("/api/download-artifact")) {
      const artifactId = url.searchParams.get("id");
      if (!artifactId) {
        return jsonResponse({ error: "Missing id parameter" }, 400);
      }

      try {
        startTimer("downloadArtifact");
        log("ZIP", `Downloading artifact: ${artifactId}`, colors.blue);

        let zipData: Uint8Array;

        // For test mode, serve from fixtures
        const runParam = url.searchParams.get("run");
        if (runParam === "test" || (runParam === "mini" && artifactId === "small-test-fixture")) {
          log("ZIP", `Using fixture for: ${artifactId} (run=${runParam})`, colors.yellow);

          const fixturesPath = resolve(process.cwd(), "tests/fixtures/artifacts");
          // For mini mode, always serve small-test-fixture.zip regardless of artifactId
          const zipName = runParam === "mini" ? "small-test-fixture.zip" : `${artifactId}.zip`;
          const zipPath = join(fixturesPath, zipName);

          log("ZIP", `Looking for fixture at: ${zipPath}`, colors.yellow);

          if (!(await ensureFileExists(zipPath))) {
            throw new Error(`Fixture not found: ${zipPath}`);
          }

          const file = Bun.file(zipPath);
          zipData = new Uint8Array(await file.arrayBuffer());
          log("ZIP", `Loaded fixture, size: ${zipData.length} bytes`, colors.green);
        } else {
          // Get from GitHub directly
          log("ZIP", `Fetching from GitHub: ${artifactId}`, colors.blue);
          const token = await getInstallationToken();
          const artifactUrl = `https://api.github.com/repos/${ORG}/${REPO}/actions/artifacts/${artifactId}/zip`;

          const ghRes = await fetch(artifactUrl, {
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${token}`,
            },
          });

          if (!ghRes.ok) {
            throw new Error(`GitHub API error: ${ghRes.status} ${ghRes.statusText}`);
          }

          const buffer = await ghRes.arrayBuffer();
          zipData = new Uint8Array(buffer);
          log("ZIP", `Downloaded from GitHub, size: ${zipData.length} bytes`, colors.green);
        }

        endTimer("downloadArtifact", "Downloaded artifact");

        // Verify ZIP signature for debugging purposes
        const isValidZip =
          zipData[0] === 0x50 &&
          zipData[1] === 0x4b &&
          zipData[2] === 0x03 &&
          zipData[3] === 0x04;

        if (!isValidZip) {
          log("ZIP", "WARNING: Invalid ZIP file signature", colors.red);
        } else {
          log("ZIP", "Valid ZIP signature detected", colors.green);
        }

        // Return raw ZIP data with proper headers for browser processing
        return new Response(zipData, {
          status: 200,
          headers: {
            "content-type": "application/zip",
            "content-length": zipData.length.toString(),
            "access-control-allow-origin": "*",
            "content-disposition": `attachment; filename="${artifactId}.zip"`,
          },
        });
      } catch (error) {
        log("ERROR", `Failed to download artifact: ${error.message}`, colors.red);
        return jsonResponse({ error: error.message }, 500);
      }
    }

    // API: Get artifacts list
    if (pathname.startsWith("/api/artifacts")) {
      const runId = url.searchParams.get("runId");
      if (!runId) {
        return jsonResponse({ error: "Missing runId parameter" }, 400);
      }

      try {
        startTimer("getArtifactsList");

        if (runId === "test") {
          log("API", "Using test fixtures for artifacts list", colors.yellow);
          const dirPath = resolve(process.cwd(), "tests/fixtures/artifacts");
          const entries = await readdir(dirPath);

          const artifacts = entries
            .filter(name => name.endsWith(".zip"))
            .map(name => ({
              id: name.replace(".zip", ""),
              name: name.replace(".zip", ""),
              archive_download_url: "",
            }));

          log("API", `Found ${artifacts.length} test artifacts`, colors.green);
          endTimer("getArtifactsList", "Retrieved test artifacts list");
          return jsonResponse({ artifacts });
        } else {
          const artifacts = await fetchArtifactsListFromGitHub(runId);
          return jsonResponse({ artifacts });
        }
      } catch (error) {
        log("ERROR", `Failed to fetch artifacts list: ${error.message}`, colors.red);
        return jsonResponse({ error: error.message }, 500);
      }
    }

    // Static file serving
    if (pathname.startsWith("/tests/fixtures/artifacts/")) {
      try {
        const filePath = resolve(process.cwd(), "." + pathname);
        log("STATIC", `Serving fixture: ${filePath}`, colors.blue);

        if (await ensureFileExists(filePath)) {
          const file = Bun.file(filePath);
          const arrayBuffer = await file.arrayBuffer();
          const contentType = pathname.endsWith(".zip")
            ? "application/zip"
            : "application/octet-stream";

          log("STATIC", `Serving file: ${pathname} (${arrayBuffer.byteLength} bytes)`, colors.green);

          const headers = new Headers({
            "Content-Type": contentType,
            "Content-Length": arrayBuffer.byteLength.toString(),
            "Access-Control-Allow-Origin": "*",
          });

          return new Response(arrayBuffer, { headers });
        } else {
          log("STATIC", `File not found: ${pathname}`, colors.red);
          return new Response("404 Not Found", { status: 404 });
        }
      } catch (error) {
        log("ERROR", `Error serving static file: ${error.message}`, colors.red);
        return new Response("500 Internal Server Error", { status: 500 });
      }
    }

    // Map paths to files
    let filePath = "";

    if (pathname === "/" || pathname === "/index.html") {
      filePath = resolve(process.cwd(), "src/index.html");
    } else if (pathname === "/bundle.js") {
      filePath = resolve(process.cwd(), "dist/bundle.js");
    } else if (pathname === "/artifact-processor.js") {
      filePath = resolve(process.cwd(), "dist/artifact-processor.js");
    } else if (pathname === "/style.css") {
      // Prefer dist/style.css if present, fallback to src/style.css
      const distCss = resolve(process.cwd(), "dist/style.css");
      const srcCss = resolve(process.cwd(), "src/style.css");
      filePath = (await ensureFileExists(distCss)) ? distCss : srcCss;
    } else if (pathname.startsWith("/dist/")) {
      filePath = resolve(process.cwd(), "." + pathname);
    } else if (pathname.startsWith("/src/")) {
      filePath = resolve(process.cwd(), "." + pathname);
    } else if (pathname.startsWith("/api/")) {
      // Unknown API route
      log("API", `Unknown API route: ${pathname}`, colors.red);
      return jsonResponse({ error: "API route not found" }, 404);
    } else if (pathname.endsWith('.map')) {
      // Source maps should 404 if not found
      filePath = resolve(process.cwd(), "." + pathname);
    } else {
      // Only use SPA fallback for navigation paths (no extension)
      if (pathname.includes('.')) {
        log("STATIC", `Not found: ${pathname}`, colors.red);
        return new Response("404 Not Found", { status: 404 });
      }
      // SPA fallback for client-side routing
      filePath = resolve(process.cwd(), "src/index.html");
    }

    try {
      if (await ensureFileExists(filePath)) {
        const file = Bun.file(filePath);
        const contentType = getContentType(filePath);

        log("STATIC", `Serving: ${filePath} (${contentType})`, colors.green);

        return new Response(file, {
          headers: {
            "content-type": contentType,
            "access-control-allow-origin": "*",
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
          },
        });
      } else {
        log("STATIC", `File not found: ${filePath}`, colors.red);
        return new Response("404 Not Found", { status: 404 });
      }
    } catch (error) {
      log("ERROR", `Error serving file: ${error.message}`, colors.red);
      return new Response("500 Internal Server Error", { status: 500 });
    }
  },
});

const url = `http://localhost:${server.port}`;
log("SERVER", `Running on ${url}`, colors.green);

// Open browser only on first run
(async () => {
  const markerFile = '.browser-opened';

  try {
    if (!(await ensureFileExists(markerFile))) {
      log("BROWSER", "Opening browser with test run", colors.bright);

      const openUrl = `${url}?run=test`;
      const openCommand =
        process.platform === "darwin" ? "open" :
        process.platform === "win32" ? "start" :
        "xdg-open";

      Bun.spawn([openCommand, openUrl]);
      await Bun.write(markerFile, 'opened');
    }
  } catch (e) {
    log("BROWSER", `Failed to open browser: ${e.message}`, colors.red);
  }
})();

// Cleanup marker file on exit
const cleanup = async () => {
  try {
    if (await ensureFileExists('.browser-opened')) {
      await unlink('.browser-opened');
    }
  } catch (e) {
    log("CLEANUP", `Failed to clean up marker file: ${e.message}`, colors.red);
  }
};

process.on("SIGINT", async () => {
  log("SERVER", "Shutting down...", colors.bright);
  await cleanup();
  process.exit(0);
});

process.on("exit", async () => {
  await cleanup();
});

function getContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
