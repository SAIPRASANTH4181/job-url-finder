import { randomBytes, createHash } from "node:crypto";

/**
 * Generate a cryptographically random PKCE code verifier
 * RFC 7636: 43-128 characters from [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 */
export function generateCodeVerifier(length: number = 64): string {
  const bytes = randomBytes(length);
  return bytes
    .toString("base64url")
    .slice(0, length);
}

/**
 * Generate S256 code challenge from verifier
 * code_challenge = BASE64URL(SHA256(code_verifier))
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = createHash("sha256").update(verifier).digest();
  return hash.toString("base64url");
}

/**
 * Generate a random state parameter to prevent CSRF attacks
 */
export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Generate all PKCE parameters needed for the OAuth flow
 */
export function generatePKCE() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  return { codeVerifier, codeChallenge, state };
}
