import puppeteer from "puppeteer-core";
import { resolve } from "path";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});

const page = await browser.newPage();
await page.goto("http://127.0.0.1:8787/?v=8", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.meeshoOptimizer);

await page.select("#max-attempts", "50");
await (await page.$("#image-input")).uploadFile(
  resolve("/workspace/app.suppliersden.com/icons/icon128.png"),
);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);
await page.click("#generate-btn");

await page.waitForFunction(
  () => (window.meeshoOptimizer?.currentResults?.length || 0) >= 50,
  { timeout: 180000 },
);

const n = await page.evaluate(() => ({
  count: window.meeshoOptimizer.currentResults.length,
  hasLayers: !!window.meeshoOptimizer.currentResults[0]?.layers?.full,
}));

console.log(n);
await browser.close();
if (n.count < 50) process.exit(1);
