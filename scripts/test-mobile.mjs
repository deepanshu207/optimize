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
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.meeshoOptimizer);

const input = await page.$("#image-input");
await input.uploadFile(imgPath);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);

await page.tap("#generate-btn");

await new Promise((r) => setTimeout(r, 4000));
const after = await page.evaluate(() => ({
  resultsLen: window.meeshoOptimizer.currentResults.length,
  licensed: window.meeshoOptimizer.isLicensed,
}));
console.log("MOBILE_TOUCH", after);
await browser.close();
