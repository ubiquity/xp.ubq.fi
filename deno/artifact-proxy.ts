/// <reference lib="deno.ns" />

// Deno Deploy serverless proxy for artifact API
// Deploy this file to Deno Deploy. It proxies artifact list and download requests to GitHub.
// Required environment variables: APP_ID, APP_INSTALLATION_ID, APP_PRIVATE_KEY, ORG, REPO

// Configuration
const APP_ID = Deno.env.get("APP_ID");
const APP_INSTALLATION_ID = Deno.env.get("APP_INSTALLATION_ID");
const APP_PRIVATE_KEY = Deno.env.get("APP_PRIVATE_KEY");
const ORG = "ubiquity-os-marketplace";
const REPO = "text-conversation-rewards";
const DEBUG = Deno.env.get("DEBUG") === "true";

// Terminal colors for logging (only visible in development)
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

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

// Logger that respects DEBUG flag
function log(tag: string, message: string, color = colors.cyan) {
  if (DEBUG) {
    console.log(`${color}[${tag}]${colors.reset} ${message}`);
  }
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
  if (logMessage && DEBUG) {
    log("PERF", `${logMessage}: ${duration.toFixed(2)}ms`, colors.magenta);
  }
  return duration;
}

// JSON response helper
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*"
    },
  });
}

// GitHub App Auth helpers
async function getInstallationToken(): Promise<string> {
  if (!APP_ID || !APP_INSTALLATION_ID || !APP_PRIVATE_KEY) {
    throw new Error("APP_ID, APP_INSTALLATION_ID, and APP_PRIVATE_KEY must be set");
  }

  // 1. Generate JWT for GitHub App
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + (10 * 60),
    iss: APP_ID,
  };

  // Deno Deploy supports crypto.subtle for signing
  const privateKeyPEM = APP_PRIVATE_KEY.replace(/\\n/g, "\n");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPEM),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const header = { alg: "RS256", typ: "JWT" };
  const enc = (obj: object) => btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const headerB64 = enc(header);
  const payloadB64 = enc(payload);
  const toSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, toSign);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${headerB64}.${payloadB64}.${signatureB64}`;

  // 2. Exchange JWT for installation access token
  const url = `https://api.github.com/app/installations/${APP_INSTALLATION_ID}/access_tokens`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get installation token: ${res.status} ${res.statusText} - ${text}`);
  }
  const data = await res.json();
  return data.token;
}

// PEM to ArrayBuffer helper
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// GitHub API helper
async function fetchArtifactsListFromGitHub(runId: string) {
  startTimer("fetchArtifactsList");
  log("API", `Fetching artifacts for run ID: ${runId}`, colors.blue);

  // ORG and REPO are now hard-coded, so this check is not needed

  const token = await getInstallationToken();
  const url = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${runId}/artifacts`;
  log("API", `Fetching from URL: ${url}`, colors.blue);

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const duration = endTimer("fetchArtifactsList", "Fetched artifacts list");
  log("API", `Found ${data.artifacts.length} artifacts in ${duration.toFixed(2)}ms`, colors.green);

  return data.artifacts;
}

// Static file serving helper with improved error handling and content types
async function serveStaticFile(filePath: string) {
  log("STATIC", `Attempting to serve: ${filePath}`, colors.blue);

  // For CSS and visualization files, try src directory first
  if (filePath.startsWith('css/') || filePath.startsWith('visualization/')) {
    try {
      const file = await Deno.readFile(`./src/${filePath}`);
      log("STATIC", `Found in src/${filePath}`, colors.green);
      return createFileResponse(file, filePath);
    } catch {
      log("STATIC", `Not found in src/${filePath}`, colors.yellow);
    }
  }

  // Try src directory, then dist/
  try {
    try {
      const file = await Deno.readFile(`./src/${filePath}`);
      log("STATIC", `Found in src/: ${filePath}`, colors.green);
      return createFileResponse(file, filePath);
    } catch {
      const file = await Deno.readFile(`./dist/${filePath}`);
      log("STATIC", `Found in dist/: ${filePath}`, colors.green);
      return createFileResponse(file, filePath);
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log("STATIC", `Error serving ${filePath}: ${errorMessage}`, colors.red);
    return null;
  }
}

function createFileResponse(file: Uint8Array, path: string) {

  const contentType = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  }[path.slice(path.lastIndexOf('.'))] || 'application/octet-stream';

  log("STATIC", `Serving ${path} (${file.length} bytes) as ${contentType}`, colors.green);

  return new Response(file, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': file.length.toString(),
      'access-control-allow-origin': '*'
    },
  });
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  startTimer("request");
  const url = new URL(req.url);
  const pathname = url.pathname;

  log("REQUEST", `${req.method} ${pathname}${url.search}`, colors.bright);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept"
      }
    });
  }

  // Serve static files
  if (pathname === '/' || pathname === '/index.html') {
    const response = await serveStaticFile('index.html');
    if (response) {
      endTimer("request", "Served index.html");
      return response;
    }
  }

  // Try serving from dist/ directory for other static resources
  if (!pathname.startsWith('/api/')) {
    const response = await serveStaticFile(pathname.slice(1));
    if (response) {
      endTimer("request", `Served static file: ${pathname}`);
      return response;
    }
  }

  // API: Download artifact
  if (pathname.startsWith("/api/download-artifact")) {
    startTimer("downloadArtifact");
    const artifactId = url.searchParams.get("id");

    if (!artifactId) {
      endTimer("request", "Bad request: missing id parameter");
      return jsonResponse({ error: "Missing id parameter" }, 400);
    }

    log("ZIP", `Artifact download request: ${artifactId}`, colors.blue);

    try {
      let zipData: Uint8Array;

      if (url.searchParams.get("run") === "test") {
        // Serve test fixture from static path
        log("ZIP", `Using test fixture for: ${artifactId}`, colors.yellow);

        try {
          // For Deno Deploy, adjust path to match deployment structure
          const path = `./tests/fixtures/artifacts/${artifactId}.zip`;
          zipData = await Deno.readFile(path);
          log("ZIP", `Loaded test fixture (${zipData.length} bytes)`, colors.green);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          log("ZIP", `Test fixture not found: ${errorMessage}`, colors.red);
          return jsonResponse({ error: `Test fixture not found: ${artifactId}.zip` }, 404);
        }
      } else {
        // Proxy to GitHub using App installation token
        // ORG and REPO are now hard-coded, so this check is not needed

        log("ZIP", `Fetching from GitHub API: ${artifactId}`, colors.blue);
        const artifactUrl = `https://api.github.com/repos/${ORG}/${REPO}/actions/artifacts/${artifactId}/zip`;

        const token = await getInstallationToken();
        const ghRes = await fetch(artifactUrl, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!ghRes.ok) {
          const errorText = await ghRes.text();
          log("ZIP", `GitHub API error: ${ghRes.status} - ${errorText}`, colors.red);
          return jsonResponse({
            error: `GitHub API error: ${ghRes.status} ${ghRes.statusText}`,
            details: errorText
          }, ghRes.status);
        }

        const buffer = await ghRes.arrayBuffer();
        zipData = new Uint8Array(buffer);
        log("ZIP", `Downloaded from GitHub (${zipData.length} bytes)`, colors.green);
      }

      // Verify ZIP signature for debugging
      const isValidZip = zipData.length >= 4 &&
        zipData[0] === 0x50 &&
        zipData[1] === 0x4b &&
        zipData[2] === 0x03 &&
        zipData[3] === 0x04;

      if (!isValidZip) {
        log("ZIP", "Warning: Invalid ZIP signature", colors.red);
      } else {
        log("ZIP", "Valid ZIP signature verified", colors.green);
      }

      endTimer("downloadArtifact", "Artifact download completed");
      const totalTime = endTimer("request", "Request completed");

      // Return raw ZIP data with improved headers
      return new Response(zipData, {
        status: 200,
        headers: {
          "content-type": "application/zip",
          "content-length": zipData.length.toString(),
          "access-control-allow-origin": "*",
          "content-disposition": `attachment; filename="${artifactId}.zip"`,
          "x-processing-time": `${totalTime.toFixed(2)}ms`,
          "cache-control": "public, max-age=60"
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log("ERROR", `Artifact download failed: ${message}`, colors.red);
      endTimer("request", "Request failed");
      return jsonResponse({ error: message }, 500);
    }
  }

  // API: List workflow runs
  if (pathname.startsWith("/api/workflow-runs")) {
    startTimer("workflowRuns");

    try {
      const token = await getInstallationToken();
      const url = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs?event=workflow_dispatch&branch=chore/run-all&per_page=10`;

      log("API", `Fetching workflow runs: ${url}`, colors.blue);

      const res = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        log("API", `GitHub API error: ${res.status} - ${errorText}`, colors.red);
        return jsonResponse({
          error: `GitHub API error: ${res.status} ${res.statusText}`,
          details: errorText
        }, res.status);
      }

      const data = await res.json();
      // Log the full response data to inspect its structure
      log("DEBUG", `GitHub Workflow Runs Response: ${JSON.stringify(data, null, 2)}`, colors.yellow);

      // For each workflow run, fetch its details and try to extract workflow_dispatch inputs
      if (data.workflow_runs && data.workflow_runs.length > 0) {
        // Only process the last 10 runs
        const lastTenRuns = data.workflow_runs.slice(0, 10);
        const runsWithInputs = [];
        for (const run of lastTenRuns) {
          let inputs = {};
          try {
            // Fetch run details
            const runDetailsUrl = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${run.id}`;
            const runDetailsRes = await fetch(runDetailsUrl, {
              headers: {
                Accept: "application/vnd.github.v3+json",
                Authorization: `Bearer ${token}`,
              },
            });
            if (runDetailsRes.ok) {
              const runDetails = await runDetailsRes.json();
              // Try to extract workflow_dispatch inputs
              if (
                runDetails &&
                runDetails.event === "workflow_dispatch"
              ) {
                // Sometimes inputs are in runDetails.inputs, sometimes in runDetails.payload.inputs
                if (runDetails.inputs) {
                  inputs = runDetails.inputs;
                } else if (runDetails.payload && runDetails.payload.inputs) {
                  inputs = runDetails.payload.inputs;
                }
              }
            }
          } catch (e) {
            // Ignore errors, fallback to empty inputs
          }
          runsWithInputs.push({
            ...run,
            inputs,
          });
        }
        endTimer("workflowRuns", "Workflow runs fetch completed");
        endTimer("request", "Request completed");
        return jsonResponse({ workflow_runs: runsWithInputs });
      }

      endTimer("workflowRuns", "Workflow runs fetch completed");
      endTimer("request", "Request completed");
      return jsonResponse(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log("ERROR", `Workflow runs fetch failed: ${message}`, colors.red);
      endTimer("request", "Request failed");
      return jsonResponse({ error: message }, 500);
    }
  }

  // API: List artifacts
  if (pathname.startsWith("/api/artifacts")) {
    startTimer("artifacts");
    const runId = url.searchParams.get("runId");

    if (!runId) {
      endTimer("request", "Bad request: missing runId parameter");
      return jsonResponse({ error: "Missing runId parameter" }, 400);
    }

    log("API", `Artifacts list request for run: ${runId}`, colors.blue);

    try {
      if (runId === "test") {
        // List test fixture zips
        log("API", "Using test fixtures for artifacts list", colors.yellow);
        let artifacts: Array<{ id: string; name: string; archive_download_url: string }> = [];

        try {
          // For Deno Deploy, adjust path to match deployment structure
          const dirPath = `./tests/fixtures/artifacts/`;
          for await (const entry of Deno.readDir(dirPath)) {
            if (entry.isFile && entry.name.endsWith(".zip")) {
              const name = entry.name.replace(".zip", "");
              artifacts.push({
                id: name,
                name,
                archive_download_url: "",
              });
            }
          }

          log("API", `Found ${artifacts.length} test artifacts`, colors.green);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          log("API", `Test fixture error: ${errorMessage}`, colors.red);
          return jsonResponse({ error: `Test fixture directory not found` }, 404);
        }

        endTimer("artifacts", "Artifacts list (test) completed");
        endTimer("request", "Request completed");
        return jsonResponse({ artifacts });
      } else {
        // Get real artifacts from GitHub
        const artifacts = await fetchArtifactsListFromGitHub(runId);
        endTimer("artifacts", "Artifacts list (GitHub) completed");
        endTimer("request", "Request completed");
        return jsonResponse({ artifacts });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log("ERROR", `Artifacts list failed: ${message}`, colors.red);
      endTimer("request", "Request failed");
      return jsonResponse({ error: message }, 500);
    }
  }

  // Not found
  log("ERROR", `Route not found: ${pathname}`, colors.red);
  endTimer("request", "404 Not Found");
  return jsonResponse({ error: "Not found", path: pathname }, 404);
});
