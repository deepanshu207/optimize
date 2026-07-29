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

await (await page.$("#image-input")).uploadFile(
  resolve("/workspace/app.suppliersden.com/icons/icon128.png"),
);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);
await page.click("#generate-btn");
await page.waitForFunction(
  () => (window.meeshoOptimizer?.currentResults?.length || 0) >= 5,
  { timeout: 60000 },
);

const before = await page.evaluate(() => {
  const r = window.meeshoOptimizer.currentResults[0];
  return {
    fullLen: r.layers?.full?.length,
    noStickersLen: r.layers?.noStickers?.length,
    same: r.layers?.full === r.layers?.noStickers,
    imageUrl: r.imageUrl?.slice(0, 80),
  };
});

await page.evaluate(async () => {
  const vid = window.meeshoOptimizer.currentResults[0].variantId;
  await window.meeshoOptimizer.openVariantEditor(vid);
});
await page.waitForSelector("#variant-edit-no-stickers", { timeout: 5000 });

await page.click("#variant-edit-no-stickers");
await new Promise((r) => setTimeout(r, 300));

const after = await page.evaluate(() => {
  const r = window.meeshoOptimizer.currentResults[0];
  const preview = document.getElementById("variant-edit-preview");
  return {
    stickersRemoved: r.editFlags?.stickersRemoved,
    imageUrl: r.imageUrl?.slice(0, 80),
    previewSrc: preview?.src?.slice(0, 80),
    changed: r.imageUrl !== r.layers?.full,
    equalsNoStickers: r.imageUrl === r.layers?.noStickers,
  };
});

console.log({ before, after });
await browser.close();
if (!after.stickersRemoved || !after.equalsNoStickers) process.exit(1);
