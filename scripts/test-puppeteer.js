const puppeteer = require("puppeteer");

async function test() {
  console.log("Testing Puppeteer with /snap/bin/chromium...");
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: "/snap/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ]
    });
    console.log("SUCCESS! Browser launched. Version:", await browser.version());
    await browser.close();
    console.log("Browser closed successfully.");
  } catch (err) {
    console.error("FAIL to launch /snap/bin/chromium:", err);
  }
}

test();
