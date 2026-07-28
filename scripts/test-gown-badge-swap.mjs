/**
 * Browser: gown badge dropdown composes one sticker at a time.
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

const result = await page.evaluate(async () => {
  const SFC = await import("/js/staticFrameCompose.mjs?v=79");

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
  const noStickers = frameCanvas.toDataURL("image/jpeg", 0.92);

  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = 773;
  fullCanvas.height = 1094;
  fullCanvas.getContext("2d").drawImage(frameCanvas, 0, 0);
  const fullCtx = fullCanvas.getContext("2d");
  fullCtx.fillStyle = "#ff0000";
  fullCtx.fillRect(60, 60, 120, 84);
  const full = fullCanvas.toDataURL("image/jpeg", 0.92);

  const layers = {
    full,
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
      border: 19,
      whitePad: 37,
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
  };

  SFC.ensureStaticPlacementMeta(layers, "gown_static");

  async function compose(edited) {
    return SFC.composeStaticPreview(layers, {}, {
      staticAppearanceEdited: edited,
      jpegQuality: 0.95,
    });
  }

  const artUrl = await compose(false);
  SFC.updatePlacementBadge(layers, "gown-best", "7");
  const badgeUrl = await compose(true);
  SFC.updatePlacementBadge(layers, "gown-best", "gown-art");
  const backUrl = await compose(true);

  return {
    artLen: artUrl.length,
    badgeLen: badgeUrl.length,
    backLen: backUrl.length,
    kind: layers._badgePlacements[0].kind,
  };
});

console.log(JSON.stringify(result, null, 2));

let failed = 0;
if (result.badgeLen === result.artLen) {
  console.error("FAIL: badge swap did not change preview");
  failed++;
}
if (result.backLen === result.badgeLen) {
  console.error("FAIL: restore to gown art did not change preview");
  failed++;
}

if (failed) {
  await browser.close();
  process.exit(1);
}

console.log("ok: gown badge dropdown composes without stacking");
await browser.close();
