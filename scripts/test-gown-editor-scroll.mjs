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
  await import("/js/staticFrameCompose.mjs?v=74");

  const productCanvas = document.createElement("canvas");
  productCanvas.width = 661;
  productCanvas.height = 982;
  productCanvas.getContext("2d").fillStyle = "#9c27b0";
  productCanvas.getContext("2d").fillRect(0, 0, 661, 982);
  const productOnly = productCanvas.toDataURL("image/jpeg", 0.92);

  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = 773;
  frameCanvas.height = 1094;
  const fctx = frameCanvas.getContext("2d");
  fctx.fillStyle = "#71cbd3";
  fctx.fillRect(0, 0, 773, 1094);
  fctx.fillStyle = "#fff";
  fctx.fillRect(19, 19, 735, 1056);
  fctx.drawImage(productCanvas, 56, 56, 661, 982);
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
        border: 19,
        whitePad: 37,
        baseBorder: 19,
        baseWhitePad: 37,
        basePx: 56,
        basePy: 56,
        baseDw: 661,
        baseDh: 982,
        baseWhiteX: 19,
        baseWhiteY: 19,
        baseWhiteW: 735,
        baseWhiteH: 1056,
        px: 56,
        py: 56,
        dw: 661,
        dh: 982,
        outerW: 773,
        outerH: 1094,
        whiteX: 19,
        whiteY: 19,
        whiteW: 735,
        whiteH: 1056,
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
    gownLayersLock: document.getElementById("static-gown-layers-lock")?.getAttribute("aria-pressed") || "",
    gownLayerSliders: document.querySelectorAll(".static-gown-layer-pct").length,
    lastSliderVisible: lastCard
      ? lastCard.getBoundingClientRect().bottom <= window.innerHeight
      : false,
    scrollClientHeight: scroll?.clientHeight || 0,
    scrollScrollHeight: scroll?.scrollHeight || 0,
    borderHex: document.getElementById("static-color-border-hex")?.value || "",
    chipCount: document.querySelectorAll(".static-color-chip").length,
    colorPickerModal: !!document.getElementById("static-color-picker-overlay"),
    hasBorderRgbInput: !!document.getElementById("static-color-border-r"),
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
assert(
  metrics.previewSticky === "sticky" ||
    metrics.previewSticky === "-webkit-sticky" ||
    metrics.scrollable,
  "preview in scrollable editor panel",
);
assert(metrics.doneVisible, "Done button stays visible outside scroll");
assert(metrics.sizeLocks === 3, "all badge size locks rendered");
assert(metrics.gownLayersLock === "false", "gown frame layer sliders unlocked by default");
assert(metrics.gownLayerSliders === 4, "gown has four per-layer frame sliders");
assert(metrics.scrollable, "controls taller than viewport scroll inside panel");
assert(metrics.scrollScrollHeight > metrics.scrollClientHeight + 40, "scroll area has room for all controls");
assert(metrics.borderHex === "#71cbd3", "existing border hex field shown");
assert(metrics.chipCount >= 8, "preset color chips rendered");
assert(!metrics.hasBorderRgbInput, "RGB inputs removed from gown color rows");

if (failed) {
  await browser.close();
  process.exit(1);
}

console.log("\nAll editor scroll/visibility checks passed");
await browser.close();
