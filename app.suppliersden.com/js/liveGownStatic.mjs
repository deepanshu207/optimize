/**
 * Gown portrait promo @ 703×1024 — teal border + white mat + Best/Flash/Popular badges.
 * Tuned for ~₹49 Meesho shipping band (45–52 KB).
 */
import {
  imageToWhiteCanvas,
  trimMargins,
} from "./lib/canvas-utils.js?v=60";
import { compressFramedToKb, blobToDataUrl } from "./lib/encoder.js?v=60";
import { estimateImageShipping } from "./lib/shipping.js?v=60";
import { drawGownBadge } from "./gownStaticBadges.mjs?v=60";

export const GOWN_STATIC_OUTER_W = 703;
export const GOWN_STATIC_OUTER_H = 1024;
export const GOWN_STATIC_VARIANT_COUNT = 25;

/** Light teal/cyan outer border — reference gown listing frame. */
const BORDER_TEAL = "#5ec4c8";
const TALL_TEAL_PCT = Math.min(0.22, 0.16 * 1.06);
const TALL_WHITE_PCT = 0.05;

const badgeCache = {};

function assetUrl(relative) {
  if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.assetUrl) {
    return MeeshoAPI.assetUrl(relative);
  }
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(relative);
  }
  return relative;
}

async function loadBadge(num) {
  if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.loadBadge) {
    return MeeshoAPI.loadBadge(num);
  }
  if (badgeCache[num]) return badgeCache[num];
  const src = assetUrl("Badge/badge" + num + ".png");
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      badgeCache[num] = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function prepareGownProduct(img) {
  const white = imageToWhiteCanvas(img, 2400);
  return trimMargins(white, 0.01);
}

function gownStaticKbTiers(count = GOWN_STATIC_VARIANT_COUNT) {
  const n = Math.max(20, Math.min(30, count));
  const start = 45;
  const end = 52;
  const tiers = [];
  for (let i = 0; i < n; i++) {
    tiers.push(Math.round(start + ((end - start) * i) / Math.max(1, n - 1)));
  }
  return tiers;
}

/**
 * 703×1024 edge-to-edge; teal outer + white mat (same geometry as tall promo).
 */
function buildGownStaticFrameCanvas(img) {
  const outerW = GOWN_STATIC_OUTER_W;
  const outerH = GOWN_STATIC_OUTER_H;
  const white = prepareGownProduct(img);

  let bestScale = 0.01;
  for (let i = 0; i < 64; i++) {
    const scale = 0.01 + (i / 63) * 2;
    const sw = Math.round(white.width * scale);
    const sh = Math.round(white.height * scale);
    const minDim = Math.min(sw, sh);
    const tealOuter = Math.max(24, Math.round(minDim * TALL_TEAL_PCT));
    const whitePad = Math.max(10, Math.round(minDim * TALL_WHITE_PCT));
    const inset = tealOuter + whitePad;
    if (sw + inset * 2 <= outerW && sh + inset * 2 <= outerH) bestScale = scale;
  }

  const sw = Math.round(white.width * bestScale);
  const sh = Math.round(white.height * bestScale);
  const minDim = Math.min(sw, sh);
  const tealOuter = Math.max(24, Math.round(minDim * TALL_TEAL_PCT));
  const whitePad = Math.max(10, Math.round(minDim * TALL_WHITE_PCT));
  const inset = tealOuter + whitePad;

  const innerW = outerW - inset * 2;
  const innerH = outerH - inset * 2;
  const px = inset + Math.round((innerW - sw) / 2);
  const py = inset + Math.round((innerH - sh) / 2);

  const whiteX = tealOuter;
  const whiteY = tealOuter;
  const whiteW = outerW - tealOuter * 2;
  const whiteH = outerH - tealOuter * 2;

  const canvas = document.createElement("canvas");
  canvas.width = outerW;
  canvas.height = outerH;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BORDER_TEAL;
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
    border: tealOuter,
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

/** Reference: Best PRICE top-left · FLASH SALE top-right · MOST POPULAR middle-left. */
function gownStaticPlacements(px, py, dw, dh) {
  const ref = Math.min(dw, dh);
  const bestW = Math.round(ref * 0.34);
  const bestH = Math.round(bestW * 0.72);
  const flashW = Math.round(ref * 0.3);
  const flashH = Math.round(flashW * 0.42);
  const popW = Math.round(ref * 0.42);
  const popH = Math.round(popW * 0.28);
  const inset = Math.max(4, Math.round(ref * 0.02));

  return [
    {
      id: "gown-best",
      label: "Best PRICE",
      anchor: "top-left",
      kind: "gownArt",
      gownSlot: "gown-best",
      w: bestW,
      h: bestH,
      x: px + inset,
      y: py + inset,
      drawn: false,
    },
    {
      id: "gown-flash",
      label: "FLASH SALE",
      anchor: "top-right",
      kind: "gownArt",
      gownSlot: "gown-flash",
      w: flashW,
      h: flashH,
      x: px + dw - flashW - inset,
      y: py + Math.round(dh * 0.04),
      drawn: false,
    },
    {
      id: "gown-popular",
      label: "MOST POPULAR",
      anchor: "middle-left",
      kind: "gownArt",
      gownSlot: "gown-popular",
      w: popW,
      h: popH,
      x: px - Math.round(popW * 0.02),
      y: py + Math.round(dh * 0.46) - Math.round(popH / 2),
      drawn: false,
    },
  ];
}

async function drawPlacements(ctx, placements) {
  const out = [];
  for (const p of placements) {
    const copy = { ...p };
    try {
      copy.drawn = await drawGownBadge(ctx, loadBadge, p);
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

async function buildGownStaticLayers(img) {
  const built = buildGownStaticFrameCanvas(img);
  const {
    canvas,
    px,
    py,
    dw,
    dh,
    border,
    whitePad,
    whiteX,
    whiteY,
    whiteW,
    whiteH,
    trimmed,
    outerW,
    outerH,
  } = built;
  const placements = gownStaticPlacements(px, py, dw, dh);

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
        style: "gown_static",
        frameType: "tall",
        borderColor: BORDER_TEAL,
        matColor: "#ffffff",
        gradientTop: BORDER_TEAL,
        gradientBottom: "#3aa8ad",
        gradientPreset: null,
        px,
        py,
        dw,
        dh,
        border,
        whitePad,
        baseBorder: border,
        baseWhitePad: whitePad,
        basePx: px,
        basePy: py,
        baseWhiteX: whiteX,
        baseWhiteY: whiteY,
        baseWhiteW: whiteW,
        baseWhiteH: whiteH,
        borderThicknessPct: 100,
        outerW,
        outerH,
        whiteX,
        whiteY,
        whiteW,
        whiteH,
      },
    },
    meta: {
      style: "gown_static",
      showcasePreset: "gown-teal-promo",
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

export async function buildGownStaticVariants(img, options = {}) {
  const {
    onProgress = () => {},
    count = GOWN_STATIC_VARIANT_COUNT,
  } = options;

  onProgress("Building gown promo frames…");

  const { canvas, layers, meta } = await buildGownStaticLayers(img);
  const kbTiers = gownStaticKbTiers(count);
  const variants = [];

  for (let i = 0; i < kbTiers.length; i++) {
    const kb = kbTiers[i];
    onProgress(`Gown promo · ${kb}KB (${i + 1}/${kbTiers.length})`);
    const blob = await compressFramedToKb(canvas, kb);
    const dataUrl = await blobToDataUrl(blob);
    const v = {
      blob,
      dataUrl,
      bytes: blob.size,
      width: meta.outerW,
      height: meta.outerH,
      path: "gown_static",
      mode: "Gown Promo",
      label: `Gown Promo · ${meta.outerW}×${meta.outerH} · ${kb}KB`,
      recommended: kb === 48 || kb === 49 || kb === 50,
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
