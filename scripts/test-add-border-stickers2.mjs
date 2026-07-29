import puppeteer from "puppeteer-core";
import { resolve } from "path";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});

const page = await browser.newPage();
await page.goto("http://127.0.0.1:8787/?v=add-border-stickers2", {
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

const stickersOnlyAddBorder = await page.evaluate(async () => {
  const opt = window.meeshoOptimizer;
  const row = opt.currentResults[1];
  row.editFlags = { borderOnlyRemoved: true };
  row.imageUrl = row.layers.noBorder;
  await opt.openVariantEditor(row.variantId);
  await new Promise((r) => setTimeout(r, 300));

  document.getElementById("variant-edit-add-border").checked = true;
  document.getElementById("variant-edit-add-border").dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1000));

  return {
    borderAdded: row.editFlags?.borderAdded,
    borderOnlyRemoved: row.editFlags?.borderOnlyRemoved,
    changed: row.imageUrl !== row.layers.noBorder,
    equalsFull: row.imageUrl === row.layers.full,
    equalsNoStickers: row.imageUrl === row.layers.noStickers,
    url: row.imageUrl,
  };
});

const borderOnlyAddStickers = await page.evaluate(async () => {
  const opt = window.meeshoOptimizer;
  const row = opt.currentResults[2];
  row.editFlags = {};
  row.layers._stickersRendered = false;
  row.layers._badgePlacements = [];
  row.imageUrl = row.layers.noStickers;
  await opt.openVariantEditor(row.variantId);
  await new Promise((r) => setTimeout(r, 300));

  document.getElementById("variant-edit-add-stickers").checked = true;
  document.getElementById("variant-edit-add-stickers").dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1000));

  return {
    stickersAdded: row.editFlags?.stickersAdded,
    placements: (row.layers._badgePlacements || []).length,
    changed: row.imageUrl !== row.layers.noStickers,
    url: row.imageUrl,
  };
});

const rowRefs = await page.evaluate(async () => {
  const opt = window.meeshoOptimizer;
  return [1, 2].map((i) => {
    const row = opt.currentResults[i];
    return {
      full: row.layers.full,
      noStickers: row.layers.noStickers,
      noBorder: row.layers.noBorder,
    };
  });
});
const refB = {
  full: await imgInfo(rowRefs[0].full),
  noStickers: await imgInfo(rowRefs[0].noStickers),
};
const refC = {
  noStickers: await imgInfo(rowRefs[1].noStickers),
};
const finalB = await imgInfo(stickersOnlyAddBorder.url);
const finalC = await imgInfo(borderOnlyAddStickers.url);

console.log(JSON.stringify({ stickersOnlyAddBorder, borderOnlyAddStickers, refB, refC, finalB, finalC }, null, 2));
await browser.close();

// Border add should restore the full decorated layer for this variant
const borderOk =
  stickersOnlyAddBorder.borderAdded &&
  stickersOnlyAddBorder.changed &&
  stickersOnlyAddBorder.equalsFull &&
  finalB &&
  finalB.w === refB.full.w &&
  finalB.h === refB.full.h &&
  JSON.stringify(finalB.edge) === JSON.stringify(refB.noStickers.edge);

// Stickers add should match noStickers canvas size and differ from plain noStickers
const stickerOk =
  borderOnlyAddStickers.stickersAdded &&
  borderOnlyAddStickers.placements > 0 &&
  borderOnlyAddStickers.changed &&
  finalC &&
  finalC.w === refC.noStickers.w &&
  finalC.h === refC.noStickers.h &&
  JSON.stringify(finalC.center) !== JSON.stringify(refC.noStickers.center);

if (!borderOk || !stickerOk) process.exit(1);
