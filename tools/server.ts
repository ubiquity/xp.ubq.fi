import { readdir, unlink } from "node:fs/promises";
import { ORG, REPO } from "../src/constants.ts";
import { getInstallationToken } from "../src/github-auth.ts";

async function fetchArtifactsListFromGitHub(runId: string) {
  const token = await getInstallationToken();
  const url = `https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${runId}/artifacts`;
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
  return data.artifacts;
}

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname.startsWith("/api/download-artifact")) {
      const artifactId = url.searchParams.get("id");
      if (!artifactId) {
        return new Response(JSON.stringify({ error: "Missing id parameter" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      try {
        console.log("Request URL:", req.url);
        console.log("Detected run param:", url.searchParams.get("run"));

        const t0 = performance.now();

        const token = await getInstallationToken();

        const t1 = performance.now();
        let t2 = t1;

        let zipData: Uint8Array;

        if (url.searchParams.get("run") === "test") {
          console.log("Loading test fixture zip for artifact:", artifactId);
          const path = `tests/fixtures/artifacts/${artifactId}.zip`;
          const file = Bun.file(path);
          if (!(await file.exists())) {
            throw new Error(`Test fixture not found: ${path}`);
          }
          zipData = new Uint8Array(await file.arrayBuffer());
        } else {
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

          const t2 = performance.now();

          const buffer = await ghRes.arrayBuffer();
          zipData = new Uint8Array(buffer);
        }

        const t3 = performance.now();

        console.log(`TIMING download token: ${(t1 - t0).toFixed(2)}ms`);
        console.log(`TIMING fetch zip: ${(t2 - t1).toFixed(2)}ms`);
        console.log(`TIMING read arrayBuffer: ${(t3 - t2).toFixed(2)}ms`);
        console.log(`TIMING total: ${(t3 - t0).toFixed(2)}ms`);

        // Return raw ZIP data
        return new Response(
          zipData,
          {
            status: 200,
            headers: {
              "content-type": "application/zip",
              "content-length": zipData.length.toString()
            },
          }
        );
      } catch (error) {
        console.error("Error downloading artifact:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    if (pathname.startsWith("/api/artifacts")) {
      const runId = url.searchParams.get("runId");
      if (!runId) {
        return new Response(JSON.stringify({ error: "Missing runId parameter" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      try {
        if (runId === "test") {
          const dirPath = "./tests/fixtures/artifacts/";
          const entries = await readdir(dirPath);
          const artifacts = entries
            .filter(name => name.endsWith(".zip"))
            .map(name => ({
              id: name.replace(".zip", ""),
              name: name.replace(".zip", ""),
              archive_download_url: "",
            }));
          return new Response(JSON.stringify({ artifacts }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } else {
          const artifacts = await fetchArtifactsListFromGitHub(runId);
          return new Response(JSON.stringify({ artifacts }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      } catch (error) {
        console.error("Error fetching artifacts list:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // Serve static files
    let filePath = "";

    if (pathname.startsWith("/tests/fixtures/artifacts/")) {
      const filePath = "." + pathname;
      console.log(`[ZIP] Attempting to serve: ${filePath}`);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const arrayBuffer = await file.arrayBuffer();
        // Send raw ArrayBuffer with correct content type
        const headers = new Headers({
          "Content-Type": "application/octet-stream",
          "Content-Length": arrayBuffer.byteLength.toString(),
          "Access-Control-Allow-Origin": "*",
        });
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log(
          `[ZIP] Serving file:`,
          `\n- Path: ${filePath}`,
          `\n- Size: ${arrayBuffer.byteLength} bytes`,
          `\n- Headers:`, Object.fromEntries(headers.entries()),
          `\n- First 16 bytes:`,
          Array.from(uint8Array.slice(0, 16)),
          `\n- Zip signature valid:`,
          uint8Array[0] === 0x50 && uint8Array[1] === 0x4b && uint8Array[2] === 0x03 && uint8Array[3] === 0x04
        );

        // Return raw ArrayBuffer
        const response = new Response(arrayBuffer, { headers });
        return response;
      } else {
        console.log(`[ZIP] File not found: ${pathname}`);
        return new Response("404 Not Found", { status: 404 });
      }
    } else if (pathname === "/") {
      filePath = "./src/index.html";
    } else if (pathname.startsWith("/dist/")) {
      filePath = "." + pathname;
    } else if (pathname.startsWith("/src/")) {
      filePath = "." + pathname;
    } else if (pathname === "/style.css") {
      filePath = "./src/style.css";
    } else if (pathname.startsWith("/api/")) {
      // Unknown API route, return 404 JSON
      return new Response(JSON.stringify({ error: "API route not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    } else {
      // fallback to index.html for unknown frontend paths
      filePath = "./src/index.html";
    }

    try {
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        return new Response("404 Not Found", { status: 404 });
      }
      const contentType = getContentType(filePath);
      return new Response(file, {
        headers: { "content-type": contentType },
      });
    } catch {
      return new Response("404 Not Found", { status: 404 });
    }
  },
});

console.log(`Server running on http://localhost:${server.port}`);

// Open browser only on first run
(async () => {
  const markerFile = Bun.file('.browser-opened');
  if (!(await markerFile.exists())) {
    try {
      const url = `http://localhost:${server.port}?run=test`;
      const openCommand =
        process.platform === "darwin" ? "open" :
        process.platform === "win32" ? "start" :
        "xdg-open";
      Bun.spawn([openCommand, url]);
      await Bun.write('.browser-opened', 'opened');
    } catch (e) {
      console.warn("Failed to open browser automatically:", e);
    }
  }
})();

// Cleanup marker file on exit
const cleanup = async () => {
  try {
    const markerFile = Bun.file('.browser-opened');
    if (await markerFile.exists()) {
      await unlink('.browser-opened');
    }
  } catch (e) {
    console.warn("Failed to clean up .browser-opened:", e);
  }
};

process.on("SIGINT", async () => {
  await cleanup();
  process.exit();
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
