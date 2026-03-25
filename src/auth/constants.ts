// OpenAI Codex OAuth configuration
// Same approach used by OpenClaw and opencode-openai-codex-auth

export const OAUTH_CONFIG = {
  // OAuth endpoints
  authorizationUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",

  // Client configuration (OpenAI Codex public client)
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",

  // Redirect URI - local callback server
  redirectUri: "http://localhost:1455/auth/callback",
  callbackPort: 1455,
  callbackHost: "127.0.0.1",

  // OAuth scopes
  scopes: "openid profile email offline_access",

  // PKCE method
  codeChallengeMethod: "S256" as const,
} as const;

// ChatGPT backend API
export const API_CONFIG = {
  baseUrl: "https://chatgpt.com/backend-api",
  responsesEndpoint: "/responses",
  codexEndpoint: "/codex/responses",
} as const;

// Token storage
export const STORAGE_CONFIG = {
  configDir: ".job-url-finder",
  authFile: "auth.json",
} as const;
