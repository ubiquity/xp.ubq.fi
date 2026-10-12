/**
 * Cloudflare Workers port of the xp.ubq.fi GitHub artifacts proxy.
 *
 * Static files are served by the Workers assets binding assembled from
 * index.html, src/**, and dist/** (see tools/build-assets.ts); this worker
 * handles /api/* plus CORS, exactly like the previous Deno Deploy server.
 * GitHub App credentials are optional bindings: APP_ID, APP_INSTALLATION_ID,
 * APP_PRIVATE_KEY, DEBUG (absent values reproduce the previous deployment,
 * which had none configured).
 */

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  APP_ID?: string;
  APP_INSTALLATION_ID?: string;
  APP_PRIVATE_KEY?: string;
  DEBUG?: string;
}

const ORG = "ubiquity-os-marketplace";
const REPO = "text-conversation-rewards";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64Url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getInstallationToken(env: Env): Promise<string> {
  const { APP_ID, APP_INSTALLATION_ID, APP_PRIVATE_KEY } = env;
  if (!APP_ID || !APP_INSTALLATION_ID || !APP_PRIVATE_KEY) {
    throw new Error("APP_ID, APP_INSTALLATION_ID, and APP_PRIVATE_KEY must be set");
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now - 60, exp: now + 10 * 60, iss: APP_ID };
  const privateKeyPEM = APP_PRIVATE_KEY.replace(/\\n/g, "\n");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPEM),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const body = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${body}`),
  );
  const jwt = `${header}.${body}.${base64Url(signature)}`;
  const res = await fetch(`https://api.github.com/app/installations/${APP_INSTALLATION_ID}/access_tokens`, {
    method: "POST",
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to get installation token: ${res.status} ${res.statusText} - ${await res.text()}`);
  }
  const data = await res.json() as { token: string };
  return data.token;
}

async function fetchAsset(env: Env, path: string): Promise<Response | null> {
  const response = await env.ASSETS.fetch(new Request(`https://assets.local${path}`));
  return response.status === 200 ? response : null;
}

async function fetchArtifactsListFromGitHub(env: Env, runId: string) {
  const token = await getInstallationToken(env);
  const res = await fetch(`https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${runId}/artifacts`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  const data = await res.json() as { artifacts: unknown[] };
  return data.artifacts;
}

async function handleWorkflowRuns(env: Env): Promise<Response> {
  try {
    const token = await getInstallationToken(env);
    const res = await fetch(
      `https://api.github.com/repos/${ORG}/${REPO}/actions/runs?event=workflow_dispatch&branch=chore/run-all&per_page=10`,
      { headers: { Accept: "application/vnd.github.v3+json", Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const errorText = await res.text();
      return jsonResponse({ error: `GitHub API error: ${res.status} ${res.statusText}`, details: errorText }, res.status);
    }
    const data = await res.json() as { workflow_runs?: Array<Record<string, unknown> & { id: number }> };
    if (data.workflow_runs && data.workflow_runs.length > 0) {
      const runsWithInputs = [];
      for (const run of data.workflow_runs.slice(0, 10)) {
        let inputs: unknown = {};
        try {
          const detailsRes = await fetch(`https://api.github.com/repos/${ORG}/${REPO}/actions/runs/${run.id}`, {
            headers: { Accept: "application/vnd.github.v3+json", Authorization: `Bearer ${token}` },
          });
          if (detailsRes.ok) {
            const details = await detailsRes.json() as Record<string, unknown> & { inputs?: unknown; payload?: { inputs?: unknown } };
            if (details.event === "workflow_dispatch") {
              inputs = details.inputs ?? details.payload?.inputs ?? {};
            }
          }
        } catch {
          // Keep empty inputs on detail failures, like the original proxy.
        }
        runsWithInputs.push({ ...run, inputs });
      }
      return jsonResponse({ workflow_runs: runsWithInputs });
    }
    return jsonResponse(data);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

async function handleArtifacts(env: Env, url: URL): Promise<Response> {
  const runId = url.searchParams.get("runId");
  if (!runId) return jsonResponse({ error: "Missing runId parameter" }, 400);
  try {
    if (runId === "test") {
      const manifest = await fetchAsset(env, "/fixture-manifest.json");
      const names = manifest ? ((await manifest.json()) as { artifacts?: string[] }).artifacts ?? [] : [];
      return jsonResponse({
        artifacts: names.map((name) => ({ id: name, name, archive_download_url: "" })),
      });
    }
    const artifacts = await fetchArtifactsListFromGitHub(env, runId);
    return jsonResponse({ artifacts });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

async function handleDownloadArtifact(env: Env, url: URL): Promise<Response> {
  const artifactId = url.searchParams.get("id");
  if (!artifactId) return jsonResponse({ error: "Missing id parameter" }, 400);
  try {
    let zipData: Uint8Array<ArrayBuffer>;
    if (url.searchParams.get("run") === "test") {
      const asset = await fetchAsset(env, `/tests/fixtures/artifacts/${artifactId}.zip`);
      if (!asset) return jsonResponse({ error: `Test fixture not found: ${artifactId}.zip` }, 404);
      zipData = new Uint8Array(await asset.arrayBuffer());
    } else {
      const token = await getInstallationToken(env);
      const ghRes = await fetch(`https://api.github.com/repos/${ORG}/${REPO}/actions/artifacts/${artifactId}/zip`, {
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      });
      if (!ghRes.ok) {
        const errorText = await ghRes.text();
        return jsonResponse({ error: `GitHub API error: ${ghRes.status} ${ghRes.statusText}`, details: errorText }, ghRes.status);
      }
      zipData = new Uint8Array(await ghRes.arrayBuffer());
    }
    return new Response(zipData, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-length": zipData.length.toString(),
        "access-control-allow-origin": "*",
        "content-disposition": `attachment; filename="${artifactId}.zip"`,
        "cache-control": "public, max-age=60",
      },
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
        },
      });
    }

    if (pathname === "/" || pathname === "/index.html") {
      const response = await fetchAsset(env, "/index.html");
      if (response) return response;
    }

    if (!pathname.startsWith("/api/")) {
      const response = await fetchAsset(env, pathname);
      if (response) return response;
    }

    if (pathname.startsWith("/api/download-artifact")) return handleDownloadArtifact(env, url);
    if (pathname.startsWith("/api/workflow-runs")) return handleWorkflowRuns(env);
    if (pathname.startsWith("/api/artifacts")) return handleArtifacts(env, url);

    return jsonResponse({ error: "Not found", path: pathname }, 404);
  },
};
