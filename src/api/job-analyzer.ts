import { chat } from "./client.js";
import type { EmailSummary } from "./gmail-client.js";
import { getRecentFeedback, loadFeedback } from "../storage/feedback.js";

// ─── Types ───────────────────────────────────────────────────────────

export interface JobInfo {
  company: string;
  role: string;
  jobId: string | null;
  location: string | null;
  applicationUrl: string | null;
  searchUrl: string; // Google search fallback — always available
  source: string | null;
  confidence: "high" | "medium" | "low"; // How confident we are in the URL
}

export interface GroupedJob {
  job: JobInfo;
  emails: Array<{ id: string; subject: string; from: string; date: string }>;
}

export interface ScanResult {
  totalEmails: number;
  jobEmails: number;
  nonJobEmails: number;
  jobs: GroupedJob[];
  skippedSubjects: string[];
}

// ─── Pass 1: Extract job details from emails ────────────────────────

const EXTRACT_PROMPT = `You are a job application email analyzer. You will receive a batch of emails (subject, from, snippet, body).

Most of these are acknowledgment emails like "Thank you for applying". The actual job posting URL is usually NOT in the email.

Your task:
1. Identify which emails are job application acknowledgments/confirmations/updates
2. For each job email, extract:
   - company: The company name
   - role: The exact job title
   - jobId: Any job/requisition ID found (e.g. "Req #10395", "Job ID: 3177934", numbers in subject lines)
   - location: City, State if mentioned
   - source: The platform the email came from. Look at the "from" address domain:
     * myworkday.com → "Workday"
     * greenhouse.io → "Greenhouse"
     * lever.co → "Lever"
     * icims.com → "iCIMS"
     * smartrecruiters.com → "SmartRecruiters"
     * successfactors.eu → "SuccessFactors"
     * brassring.com → "Brassring"
     * linkedin.com → "LinkedIn"
     * indeed.com → "Indeed"
     * jobvite.com → "Jobvite"
     * amazon.jobs → "Amazon"
     * Other → identify from email content or domain
   - linksInEmail: Any URLs/links found in the email body that might be the job posting (not unsubscribe or generic company links)
3. Group duplicate emails about the same job (same company + role)
4. Skip non-job emails (promotions, newsletters, social, forwarding confirmations, etc.)

IMPORTANT: Respond ONLY with valid JSON, no markdown, no explanation. Use this exact format:
{
  "jobs": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "jobId": "12345" or null,
      "location": "City, State" or null,
      "source": "Workday" or null,
      "linksInEmail": ["https://..."] or [],
      "emailIds": ["id1", "id2"]
    }
  ],
  "nonJobEmailIds": ["id3", "id4"]
}`;

// ─── Pass 2: Find real job posting URLs via web search ─────────────

function buildUrlHuntPrompt(fewShotExamples: string): string {
  const examplesSection = fewShotExamples
    ? `\nEXAMPLES OF CORRECT ANSWERS (verified by user):\n${fewShotExamples}\n\nUse these examples to understand URL patterns for similar platforms.\n`
    : "";

  return `You are an expert at finding real job posting URLs. You have access to web search.

For each job below, use web search to find the ACTUAL job posting URL. Do NOT guess or reconstruct URLs from patterns — search and verify.

SEARCH STRATEGY:
1. Search: "{company} {role} job posting" or "{company} careers {role}"
2. If you have a jobId, include it: "{company} {jobId} job"
3. If you know the platform (Workday, Greenhouse, etc.), try: "site:{platform-domain} {company} {role}"
4. Look for the actual job listing page, not a generic careers page
${examplesSection}
CONFIDENCE LEVELS:
- "high": You found the exact job posting URL via search
- "medium": You found a careers/search page that likely contains the job
- "low": You could not find the posting, providing best guess

IMPORTANT: Respond ONLY with valid JSON array:
[
  {
    "index": 0,
    "applicationUrl": "https://..." or null,
    "searchUrl": "https://www.google.com/search?q=...",
    "confidence": "high" | "medium" | "low"
  }
]`;
}

// ─── Main Analysis Function ──────────────────────────────────────────

export async function analyzeEmails(emails: EmailSummary[]): Promise<ScanResult> {
  const BATCH_SIZE = 15;
  const allJobs: Map<string, GroupedJob> = new Map();
  const allNonJobIds: string[] = [];
  const skippedSubjects: string[] = [];

  const batches = [];
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    batches.push(emails.slice(i, i + BATCH_SIZE));
  }

  // ─── Pass 1: Extract job details ────────────────────────────
  console.log(`  Pass 1: Extracting job details from ${emails.length} emails (${batches.length} batch(es))...\n`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(`  Batch ${batchIdx + 1}/${batches.length} (${batch.length} emails)...`);

    const emailData = batch.map((e) => ({
      id: e.id,
      subject: e.subject,
      from: e.from,
      date: e.date,
      snippet: e.snippet,
      body: e.body.slice(0, 2000),
    }));

    try {
      const response = await chat({
        model: "gpt-5.4-mini",
        messages: [
          { role: "system", content: EXTRACT_PROMPT },
          {
            role: "user",
            content: `Analyze these ${batch.length} emails:\n\n${JSON.stringify(emailData, null, 2)}`,
          },
        ],
        temperature: 0.1,
      });

      const parsed = JSON.parse(cleanJsonResponse(response)) as {
        jobs: Array<{
          company: string;
          role: string;
          jobId: string | null;
          location: string | null;
          source: string | null;
          linksInEmail: string[];
          emailIds: string[];
        }>;
        nonJobEmailIds: string[];
      };

      for (const job of parsed.jobs) {
        const key = `${job.company.toLowerCase()}|${job.role.toLowerCase()}`;
        const existing = allJobs.get(key);

        const emailRefs = job.emailIds.map((id) => {
          const email = emails.find((e) => e.id === id);
          return {
            id,
            subject: email?.subject ?? "(unknown)",
            from: email?.from ?? "(unknown)",
            date: email?.date ?? "(unknown)",
          };
        });

        // Check if any link from email looks like a job posting
        const emailUrl = (job.linksInEmail ?? []).find((url) =>
          /job|career|position|apply|requisition/i.test(url),
        ) ?? null;

        if (existing) {
          existing.emails.push(...emailRefs);
          if (!existing.job.jobId && job.jobId) existing.job.jobId = job.jobId;
          if (!existing.job.applicationUrl && emailUrl) existing.job.applicationUrl = emailUrl;
          if (!existing.job.location && job.location) existing.job.location = job.location;
        } else {
          allJobs.set(key, {
            job: {
              company: job.company,
              role: job.role,
              jobId: job.jobId,
              location: job.location,
              applicationUrl: emailUrl,
              searchUrl: "", // Will be filled in Pass 2
              source: job.source,
              confidence: emailUrl ? "high" : "low",
            },
            emails: emailRefs,
          });
        }
      }

      for (const id of parsed.nonJobEmailIds ?? []) {
        allNonJobIds.push(id);
        const email = emails.find((e) => e.id === id);
        if (email) skippedSubjects.push(email.subject);
      }
    } catch (err) {
      console.error(`  Error in batch ${batchIdx + 1}: ${(err as Error).message}`);
    }
  }

  // ─── Pre-populate from feedback store ───────────────────────
  const feedbackStore = await loadFeedback();
  const feedbackMap = new Map(
    feedbackStore.entries.map((e) => [
      `${e.company.toLowerCase()}|${e.role.toLowerCase()}`,
      e.correctUrl,
    ]),
  );

  const jobs = Array.from(allJobs.values());
  let feedbackHits = 0;
  for (const grouped of jobs) {
    const key = `${grouped.job.company.toLowerCase()}|${grouped.job.role.toLowerCase()}`;
    const verified = feedbackMap.get(key);
    if (verified && !grouped.job.applicationUrl) {
      grouped.job.applicationUrl = verified;
      grouped.job.confidence = "high";
      feedbackHits++;
    }
  }
  if (feedbackHits > 0) {
    console.log(`  Pre-filled ${feedbackHits} job URL(s) from user feedback.`);
  }

  // ─── Pass 2: Hunt for job URLs ──────────────────────────────
  const jobsNeedingUrls = jobs.filter((j) => !j.job.applicationUrl);

  if (jobsNeedingUrls.length > 0) {
    console.log(`\n  Pass 2: Searching web for ${jobsNeedingUrls.length} job URLs using ChatGPT...\n`);

    const jobSummaries = jobsNeedingUrls.map((j, idx) => ({
      index: idx,
      company: j.job.company,
      role: j.job.role,
      jobId: j.job.jobId,
      location: j.job.location,
      source: j.job.source,
    }));

    // Build few-shot examples from user feedback
    const feedback = await getRecentFeedback(10);
    const fewShotExamples = feedback
      .map((f) => `- ${f.company} "${f.role}" (${f.source ?? "unknown platform"}) → ${f.correctUrl}`)
      .join("\n");

    try {
      const response = await chat({
        model: "gpt-5.4-mini",
        messages: [
          { role: "system", content: buildUrlHuntPrompt(fewShotExamples) },
          {
            role: "user",
            content: `Find job posting URLs for these ${jobSummaries.length} jobs:\n\n${JSON.stringify(jobSummaries, null, 2)}`,
          },
        ],
        temperature: 0.1,
        tools: [{ type: "web_search_preview" }],
      });

      const urlResults = JSON.parse(cleanJsonResponse(response)) as Array<{
        index: number;
        applicationUrl: string | null;
        searchUrl: string;
        confidence: "high" | "medium" | "low";
      }>;

      for (const result of urlResults) {
        if (result.index >= 0 && result.index < jobsNeedingUrls.length) {
          const job = jobsNeedingUrls[result.index].job;
          job.applicationUrl = result.applicationUrl;
          job.searchUrl = result.searchUrl;
          job.confidence = result.confidence;
        }
      }
    } catch (err) {
      console.error(`  Error hunting URLs: ${(err as Error).message}`);
    }
  }

  // Fill in Google search URLs for any jobs still missing them
  for (const grouped of jobs) {
    const job = grouped.job;
    if (!job.searchUrl) {
      const query = encodeURIComponent(
        `${job.company} ${job.role}${job.jobId ? " " + job.jobId : ""} job posting apply`,
      );
      job.searchUrl = `https://www.google.com/search?q=${query}`;
    }
  }

  return {
    totalEmails: emails.length,
    jobEmails: emails.length - allNonJobIds.length,
    nonJobEmails: allNonJobIds.length,
    jobs,
    skippedSubjects,
  };
}

/**
 * Clean ChatGPT response that might have markdown code fences
 */
function cleanJsonResponse(response: string): string {
  let cleaned = response.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

/**
 * Print scan results to terminal
 */
export function printScanResults(result: ScanResult): void {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    JOB APPLICATION SCAN                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log(`  Total emails scanned:  ${result.totalEmails}`);
  console.log(`  Job-related emails:    ${result.jobEmails}`);
  console.log(`  Non-job emails:        ${result.nonJobEmails}`);
  console.log(`  Unique jobs found:     ${result.jobs.length}\n`);

  console.log("─".repeat(62));

  const confidenceIcon = { high: "🟢", medium: "🟡", low: "🔴" };

  for (let i = 0; i < result.jobs.length; i++) {
    const { job, emails } = result.jobs[i];
    console.log(`\n  #${i + 1}  ${job.company} — ${job.role}`);
    if (job.jobId) console.log(`      Job ID:     ${job.jobId}`);
    if (job.location) console.log(`      Location:   ${job.location}`);
    if (job.source) console.log(`      Source:     ${job.source}`);
    console.log(`      Confidence: ${confidenceIcon[job.confidence]} ${job.confidence}`);
    if (job.applicationUrl) {
      console.log(`      URL:        ${job.applicationUrl}`);
    } else {
      console.log(`      URL:        ⚠ Not found`);
    }
    console.log(`      Search:     ${job.searchUrl}`);
    console.log(`      Emails:     ${emails.length} related email(s)`);
  }

  console.log("\n" + "─".repeat(62));

  if (result.skippedSubjects.length > 0) {
    console.log(`\n  Skipped non-job emails (${result.skippedSubjects.length}):`);
    for (const subject of result.skippedSubjects) {
      console.log(`    - ${subject.slice(0, 60)}`);
    }
  }

  console.log();
}
