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
const logs = [];
page.on("console", (m) => logs.push(m.text()));

await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.meeshoOptimizer);

await page.evaluate(() => {
  const orig = window.meeshoOptimizer.processImage.bind(window.meeshoOptimizer);
  window.meeshoOptimizer.processImage = async function (file) {
    window.__processImageCalled = (window.__processImageCalled || 0) + 1;
    window.__processImageFile = file?.name;
    return orig(file);
  };
});

const input = await page.$("#image-input");
await input.uploadFile(imgPath);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);

const btn = await page.$("#generate-btn");
const box = await btn.boundingBox();
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await new Promise((r) => setTimeout(r, 5000));

let snap = await page.evaluate(() => ({
  called: window.__processImageCalled || 0,
  file: window.__processImageFile,
  resultsLen: window.meeshoOptimizer.currentResults.length,
  isProcessing: window.meeshoOptimizer.isProcessing,
}));
console.log("TOUCH", snap);

// fresh page click test
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.meeshoOptimizer);
await page.evaluate(() => {
  const orig = window.meeshoOptimizer.processImage.bind(window.meeshoOptimizer);
  window.meeshoOptimizer.processImage = async function (file) {
    window.__processImageCalled = (window.__processImageCalled || 0) + 1;
    return orig(file);
  };
});
await (await page.$("#image-input")).uploadFile(imgPath);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);
await page.click("#generate-btn");
await new Promise((r) => setTimeout(r, 5000));
snap = await page.evaluate(() => ({
  called: window.__processImageCalled || 0,
  resultsLen: window.meeshoOptimizer.currentResults.length,
}));
console.log("CLICK", snap);
console.log(logs.filter((l) => l.includes("Target") || l.includes("Error")).join("\n"));
await browser.close();
