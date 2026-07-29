import puppeteer from "puppeteer-core";
import { resolve } from "path";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});

const page = await browser.newPage();
await page.goto("http://127.0.0.1:8787/?v=live-add-stickers", {
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

const result = await page.evaluate(async () => {
  const opt = window.meeshoOptimizer;
  const row = opt.currentResults[0];
  const variantId = row.variantId;

  row.layers._stickersRendered = false;
  row.layers._badgePlacements = [];
  row.imageUrl = row.layers.noStickers;
  row.pricingImageUrl = row.layers.noStickers;
  row.editFlags = {};

  await opt.openVariantEditor(variantId);
  await new Promise((r) => setTimeout(r, 400));

  const staticBefore = document.getElementById("variant-edit-static-badges");
  const borderBefore = !!staticBefore?.querySelector("#static-border-thickness");

  const addCb = document.getElementById("variant-edit-add-stickers");
  addCb.checked = true;
  addCb.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1000));

  const staticSection = document.getElementById("variant-edit-static-badges");
  const stickerCards = staticSection?.querySelectorAll(".static-sticker-card")?.length || 0;
  const borderSlider = !!staticSection?.querySelector("#static-border-thickness");
  const colorTop = !!staticSection?.querySelector("#static-color-top-hex");
  const preview = document.getElementById("variant-edit-preview");

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = preview?.src || row.imageUrl;
  });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const sample = (x, y) => {
    const d = ctx.getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const corners = [
    sample(12, 12),
    sample(img.width - 12, 12),
    sample(12, img.height - 12),
    sample(img.width - 12, img.height - 12),
  ];
  const center = sample(Math.floor(img.width / 2), Math.floor(img.height / 2));
  const cornerDiffersFromCenter = corners.some(
    (c) => Math.abs(c[0] - center[0]) + Math.abs(c[1] - center[1]) + Math.abs(c[2] - center[2]) > 80,
  );

  return {
    borderBefore,
    afterPlacements: (row.layers._badgePlacements || []).length,
    stickersAdded: row.editFlags?.stickersAdded,
    stickerCards,
    borderSlider,
    colorTop,
    staticVisible: staticSection?.style.display !== "none",
    previewUsesNoStickers: preview?.src?.startsWith(row.layers.noStickers?.slice(0, 40) || "@@@"),
    cornerDiffersFromCenter,
  };
});

console.log(result);
await browser.close();

const ok =
  result.borderBefore &&
  result.stickersAdded &&
  result.afterPlacements > 0 &&
  result.stickerCards > 0 &&
  result.borderSlider &&
  result.colorTop &&
  result.staticVisible &&
  result.cornerDiffersFromCenter;

if (!ok) process.exit(1);
