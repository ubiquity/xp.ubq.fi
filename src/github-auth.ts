import { importPKCS8, SignJWT } from 'jose';

let cachedToken: string | undefined;
let tokenExpiry = 0;

export async function getInstallationToken(): Promise<string> {
  const appId = Bun.env.APP_ID;
  const installationId = Bun.env.APP_INSTALLATION_ID;
  const privateKey = Bun.env.APP_PRIVATE_KEY;

  if (!appId || !installationId || !privateKey) {
    throw new Error('Missing GitHub App credentials in environment variables.');
  }

  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for at least 1 more minute
  if (cachedToken && tokenExpiry - now > 60) {
    return cachedToken!;
  }

  // Create JWT
  const payload = {
    iat: now - 60,
    exp: now + 600, // 10 minutes
    iss: appId,
  };

  const alg = 'RS256';

  const pkcs8 = privateKey
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----\n')
    .replace(/-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----')
    .trim();

  const key = await importPKCS8(pkcs8, alg);

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg })
    .setIssuedAt(payload.iat)
    .setExpirationTime(payload.exp)
    .setIssuer(payload.iss)
    .sign(key);

  // Exchange JWT for installation token
  const url = `https://api.github.com/app/installations/${installationId}/access_tokens`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to get installation token: ${res.status} ${res.statusText} - ${errorBody}`);
  }

  const data = await res.json();

  if (!data.token || !data.expires_at) {
    throw new Error('Invalid response from GitHub when requesting installation token.');
  }

  cachedToken = data.token;
  tokenExpiry = Math.floor(new Date(data.expires_at).getTime() / 1000);

  return cachedToken!;
}
