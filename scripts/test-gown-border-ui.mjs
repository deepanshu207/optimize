/**
 * UI test: editor preview must change when border slider moves.
 */
import puppeteer from "puppeteer-core";

const BASE = "http://127.0.0.1:8787";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
const logs = [];
page.on("pageerror", (err) => logs.push(err.message));
await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30000 });

await page.waitForFunction(() => window.meeshoOptimizer, { timeout: 15000 });

const injected = await page.evaluate(async () => {
  await import("/js/staticFrameCompose.mjs?v=70");

  const productCanvas = document.createElement("canvas");
  productCanvas.width = 477;
  productCanvas.height = 715;
  productCanvas.getContext("2d").fillStyle = "#9c27b0";
  productCanvas.getContext("2d").fillRect(0, 0, 477, 715);
  const productOnly = productCanvas.toDataURL("image/jpeg", 0.92);

  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = 703;
  frameCanvas.height = 1024;
  const fctx = frameCanvas.getContext("2d");
  fctx.fillStyle = "#71cbd3";
  fctx.fillRect(0, 0, 703, 1024);
  fctx.fillStyle = "#fff";
  fctx.fillRect(18, 18, 667, 988);
  fctx.drawImage(productCanvas, 113, 113, 477, 715);
  const full = frameCanvas.toDataURL("image/jpeg", 0.92);

  const variantId = "gown-static-test-ui-90001";
  const row = {
    variantId,
    name: "Gown Test",
    pricingImageUrl: full,
    dataUrl: full,
    imageUrl: full,
    layers: {
      full,
      noStickers: full,
      productOnly,
      _stickersRendered: true,
      _badgePlacements: [
        {
          id: "gown-best",
          label: "Best PRICE",
          kind: "gownArt",
          gownSlot: "gown-best",
          w: 120,
          h: 84,
          x: 120,
          y: 120,
          drawn: true,
          anchor: "top-left",
        },
      ],
      _staticFrame: {
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
        borderThicknessPct: 100,
      },
    },
    editFlags: {},
    variantStyle: "gown_static",
    meta: { path: "gown_static", targetKb: 44 },
    estShipping: 49,
  };

  const opt = window.meeshoOptimizer;
  opt.gownStaticResults = [row];
  opt.showGownStaticResults = true;
  opt.displayLiveResultsPanel({ scroll: false });
  opt.setupResultsEvents();
  return variantId;
});

await page.waitForSelector(`[data-variant-id="${injected}"]`, { timeout: 10000 });
await page.evaluate((vid) => window.meeshoOptimizer.openVariantEditor(vid), injected);

await page.waitForSelector("#variant-edit-panel", { visible: true, timeout: 10000 });
await page.waitForSelector("#static-border-thickness", { timeout: 10000 });

await page.waitForSelector("#static-border-lock", { timeout: 10000 });
await page.click("#static-border-lock");

const before = await page.$eval("#variant-edit-preview", (el) => el.src.length);

await page.$eval("#static-border-thickness", (el) => {
  el.value = "500";
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
});

await new Promise((r) => setTimeout(r, 220));

const after = await page.$eval("#variant-edit-preview", (el) => el.src.length);
const borderVal = await page.$eval("#static-border-thickness-val", (el) => el.textContent);

console.log({ before, after, borderVal, logs });

if (after === before) {
  console.error("FAIL: preview src length unchanged after slider");
  process.exit(1);
}
if (borderVal !== "500") {
  console.error("FAIL: slider value label not updated");
  process.exit(1);
}

console.log("ok: UI preview updates on border slider");
await browser.close();
