import puppeteer from "puppeteer-core";
import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE = "http://127.0.0.1:8787";
const imgPath = resolve("/workspace/app.suppliersden.com/icons/icon128.png");

// 1x1 red JPEG
const tinyJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);
writeFileSync("/tmp/test-img.jpg", tinyJpeg);

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

await page.waitForFunction(
  () => window.meeshoOptimizer && document.getElementById("generate-btn"),
  { timeout: 15000 },
);

const input = await page.$("#image-input");
await input.uploadFile(imgPath);

await page.waitForFunction(
  () => !document.getElementById("generate-btn").disabled,
  { timeout: 5000 },
);

await page.click("#generate-btn");

await page.waitForFunction(
  () => {
    const results = document.getElementById("results-area");
    return results && results.style.display !== "none" && results.innerHTML.includes("Var-");
  },
  { timeout: 120000 },
);

const resultHtml = await page.$eval("#results-area", (el) => el.innerHTML);
const variantCount = (resultHtml.match(/Var-/g) || []).length;

console.log("VARIANT_COUNT", variantCount);
console.log("RESULTS_SNIPPET", resultHtml.slice(0, 200));

if (variantCount < 1) {
  console.log("LOGS", logs.slice(-40).join("\n"));
  process.exit(1);
}

await browser.close();
console.log("OK generate variants works");
