import { API_CONFIG } from "../auth/constants.js";
import { getValidToken } from "../auth/token.js";

// ─── Types ───────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequestOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: Array<{ type: string; [key: string]: unknown }>;
}

// ─── Browser-like headers to pass Cloudflare ─────────────────────────

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/event-stream",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://chatgpt.com/",
  Origin: "https://chatgpt.com",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
};

// ─── API Client ──────────────────────────────────────────────────────

/**
 * Make an authenticated request to the ChatGPT backend API
 * Uses browser-like headers to pass Cloudflare protection
 */
async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const tokens = await getValidToken();

  const url = `${API_CONFIG.baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    ...BROWSER_HEADERS,
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokens.access_token}`,
    "x-account-id": tokens.account_id,
    "openai-beta": "codex-responses",
    ...(options.headers as Record<string, string> | undefined),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Parse an SSE (Server-Sent Events) stream and extract the final response text.
 * Looks for the 'response.completed' event which contains the full response.
 */
async function parseSSEStream(response: Response): Promise<string> {
  const body = response.body;
  if (!body) throw new Error("No response body");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let resultText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE events (separated by double newlines)
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? ""; // Keep incomplete event in buffer

    for (const event of events) {
      const lines = event.trim().split("\n");
      let eventType = "";
      let eventData = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7);
        } else if (line.startsWith("data: ")) {
          eventData = line.slice(6);
        }
      }

      // Look for response.completed or response.done events
      if (
        (eventType === "response.completed" ||
          eventType === "response.done") &&
        eventData
      ) {
        try {
          const parsed = JSON.parse(eventData) as {
            response?: {
              output?: Array<{
                type: string;
                content?: Array<{
                  type: string;
                  text?: string;
                }>;
              }>;
            };
          };

          const output = parsed.response?.output ?? [];
          resultText = output
            .filter((item) => item.type === "message")
            .flatMap((item) => item.content ?? [])
            .filter((c) => c.type === "output_text")
            .map((c) => c.text ?? "")
            .join("");
        } catch {
          // Not valid JSON, skip
        }
      }

      // Also collect output_text delta events for incremental text
      if (eventType === "response.output_text.delta" && eventData) {
        try {
          const parsed = JSON.parse(eventData) as { delta?: string };
          if (parsed.delta) {
            resultText += parsed.delta;
          }
        } catch {
          // skip
        }
      }
    }
  }

  return resultText || "(No response)";
}

/**
 * Send a chat request to ChatGPT backend
 * Uses the /codex/responses endpoint (same as Codex CLI)
 * Always streams (required by Codex API), then collects the full response
 */
export async function chat(options: ChatRequestOptions): Promise<string> {
  const {
    model = "gpt-5.4-mini",
    messages,
    temperature = 0.7,
    max_tokens,
  } = options;

  // Build input in the Responses API format (exclude system messages from input)
  const input = messages
    .filter((msg) => msg.role !== "system")
    .map((msg) => ({
      type: "message" as const,
      role: msg.role,
      content: [
        {
          type: msg.role === "user" ? "input_text" : "output_text",
          text: msg.content,
        },
      ],
    }));

  // Extract system message as instructions (required by Codex API)
  const systemMsg = messages.find((m) => m.role === "system");
  const instructions =
    systemMsg?.content ?? "You are a helpful AI assistant.";

  const body: Record<string, unknown> = {
    model,
    instructions,
    input,
    store: false, // Required: stateless operation for Codex backend
    stream: true, // Required: Codex API requires streaming
  };

  if (max_tokens !== undefined) body["max_output_tokens"] = max_tokens;
  if (options.tools?.length) body["tools"] = options.tools;

  // Use /codex/responses endpoint (tied to ChatGPT subscription limits)
  const response = await authenticatedFetch(API_CONFIG.codexEndpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat API error (${response.status}): ${errorText}`);
  }

  // Parse the SSE stream to get the complete response
  return await parseSSEStream(response);
}

/**
 * Simple helper: send a single message and get a response
 */
export async function ask(prompt: string, model?: string): Promise<string> {
  return chat({
    model,
    messages: [{ role: "user", content: prompt }],
  });
}
