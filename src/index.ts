#!/usr/bin/env node

import "dotenv/config";
import { login } from "./auth/login.js";
import { loadTokens, clearTokens } from "./auth/token.js";
import { ask } from "./api/client.js";
import { gmailLogin } from "./auth/gmail/login.js";
import { loadGmailTokens, clearGmailTokens } from "./auth/gmail/token.js";
import { getRecentEmail, getAllEmails } from "./api/gmail-client.js";
import { analyzeEmails, printScanResults } from "./api/job-analyzer.js";
import { startServer } from "./server.js";

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

// ─── Gmail Commands ──────────────────────────────────────────────────

async function handleGmailLogin() {
  try {
    await gmailLogin();
  } catch (err) {
    console.error("\nGmail login failed:", (err as Error).message);
    process.exit(1);
  }
}

async function handleGmailLogout() {
  await clearGmailTokens();
  console.log("Gmail logged out. Tokens cleared.");
}

async function handleGmailStatus() {
  const tokens = await loadGmailTokens();

  if (!tokens) {
    console.log("\nGmail Status: Not authenticated");
    console.log('Run "gmail-login" to sign in with your Google account.\n');
    return;
  }

  const isExpired = Date.now() >= tokens.expires_at;
  const expiresAt = new Date(tokens.expires_at).toLocaleString();

  console.log("\n--- Gmail Authentication Status ---\n");
  console.log(`  Status:  ${isExpired ? "Expired (will auto-refresh)" : "Active"}`);
  console.log(`  Email:   ${tokens.email}`);
  console.log(`  Expires: ${expiresAt}`);
  console.log();
}

async function handleGmailTest() {
  console.log("\nFetching most recent email from Gmail...\n");
  try {
    const email = await getRecentEmail();
    console.log(`  Subject: ${email.subject}`);
    console.log(`  From:    ${email.from}`);
    console.log(`  Date:    ${email.date}`);
    console.log("\nGmail access is working!\n");
  } catch (err) {
    console.error("Gmail test failed:", (err as Error).message);
    process.exit(1);
  }
}

// ─── Scan Command ────────────────────────────────────────────────────

async function handleScan() {
  const maxEmails = parseInt(process.argv[3] ?? "100", 10);

  console.log("\n--- Job Application Scanner ---\n");
  console.log("  Step 1: Reading emails from Gmail...");

  try {
    const emails = await getAllEmails(maxEmails);

    if (emails.length === 0) {
      console.log("  No emails found in inbox.");
      return;
    }

    console.log(`\n  Step 2: Analyzing with ChatGPT...`);
    const result = await analyzeEmails(emails);

    printScanResults(result);
  } catch (err) {
    console.error("\nScan failed:", (err as Error).message);
    process.exit(1);
  }
}

async function handleUi() {
  const port = parseInt(process.argv[3] ?? "3000", 10);
  startServer(port);

  // Try to open browser automatically
  try {
    const open = (await import("open")).default;
    await open(`http://localhost:${port}`);
  } catch {
    // open package may fail in some environments — that's fine
  }
}

function showHelp() {
  console.log(`
job-url-finder - Job URL Finder CLI

Usage:
  npx tsx src/index.ts <command>

ChatGPT Commands:
  login         Sign in with your ChatGPT Plus/Pro account (OAuth)
  logout        Clear stored ChatGPT authentication tokens
  status        Show ChatGPT authentication status
  test          Send a test message to ChatGPT

Gmail Commands:
  gmail-login   Sign in with your Google account (Gmail read-only)
  gmail-logout  Clear stored Gmail authentication tokens
  gmail-status  Show Gmail authentication status
  gmail-test    Read your most recent email (confirms access)

Scanner:
  scan [count]  Scan emails, find job applications & URLs (default: 100)

Web UI:
  ui [port]     Start the web dashboard (default port: 3000)

General:
  help          Show this help message
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
  case "scan":
    await handleScan();
    break;
  case "ui":
    await handleUi();
    break;
  case "gmail-login":
    await handleGmailLogin();
    break;
  case "gmail-logout":
    await handleGmailLogout();
    break;
  case "gmail-status":
    await handleGmailStatus();
    break;
  case "gmail-test":
    await handleGmailTest();
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
