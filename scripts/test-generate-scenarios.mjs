import puppeteer from "puppeteer-core";
import { resolve } from "path";

const BASE = "http://127.0.0.1:8787";
const imgPath = resolve("/workspace/app.suppliersden.com/icons/icon128.png");

async function runScenario(name, opts) {
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  const logs = [];
  page.on("console", (msg) => logs.push(msg.text()));
  page.on("pageerror", (err) => logs.push("ERR:" + err.message));

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.meeshoOptimizer, { timeout: 15000 });

  if (opts.manual === false) {
    await page.evaluate(() => {
      const el = document.getElementById("manual-shipping-mode");
      if (el) el.checked = false;
    });
  }

  if (opts.session) {
    await page.evaluate(() => {
      localStorage.setItem(
        "meesho_web_session_v1",
        JSON.stringify({
          supplierId: "3580323",
          browserId: "test-browser-id",
          identifier: "ytnlz",
          price: "100",
        }),
      );
    });
    await page.evaluate(() => window.meeshoOptimizer?.mountEmbedded?.(document.getElementById("optimizer-app")));
  }

  const input = await page.$("#image-input");
  await input.uploadFile(imgPath);
  await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);

  const t0 = Date.now();
  await page.click("#generate-btn");

  let done = false;
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const snap = await page.evaluate(() => ({
      resultsLen: window.meeshoOptimizer?.currentResults?.length || 0,
      isProcessing: window.meeshoOptimizer?.isProcessing,
      processing: document.getElementById("processing-area")?.style.display,
    }));
    if (snap.resultsLen > 0) {
      console.log(name, "OK", snap.resultsLen, "in", Date.now() - t0, "ms");
      done = true;
      break;
    }
    if (!snap.isProcessing && snap.processing === "none" && i > 3) {
      console.log(name, "STUCK/FAILED", snap, Date.now() - t0, "ms");
      console.log(logs.slice(-15).join("\n"));
      break;
    }
  }
  if (!done) console.log(name, "TIMEOUT", Date.now() - t0, "ms", logs.slice(-10));
  await browser.close();
}

await runScenario("manual-on", { manual: true });
await runScenario("manual-off-no-session", { manual: false });
await runScenario("manual-off-with-session", { manual: false, session: true });
