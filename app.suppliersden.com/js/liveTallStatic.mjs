/**
 * Web-only tall portrait promo frames — 703×1024 blue border + corner badges @ ₹50 band.
 * Layout matches competitor reference: thick blue frame, white mat, full product, 3 corner icons.
 */
import { imageToWhiteCanvas } from "./lib/canvas-utils.js?v=45";
import { compressFramedToKb } from "./lib/encoder.js?v=45";
import { estimateImageShipping } from "./lib/shipping.js?v=45";
import {
  drawPriceTag,
  drawCurvedArrow,
  drawDeliveryTruck,
  drawTallPlacement,
} from "./tallStaticBadges.mjs?v=45";

export const TALL_STATIC_OUTER_W = 703;
export const TALL_STATIC_OUTER_H = 1024;
export const TALL_STATIC_VARIANT_COUNT = 25;

const BORDER_BLUE = "#add8e6";
const BLUE_PCT = 0.17;
const WHITE_PCT = 0.04;

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
 * Screenshot-style frame scaled to exactly 703×1024 (same as low_*_tall hunt layout).
 */
function buildTallStaticFrameCanvas(img) {
  const outerW = TALL_STATIC_OUTER_W;
  const outerH = TALL_STATIC_OUTER_H;
  const white = imageToWhiteCanvas(img);

  let w = white.width;
  let h = white.height;
  const cap = 920;
  if (Math.max(w, h) > cap) {
    const s = cap / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }

  const minDim = Math.min(w, h);
  const blueOuter = Math.max(24, Math.round(minDim * BLUE_PCT * 1.06));
  const whitePad = Math.max(10, Math.round(minDim * WHITE_PCT));
  const inset = blueOuter + whitePad;

  const framedW = w + inset * 2;
  const framedH = h + inset * 2;
  const scale = Math.min(outerW / framedW, outerH / framedH);

  const outFramedW = Math.round(framedW * scale);
  const outFramedH = Math.round(framedH * scale);
  const ox = Math.round((outerW - outFramedW) / 2);
  const oy = Math.round((outerH - outFramedH) / 2);

  const outBlue = Math.round(blueOuter * scale);
  const outInset = Math.round(inset * scale);
  const dw = Math.round(w * scale);
  const dh = Math.round(h * scale);
  const px = ox + outInset;
  const py = oy + outInset;

  const canvas = document.createElement("canvas");
  canvas.width = outerW;
  canvas.height = outerH;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BORDER_BLUE;
  ctx.fillRect(0, 0, outerW, outerH);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(
    ox + outBlue,
    oy + outBlue,
    outFramedW - outBlue * 2,
    outFramedH - outBlue * 2,
  );

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(white, 0, 0, white.width, white.height, px, py, dw, dh);

  ctx.strokeStyle = "#9ec5e8";
  ctx.lineWidth = Math.max(2, Math.round(minDim * scale * 0.006));
  ctx.strokeRect(px - 1, py - 1, dw + 2, dh + 2);

  return {
    canvas,
    px,
    py,
    dw,
    dh,
    border: outBlue,
    trimmed: white,
    outerW,
    outerH,
    scale,
  };
}

function tallStaticPlacements(px, py, dw, dh, outerW, outerH) {
  const ref = Math.min(dw, dh);
  const tagSize = Math.max(52, Math.round(ref * 0.14));
  const arrowW = Math.max(44, Math.round(ref * 0.12));
  const arrowH = Math.max(50, Math.round(ref * 0.16));
  const truckSize = Math.max(48, Math.round(ref * 0.13));
  const inset = Math.max(6, Math.round(tagSize * 0.06));

  const placements = [
    {
      id: "tall-sale",
      label: "Price tag",
      anchor: "top-left",
      kind: "priceTag",
      size: tagSize,
      x: px + inset,
      y: py + inset,
      drawn: false,
    },
    {
      id: "tall-arrow",
      label: "Arrow",
      anchor: "top-right",
      kind: "curvedArrow",
      w: arrowW,
      h: arrowH,
      x: px + dw - arrowW - inset,
      y: py + inset,
      drawn: false,
    },
    {
      id: "tall-ship",
      label: "Delivery truck",
      anchor: "bottom-left",
      kind: "truckIcon",
      size: truckSize,
      x: px + inset,
      y: py + dh - truckSize - inset,
      drawn: false,
    },
  ];

  const pad = 3;
  for (const p of placements) {
    const pw = p.w || p.size;
    const ph = p.h || p.size;
    p.x = Math.max(pad, Math.min(p.x, outerW - pw - pad));
    p.y = Math.max(pad, Math.min(p.y, outerH - ph - pad));
  }
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
  const { canvas, px, py, dw, dh, border, trimmed, outerW, outerH } = built;
  const placements = tallStaticPlacements(px, py, dw, dh, outerW, outerH);

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
