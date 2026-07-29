import puppeteer from "puppeteer-core";
import { resolve } from "path";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});

const page = await browser.newPage();
await page.goto("http://127.0.0.1:8787/?v=remove-border", {
  waitUntil: "domcontentloaded",
});
await page.waitForFunction(() => window.meeshoOptimizer);

await (await page.$("#image-input")).uploadFile(
  resolve("/workspace/app.suppliersden.com/icons/icon128.png"),
);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);
await page.click("#generate-btn");
await page.waitForFunction(
  () => (window.meeshoOptimizer?.currentResults?.length || 0) >= 5,
  { timeout: 90000 },
);

async function samplePreviewSrc(src) {
  return page.evaluate(async (url) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const edge = (x, y) => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      return d[0] + d[1] + d[2];
    };
    const center = edge(Math.floor(img.width / 2), Math.floor(img.height / 2));
    const corners = [
      edge(2, 2),
      edge(img.width - 3, 2),
      edge(2, img.height - 3),
      edge(img.width - 3, img.height - 3),
    ];
    const edgeAvg = corners.reduce((a, b) => a + b, 0) / corners.length;
    return { width: img.width, height: img.height, center, edgeAvg, edgeSpread: Math.max(...corners) - Math.min(...corners) };
  }, src);
}

const fullVariant = await page.evaluate(() => {
  const rows = window.meeshoOptimizer.currentResults;
  return rows.find(
    (r) =>
      r.layers?._stickersRendered &&
      r.layers?.noBorder &&
      r.layers?.noStickers &&
      r.layers.full !== r.layers.noBorder &&
      r.layers.noStickers !== r.layers.noBorder,
  );
});

if (!fullVariant) {
  console.error("No full live variant with distinct layers found");
  await browser.close();
  process.exit(1);
}

const borderOnlyResult = await page.evaluate(async (variantId) => {
  const opt = window.meeshoOptimizer;
  const row = opt.currentResults.find((r) => r.variantId === variantId);
  await opt.openVariantEditor(variantId);
  await new Promise((r) => setTimeout(r, 300));

  const fullBefore = row.imageUrl;
  const borderCb = document.getElementById("variant-edit-border-only");
  borderCb.checked = true;
  borderCb.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));

  const preview = document.getElementById("variant-edit-preview");
  return {
    borderOnlyRemoved: row.editFlags?.borderOnlyRemoved,
    equalsNoBorder: row.imageUrl === row.layers.noBorder,
    previewEqualsNoBorder: preview?.src === row.layers.noBorder,
    changedFromFull: row.imageUrl !== fullBefore,
    fullBefore,
    after: row.imageUrl,
    noBorder: row.layers.noBorder,
    noStickers: row.layers.noStickers,
    productOnly: row.layers.productOnly,
  };
}, fullVariant.variantId);

const fullSample = await samplePreviewSrc(fullVariant.layers.full);
const borderRemovedSample = await samplePreviewSrc(borderOnlyResult.after);
const noBorderSample = await samplePreviewSrc(fullVariant.layers.noBorder);

console.log("borderOnly", borderOnlyResult);
console.log("pixels", { fullSample, borderRemovedSample, noBorderSample });

await page.evaluate(() => window.meeshoOptimizer.closeVariantEditor());
await new Promise((r) => setTimeout(r, 200));

const addBorderResult = await page.evaluate(async (variantId) => {
  const opt = window.meeshoOptimizer;
  const row = opt.currentResults.find((r) => r.variantId === variantId);
  row.editFlags = {};
  row.imageUrl = row.layers.noStickers;
  row.layers._stickersRendered = false;
  row.layers._badgePlacements = [];
  await opt.openVariantEditor(variantId);
  await new Promise((r) => setTimeout(r, 300));

  const addStickersCb = document.getElementById("variant-edit-add-stickers");
  addStickersCb.checked = true;
  addStickersCb.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));

  return {
    stickersAdded: row.editFlags?.stickersAdded,
    placements: (row.layers._badgePlacements || []).length,
    changed: row.imageUrl !== row.layers.noStickers,
  };
}, fullVariant.variantId);

console.log("addStickersOnBorderOnly", addBorderResult);

await browser.close();

const borderOnlyOk =
  borderOnlyResult.borderOnlyRemoved &&
  borderOnlyResult.equalsNoBorder &&
  borderOnlyResult.previewEqualsNoBorder &&
  borderOnlyResult.changedFromFull &&
  Math.abs(borderRemovedSample.width - noBorderSample.width) <= 2 &&
  Math.abs(borderRemovedSample.height - noBorderSample.height) <= 2;

const addOk =
  addBorderResult.stickersAdded &&
  addBorderResult.placements > 0 &&
  addBorderResult.changed;

if (!borderOnlyOk || !addOk) process.exit(1);
