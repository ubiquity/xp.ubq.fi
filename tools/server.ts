import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import { readdir, stat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ORG, REPO } from "../src/constants.ts";
import { getInstallationToken } from "./local-auth.ts";

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

function log(tag: string, message: string, color = colors.cyan) {
  console.log(`${color}[${tag}]${colors.reset} ${message}`);
}

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

async function ensureFileExists(path: string): Promise<boolean> {
  try {
    const fileStat = await stat(path);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

function getContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const app = new Elysia();

// --- Static file serving for dist/, src/, and tests/fixtures/artifacts/ ---
app.use(
  staticPlugin({
    prefix: "/",
    assets: resolve(process.cwd(), "dist"),
    alwaysStatic: true,
  })
);
app.use(
  staticPlugin({
    prefix: "/src",
    assets: resolve(process.cwd(), "src"),
    alwaysStatic: true,
  })
);
app.use(
  staticPlugin({
    prefix: "/css",
    assets: resolve(process.cwd(), "src/css"),
    alwaysStatic: true,
  })
);
app.use(
  staticPlugin({
    prefix: "/tests/fixtures/artifacts",
    assets: resolve(process.cwd(), "tests/fixtures/artifacts"),
    alwaysStatic: true,
  })
);

/**
 * --- API ROUTES ---
 */

// --- NEW ENDPOINT: /api/workflow-inputs/:runId ---
app.get("/api/workflow-inputs/:runId", async ({ params, set }) => {
  const runId = params.runId;
  if (!runId) {
    set.status = 400;
    return { error: "Missing runId parameter" };
  }

  try {
    startTimer("workflowInputs");
    const token = await getInstallationToken();
    const artifactsUrl = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${runId}/artifacts`;
    log("API", `Fetching artifacts for run ${runId}: ${artifactsUrl}`, colors.blue);

    const artifactsResponse = await fetch(artifactsUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!artifactsResponse.ok) {
      set.status = artifactsResponse.status;
      return { error: `GitHub API error: ${artifactsResponse.status} ${artifactsResponse.statusText}` };
    }

    const artifactsData = await artifactsResponse.json();
    const artifact = artifactsData.artifacts.find((a: any) =>
      a.name === `workflow-inputs-${runId}`
    );
    if (!artifact) {
      set.status = 404;
      return { error: `workflow-inputs artifact not found for run ${runId}` };
    }

    // Download the artifact zip
    const artifactUrl = artifact.archive_download_url;
    log("API", `Downloading artifact zip: ${artifactUrl}`, colors.blue);
    const artifactZipRes = await fetch(artifactUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!artifactZipRes.ok) {
      set.status = artifactZipRes.status;
      return { error: `Failed to download artifact zip: ${artifactZipRes.status} ${artifactZipRes.statusText}` };
    }
    const zipBuffer = await artifactZipRes.arrayBuffer();
    const zipData = new Uint8Array(zipBuffer);

    // Unzip and extract workflow-inputs.json
    // Use Bun's built-in unzip
    const tmpDir = `/tmp/workflow-inputs-${runId}-${Date.now()}`;
    await Bun.write(`${tmpDir}.zip`, zipData);
    await Bun.$`unzip -d ${tmpDir} ${tmpDir}.zip`;

    const jsonPath = join(tmpDir, "workflow-inputs.json");
    if (!(await ensureFileExists(jsonPath))) {
      set.status = 404;
      return { error: "workflow-inputs.json not found in artifact" };
    }
    const jsonFile = Bun.file(jsonPath);
    const jsonText = await jsonFile.text();
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      set.status = 500;
      return { error: "Failed to parse workflow-inputs.json" };
    }

    // Clean up temp files
    try {
      await unlink(`${tmpDir}.zip`);
      await unlink(jsonPath);
    } catch {}

    endTimer("workflowInputs", "Fetched workflow inputs");
    set.status = 200;
    set.headers = { "content-type": "application/json", "access-control-allow-origin": "*" };
    return parsed;
  } catch (error: any) {
    log("ERROR", `Failed to fetch workflow inputs: ${error.message}`, colors.red);
    set.status = 500;
    return { error: error.message };
  }
});


app.get("/api/download-artifact", async ({ query, set }) => {
  const artifactId = query.id;
  if (!artifactId) {
    set.status = 400;
    return { error: "Missing id parameter" };
  }

  try {
    startTimer("downloadArtifact");
    log("ZIP", `Downloading artifact: ${artifactId}`, colors.blue);

    let zipData: Uint8Array;

    // For test mode, serve from fixtures
    const runParam = query.run;
    if (runParam === "test" || (runParam === "mini" && artifactId === "small-test-fixture")) {
      log("ZIP", `Using fixture for: ${artifactId} (run=${runParam})`, colors.yellow);

      const fixturesPath = resolve(process.cwd(), "tests/fixtures/artifacts");
      const zipName = runParam === "mini" ? "small-test-fixture.zip" : `${artifactId}.zip`;
      const zipPath = join(fixturesPath, zipName);

      log("ZIP", `Looking for fixture at: ${zipPath}`, colors.yellow);

      if (!(await ensureFileExists(zipPath))) {
        set.status = 404;
        return { error: `Fixture not found: ${zipPath}` };
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
        set.status = ghRes.status;
        return { error: `GitHub API error: ${ghRes.status} ${ghRes.statusText}` };
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

    set.status = 200;
    const headers = {
      "content-type": "application/zip",
      "content-length": zipData.length.toString(),
      "access-control-allow-origin": "*",
      "content-disposition": `attachment; filename=\"${artifactId}.zip\"`,
    };
    return new Response(zipData, { headers });
  } catch (error: any) {
    log("ERROR", `Failed to download artifact: ${error.message}`, colors.red);
    set.status = 500;
    return { error: error.message };
  }
});

app.get("/api/workflow-runs", async ({ set }) => {
  try {
    startTimer("workflowRuns");
    const token = await getInstallationToken();
    const runsUrl = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs?event=workflow_dispatch&branch=chore/run-all&per_page=10`;
    log("API", `Fetching workflow runs: ${runsUrl}`, colors.blue);

    const runsResponse = await fetch(runsUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!runsResponse.ok) {
      set.status = runsResponse.status;
      return { error: `GitHub API error: ${runsResponse.status} ${runsResponse.statusText}` };
    }

    const runsData = await runsResponse.json();

    // Fetch workflow run inputs for each run
    const runs = await Promise.all(
      runsData.workflow_runs.map(async (run: any) => {
        const jobsUrl = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${run.id}/jobs`;
        log("API", `Fetching jobs for run ${run.id}`, colors.blue);

        const jobsResponse = await fetch(jobsUrl, {
          headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!jobsResponse.ok) {
          log("ERROR", `Failed to fetch jobs for run ${run.id}`, colors.red);
          return run;
        }

        const jobsData = await jobsResponse.json();
        // Fetch job logs for debugging
        const job = jobsData.jobs?.[0];
        if (!job) return run;

        const logsUrl = `https://api.github.com/repos/${ORG}/${REPO}/actions/jobs/${job.id}/logs`;
        log("API", `Fetching logs for job ${job.id}`, colors.blue);

        const logsResponse = await fetch(logsUrl, {
          headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!logsResponse.ok) {
          log("ERROR", `Failed to fetch logs for job ${job.id}`, colors.red);
          return run;
        }

        const logText = await logsResponse.text();
        log("DEBUG", `Got logs for run ${run.id}, length: ${logText.length}`, colors.yellow);

        // Look for repository URLs in the logs
        const repoMatches = logText.match(/https:\/\/github\.com\/([^/\s]+\/[^/\s]+)/g) || [];
        const uniqueRepos = [...new Set(repoMatches.map(url => url.split('github.com/')[1]))];

        const repository = uniqueRepos[0] || "";
        const issueMatch = logText.match(/(?:issues|pulls)\/(\d+)/);
        const issueId = issueMatch ? issueMatch[1] : "";

        log("DEBUG", `Found repo: ${repository}, issue: ${issueId}`, colors.yellow);

        return {
          ...run,
          repository,
          issueId
        };
      })
    );

    const data = { ...runsData, workflow_runs: runs };
    endTimer("workflowRuns", "Workflow runs fetch completed");
    set.status = 200;
    set.headers = { "content-type": "application/json", "access-control-allow-origin": "*" };
    return data;
  } catch (error: any) {
    log("ERROR", `Failed to fetch workflow runs: ${error.message}`, colors.red);
    set.status = 500;
    return { error: error.message };
  }
});

app.get("/api/artifacts", async ({ query, set }) => {
  const runId = query.runId;
  if (!runId) {
    set.status = 400;
    return { error: "Missing runId parameter" };
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
      set.status = 200;
      set.headers = { "content-type": "application/json", "access-control-allow-origin": "*" };
      return { artifacts };
    } else {
      // Fetch from GitHub
      const token = await getInstallationToken();
      const url = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${runId}/artifacts`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        set.status = response.status;
        return { error: `GitHub API error: ${response.status} ${response.statusText}` };
      }

      const data = await response.json();
      log("API", `Found ${data.artifacts.length} artifacts`, colors.green);
      endTimer("getArtifactsList", "Fetched artifacts list");
      set.status = 200;
      set.headers = { "content-type": "application/json", "access-control-allow-origin": "*" };
      return { artifacts: data.artifacts };
    }
  } catch (error: any) {
    log("ERROR", `Failed to fetch artifacts list: ${error.message}`, colors.red);
    set.status = 500;
    return { error: error.message };
  }
});

// --- SPA fallback for client-side routing ---
app.get("/*", async ({ request, set }) => {
  // Only handle GET requests that are not API or static file
  if (request.method !== "GET") return;
  // If the path contains a dot, it's likely a file, so let staticPlugin handle 404
  if (new URL(request.url).pathname.includes(".")) return;
  // Serve index.html for SPA navigation
  const indexPath = resolve(process.cwd(), "src/index.html");
  set.status = 200;
  set.headers = { "content-type": "text/html" };
  return Bun.file(indexPath);
});

app.listen(PORT, () => {
  log("SERVER", `Running on http://localhost:${PORT}`, colors.green);
});
