# Job URL Finder

Scans your Gmail for job application emails, identifies which companies/roles you applied to, and finds the actual job posting URLs using ChatGPT Codex. Includes a feedback loop where your corrections improve future results.

## How It Works

1. **Scan Gmail** — Reads your inbox for job application acknowledgment emails
2. **Extract with Codex** — Pass 1 identifies company, role, job ID, source platform (Workday, Greenhouse, etc.)
3. **Hunt URLs with Codex** — Pass 2 uses web search to find the real job posting URL
4. **User Feedback** — You paste the correct URL when the system gets it wrong
5. **Learn & Improve** — Corrections are stored and used as few-shot examples in future scans; verified URLs are pre-filled on re-scan

## Prerequisites

- **Node.js** 18+
- **ChatGPT Plus or Pro subscription** (uses the Codex API via your account)
- **Google Cloud project** with Gmail API enabled and OAuth 2.0 credentials

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env` file

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

To get Google credentials:
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Create a project (or use existing)
- Enable the **Gmail API**
- Go to APIs & Services > Credentials > Create OAuth 2.0 Client ID (Desktop app)
- Add redirect URI: `http://localhost:1456/auth/gmail/callback`

ChatGPT uses a public Codex client ID (no env var needed) — you just need an active subscription.

### 3. Authenticate

```bash
# ChatGPT (opens browser to sign in)
npx tsx src/index.ts login
npx tsx src/index.ts status

# Gmail (opens browser to sign in)
npx tsx src/index.ts gmail-login
npx tsx src/index.ts gmail-status
```

## Usage

### CLI

```bash
# Scan 50 most recent emails
npx tsx src/index.ts scan 50

# Quick test — verify ChatGPT API works
npx tsx src/index.ts test

# Quick test — verify Gmail access
npx tsx src/index.ts gmail-test
```

### Web Dashboard

```bash
npx tsx src/index.ts ui
# Opens http://localhost:3000
```

The dashboard lets you:
- **Scan emails** with configurable count and date range
- **View results** in a table with company, role, job ID, location, source, URL, and confidence
- **Submit corrections** — paste the correct URL for any job the system got wrong
- **Export results** as CSV or JSON
- **View feedback stats** — total corrections, unique companies, accuracy rate
- **Load last scan** — view previous results without re-scanning

### Chrome Extension (Optional)

The browser agent extension can autonomously search for job URLs:

1. Go to `chrome://extensions` > Enable Developer mode
2. Click "Load unpacked" > select the `extension/` folder
3. Click the extension icon to open the sidepanel
4. Login with ChatGPT
5. Type a task (e.g. "Find the job posting for Stripe Senior SWE on their careers page")
6. The agent navigates the web and returns the URL
7. Results auto-sync to the local server when it's running

## Verification

To confirm everything works end-to-end:

```bash
# 1. Check auth status for both services
npx tsx src/index.ts status
npx tsx src/index.ts gmail-status
# Both should show "Active"

# 2. Run a small scan
npx tsx src/index.ts scan 10
# Should print job applications found with URLs and confidence levels

# 3. Start dashboard
npx tsx src/index.ts ui
# Open http://localhost:3000
# - Auth badges (top-right) should both be green
# - Click "Scan Emails" with count=10
# - Jobs table should populate
# - Try pasting a correct URL in the feedback input and click "Save"
# - Run another scan — the corrected job should show "high" confidence
# - Click "Export CSV" to verify export works
# - Feedback stats section should show your correction count
```

## Project Structure

```
src/
  index.ts              # CLI entry point
  server.ts             # HTTP server with API routes
  auth/
    login.ts            # ChatGPT OAuth PKCE flow
    token.ts            # Token storage & auto-refresh
    constants.ts        # OAuth & API config
    gmail/
      login.ts          # Gmail OAuth flow
      token.ts          # Gmail token management
      constants.ts      # Google OAuth config
  api/
    client.ts           # ChatGPT Codex API client (SSE streaming)
    gmail-client.ts     # Gmail API client (fetch & parse emails)
    job-analyzer.ts     # 2-pass analysis: extract jobs + hunt URLs
  storage/
    feedback.ts         # User correction storage (feedback loop)
    results.ts          # Scan result persistence
  ui/
    dashboard.ts        # Web dashboard (single-file HTML/CSS/JS)
extension/
  manifest.json         # Chrome extension manifest v3
  background.js         # Browser agent + Codex API + server sync
  sidepanel.html/js/css # Extension UI
  content.js            # Page accessibility tree extraction
```

## Data Storage

All data is stored locally in `~/.job-url-finder/`:

| File | Purpose |
|------|---------|
| `auth.json` | ChatGPT OAuth tokens |
| `auth-gmail.json` | Gmail OAuth tokens |
| `feedback.json` | User-submitted correct URLs (training data) |
| `last-scan.json` | Most recent scan results |

## API Endpoints (when dashboard is running)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard HTML |
| `/api/status` | GET | Auth status for both services |
| `/api/email-count` | GET | Total Gmail inbox count |
| `/api/scan` | POST | Run a scan (body: `{maxEmails, startDate?, endDate?}`) |
| `/api/feedback` | GET | All user corrections |
| `/api/feedback` | POST | Submit a correction |
| `/api/stats` | GET | Feedback stats & accuracy metrics |
| `/api/last-scan` | GET | Load previous scan results |

## CLI Commands

```
ChatGPT:     login | logout | status | test
Gmail:       gmail-login | gmail-logout | gmail-status | gmail-test
Scanner:     scan [count]
Dashboard:   ui [port]
Help:        help
```

## License

ISC
