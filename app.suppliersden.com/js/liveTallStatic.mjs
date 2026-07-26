/**
 * Web-only tall portrait promo — exact reference layout @ 703×1024.
 * Thick blue border · white mat · full product · 3 corner badges on white mat.
 */
import { imageToWhiteCanvas } from "./lib/canvas-utils.js?v=46";
import { compressFramedToKb } from "./lib/encoder.js?v=46";
import { estimateImageShipping } from "./lib/shipping.js?v=46";
import { drawTallPlacement } from "./tallStaticBadges.mjs?v=46";

export const TALL_STATIC_OUTER_W = 703;
export const TALL_STATIC_OUTER_H = 1024;
export const TALL_STATIC_VARIANT_COUNT = 25;

/** Light blue border — matches reference screenshot. */
const BORDER_BLUE = "#add8e6";

function tallStaticKbTiers(count = TALL_STATIC_VARIANT_COUNT) {
  const n = Math.max(20, Math.min(30, count));
  const start = 40;
  const end = 52;
  const tiers = [];
  for (let i = 0; i < n; i++) {
    tiers.push(Math.round(start + ((end - start) * i) / Math.max(1, n - 1)));
  }
  return tiers;
}

/**
 * Build exactly 703×1024 — blue fills entire canvas, white mat inside, product maximized.
 */
function buildTallStaticFrameCanvas(img) {
  const outerW = TALL_STATIC_OUTER_W;
  const outerH = TALL_STATIC_OUTER_H;

  // Thick uniform blue border (~10.5% of short side) like reference
  const blueOuter = Math.round(Math.min(outerW, outerH) * 0.105);
  const whitePad = Math.max(10, Math.round(blueOuter * 0.16));

  const whiteX = blueOuter;
  const whiteY = blueOuter;
  const whiteW = outerW - blueOuter * 2;
  const whiteH = outerH - blueOuter * 2;

  const availW = whiteW - whitePad * 2;
  const availH = whiteH - whitePad * 2;

  const white = imageToWhiteCanvas(img);
  const scale = Math.min(availW / white.width, availH / white.height);
  const dw = Math.round(white.width * scale);
  const dh = Math.round(white.height * scale);
  const px = whiteX + whitePad + Math.round((availW - dw) / 2);
  const py = whiteY + whitePad + Math.round((availH - dh) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = outerW;
  canvas.height = outerH;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BORDER_BLUE;
  ctx.fillRect(0, 0, outerW, outerH);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(whiteX, whiteY, whiteW, whiteH);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(white, 0, 0, white.width, white.height, px, py, dw, dh);

  return {
    canvas,
    px,
    py,
    dw,
    dh,
    border: blueOuter,
    whiteX,
    whiteY,
    whiteW,
    whiteH,
    trimmed: white,
    outerW,
    outerH,
  };
}

/** Badges sit on white-mat corners (reference positions). */
function tallStaticPlacements(frame) {
  const { whiteX, whiteY, whiteW, whiteH, outerW, outerH } = frame;
  const ref = Math.min(outerW, outerH);

  const tagSize = Math.round(ref * 0.11);
  const arrowW = Math.round(ref * 0.1);
  const arrowH = Math.round(ref * 0.14);
  const truckSize = Math.round(ref * 0.1);
  const pad = Math.max(6, Math.round(ref * 0.012));

  const placements = [
    {
      id: "tall-sale",
      label: "Price tag",
      anchor: "top-left",
      kind: "priceTag",
      size: tagSize,
      x: whiteX + pad,
      y: whiteY + pad,
      drawn: false,
    },
    {
      id: "tall-arrow",
      label: "Arrow",
      anchor: "top-right",
      kind: "curvedArrow",
      w: arrowW,
      h: arrowH,
      x: whiteX + whiteW - arrowW - pad,
      y: whiteY + pad,
      drawn: false,
    },
    {
      id: "tall-ship",
      label: "Delivery truck",
      anchor: "bottom-left",
      kind: "truckIcon",
      size: truckSize,
      x: whiteX + pad,
      y: whiteY + whiteH - truckSize - pad,
      drawn: false,
    },
  ];

  return placements;
}

async function drawPlacements(ctx, placements) {
  const out = [];
  for (const p of placements) {
    const copy = { ...p };
    try {
      drawTallPlacement(ctx, p);
      copy.drawn = true;
    } catch (e) {}
    out.push(copy);
  }
  return out;
}

function dataUrlFromCanvas(canvas, quality = 0.82) {
  return canvas.toDataURL("image/jpeg", quality);
}

async function buildTallStaticLayers(img) {
  const built = buildTallStaticFrameCanvas(img);
  const {
    canvas,
    px,
    py,
    dw,
    dh,
    border,
    whiteX,
    whiteY,
    whiteW,
    whiteH,
    trimmed,
    outerW,
    outerH,
  } = built;
  const placements = tallStaticPlacements(built);

  const noStickersCanvas = document.createElement("canvas");
  noStickersCanvas.width = canvas.width;
  noStickersCanvas.height = canvas.height;
  noStickersCanvas.getContext("2d").drawImage(canvas, 0, 0);
  const noStickers = dataUrlFromCanvas(noStickersCanvas);

  const fullCtx = canvas.getContext("2d");
  const badgePlacements = await drawPlacements(fullCtx, placements);
  const full = dataUrlFromCanvas(canvas);

  const productOnlyCanvas = document.createElement("canvas");
  productOnlyCanvas.width = dw;
  productOnlyCanvas.height = dh;
  productOnlyCanvas
    .getContext("2d")
    .drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, 0, 0, dw, dh);
  const productOnly = dataUrlFromCanvas(productOnlyCanvas);

  const noBorderCanvas = document.createElement("canvas");
  noBorderCanvas.width = dw;
  noBorderCanvas.height = dh;
  const nbCtx = noBorderCanvas.getContext("2d");
  nbCtx.drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, 0, 0, dw, dh);
  const shifted = badgePlacements.map((p) => ({
    ...p,
    x: (p.x || 0) - px,
    y: (p.y || 0) - py,
  }));
  await drawPlacements(nbCtx, shifted);
  const noBorder = dataUrlFromCanvas(noBorderCanvas);

  return {
    canvas,
    layers: {
      full,
      noStickers,
      noBorder,
      productOnly,
      _stickersRendered: badgePlacements.some((p) => p.drawn),
      _badgePlacements: badgePlacements,
      _staticFrame: {
        style: "tall_static",
        px,
        py,
        dw,
        dh,
        border,
        outerW,
        outerH,
        whiteX,
        whiteY,
        whiteW,
        whiteH,
      },
    },
    meta: {
      style: "tall_static",
      showcasePreset: "tall-blue-promo",
      canvasW: outerW,
      canvasH: outerH,
      productW: dw,
      productH: dh,
      borderPx: border,
      outerW,
      outerH,
    },
  };
}

/**
 * Generate tall static promo variants (40–52 KB) — ₹50 band.
 */
export async function buildTallStaticVariants(img, options = {}) {
  const {
    onProgress = () => {},
    count = TALL_STATIC_VARIANT_COUNT,
  } = options;

  onProgress("Building tall promo frames…");

  const { canvas, layers, meta } = await buildTallStaticLayers(img);
  const kbTiers = tallStaticKbTiers(count);
  const variants = [];

  for (let i = 0; i < kbTiers.length; i++) {
    const kb = kbTiers[i];
    onProgress(`Tall promo · ${kb}KB (${i + 1}/${kbTiers.length})`);
    const blob = await compressFramedToKb(canvas, kb);
    const v = {
      blob,
      bytes: blob.size,
      width: meta.outerW,
      height: meta.outerH,
      path: "tall_static",
      mode: "Tall Promo",
      label: `Tall Promo · ${meta.outerW}×${meta.outerH} · ${kb}KB`,
      recommended: kb === 48 || kb === 50,
      lowest: i === 0,
      layers,
      meta: { ...meta, targetKb: kb },
    };
    v.kb = Math.ceil(blob.size / 1024);
    v.estInr = estimateImageShipping(v);
    variants.push(v);
    await new Promise((r) => setTimeout(r, 0));
  }

  return variants;
}
