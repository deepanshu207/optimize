/**
 * Simulates app path: MeeshoAPI.resolveDisplayUrlAsync after border slider.
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
  await import("/js/staticFrameCompose.mjs?v=68");

  const productCanvas = document.createElement("canvas");
  productCanvas.width = 561;
  productCanvas.height = 841;
  const pctx = productCanvas.getContext("2d");
  pctx.fillStyle = "#e91e63";
  pctx.fillRect(0, 0, 561, 841);
  const productOnly = productCanvas.toDataURL("image/jpeg", 0.92);

  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = 773;
  frameCanvas.height = 1094;
  const fctx = frameCanvas.getContext("2d");
  fctx.fillStyle = "#71cbd3";
  fctx.fillRect(0, 0, 773, 1094);
  fctx.fillStyle = "#ffffff";
  fctx.fillRect(19, 19, 735, 1056);
  fctx.drawImage(productCanvas, 106, 126, 561, 841);
  const full = frameCanvas.toDataURL("image/jpeg", 0.92);
  const noStickers = full;

  const row = {
    layers: {
      full,
      noStickers,
      productOnly,
      _stickersRendered: true,
      _badgePlacements: [
        {
          id: "gown-best",
          kind: "gownArt",
          gownSlot: "gown-best",
          w: 100,
          h: 70,
          x: 120,
          y: 120,
          drawn: true,
          anchor: "top-left",
        },
      ],
      _staticFrame: {
        style: "gown_static",
        frameType: "tall",
        border: 19,
        whitePad: 87,
        baseBorder: 19,
        baseWhitePad: 87,
        basePx: 106,
        basePy: 126,
        baseDw: 561,
        baseDh: 841,
        baseWhiteX: 19,
        baseWhiteY: 19,
        baseWhiteW: 735,
        baseWhiteH: 1056,
        px: 106,
        py: 126,
        dw: 561,
        dh: 841,
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
    meta: { targetKb: 44, path: "gown_static" },
    _staticAppearanceEdited: false,
  };

  window.StaticFrameCompose.ensureStaticPlacementMeta(row.layers, "gown_static");

  async function urlAt(pct) {
    row._staticAppearanceEdited = true;
    window.StaticFrameCompose.updateFrameAppearance(row.layers, {
      borderThicknessPct: pct,
    });
    window.StaticFrameCompose.reanchorPlacements(row.layers);
    const url = await MeeshoAPI.resolveDisplayUrlAsync(row);
    return {
      pct,
      len: url.length,
      border: row.layers._staticFrame.border,
      sameAsFull: url === row.layers.full,
    };
  }

  const at100 = await urlAt(100);
  const at300 = await urlAt(300);
  const at500 = await urlAt(500);

  return { at100, at300, at500 };
});

console.log(JSON.stringify(result, null, 2));

let failed = 0;
if (result.at300.sameAsFull || result.at500.sameAsFull) {
  console.error("FAIL: composed URL still equals baked full layer");
  failed++;
}
if (result.at300.len === result.at100.len && result.at500.len === result.at100.len) {
  console.error("FAIL: URL length unchanged after border edit");
  failed++;
}
if (result.at500.border <= result.at100.border) {
  console.error("FAIL: frame.border did not increase at 500%");
  failed++;
}

if (failed) process.exit(1);
console.log("ok: resolveDisplayUrlAsync reflects border edits");
await browser.close();
