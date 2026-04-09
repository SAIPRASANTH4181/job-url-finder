import { readFile, writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { STORAGE_CONFIG } from "../auth/constants.js";

// ─── Types ───────────────────────────────────────────────────────────

export interface FeedbackEntry {
  id: string;
  company: string;
  role: string;
  jobId: string | null;
  source: string | null;
  fromDomain: string;
  subjectSnippet: string;
  correctUrl: string;
  createdAt: string;
}

interface FeedbackStore {
  entries: FeedbackEntry[];
}

// ─── Paths ───────────────────────────────────────────────────────────

const FEEDBACK_FILE = join(
  homedir(),
  STORAGE_CONFIG.configDir,
  "feedback.json",
);

// ─── Functions ───────────────────────────────────────────────────────

export async function loadFeedback(): Promise<FeedbackStore> {
  try {
    const raw = await readFile(FEEDBACK_FILE, "utf-8");
    return JSON.parse(raw) as FeedbackStore;
  } catch {
    return { entries: [] };
  }
}

export async function saveFeedback(
  entry: Omit<FeedbackEntry, "id" | "createdAt">,
): Promise<FeedbackEntry> {
  const store = await loadFeedback();

  const full: FeedbackEntry = {
    ...entry,
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  store.entries.push(full);

  await mkdir(join(homedir(), STORAGE_CONFIG.configDir), { recursive: true });
  await writeFile(FEEDBACK_FILE, JSON.stringify(store, null, 2), "utf-8");

  return full;
}

export async function getRecentFeedback(
  limit = 10,
): Promise<FeedbackEntry[]> {
  const store = await loadFeedback();
  return store.entries.slice(-limit);
}
