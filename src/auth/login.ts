import { OAUTH_CONFIG } from "./constants.js";
import { generatePKCE } from "./pkce.js";
import { openBrowser } from "./browser.js";
import { startCallbackServer } from "./server.js";
import { exchangeCodeForTokens, type TokenData } from "./token.js";

/**
 * Build the full OAuth authorization URL with PKCE parameters
 */
function buildAuthUrl(codeChallenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: OAUTH_CONFIG.codeChallengeMethod,
  });

  return `${OAUTH_CONFIG.authorizationUrl}?${params.toString()}`;
}

/**
 * Run the full OAuth login flow:
 * 1. Generate PKCE challenge + state
 * 2. Start local callback server
 * 3. Open browser for ChatGPT login
 * 4. Wait for callback with auth code
 * 5. Exchange code for tokens
 * 6. Store tokens locally
 */
export async function login(): Promise<TokenData> {
  console.log("\n--- ChatGPT OAuth Login ---\n");
  console.log("This will open your browser to sign in with your ChatGPT account.");
  console.log("Your ChatGPT Plus/Pro subscription will be used (no API key needed).\n");

  // Step 1: Generate PKCE parameters
  const { codeVerifier, codeChallenge, state } = generatePKCE();

  // Step 2: Start callback server (before opening browser)
  const callbackPromise = startCallbackServer(state);

  // Step 3: Build auth URL and open browser
  const authUrl = buildAuthUrl(codeChallenge, state);
  await openBrowser(authUrl);

  console.log("Waiting for authentication...\n");

  // Step 4: Wait for the callback with the authorization code
  const { code } = await callbackPromise;
  console.log("Authorization code received!\n");

  // Step 5: Exchange code for tokens
  console.log("Exchanging code for tokens...");
  const tokens = await exchangeCodeForTokens(code, codeVerifier);

  // Step 6: Done!
  console.log("\nAuthentication successful!");
  console.log(`Account ID: ${tokens.account_id}`);
  console.log(`Token expires: ${new Date(tokens.expires_at).toLocaleString()}\n`);

  return tokens;
}
