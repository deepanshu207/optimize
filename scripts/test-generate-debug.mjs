import puppeteer from "puppeteer-core";
import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE = "http://127.0.0.1:8787";
const imgPath = resolve("/workspace/app.suppliersden.com/icons/icon128.png");

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 30000 });
await page.waitForFunction(() => window.meeshoOptimizer, { timeout: 15000 });

const input = await page.$("#image-input");
await input.uploadFile(imgPath);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);

const stateBefore = await page.evaluate(() => ({
  licensed: window.meeshoOptimizer?.isLicensed,
  manual: document.getElementById("manual-shipping-mode")?.checked,
  pending: !!window.meeshoOptimizer?._pendingFile,
}));

console.log("STATE_BEFORE", stateBefore);
await page.click("#generate-btn");

for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const snap = await page.evaluate(() => ({
    isProcessing: window.meeshoOptimizer?.isProcessing,
    resultsLen: window.meeshoOptimizer?.currentResults?.length,
    processingDisplay: document.getElementById("processing-area")?.style.display,
    resultsDisplay: document.getElementById("results-area")?.style.display,
    bootMsg: document.getElementById("boot-msg")?.textContent,
    notifications: [...document.querySelectorAll(".opt-notification")].map(
      (n) => n.textContent,
    ),
    bodySnippet: document.body.innerText.slice(0, 500),
  }));
  console.log(`SNAP_${i}`, JSON.stringify(snap));
  if (snap.resultsLen > 0) break;
}

console.log("LOGS\n", logs.join("\n"));
await browser.close();
