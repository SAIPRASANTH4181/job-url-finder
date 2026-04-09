# Contributing to Job URL Finder

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/SAIPRASANTH4181/job-url-finder.git
   cd job-url-finder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Fill in your Google OAuth credentials (see README for details)
   ```

4. **Authenticate**
   ```bash
   npx tsx src/index.ts login        # ChatGPT
   npx tsx src/index.ts gmail-login  # Gmail
   ```

5. **Run in dev mode**
   ```bash
   npx tsx src/index.ts ui           # Dashboard at localhost:3000
   npx tsx src/index.ts scan 10      # Quick CLI scan
   ```

## Project Layout

- `src/auth/` — OAuth flows for ChatGPT and Gmail
- `src/api/` — Codex API client, Gmail client, job analyzer (2-pass pipeline)
- `src/storage/` — Feedback and scan result persistence
- `src/ui/` — Web dashboard (single-file vanilla HTML/CSS/JS)
- `extension/` — Chrome extension (browser agent + sidepanel)

## Type Checking

```bash
npx tsc --noEmit
```

Note: `src/test-account.ts` and `src/test-browser.ts` have known DOM-related type errors (they run in browser context). Core source files should compile clean.

## Making Changes

1. Create a feature branch: `git checkout -b feature/my-change`
2. Make your changes
3. Verify types: `npx tsc --noEmit`
4. Test manually with `npx tsx src/index.ts ui` or `scan`
5. Commit with a clear message describing what and why
6. Open a pull request against `master`

## Areas for Contribution

- **Better URL detection** — Improve the Codex prompts or add post-processing heuristics
- **New email sources** — Support Outlook or other email providers
- **Testing** — Add automated tests for the analyzer and feedback loop
- **UI improvements** — Enhance the dashboard or extension sidepanel
- **Platform patterns** — Add known URL patterns for specific ATS platforms

## Code Style

- TypeScript with strict mode
- ES modules (`"type": "module"`)
- No external UI frameworks — dashboard is vanilla HTML/CSS/JS
- Prefer simple, readable code over abstractions
