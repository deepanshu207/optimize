/**
 * Browser test: gown border slider must change composed preview pixels.
 */
import puppeteer from "puppeteer-core";

const BASE = "http://127.0.0.1:8787";
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30000 });

const result = await page.evaluate(async () => {
  const mod = await import("/js/staticFrameCompose.mjs?v=67");
  const {
    applyBorderThickness,
    composeStaticPreview,
    ensureStaticPlacementMeta,
    BORDER_THICKNESS_DEFAULT,
  } = mod;

  // Minimal 2x2 product patch (red / blue) for visible diff
  const productCanvas = document.createElement("canvas");
  productCanvas.width = 477;
  productCanvas.height = 715;
  const pctx = productCanvas.getContext("2d");
  pctx.fillStyle = "#cc0000";
  pctx.fillRect(0, 0, 237, 715);
  pctx.fillStyle = "#0000cc";
  pctx.fillRect(237, 0, 240, 715);
  const productOnly = productCanvas.toDataURL("image/jpeg", 0.92);

  const frame = {
    style: "gown_static",
    frameType: "tall",
    border: 18,
    whitePad: 95,
    baseBorder: 18,
    baseWhitePad: 95,
    basePx: 113,
    basePy: 113,
    baseDw: 477,
    baseDh: 715,
    baseWhiteX: 18,
    baseWhiteY: 18,
    baseWhiteW: 667,
    baseWhiteH: 988,
    px: 113,
    py: 113,
    dw: 477,
    dh: 715,
    outerW: 703,
    outerH: 1024,
    whiteX: 18,
    whiteY: 18,
    whiteW: 667,
    whiteH: 988,
    borderColor: "#71cbd3",
    matColor: "#ffffff",
    borderThicknessPct: BORDER_THICKNESS_DEFAULT,
  };

  const layers = {
    full: productOnly,
    noStickers: productOnly,
    productOnly,
    _stickersRendered: false,
    _badgePlacements: [],
    _staticFrame: frame,
  };

  ensureStaticPlacementMeta(layers, "gown_static");

  async function borderPixels(pct) {
    layers._staticFrame.borderThicknessPct = pct;
    applyBorderThickness(layers._staticFrame);
    const url = await composeStaticPreview(layers, {}, { jpegQuality: 0.95 });
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d").drawImage(img, 0, 0);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 97) sum += d[i] + d[i + 1] + d[i + 2];
    return {
      pct,
      urlLen: url.length,
      border: layers._staticFrame.border,
      whitePad: layers._staticFrame.whitePad,
      pixelSum: sum,
    };
  }

  const at100 = await borderPixels(100);
  const at50 = await borderPixels(50);
  const at500 = await borderPixels(500);

  return { at100, at50, at500 };
});

console.log(JSON.stringify(result, null, 2));

let failed = 0;
if (result.at50.border >= result.at100.border) {
  console.error("FAIL: 50% should thin border vs 100%");
  failed++;
}
if (result.at500.border <= result.at100.border) {
  console.error("FAIL: 500% should thicken border vs 100%");
  failed++;
}
if (result.at100.pixelSum === result.at500.pixelSum) {
  console.error("FAIL: composed preview pixels unchanged across border settings");
  failed++;
}

if (failed) {
  console.error("LOGS", logs.join("\n"));
  await browser.close();
  process.exit(1);
}

console.log("ok: gown border compose changes preview pixels");
await browser.close();
