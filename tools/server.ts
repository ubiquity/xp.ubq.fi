import { strFromU8, unzipSync } from "fflate";
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
        const zipData = new Uint8Array(buffer);
        const outerUnzipped = unzipSync(zipData);

        // Find the first nested zip file
        const nestedZipEntry = Object.entries(outerUnzipped).find(([name]) =>
          name.endsWith(".zip")
        );
        if (!nestedZipEntry) {
          throw new Error("No nested zip found in artifact");
        }

        const nestedZipData = nestedZipEntry[1];
        const nestedUnzipped = unzipSync(nestedZipData);

        const files: { name: string; json: any }[] = [];
        for (const [name, data] of Object.entries(nestedUnzipped)) {
          if (name.endsWith(".json")) {
            try {
              const jsonText = strFromU8(data);
              const json = JSON.parse(jsonText);
              files.push({ name, json });
            } catch (e) {
              console.warn(`Failed to parse ${name}:`, e);
            }
          }
        }

        const directoryName = nestedZipEntry[0].replace(/\.zip$/, "");

        return new Response(
          JSON.stringify({ directoryName, files }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
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
        const artifacts = await fetchArtifactsListFromGitHub(runId);
        return new Response(JSON.stringify({ artifacts }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
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

    if (pathname === "/") {
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

// Automatically open browser
try {
  const url = `http://localhost:${server.port}`;
  const openCommand =
    process.platform === "darwin" ? "open" :
    process.platform === "win32" ? "start" :
    "xdg-open";
  Bun.spawn([openCommand, url]);
} catch (e) {
  console.warn("Failed to open browser automatically:", e);
}

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
