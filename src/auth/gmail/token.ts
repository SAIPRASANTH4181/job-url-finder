import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { GMAIL_OAUTH_CONFIG, GMAIL_STORAGE_CONFIG } from "./constants.js";

// ─── Types ───────────────────────────────────────────────────────────

export interface GmailTokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in ms
  email: string; // Gmail address (for display only)
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string; // Google only returns this on first auth
  expires_in: number;
  token_type: string;
  scope: string;
}

// ─── Token Storage ───────────────────────────────────────────────────

function getConfigDir(): string {
  return join(homedir(), GMAIL_STORAGE_CONFIG.configDir);
}

function getAuthFilePath(): string {
  return join(getConfigDir(), GMAIL_STORAGE_CONFIG.authFile);
}

export async function saveGmailTokens(tokens: GmailTokenData): Promise<void> {
  const dir = getConfigDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getAuthFilePath(), JSON.stringify(tokens, null, 2), "utf-8");
}

export async function loadGmailTokens(): Promise<GmailTokenData | null> {
  try {
    const data = await readFile(getAuthFilePath(), "utf-8");
    return JSON.parse(data) as GmailTokenData;
  } catch {
    return null;
  }
}

export async function clearGmailTokens(): Promise<void> {
  try {
    await unlink(getAuthFilePath());
  } catch {
    // File doesn't exist, that's fine
  }
}

// ─── Fetch User Email ───────────────────────────────────────────────

/**
 * Get the Gmail address from Google's userinfo endpoint
 * This is the only personal data we store (for display in status)
 */
async function fetchUserEmail(accessToken: string): Promise<string> {
  const response = await fetch(GMAIL_OAUTH_CONFIG.userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.status}`);
  }

  const data = (await response.json()) as { email?: string };
  if (!data.email) {
    throw new Error("Could not get email from Google userinfo");
  }
  return data.email;
}

// ─── Token Exchange ──────────────────────────────────────────────────

/**
 * Exchange authorization code for tokens
 * Google requires client_secret in the token exchange (unlike OpenAI)
 */
export async function exchangeGmailCode(
  code: string,
  codeVerifier: string,
): Promise<GmailTokenData> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: GMAIL_OAUTH_CONFIG.redirectUri,
    client_id: GMAIL_OAUTH_CONFIG.clientId,
    client_secret: GMAIL_OAUTH_CONFIG.clientSecret,
    code_verifier: codeVerifier,
  });

  const response = await fetch(GMAIL_OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail token exchange failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as GoogleTokenResponse;

  if (!data.access_token) {
    throw new Error("Invalid token response - missing access token");
  }

  if (!data.refresh_token) {
    throw new Error(
      "No refresh token received. This usually means the app was already authorized.\n" +
        "Go to https://myaccount.google.com/connections and remove this app, then try again.",
    );
  }

  // Fetch the user's email address
  const email = await fetchUserEmail(data.access_token);

  const tokens: GmailTokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    email,
  };

  await saveGmailTokens(tokens);
  return tokens;
}

// ─── Token Refresh ───────────────────────────────────────────────────

export function isGmailTokenExpired(tokens: GmailTokenData): boolean {
  return Date.now() >= tokens.expires_at - 60_000;
}

/**
 * Refresh the Gmail access token
 * Note: Google does NOT return a new refresh_token on refresh,
 * so we preserve the existing one
 */
export async function refreshGmailToken(
  tokens: GmailTokenData,
): Promise<GmailTokenData> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: GMAIL_OAUTH_CONFIG.clientId,
    client_secret: GMAIL_OAUTH_CONFIG.clientSecret,
  });

  const response = await fetch(GMAIL_OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gmail token refresh failed (${response.status}): ${errorText}\n` +
        "Please run 'gmail-login' again.",
    );
  }

  const data = (await response.json()) as GoogleTokenResponse;

  const newTokens: GmailTokenData = {
    access_token: data.access_token,
    refresh_token: tokens.refresh_token, // Preserve existing refresh token
    expires_at: Date.now() + data.expires_in * 1000,
    email: tokens.email,
  };

  await saveGmailTokens(newTokens);
  return newTokens;
}

/**
 * Get a valid Gmail access token, refreshing if needed
 */
export async function getValidGmailToken(): Promise<GmailTokenData> {
  const tokens = await loadGmailTokens();

  if (!tokens) {
    throw new Error("Gmail not authenticated. Run 'gmail-login' first.");
  }

  if (isGmailTokenExpired(tokens)) {
    console.log("Gmail token expired, refreshing...");
    return await refreshGmailToken(tokens);
  }

  return tokens;
}
