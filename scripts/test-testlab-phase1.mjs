/**
 * Automated Test Lab Phase 1 smoke test (no Meesho session required).
 * Run: npx wrangler dev (or serve app) then node scripts/test-testlab-phase1.mjs
 */
import puppeteer from "puppeteer-core";
import { resolve } from "path";
import { createServer } from "http";
import { readFileSync, statSync } from "fs";
import { extname } from "path";

const PORT = 8791;
const ROOT = resolve("/workspace/app.suppliersden.com");

function mime(p) {
  const m = { ".js": "application/javascript", ".mjs": "application/javascript", ".html": "text/html", ".png": "image/png", ".css": "text/css" };
  return m[extname(p)] || "application/octet-stream";
}

function startStaticServer() {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      const url = (req.url || "/").split("?")[0];
      const file = url === "/" ? "/index.html" : url;
      const path = ROOT + file;
      try {
        statSync(path);
        res.writeHead(200, { "Content-Type": mime(path) });
        res.end(readFileSync(path));
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(PORT, () => resolveServer(server));
  });
}

const server = await startStaticServer();
const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?v=20`, {
    waitUntil: "networkidle0",
    timeout: 30000,
  });
  await page.waitForFunction(() => window.meeshoOptimizer, { timeout: 20000 });

  await page.click('[data-optimizer-tab="test"]');
  await page.waitForFunction(
    () => document.getElementById("test-generate-btn")?.style.display !== "none",
    { timeout: 5000 }
  );

  const input = await page.$("#image-input");
  await input.uploadFile(resolve(ROOT, "icons/icon128.png"));
  await page.waitForFunction(
    () => !document.getElementById("test-generate-btn").disabled,
    { timeout: 8000 }
  );

  await page.evaluate(() => {
    const cb = document.getElementById("test-lab-live-verify");
    if (cb) cb.checked = false;
  });

  await page.click("#test-generate-btn");
  await page.waitForFunction(
    () =>
      window.meeshoOptimizer?.testLabResults?.length > 0 ||
      document.querySelector("#results-area img"),
    { timeout: 120000 }
  );

  const result = await page.evaluate(() => {
    const rows = window.meeshoOptimizer?.testLabResults || [];
    return {
      count: rows.length,
      bestEst: rows[0]?.estShipping || rows[0]?.meta?.estInr,
      bestName: rows[0]?.name,
      hasImages: rows.filter((r) => r.imageUrl || r.dataUrl).length,
      phase2: window.meeshoOptimizer?.testLabPhase2Meta,
    };
  });

  console.log("TEST LAB PHASE 1:", JSON.stringify(result, null, 2));

  if (result.count < 6) {
    console.error("FAIL: expected at least 6 variants, got", result.count);
    process.exit(1);
  }
  if (result.hasImages < result.count) {
    console.error("FAIL: some variants missing image URLs");
    process.exit(1);
  }
  console.log("PASS: Phase 1 generated", result.count, "variants, best est ₹" + result.bestEst);
} finally {
  await browser.close();
  server.close();
}
