import { readFile, writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { STORAGE_CONFIG } from "../auth/constants.js";
import type { ScanResult } from "../api/job-analyzer.js";

// ─── Types ───────────────────────────────────────────────────────────

export interface PersistedScan {
  scanId: string;
  timestamp: string;
  result: ScanResult;
}

// ─── Paths ───────────────────────────────────────────────────────────

const SCAN_FILE = join(
  homedir(),
  STORAGE_CONFIG.configDir,
  "last-scan.json",
);

// ─── Functions ───────────────────────────────────────────────────────

export async function saveLastScan(result: ScanResult): Promise<string> {
  const scanId = `scan_${Date.now()}`;
  const data: PersistedScan = {
    scanId,
    timestamp: new Date().toISOString(),
    result,
  };

  await mkdir(join(homedir(), STORAGE_CONFIG.configDir), { recursive: true });
  await writeFile(SCAN_FILE, JSON.stringify(data, null, 2), "utf-8");

  return scanId;
}

export async function loadLastScan(): Promise<PersistedScan | null> {
  try {
    const raw = await readFile(SCAN_FILE, "utf-8");
    return JSON.parse(raw) as PersistedScan;
  } catch {
    return null;
  }
}
