/**
 * UI test: variant editor shows all static controls and scrolls with sticky preview.
 */
import puppeteer from "puppeteer-core";

const BASE = "http://127.0.0.1:8787";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 700, isMobile: true, hasTouch: true });
await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30000 });
await page.waitForFunction(() => window.meeshoOptimizer, { timeout: 15000 });

const variantId = await page.evaluate(async () => {
  await import("/js/staticFrameCompose.mjs?v=71");

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

  const badges = [
    { id: "gown-best", label: "Best PRICE", kind: "gownArt", gownSlot: "gown-best", w: 120, h: 84, x: 120, y: 120, drawn: true, anchor: "top-left" },
    { id: "gown-flash", label: "Flash SALE", kind: "gownArt", gownSlot: "gown-flash", w: 120, h: 84, x: 300, y: 120, drawn: true, anchor: "top-left" },
    { id: "gown-popular", label: "Popular", kind: "gownArt", gownSlot: "gown-popular", w: 120, h: 84, x: 120, y: 300, drawn: true, anchor: "top-left" },
  ];

  const variantId = "gown-static-scroll-test";
  const row = {
    variantId,
    name: "Gown Scroll Test",
    pricingImageUrl: full,
    dataUrl: full,
    imageUrl: full,
    layers: {
      full,
      noStickers: full,
      productOnly,
      _stickersRendered: true,
      _badgePlacements: badges,
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

await page.waitForSelector(`[data-variant-id="${variantId}"]`, { timeout: 10000 });
await page.evaluate((vid) => window.meeshoOptimizer.openVariantEditor(vid), variantId);
await page.waitForSelector("#variant-edit-scroll", { timeout: 10000 });

const metrics = await page.evaluate(() => {
  const scroll = document.getElementById("variant-edit-scroll");
  const preview = document.getElementById("variant-edit-preview");
  const done = document.getElementById("variant-edit-done");
  const sizeLocks = document.querySelectorAll(".static-size-lock");
  const border = document.getElementById("static-border-thickness");
  const lastCard = document.querySelector(".static-sticker-card:last-of-type .static-pos-v");
  return {
    scrollMinHeight: scroll ? getComputedStyle(scroll).minHeight : null,
    scrollOverflow: scroll ? getComputedStyle(scroll).overflowY : null,
    scrollable: scroll ? scroll.scrollHeight > scroll.clientHeight : false,
    previewSticky: preview ? getComputedStyle(preview).position : null,
    doneVisible: done ? done.getBoundingClientRect().height > 0 : false,
    sizeLocks: sizeLocks.length,
    borderDisabled: border ? border.disabled : null,
    lastSliderVisible: lastCard
      ? lastCard.getBoundingClientRect().bottom <= window.innerHeight
      : false,
    scrollClientHeight: scroll?.clientHeight || 0,
    scrollScrollHeight: scroll?.scrollHeight || 0,
  };
});

console.log(metrics);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

assert(metrics.scrollMinHeight === "0px", "scroll region uses min-height:0");
assert(metrics.scrollOverflow === "auto", "scroll region scrolls");
assert(metrics.previewSticky === "sticky", "preview stays visible while scrolling");
assert(metrics.doneVisible, "Done button stays visible outside scroll");
assert(metrics.sizeLocks === 3, "all badge size locks rendered");
assert(metrics.borderDisabled === true, "border slider locked by default");
assert(metrics.scrollable, "controls taller than viewport scroll inside panel");
assert(metrics.scrollScrollHeight > metrics.scrollClientHeight + 40, "scroll area has room for all controls");

if (failed) {
  await browser.close();
  process.exit(1);
}

console.log("\nAll editor scroll/visibility checks passed");
await browser.close();
