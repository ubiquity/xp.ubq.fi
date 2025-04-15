// Token generation for local development server
export async function getInstallationToken(): Promise<string> {
  const appId = process.env.APP_ID;
  const installationId = process.env.APP_INSTALLATION_ID;
  const privateKey = process.env.APP_PRIVATE_KEY;

  if (!appId || !installationId || !privateKey) {
    throw new Error("Missing GitHub App credentials in environment variables.");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600, // 10 minutes
    iss: appId,
  };

  const headerBase64 = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const payloadBase64 = btoa(JSON.stringify(payload))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey.replace(/\\n/g, "\n")),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const toSign = new TextEncoder().encode(`${headerBase64}.${payloadBase64}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, toSign);

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${headerBase64}.${payloadBase64}.${signatureBase64}`;

  // Exchange JWT for installation token
  const url = `https://api.github.com/app/installations/${installationId}/access_tokens`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to get installation token: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error("Invalid response from GitHub when requesting installation token.");
  }

  return data.token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
