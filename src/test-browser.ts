import "dotenv/config";
import puppeteer from "puppeteer-core";

const BRAVE_PATH = "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const USER_DATA_DIR = "C:/Users/bsaip/AppData/Local/BraveSoftware/Brave-Browser/User Data";

async function test() {
  console.log("Launching Brave with existing profile...");

  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: false,
    userDataDir: USER_DATA_DIR,
    args: [
      "--no-first-run",
      "--disable-blink-features=AutomationControlled",
      "--profile-directory=Default",
    ],
    defaultViewport: null,
  });

  const page = await browser.newPage();

  console.log("Navigating to ChatGPT...");
  await page.goto("https://chatgpt.com", { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000));

  // Type a test query
  const query = "Search the web and find the actual working job posting URL for: Supply Planner at TTI Power Equipment. The email came from tti@myworkday.com. Return ONLY the direct URL to the job posting, nothing else.";

  console.log("Typing query...");

  // Find and click the textarea
  const textarea = await page.waitForSelector('#prompt-textarea', { timeout: 10000 });
  if (!textarea) throw new Error("Could not find prompt textarea");

  await textarea.click();
  await page.keyboard.type(query, { delay: 10 });

  // Hit Enter to send
  console.log("Sending message...");
  await page.keyboard.press("Enter");

  // Wait for response — look for the streaming to stop
  console.log("Waiting for ChatGPT response (may take 30-60s with web search)...");

  // Wait for the response to appear and finish
  await new Promise((r) => setTimeout(r, 5000)); // Initial wait

  // Poll for the response to finish (no more streaming indicator)
  let attempts = 0;
  while (attempts < 60) { // Max 60 seconds
    const isStreaming = await page.evaluate(() => {
      // Check if the stop button is visible (means still generating)
      const stopBtn = document.querySelector('[data-testid="stop-button"]');
      return !!stopBtn;
    });

    if (!isStreaming) {
      // Wait a bit more to make sure it's truly done
      await new Promise((r) => setTimeout(r, 2000));
      break;
    }

    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
    if (attempts % 10 === 0) console.log(`  Still waiting... (${attempts}s)`);
  }

  // Extract the last assistant message
  const response = await page.evaluate(() => {
    const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (messages.length === 0) return "(no response found)";
    const lastMsg = messages[messages.length - 1];
    return lastMsg.textContent || "(empty response)";
  });

  console.log("\n--- ChatGPT Response ---");
  console.log(response);
  console.log("--- End ---\n");

  await browser.close();
  console.log("Done!");
}

test().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
