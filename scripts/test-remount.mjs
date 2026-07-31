import puppeteer from "puppeteer-core";
import { resolve } from "path";

const BASE = "http://127.0.0.1:8787";
const imgPath = resolve("/workspace/app.suppliersden.com/icons/icon128.png");

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.meeshoOptimizer);

const input = await page.$("#image-input");
await input.uploadFile(imgPath);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);

// simulate remount like close button
await page.evaluate(() => {
  window.meeshoOptimizer.mountEmbedded(document.getElementById("optimizer-app"));
});

const state = await page.evaluate(() => ({
  pending: !!window.meeshoOptimizer._pendingFile,
  webPending: !!window.__webPendingFile,
  btnDisabled: document.getElementById("generate-btn").disabled,
}));

console.log("AFTER_REMOUNT", state);
await page.click("#generate-btn");
await new Promise((r) => setTimeout(r, 3000));

const after = await page.evaluate(() => ({
  resultsLen: window.meeshoOptimizer.currentResults.length,
  isProcessing: window.meeshoOptimizer.isProcessing,
}));
console.log("AFTER_GENERATE", after);
await browser.close();
