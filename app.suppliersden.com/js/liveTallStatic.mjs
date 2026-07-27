/**
 * Tall portrait promo — pixel-match reference #2 @ 703×1024.
 * Hunt low_48_tall frame math + badge3 / arrow / badge1 on product corners.
 */
import {
  imageToWhiteCanvas,
  trimMargins,
} from "./lib/canvas-utils.js?v=51";
import { compressFramedToKb, blobToDataUrl } from "./lib/encoder.js?v=51";
import { estimateImageShipping } from "./lib/shipping.js?v=51";
import { drawTallPlacement, loadTallBadge } from "./tallStaticBadges.mjs?v=51";

export const TALL_STATIC_OUTER_W = 703;
export const TALL_STATIC_OUTER_H = 1024;
export const TALL_STATIC_VARIANT_COUNT = 25;

/** Reference #2 badge assets. */
export const TALL_STATIC_BADGES = {
  tag: 3,
  ship: 1,
};

/** Reference #2: blue ~10% of canvas, white mat ~half of blue band. */
const BORDER_BLUE_RATIO = 0.10;
const WHITE_MAT_RATIO = 0.05;

/** Sky blue from reference (#45a9e5). */
const BORDER_BLUE = "#45a9e5";

function prepareTallProduct(img) {
  const white = imageToWhiteCanvas(img, 2400);
  return trimMargins(white, 0.01);
}

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
 * Build 703×1024 edge-to-edge — fixed border % of canvas (reference #2).
 * No centering gap (that was causing extra-thick blue bars on the sides).
 */
function buildTallStaticFrameCanvas(img) {
  const outerW = TALL_STATIC_OUTER_W;
  const outerH = TALL_STATIC_OUTER_H;

  const white = prepareTallProduct(img);
  const ref = Math.min(outerW, outerH);
  const blueOuter = Math.max(22, Math.round(ref * BORDER_BLUE_RATIO));
  const whitePad = Math.max(8, Math.round(ref * WHITE_MAT_RATIO));
  const inset = blueOuter + whitePad;

  const innerW = outerW - inset * 2;
  const innerH = outerH - inset * 2;
  const scale = Math.min(innerW / white.width, innerH / white.height);
  const sw = Math.round(white.width * scale);
  const sh = Math.round(white.height * scale);
  const px = inset + Math.round((innerW - sw) / 2);
  const py = inset + Math.round((innerH - sh) / 2);

  const whiteX = blueOuter;
  const whiteY = blueOuter;
  const whiteW = outerW - blueOuter * 2;
  const whiteH = outerH - blueOuter * 2;

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
  ctx.drawImage(white, 0, 0, white.width, white.height, px, py, sw, sh);

  return {
    canvas,
    px,
    py,
    dw: sw,
    dh: sh,
    border: blueOuter,
    whitePad,
    whiteX,
    whiteY,
    whiteW,
    whiteH,
    trimmed: white,
    outerW,
    outerH,
  };
}

/**
 * Badges on product-photo corners (reference #2 / addLowShippingBadges slots).
 */
function tallStaticPlacements(frame) {
  const { px, py, dw, dh } = frame;

  const size = Math.max(56, Math.round(Math.min(dw, dh) * 0.14));
  const inset = Math.max(6, Math.round(size * 0.06));
  const tagSize = size;
  const arrowW = Math.round(size * 1.2);
  const arrowH = Math.round(size * 1.15);
  const truckSize = Math.round(size * 0.95);

  return [
    {
      id: "tall-sale",
      label: "Price tag",
      anchor: "top-left",
      num: TALL_STATIC_BADGES.tag,
      size: tagSize,
      w: tagSize,
      h: tagSize,
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
      num: TALL_STATIC_BADGES.ship,
      size: truckSize,
      w: truckSize,
      h: truckSize,
      x: px + inset,
      y: py + dh - truckSize - inset,
      drawn: false,
    },
  ];
}

async function drawPlacements(ctx, placements) {
  const out = [];
  for (const p of placements) {
    const copy = { ...p };
    try {
      copy.drawn = await drawTallPlacement(ctx, p);
    } catch (e) {
      copy.drawn = false;
    }
    out.push(copy);
  }
  return out;
}

function dataUrlFromCanvas(canvas, quality = 0.82) {
  return canvas.toDataURL("image/jpeg", quality);
}

async function buildTallStaticLayers(img) {
  await Promise.all([
    loadTallBadge(TALL_STATIC_BADGES.tag),
    loadTallBadge(TALL_STATIC_BADGES.ship),
  ]);

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
    const dataUrl = await blobToDataUrl(blob);
    const v = {
      blob,
      dataUrl,
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
