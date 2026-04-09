import "dotenv/config";
import { createServer } from "node:http";
import { loadTokens } from "./auth/token.js";
import { loadGmailTokens } from "./auth/gmail/token.js";
import { getAllEmails } from "./api/gmail-client.js";
import { analyzeEmails } from "./api/job-analyzer.js";
import { getDashboardHtml } from "./ui/dashboard.js";
import { saveFeedback, loadFeedback } from "./storage/feedback.js";
import { saveLastScan, loadLastScan } from "./storage/results.js";

// ─── HTTP Server ────────────────────────────────────────────────────

export function startServer(port: number = 3000): void {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // CORS headers (for local dev)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // ─── Routes ─────────────────────────────────────────────────

      if (url.pathname === "/" && req.method === "GET") {
        // Serve the dashboard HTML
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getDashboardHtml());
        return;
      }

      if (url.pathname === "/api/status" && req.method === "GET") {
        // Check auth status for both services
        const [chatgptTokens, gmailTokens] = await Promise.all([
          loadTokens(),
          loadGmailTokens(),
        ]);

        const status = {
          chatgpt: {
            authenticated: !!chatgptTokens,
            expired: chatgptTokens
              ? Date.now() >= chatgptTokens.expires_at
              : false,
            accountId: chatgptTokens?.account_id ?? null,
          },
          gmail: {
            authenticated: !!gmailTokens,
            expired: gmailTokens
              ? Date.now() >= gmailTokens.expires_at
              : false,
            email: gmailTokens?.email ?? null,
          },
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(status));
        return;
      }

      if (url.pathname === "/api/email-count" && req.method === "GET") {
        // Get total email count from Gmail inbox
        const gmailTokens = await loadGmailTokens();
        if (!gmailTokens) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Gmail not authenticated" }));
          return;
        }

        const { getValidGmailToken } = await import("./auth/gmail/token.js");
        const tokens = await getValidGmailToken();
        const profileRes = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/profile",
          { headers: { Authorization: `Bearer ${tokens.access_token}` } },
        );
        const profile = (await profileRes.json()) as { messagesTotal?: number };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ total: profile.messagesTotal ?? 0 }));
        return;
      }

      if (url.pathname === "/api/scan" && req.method === "POST") {
        // Parse request body for maxEmails
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }

        let maxEmails = 100;
        let startDate: string | undefined;
        let endDate: string | undefined;
        try {
          const parsed = JSON.parse(body) as {
            maxEmails?: number;
            startDate?: string;
            endDate?: string;
          };
          if (parsed.maxEmails && parsed.maxEmails > 0) {
            maxEmails = parsed.maxEmails;
          }
          if (parsed.startDate) startDate = parsed.startDate;
          if (parsed.endDate) endDate = parsed.endDate;
        } catch {
          // Use defaults
        }

        const dateInfo = startDate || endDate
          ? ` (${startDate || "..."} to ${endDate || "..."})`
          : "";
        console.log(`[API] Starting scan of ${maxEmails} emails${dateInfo}...`);

        const emails = await getAllEmails(maxEmails, { startDate, endDate });

        if (emails.length === 0) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              totalEmails: 0,
              jobEmails: 0,
              nonJobEmails: 0,
              jobs: [],
              skippedSubjects: [],
            }),
          );
          return;
        }

        const result = await analyzeEmails(emails);
        const scanId = await saveLastScan(result);

        console.log(
          `[API] Scan complete: ${result.jobs.length} jobs found from ${result.totalEmails} emails (${scanId})`,
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ...result, scanId }));
        return;
      }

      if (url.pathname === "/api/feedback" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }

        const data = JSON.parse(body) as {
          company: string;
          role: string;
          jobId?: string | null;
          source?: string | null;
          fromDomain: string;
          subjectSnippet: string;
          correctUrl: string;
        };

        const entry = await saveFeedback({
          company: data.company,
          role: data.role,
          jobId: data.jobId ?? null,
          source: data.source ?? null,
          fromDomain: data.fromDomain,
          subjectSnippet: data.subjectSnippet,
          correctUrl: data.correctUrl,
        });

        console.log(`[API] Feedback saved: ${entry.company} — ${entry.role} → ${entry.correctUrl}`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, entry }));
        return;
      }

      if (url.pathname === "/api/feedback" && req.method === "GET") {
        const store = await loadFeedback();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(store));
        return;
      }

      if (url.pathname === "/api/stats" && req.method === "GET") {
        const store = await loadFeedback();
        const scan = await loadLastScan();

        const totalFeedback = store.entries.length;
        const uniqueCompanies = new Set(store.entries.map((e) => e.company.toLowerCase())).size;

        // Source breakdown from feedback
        const sourceCounts: Record<string, number> = {};
        for (const e of store.entries) {
          const src = e.source || "unknown";
          sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        }

        // Accuracy from last scan: how many jobs had high confidence vs total
        let lastScanJobs = 0;
        let highConfidence = 0;
        let feedbackMatches = 0;
        if (scan) {
          lastScanJobs = scan.result.jobs.length;
          for (const g of scan.result.jobs) {
            if (g.job.confidence === "high") highConfidence++;
            const key = `${g.job.company.toLowerCase()}|${g.job.role.toLowerCase()}`;
            if (store.entries.some((e) => `${e.company.toLowerCase()}|${e.role.toLowerCase()}` === key)) {
              feedbackMatches++;
            }
          }
        }

        const stats = {
          totalFeedback,
          uniqueCompanies,
          sourceCounts,
          lastScan: lastScanJobs > 0
            ? { totalJobs: lastScanJobs, highConfidence, feedbackMatches }
            : null,
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(stats));
        return;
      }

      if (url.pathname === "/api/last-scan" && req.method === "GET") {
        const scan = await loadLastScan();
        if (!scan) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No previous scan found" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(scan));
        return;
      }

      // 404
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      console.error("[API] Error:", (err as Error).message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  });

  server.listen(port, () => {
    console.log(`\n  Job URL Finder — Web Dashboard`);
    console.log(`  ──────────────────────────────`);
    console.log(`  Running at: http://localhost:${port}`);
    console.log(`  Press Ctrl+C to stop\n`);
  });
}
