import puppeteer from "puppeteer-core";
import { resolve } from "path";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});

const page = await browser.newPage();
const logs = [];
page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") logs.push("ERR: " + m.text());
});

await page.goto("http://127.0.0.1:8787/?v=7", { waitUntil: "domcontentloaded" });

await page.evaluate(() => {
  if (typeof MeeshoAPI !== "undefined") {
    delete MeeshoAPI.ensureEmbeddedCategories;
  }
});

await page.waitForFunction(() => window.meeshoOptimizer, { timeout: 15000 });

// Re-mount to trigger setup with stripped function
await page.evaluate(() => {
  window.meeshoOptimizer.mountEmbedded(document.getElementById("optimizer-app"));
});

await (await page.$("#image-input")).uploadFile(
  resolve("/workspace/app.suppliersden.com/icons/icon128.png"),
);

await page.waitForFunction(() => !document.getElementById("generate-btn").disabled, {
  timeout: 5000,
});

const preClick = await page.evaluate(() => ({
  disabled: document.getElementById("generate-btn").disabled,
  hasOnclick: !!document.getElementById("generate-btn").onclick,
  boot: document.getElementById("boot-msg")?.textContent,
}));

await page.click("#generate-btn");
await new Promise((r) => setTimeout(r, 4000));

const post = await page.evaluate(() => ({
  results: window.meeshoOptimizer?.currentResults?.length || 0,
  errors: window.__bootErrors,
}));

console.log("PRE", preClick);
console.log("POST", post);
console.log("LOGS", logs);
await browser.close();

if (!preClick.hasOnclick || preClick.disabled || post.results < 1) process.exit(1);
