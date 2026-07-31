import puppeteer from "puppeteer-core";
import { resolve } from "path";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});

const page = await browser.newPage();
await page.goto("http://127.0.0.1:8787/?v=add-border-stickers", {
  waitUntil: "domcontentloaded",
});
await page.waitForFunction(() => window.meeshoOptimizer);
await (await page.$("#image-input")).uploadFile(
  resolve("/workspace/app.suppliersden.com/icons/icon128.png"),
);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);
await page.click("#generate-btn");
await page.waitForFunction(
  () => (window.meeshoOptimizer?.currentResults?.length || 0) >= 3,
  { timeout: 90000 },
);

async function sample(url) {
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
      return d[0] + d[1] + d[2];
    };
    return {
      w: img.width,
      h: img.height,
      edge: px(2, 2),
      center: px(Math.floor(img.width / 2), Math.floor(img.height / 2)),
    };
  }, url);
}

const addBorderAfterRemove = await page.evaluate(async () => {
  const opt = window.meeshoOptimizer;
  const row = opt.currentResults[0];
  row.editFlags = {};
  await opt.openVariantEditor(row.variantId);
  await new Promise((r) => setTimeout(r, 400));

  const borderOnlyCb = document.getElementById("variant-edit-border-only");
  borderOnlyCb.checked = true;
  borderOnlyCb.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 800));

  const afterRemove = row.imageUrl;
  const addBorderCb = document.getElementById("variant-edit-add-border");
  addBorderCb.checked = true;
  addBorderCb.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 800));

  return {
    borderAdded: row.editFlags?.borderAdded,
    borderOnlyRemoved: row.editFlags?.borderOnlyRemoved,
    changed: row.imageUrl !== afterRemove,
    equalsFull: row.imageUrl === row.layers.full,
    equalsNoStickers: row.imageUrl === row.layers.noStickers,
    afterRemove: afterRemove?.slice(0, 40),
    afterAdd: row.imageUrl?.slice(0, 40),
  };
});

console.log("addBorderAfterRemove", addBorderAfterRemove);

await page.evaluate(() => window.meeshoOptimizer.closeVariantEditor());
await new Promise((r) => setTimeout(r, 300));

const addStickersBorderOnly = await page.evaluate(async () => {
  const opt = window.meeshoOptimizer;
  const row = opt.currentResults[1];
  row.editFlags = {};
  row.layers._stickersRendered = false;
  row.layers._badgePlacements = [];
  row.imageUrl = row.layers.noStickers;
  await opt.openVariantEditor(row.variantId);
  await new Promise((r) => setTimeout(r, 400));

  const addStickersCb = document.getElementById("variant-edit-add-stickers");
  addStickersCb.checked = true;
  addStickersCb.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1000));

  return {
    stickersAdded: row.editFlags?.stickersAdded,
    placements: (row.layers._badgePlacements || []).length,
    changed: row.imageUrl !== row.layers.noStickers,
    equalsFull: row.imageUrl === row.layers.full,
    preview: document.getElementById("variant-edit-preview")?.src?.slice(0, 40),
  };
});

console.log("addStickersBorderOnly", addStickersBorderOnly);

const row0 = await page.evaluate(() => window.meeshoOptimizer.currentResults[0]);
const samples = {
  full: await sample(row0.layers.full),
  noStickers: await sample(row0.layers.noStickers),
  noBorder: await sample(row0.layers.noBorder),
};
console.log("samples", samples);

await browser.close();

const ok1 =
  addBorderAfterRemove.borderAdded &&
  !addBorderAfterRemove.borderOnlyRemoved &&
  addBorderAfterRemove.changed &&
  (addBorderAfterRemove.equalsFull || addBorderAfterRemove.equalsNoStickers);

const ok2 =
  addStickersBorderOnly.stickersAdded &&
  addStickersBorderOnly.placements > 0 &&
  addStickersBorderOnly.changed;

if (!ok1 || !ok2) process.exit(1);
