/**
 * Browser: gown fill mat color must change composed preview pixels.
 */
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const appRoot = resolve(root, "app.suppliersden.com");

const server = createServer((req, res) => {
  const path = (req.url || "/").split("?")[0];
  const file = path === "/" ? "/index.html" : path;
  const full = resolve(appRoot, "." + file);
  try {
    const data = readFileSync(full);
    const ext = file.slice(file.lastIndexOf("."));
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(8791, r));

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:8791/", { waitUntil: "networkidle0" });

const result = await page.evaluate(async () => {
  const mod = await import("/js/staticFrameCompose.mjs?v=112");
  const { composeStaticPreview, updateFrameAppearance, ensureStaticPlacementMeta } = mod;

  const productCanvas = document.createElement("canvas");
  productCanvas.width = 657;
  productCanvas.height = 978;
  const pctx = productCanvas.getContext("2d");
  pctx.fillStyle = "#cc0000";
  pctx.fillRect(0, 0, 657, 978);
  const productOnly = productCanvas.toDataURL("image/jpeg", 0.92);

  const frame = {
    style: "gown_static",
    outerW: 773,
    outerH: 1094,
    border: 19,
    outerMatPad: 19,
    innerMatPad: 17,
    innerFrameX: 38,
    innerFrameY: 38,
    innerFrameW: 697,
    innerFrameH: 1018,
    px: 58,
    py: 58,
    dw: 657,
    dh: 978,
    basePx: 58,
    basePy: 58,
    baseDw: 657,
    baseDh: 978,
    baseBorder: 19,
    baseOuterMatPad: 19,
    baseInnerMatPad: 17,
    baseInnerFrameX: 38,
    baseInnerFrameY: 38,
    baseInnerFrameW: 697,
    baseInnerFrameH: 1018,
    borderColor: "#71cbd3",
    outerMatColor: "#ffffff",
    fillMatColor: "#ffffff",
    fillMatEnabled: true,
    padColor: "#ffffff",
    gownLayerPct: { border: 100, outerMat: 100, innerMat: 100 },
  };

  const noStickersCanvas = document.createElement("canvas");
  noStickersCanvas.width = 773;
  noStickersCanvas.height = 1094;
  const ns = noStickersCanvas.getContext("2d");
  ns.fillStyle = "#71cbd3";
  ns.fillRect(0, 0, 773, 1094);
  ns.fillStyle = "#ffffff";
  ns.fillRect(19, 19, 735, 1056);
  ns.drawImage(productCanvas, 58, 58);
  const noStickers = noStickersCanvas.toDataURL("image/jpeg", 0.92);

  const layers = {
    full: noStickers,
    noStickers,
    productOnly,
    _gownPhotoSource: productOnly,
    _badgePlacements: [{ id: "gown-best", kind: "gownArt", gownSlot: "gown-best", x: 60, y: 60, w: 100, h: 70, drawn: true }],
    _staticFrame: frame,
  };
  ensureStaticPlacementMeta(layers, "gown_static");

  const matPoints = [
    [25, 25],
    [50, 50],
    [200, 50],
    [50, 300],
  ];

  async function samplePoints(url) {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const out = {};
    for (const [x, y] of matPoints) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      out[`${x},${y}`] = [d[0], d[1], d[2]];
    }
    return out;
  }

  const whiteUrl = await composeStaticPreview(layers, {}, { preview: true, staticAppearanceEdited: true });
  updateFrameAppearance(layers, { fillMatColor: "#7c3aed", outerMatColor: "#ff0000" });

  const gownMod = await import("/js/liveGownStatic.mjs?v=110");
  const directCanvas = document.createElement("canvas");
  directCanvas.width = 773;
  directCanvas.height = 1094;
  gownMod.drawGownStaticFrameBackground(directCanvas.getContext("2d"), { ...layers._staticFrame });
  const directPixel = Array.from(
    directCanvas.getContext("2d").getImageData(50, 50, 1, 1).data,
  );

  const purpleUrl = await composeStaticPreview(layers, {}, { preview: true, staticAppearanceEdited: true });

  let rebuildPixel = null;
  if (mod.rebuildGownPreviewCanvas) {
    const rebuilt = await mod.rebuildGownPreviewCanvas(layers);
    if (rebuilt?.canvas) {
      rebuildPixel = Array.from(
        rebuilt.canvas.getContext("2d").getImageData(50, 50, 1, 1).data,
      );
    }
  }

  const whiteSample = await samplePoints(whiteUrl);
  const purpleSample = await samplePoints(purpleUrl);

  return { whiteSample, purpleSample, frameFill: layers._staticFrame.fillMatColor, directPixel, rebuildPixel };
});

server.close();
await browser.close();

let failed = 0;
if (!result.purpleSample) {
  console.error("FAIL: compose returned no samples");
  failed++;
}
const mat50 = result.purpleSample?.["50,50"];
const white50 = result.whiteSample?.["50,50"];
if (!mat50 || (mat50[0] === white50?.[0] && mat50[1] === white50?.[1] && mat50[2] === white50?.[2])) {
  console.error("FAIL: inner mat pixel (50,50) unchanged after fill mat edit", result);
  failed++;
}
if (!mat50 || mat50[0] < 100 || mat50[2] < 200) {
  console.error("FAIL: expected purple at inner mat (50,50)", mat50);
  failed++;
}
const outer25 = result.purpleSample?.["25,25"];
if (!outer25 || outer25[0] < 200) {
  console.error("FAIL: expected red outer mat at (25,25)", outer25);
  failed++;
}

if (failed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log("ok: gown mat compose changes preview pixels", result);
