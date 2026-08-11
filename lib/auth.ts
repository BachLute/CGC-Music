// Shared helpers for the password gate.
//
// Used by both `middleware.ts` (Edge runtime) and `app/api/login/route.ts`
// (Node runtime) — both runtimes expose the Web Crypto API (`crypto.subtle`)
// globally, so this file has no environment-specific imports and works in
// either place unmodified.

export const SESSION_COOKIE_NAME = "app_session";

// How long an issued session stays valid, independent of the cookie's own
// lifetime. The cookie itself is a browser-session cookie (cleared when the
// browser closes); this is a server-side backstop in case a cookie somehow
// outlives that.
const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function getAppPassword(): string {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    throw new Error(
      "APP_PASSWORD environment variable is not set. Set it before the password gate can work."
    );
  }
  return password;
}

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(message: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return toBase64Url(digest);
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return toBase64Url(signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Checks a submitted password against APP_PASSWORD in constant time.
 * Both sides are hashed first so comparison time never depends on how much
 * of the password matched, and so string lengths never leak either.
 */
export async function verifyPassword(candidate: string): Promise<boolean> {
  const expected = getAppPassword();
  const [expectedHash, candidateHash] = await Promise.all([sha256(expected), sha256(candidate)]);
  return timingSafeEqual(expectedHash, candidateHash);
}

/** Issues a signed session token proving a successful login. */
export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = String(expires);
  const signature = await hmacSha256(getAppPassword(), payload);
  return `${payload}.${signature}`;
}

/** Verifies a session token read from the cookie. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expires = Number(payload);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;

  let password: string;
  try {
    password = getAppPassword();
  } catch {
    return false;
  }

  const expectedSignature = await hmacSha256(password, payload);
  return timingSafeEqual(signature, expectedSignature);
}
