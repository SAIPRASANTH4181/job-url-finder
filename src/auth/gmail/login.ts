import { GMAIL_OAUTH_CONFIG } from "./constants.js";
import { generatePKCE } from "../pkce.js";
import { openBrowser } from "../browser.js";
import { startCallbackServer } from "../server.js";
import { exchangeGmailCode, type GmailTokenData } from "./token.js";

/**
 * Build the Google OAuth authorization URL
 */
function buildGmailAuthUrl(codeChallenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: GMAIL_OAUTH_CONFIG.clientId,
    redirect_uri: GMAIL_OAUTH_CONFIG.redirectUri,
    scope: GMAIL_OAUTH_CONFIG.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: GMAIL_OAUTH_CONFIG.codeChallengeMethod,
    access_type: GMAIL_OAUTH_CONFIG.accessType,
    prompt: GMAIL_OAUTH_CONFIG.prompt,
  });

  return `${GMAIL_OAUTH_CONFIG.authorizationUrl}?${params.toString()}`;
}

/**
 * Run the full Gmail OAuth login flow:
 * 1. Generate PKCE challenge + state
 * 2. Start local callback server (port 1456)
 * 3. Open browser for Google sign-in
 * 4. Wait for callback with auth code
 * 5. Exchange code for tokens
 * 6. Fetch user email
 * 7. Store tokens locally
 */
export async function gmailLogin(): Promise<GmailTokenData> {
  console.log("\n--- Gmail OAuth Login ---\n");
  console.log("This will open your browser to sign in with your Google account.");
  console.log("Only read-only Gmail access is requested (gmail.readonly).\n");

  // Step 1: Generate PKCE parameters
  const { codeVerifier, codeChallenge, state } = generatePKCE();

  // Step 2: Start callback server on port 1456
  const callbackPromise = startCallbackServer(state, {
    port: GMAIL_OAUTH_CONFIG.callbackPort,
    host: GMAIL_OAUTH_CONFIG.callbackHost,
    path: GMAIL_OAUTH_CONFIG.callbackPath,
  });

  // Step 3: Build auth URL and open browser
  const authUrl = buildGmailAuthUrl(codeChallenge, state);
  await openBrowser(authUrl);

  console.log("Waiting for Google authentication...\n");

  // Step 4: Wait for the callback
  const { code } = await callbackPromise;
  console.log("Authorization code received!\n");

  // Step 5: Exchange code for tokens + fetch email
  console.log("Exchanging code for tokens...");
  const tokens = await exchangeGmailCode(code, codeVerifier);

  // Step 6: Done!
  console.log("\nGmail authentication successful!");
  console.log(`Email: ${tokens.email}`);
  console.log(`Token expires: ${new Date(tokens.expires_at).toLocaleString()}\n`);

  return tokens;
}
