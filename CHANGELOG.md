# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-09

### Added
- **ChatGPT OAuth** — PKCE auth flow for Codex API via ChatGPT Plus/Pro subscription
- **Gmail OAuth** — Google OAuth with Gmail read-only access and date filtering
- **2-pass job analyzer** — Pass 1 extracts job details, Pass 2 hunts real URLs via Codex web search
- **Web dashboard** — Scan emails, view results table, submit feedback, export CSV/JSON
- **Feedback loop** — User corrections stored as few-shot examples for future Codex prompts
- **Feedback pre-population** — Verified URLs auto-filled on re-scan (skips API calls)
- **Stats dashboard** — Total corrections, unique companies, confidence rate, verified count
- **Chrome extension** — Browser agent with CDP automation, accessibility tree targeting, Codex-powered navigation
- **Extension sync** — Extension connects to local server for bidirectional feedback sync
- **CLI commands** — login, logout, status, test, scan, ui, gmail-login, gmail-logout, gmail-status, gmail-test
- **Scan persistence** — Last scan results saved and reloadable from dashboard
- **Export** — Download scan results as CSV or JSON
