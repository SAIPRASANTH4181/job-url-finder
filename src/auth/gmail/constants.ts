// Google OAuth configuration for Gmail read-only access
// Client credentials are read from environment variables — never hardcoded

export const GMAIL_OAUTH_CONFIG = {
  // OAuth endpoints
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userinfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",

  // Client credentials from env vars (user creates their own Google Cloud project)
  get clientId(): string {
    const id = process.env.GOOGLE_CLIENT_ID;
    if (!id) {
      throw new Error(
        "GOOGLE_CLIENT_ID not set. Create OAuth credentials in Google Cloud Console\n" +
          "and add them to your .env file. See GMAIL_SETUP.md for instructions.",
      );
    }
    return id;
  },
  get clientSecret(): string {
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!secret) {
      throw new Error(
        "GOOGLE_CLIENT_SECRET not set. Create OAuth credentials in Google Cloud Console\n" +
          "and add them to your .env file. See GMAIL_SETUP.md for instructions.",
      );
    }
    return secret;
  },

  // Redirect URI — different port from ChatGPT (1455)
  redirectUri: "http://localhost:1456/auth/gmail/callback",
  callbackPort: 1456,
  callbackHost: "127.0.0.1",
  callbackPath: "/auth/gmail/callback",

  // Gmail read-only + email scope (email needed to identify the account)
  scopes: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email",

  // PKCE method
  codeChallengeMethod: "S256" as const,

  // Google-specific: required to get a refresh token
  accessType: "offline",
  prompt: "consent",
} as const;

// Gmail API
export const GMAIL_API_CONFIG = {
  baseUrl: "https://gmail.googleapis.com/gmail/v1",
} as const;

// Token storage — separate file from ChatGPT tokens
export const GMAIL_STORAGE_CONFIG = {
  configDir: ".job-url-finder",
  authFile: "auth-gmail.json",
} as const;
