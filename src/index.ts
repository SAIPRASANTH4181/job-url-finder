#!/usr/bin/env node

import { login } from "./auth/login.js";
import { loadTokens, clearTokens } from "./auth/token.js";
import { ask } from "./api/client.js";

// ─── CLI Commands ────────────────────────────────────────────────────

async function handleLogin() {
  try {
    await login();
  } catch (err) {
    console.error("\nLogin failed:", (err as Error).message);
    process.exit(1);
  }
}

async function handleLogout() {
  await clearTokens();
  console.log("Logged out. Tokens cleared.");
}

async function handleStatus() {
  const tokens = await loadTokens();

  if (!tokens) {
    console.log("\nStatus: Not authenticated");
    console.log('Run "login" to sign in with your ChatGPT account.\n');
    return;
  }

  const isExpired = Date.now() >= tokens.expires_at;
  const expiresAt = new Date(tokens.expires_at).toLocaleString();

  console.log("\n--- Authentication Status ---\n");
  console.log(`  Status:     ${isExpired ? "Expired (will auto-refresh)" : "Active"}`);
  console.log(`  Account ID: ${tokens.account_id}`);
  console.log(`  Expires:    ${expiresAt}`);
  console.log();
}

async function handleTest() {
  console.log("\nSending test message to ChatGPT...\n");
  try {
    const response = await ask("Say hello in one sentence. Confirm you are ChatGPT.");
    console.log(`ChatGPT: ${response}\n`);
  } catch (err) {
    console.error("Test failed:", (err as Error).message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
job-url-finder - ChatGPT OAuth CLI

Usage:
  npx tsx src/index.ts <command>

Commands:
  login    Sign in with your ChatGPT Plus/Pro account (OAuth)
  logout   Clear stored authentication tokens
  status   Show current authentication status
  test     Send a test message to ChatGPT
  help     Show this help message
`);
}

// ─── Main ────────────────────────────────────────────────────────────

const command = process.argv[2];

switch (command) {
  case "login":
    await handleLogin();
    break;
  case "logout":
    await handleLogout();
    break;
  case "status":
    await handleStatus();
    break;
  case "test":
    await handleTest();
    break;
  case "help":
  case "--help":
  case "-h":
    showHelp();
    break;
  default:
    if (command) {
      console.error(`Unknown command: ${command}`);
    }
    showHelp();
    break;
}
