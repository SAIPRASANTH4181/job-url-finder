import { getValidGmailToken } from "../auth/gmail/token.js";
import { GMAIL_API_CONFIG } from "../auth/gmail/constants.js";

// ─── Types ───────────────────────────────────────────────────────────

interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessageMetadata {
  id: string;
  payload: {
    headers: GmailMessageHeader[];
  };
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  resultSizeEstimate: number;
}

export interface EmailSummary {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
}

interface GmailFullMessage {
  id: string;
  snippet: string;
  payload: {
    headers: GmailMessageHeader[];
    mimeType: string;
    body?: { data?: string; size: number };
    parts?: GmailPart[];
  };
}

interface GmailPart {
  mimeType: string;
  body?: { data?: string; size: number };
  parts?: GmailPart[];
}

// ─── Gmail API Client ────────────────────────────────────────────────

/**
 * Make an authenticated request to the Gmail API
 */
async function gmailFetch(path: string): Promise<Response> {
  const tokens = await getValidGmailToken();

  const response = await fetch(`${GMAIL_API_CONFIG.baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${errorText}`);
  }

  return response;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getHeader(headers: GmailMessageHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "(unknown)";
}

/**
 * Decode base64url-encoded email body
 */
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Recursively extract plain text body from email parts
 */
function extractTextBody(payload: GmailFullMessage["payload"]): string {
  // Simple email (no parts)
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart — look for text/plain first, then text/html
  if (payload.parts) {
    // Try text/plain first
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Fall back to text/html
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        // Strip HTML tags for a rough text extraction
        return decodeBase64Url(part.body.data)
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();
      }
    }
    // Recurse into nested multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const text = extractTextBody(part as GmailFullMessage["payload"]);
        if (text) return text;
      }
    }
  }

  return "";
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Get the most recent email (for gmail-test command)
 */
export async function getRecentEmail(): Promise<EmailSummary> {
  const listResponse = await gmailFetch("/users/me/messages?maxResults=1");
  const listData = (await listResponse.json()) as GmailListResponse;

  if (!listData.messages || listData.messages.length === 0) {
    throw new Error("No emails found in inbox");
  }

  const messageId = listData.messages[0].id;
  const msgResponse = await gmailFetch(`/users/me/messages/${messageId}?format=full`);
  const msgData = (await msgResponse.json()) as GmailFullMessage;

  const headers = msgData.payload.headers;

  return {
    id: msgData.id,
    subject: getHeader(headers, "Subject"),
    from: getHeader(headers, "From"),
    date: getHeader(headers, "Date"),
    snippet: msgData.snippet,
    body: extractTextBody(msgData.payload),
  };
}

export interface DateFilter {
  startDate?: string; // YYYY/MM/DD
  endDate?: string;   // YYYY/MM/DD
}

/**
 * Fetch all emails (up to maxResults) with optional date filtering
 * Gmail q syntax: after:YYYY/MM/DD before:YYYY/MM/DD
 * "before" is exclusive in Gmail, so we add 1 day to endDate to make it inclusive
 */
export async function getAllEmails(
  maxResults: number = 100,
  dateFilter?: DateFilter,
): Promise<EmailSummary[]> {
  // Build Gmail search query for date filtering
  let query = "";
  if (dateFilter?.startDate) {
    query += `after:${dateFilter.startDate} `;
  }
  if (dateFilter?.endDate) {
    // Gmail "before" is exclusive — add 1 day to make it inclusive
    const end = new Date(dateFilter.endDate);
    end.setDate(end.getDate() + 1);
    const inclusiveEnd = `${end.getFullYear()}/${String(end.getMonth() + 1).padStart(2, "0")}/${String(end.getDate()).padStart(2, "0")}`;
    query += `before:${inclusiveEnd} `;
  }
  query = query.trim();

  const dateInfo = query ? ` (filter: ${query})` : "";
  console.log(`  Fetching email list (up to ${maxResults})${dateInfo}...`);

  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (query) params.set("q", query);

  const listResponse = await gmailFetch(`/users/me/messages?${params.toString()}`);
  const listData = (await listResponse.json()) as GmailListResponse;

  if (!listData.messages || listData.messages.length === 0) {
    return [];
  }

  const emails: EmailSummary[] = [];
  const total = listData.messages.length;

  console.log(`  Found ${total} emails. Reading each one...`);

  for (let i = 0; i < total; i++) {
    const msgId = listData.messages[i].id;

    try {
      const msgResponse = await gmailFetch(`/users/me/messages/${msgId}?format=full`);
      const msgData = (await msgResponse.json()) as GmailFullMessage;
      const headers = msgData.payload.headers;

      emails.push({
        id: msgData.id,
        subject: getHeader(headers, "Subject"),
        from: getHeader(headers, "From"),
        date: getHeader(headers, "Date"),
        snippet: msgData.snippet,
        body: extractTextBody(msgData.payload),
      });

      // Progress indicator
      process.stdout.write(`\r  Reading emails: ${i + 1}/${total}`);
    } catch (err) {
      console.warn(`\n  Warning: Failed to read email ${msgId}: ${(err as Error).message}`);
    }
  }

  console.log(); // New line after progress
  return emails;
}
