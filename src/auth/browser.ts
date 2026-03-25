/**
 * Open a URL in the user's default browser
 * Falls back to printing the URL if browser can't be opened
 */
export async function openBrowser(url: string): Promise<void> {
  try {
    // Dynamic import for ESM compatibility
    const open = (await import("open")).default;
    await open(url);
    console.log("\nBrowser opened. Please log in with your ChatGPT account.");
  } catch {
    console.log("\nCould not open browser automatically.");
    console.log("Please open this URL manually:\n");
    console.log(`  ${url}\n`);
  }
}
