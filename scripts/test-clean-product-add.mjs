import puppeteer from "puppeteer-core";
import { resolve } from "path";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});

const page = await browser.newPage();
await page.goto("http://127.0.0.1:8787/?v=clean-product-add", {
  waitUntil: "domcontentloaded",
});
await page.waitForFunction(() => window.meeshoOptimizer);
await (await page.$("#image-input")).uploadFile(
  resolve("/workspace/app.suppliersden.com/icons/icon128.png"),
);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);
await page.click("#generate-btn");
await page.waitForFunction(
  () => (window.meeshoOptimizer?.currentResults?.length || 0) >= 1,
  { timeout: 90000 },
);

async function imgInfo(url) {
  if (!url) return null;
  return page.evaluate(async (u) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = u;
    });
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    c.width = img.width;
    c.height = img.height;
    ctx.drawImage(img, 0, 0);
    const px = (x, y) => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    return {
      w: img.width,
      h: img.height,
      edge: px(2, 2),
      center: px(Math.floor(img.width / 2), Math.floor(img.height / 2)),
    };
  }, url);
}

const addStickersFromClean = await page.evaluate(async () => {
  const opt = window.meeshoOptimizer;
  const row = opt.currentResults[0];
  row.editFlags = { cleanProduct: true };
  row.imageUrl = row.layers.productOnly;
  await opt.openVariantEditor(row.variantId);
  await new Promise((r) => setTimeout(r, 300));

  document.getElementById("variant-edit-clean-product").checked = true;
  document.getElementById("variant-edit-clean-product").dispatchEvent(
    new Event("change", { bubbles: true }),
  );
  await new Promise((r) => setTimeout(r, 800));

  document.getElementById("variant-edit-add-stickers").checked = true;
  document.getElementById("variant-edit-add-stickers").dispatchEvent(
    new Event("change", { bubbles: true }),
  );
  await new Promise((r) => setTimeout(r, 1200));

  return {
    cleanProduct: row.editFlags?.cleanProduct,
    stickersAdded: row.editFlags?.stickersAdded,
    placements: (row.layers._badgePlacements || []).length,
    changed: row.imageUrl !== row.layers.productOnly,
    url: row.imageUrl,
  };
});

const addBorderFromClean = await page.evaluate(async () => {
  const opt = window.meeshoOptimizer;
  const row = opt.currentResults[1] || opt.currentResults[0];
  row.editFlags = { cleanProduct: true };
  row.imageUrl = row.layers.productOnly;
  await opt.openVariantEditor(row.variantId);
  await new Promise((r) => setTimeout(r, 300));

  document.getElementById("variant-edit-clean-product").checked = true;
  document.getElementById("variant-edit-clean-product").dispatchEvent(
    new Event("change", { bubbles: true }),
  );
  await new Promise((r) => setTimeout(r, 800));

  document.getElementById("variant-edit-add-border").checked = true;
  document.getElementById("variant-edit-add-border").dispatchEvent(
    new Event("change", { bubbles: true }),
  );
  await new Promise((r) => setTimeout(r, 1200));

  return {
    cleanProduct: row.editFlags?.cleanProduct,
    borderAdded: row.editFlags?.borderAdded,
    equalsNoStickers: row.imageUrl === row.layers.noStickers,
    changed: row.imageUrl !== row.layers.productOnly,
    url: row.imageUrl,
  };
});

const layerRefs = await page.evaluate(() => {
  const opt = window.meeshoOptimizer;
  return [0, 1].map((i) => {
    const r = opt.currentResults[i] || opt.currentResults[0];
    return {
      noStickers: r.layers.noStickers,
      productOnly: r.layers.productOnly,
    };
  });
});
const finalS = await imgInfo(addStickersFromClean.url);
const finalB = await imgInfo(addBorderFromClean.url);
const refProduct = await imgInfo(layerRefs[0].productOnly);
const refNoStickersBorder = await imgInfo(layerRefs[1].noStickers);

console.log(
  JSON.stringify(
    { addStickersFromClean, addBorderFromClean, finalS, finalB, refProduct, refNoStickersBorder },
    null,
    2,
  ),
);
await browser.close();

const stickerOk =
  !addStickersFromClean.cleanProduct &&
  addStickersFromClean.stickersAdded &&
  addStickersFromClean.placements > 0 &&
  addStickersFromClean.changed &&
  finalS &&
  JSON.stringify(finalS.center) !== JSON.stringify(refProduct.center);

const borderOk =
  !addBorderFromClean.cleanProduct &&
  addBorderFromClean.borderAdded &&
  addBorderFromClean.changed &&
  finalB &&
  refNoStickersBorder &&
  finalB.w === refNoStickersBorder.w &&
  finalB.h === refNoStickersBorder.h &&
  JSON.stringify(finalB.edge) === JSON.stringify(refNoStickersBorder.edge);

if (!stickerOk || !borderOk) process.exit(1);
