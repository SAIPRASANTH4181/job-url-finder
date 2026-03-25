import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { OAUTH_CONFIG, STORAGE_CONFIG } from "./constants.js";

// ─── Types ───────────────────────────────────────────────────────────

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in ms
  account_id: string; // ChatGPT account ID from JWT
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// ─── Token Storage ───────────────────────────────────────────────────

function getConfigDir(): string {
  return join(homedir(), STORAGE_CONFIG.configDir);
}

function getAuthFilePath(): string {
  return join(getConfigDir(), STORAGE_CONFIG.authFile);
}

/**
 * Save tokens to local storage
 */
export async function saveTokens(tokens: TokenData): Promise<void> {
  const dir = getConfigDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getAuthFilePath(), JSON.stringify(tokens, null, 2), "utf-8");
}

/**
 * Load tokens from local storage
 * Returns null if no tokens are stored
 */
export async function loadTokens(): Promise<TokenData | null> {
  try {
    const data = await readFile(getAuthFilePath(), "utf-8");
    return JSON.parse(data) as TokenData;
  } catch {
    return null;
  }
}

/**
 * Delete stored tokens (logout)
 */
export async function clearTokens(): Promise<void> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(getAuthFilePath());
  } catch {
    // File doesn't exist, that's fine
  }
}

// ─── JWT Parsing ─────────────────────────────────────────────────────

/**
 * Decode a JWT token payload (no verification - we trust OpenAI's token)
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload) {
    throw new Error("Invalid JWT token");
  }
  const decoded = Buffer.from(payload, "base64url").toString("utf-8");
  return JSON.parse(decoded) as Record<string, unknown>;
}

/**
 * Extract ChatGPT account ID from the access token JWT
 */
export function extractAccountId(accessToken: string): string {
  const payload = decodeJwtPayload(accessToken);
  // Account ID is nested under the OpenAI auth claim
  const authClaim = payload["https://api.openai.com/auth"] as
    | Record<string, unknown>
    | undefined;
  const accountId = authClaim?.["chatgpt_account_id"];
  if (typeof accountId !== "string") {
    throw new Error("Could not extract account ID from token");
  }
  return accountId;
}

// ─── Token Exchange ──────────────────────────────────────────────────

/**
 * Exchange authorization code for access + refresh tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<TokenData> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    client_id: OAUTH_CONFIG.clientId,
    code_verifier: codeVerifier,
  });

  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as TokenResponse;

  if (!data.access_token || !data.refresh_token) {
    throw new Error("Invalid token response - missing access or refresh token");
  }

  const accountId = extractAccountId(data.access_token);

  const tokens: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    account_id: accountId,
  };

  await saveTokens(tokens);
  return tokens;
}

// ─── Token Refresh ───────────────────────────────────────────────────

/**
 * Check if the access token is expired (or about to expire in 60s)
 */
export function isTokenExpired(tokens: TokenData): boolean {
  return Date.now() >= tokens.expires_at - 60_000;
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshAccessToken(
  tokens: TokenData,
): Promise<TokenData> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: OAUTH_CONFIG.clientId,
  });

  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Token refresh failed (${response.status}): ${errorText}\nPlease run 'login' again.`,
    );
  }

  const data = (await response.json()) as TokenResponse;

  const accountId = extractAccountId(data.access_token);

  const newTokens: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    account_id: accountId,
  };

  await saveTokens(newTokens);
  return newTokens;
}

/**
 * Get a valid access token, refreshing if needed
 */
export async function getValidToken(): Promise<TokenData> {
  const tokens = await loadTokens();

  if (!tokens) {
    throw new Error("Not authenticated. Run 'login' first.");
  }

  if (isTokenExpired(tokens)) {
    console.log("Token expired, refreshing...");
    return await refreshAccessToken(tokens);
  }

  return tokens;
}
