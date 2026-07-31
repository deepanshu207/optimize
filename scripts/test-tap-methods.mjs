import puppeteer from "puppeteer-core";
import { resolve } from "path";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto("http://127.0.0.1:8787/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.meeshoOptimizer);
await (await page.$("#image-input")).uploadFile(
  resolve("/workspace/app.suppliersden.com/icons/icon128.png"),
);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);

await page.evaluate(() => {
  window.__called = 0;
  const o = window.meeshoOptimizer.processImage.bind(window.meeshoOptimizer);
  window.meeshoOptimizer.processImage = (f) => {
    window.__called++;
    return o(f);
  };
});

for (const method of ["tap", "click", "touchscreen"]) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.meeshoOptimizer);
  await (await page.$("#image-input")).uploadFile(
    resolve("/workspace/app.suppliersden.com/icons/icon128.png"),
  );
  await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);
  await page.evaluate(() => {
    window.__called = 0;
  });

  if (method === "tap") await page.tap("#generate-btn");
  else if (method === "click") await page.click("#generate-btn");
  else {
    const box = await (await page.$("#generate-btn")).boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }
  await new Promise((r) => setTimeout(r, 3000));
  const n = await page.evaluate(() => ({
    called: window.__called,
    results: window.meeshoOptimizer.currentResults.length,
  }));
  console.log(method, n);
}
await browser.close();
