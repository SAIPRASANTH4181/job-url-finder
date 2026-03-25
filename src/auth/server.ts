import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { OAUTH_CONFIG } from "./constants.js";

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Authentication Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #1a1a2e;
      color: #e0e0e0;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .checkmark {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 { color: #4ade80; margin-bottom: 0.5rem; }
    p { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">&#10003;</div>
    <h1>Authentication Successful!</h1>
    <p>You can close this tab and return to the terminal.</p>
  </div>
</body>
</html>`;

const ERROR_HTML = `<!DOCTYPE html>
<html>
<head><title>Authentication Failed</title>
<style>
  body { font-family: sans-serif; display: flex; justify-content: center; align-items: center;
         min-height: 100vh; margin: 0; background: #1a1a2e; color: #e0e0e0; }
  .container { text-align: center; padding: 2rem; }
  h1 { color: #f87171; }
  p { color: #94a3b8; }
</style>
</head>
<body>
  <div class="container">
    <h1>Authentication Failed</h1>
    <p>Please try again from the terminal.</p>
  </div>
</body>
</html>`;

export interface CallbackResult {
  code: string;
}

/**
 * Start a local HTTP server to receive the OAuth callback
 * Returns a promise that resolves with the authorization code
 */
export function startCallbackServer(expectedState: string): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? "/", `http://${OAUTH_CONFIG.callbackHost}:${OAUTH_CONFIG.callbackPort}`);

      if (url.pathname !== "/auth/callback") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      // Check for errors from the OAuth provider
      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(ERROR_HTML);
        cleanup();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      // Validate state to prevent CSRF
      if (state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(ERROR_HTML);
        cleanup();
        reject(new Error("State mismatch - possible CSRF attack"));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(ERROR_HTML);
        cleanup();
        reject(new Error("No authorization code received"));
        return;
      }

      // Success!
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(SUCCESS_HTML);
      cleanup();
      resolve({ code });
    });

    const cleanup = () => {
      setTimeout(() => {
        server.close();
      }, 1000);
    };

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Authentication timed out (5 minutes). Please try again."));
    }, 5 * 60 * 1000);

    server.on("close", () => {
      clearTimeout(timeout);
    });

    server.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start callback server: ${err.message}`));
    });

    server.listen(OAUTH_CONFIG.callbackPort, OAUTH_CONFIG.callbackHost, () => {
      console.log(`Callback server listening on ${OAUTH_CONFIG.redirectUri}`);
    });
  });
}
