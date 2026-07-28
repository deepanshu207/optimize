/**
 * Browser test: gown badge dropdown swap updates preview without stacking.
 */
import puppeteer from "puppeteer-core";

const BASE = "http://127.0.0.1:8787";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30000 });
await page.waitForFunction(() => window.meeshoOptimizer, { timeout: 15000 });

const result = await page.evaluate(async () => {
  const SFC = await import("/js/staticFrameCompose.mjs?v=78");

  const productCanvas = document.createElement("canvas");
  productCanvas.width = 661;
  productCanvas.height = 982;
  const pctx = productCanvas.getContext("2d");
  pctx.fillStyle = "#9c27b0";
  pctx.fillRect(0, 0, 661, 982);
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
  const noStickers = frameCanvas.toDataURL("image/jpeg", 0.92);

  const row = {
    variantId: "gown-badge-swap-test",
    name: "Gown Badge Swap",
    pricingImageUrl: noStickers,
    dataUrl: noStickers,
    imageUrl: noStickers,
    layers: {
      full: noStickers,
      noStickers,
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
          x: 60,
          y: 60,
          drawn: true,
          anchor: "top-left",
          posH: 5,
          posV: 5,
          sizePct: 100,
        },
      ],
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
    _staticAppearanceEdited: false,
  };

  SFC.ensureStaticPlacementMeta(row.layers, "gown_static");

  async function compose() {
    return SFC.composeStaticPreview(row.layers, row.editFlags || {}, {
      staticAppearanceEdited: !!row._staticAppearanceEdited,
      badgesRepositioned: !!row._badgesRepositioned,
      jpegQuality: 0.95,
    });
  }

  const artUrl = await compose();
  row._staticAppearanceEdited = true;
  const swapped = SFC.updatePlacementBadge(row.layers, "gown-best", "7");
  const kindAfterBadge = row.layers._badgePlacements[0].kind;
  const numAfterBadge = row.layers._badgePlacements[0].num;
  const badgeUrl = await compose();
  const restored = SFC.updatePlacementBadge(
    row.layers,
    "gown-best",
    SFC.gownArtBadgeValue("gown-best"),
  );
  const kindAfterRestore = row.layers._badgePlacements[0].kind;
  const backUrl = await compose();

  return {
    swapped,
    restored,
    artLen: artUrl.length,
    badgeLen: badgeUrl.length,
    backLen: backUrl.length,
    kindAfterBadge,
    kindAfterRestore,
    numAfterBadge,
  };
});

console.log(JSON.stringify(result, null, 2));

let failed = 0;
if (!result.swapped) {
  console.error("FAIL: updatePlacementBadge to badge 7 returned false");
  failed++;
}
if (!result.restored) {
  console.error("FAIL: restore gown art returned false");
  failed++;
}
if (result.kindAfterBadge !== "badge" || result.numAfterBadge !== 7) {
  console.error("FAIL: gown-best should become numbered badge 7");
  failed++;
}
if (result.kindAfterRestore !== "gownArt") {
  console.error("FAIL: gown-best should restore gown art kind");
  failed++;
}
if (result.artLen === result.badgeLen) {
  console.error("FAIL: preview unchanged after badge swap");
  failed++;
}
if (result.badgeLen === result.backLen) {
  console.error("FAIL: preview unchanged after restore to gown art");
  failed++;
}

if (failed) {
  await browser.close();
  process.exit(1);
}

console.log("ok: gown badge dropdown swap composes cleanly");
await browser.close();
