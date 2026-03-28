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

  // Check for account menu / user info
  const accountInfo = await page.evaluate(() => {
    // Look for the user menu button (usually has the user's initials or avatar)
    const userMenu = document.querySelector('[data-testid="profile-button"]');
    const planBadge = document.querySelector('[data-testid="plan-badge"]');

    // Check for any element showing the plan type (Plus, Pro, Free)
    const allText = document.body.innerText;
    const hasPlusOrPro = /Plus|Pro|Team|Enterprise|Free/i.test(allText);

    return {
      userMenuExists: !!userMenu,
      userMenuText: userMenu?.textContent || "(not found)",
      planBadge: planBadge?.textContent || "(not found)",
      hasLoginButton: !!document.querySelector('[data-testid="login-button"]'),
    };
  });

  console.log("\n--- Account Info ---");
  console.log("User menu exists:", accountInfo.userMenuExists);
  console.log("User menu text:", accountInfo.userMenuText);
  console.log("Plan badge:", accountInfo.planBadge);
  console.log("Has login button:", accountInfo.hasLoginButton);

  // Try clicking the user menu to see account details
  if (accountInfo.userMenuExists) {
    console.log("\nClicking user menu...");
    await page.click('[data-testid="profile-button"]');
    await new Promise((r) => setTimeout(r, 2000));

    const menuContent = await page.evaluate(() => {
      // Look for dropdown/menu content
      const menuItems = document.querySelectorAll('[role="menuitem"], [role="menu"] *, .popover *, [data-radix-popper-content-wrapper] *');
      const texts: string[] = [];
      menuItems.forEach((el) => {
        const t = (el as HTMLElement).innerText?.trim();
        if (t && !texts.includes(t)) texts.push(t);
      });
      return texts.slice(0, 15);
    });

    console.log("Menu items:", menuContent);
  }

  // Also try navigating to settings to see account email
  console.log("\nNavigating to settings...");
  await page.goto("https://chatgpt.com/settings", { waitUntil: "networkidle2", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 3000));

  const settingsInfo = await page.evaluate(() => {
    const body = document.body.innerText;
    // Look for email patterns
    const emailMatch = body.match(/[\w.-]+@[\w.-]+\.\w+/);
    // Look for plan info
    const planMatch = body.match(/(Free|Plus|Pro|Team|Enterprise)\s*(plan|Plan)?/i);
    return {
      email: emailMatch?.[0] || "(not found)",
      plan: planMatch?.[0] || "(not found)",
      pageTitle: document.title,
    };
  });

  console.log("\n--- Settings Info ---");
  console.log("Email:", settingsInfo.email);
  console.log("Plan:", settingsInfo.plan);
  console.log("Page title:", settingsInfo.pageTitle);

  await browser.close();
  console.log("\nDone!");
}

test().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
