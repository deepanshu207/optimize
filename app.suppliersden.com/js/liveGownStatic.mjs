/**
 * Gown portrait promo @ 703×1024 — reference-matched for ~₹49 Meesho band.
 *
 * Unlike tall_static (max product + white flatten → ~₹50–79), gown promo:
 * - Keeps original lifestyle scene (no white flatten)
 * - Thin teal outer border + thick white mat
 * - Product ~62–65% of white area (large breathing room like competitor listing)
 * - 38–48 KB via downscale+compress (same band as low_38–48 framed profiles)
 */
import { imageToCanvas } from "./lib/canvas-utils.js?v=61";
import { blobToDataUrl } from "./lib/encoder.js?v=61";
import { estimateImageShipping } from "./lib/shipping.js?v=61";
import { drawGownBadge } from "./gownStaticBadges.mjs?v=61";

export const GOWN_STATIC_OUTER_W = 703;
export const GOWN_STATIC_OUTER_H = 1024;
export const GOWN_STATIC_VARIANT_COUNT = 25;

/** Reference screenshot teal — thinner outer band than tall promo blue. */
const BORDER_TEAL = "#64c5d3";
/** ~3.5% of canvas — thin cyan rim (reference: thinner than white mat). */
const GOWN_TEAL_RATIO = 0.035;
/** Product fills at most this fraction of the white inner rect (reference ~60–70%). */
const GOWN_PRODUCT_FILL = 0.64;

function gownStaticKbTiers(count = GOWN_STATIC_VARIANT_COUNT) {
  const n = Math.max(20, Math.min(30, count));
  const start = 38;
  const end = 48;
  const tiers = [];
  for (let i = 0; i < n; i++) {
    tiers.push(Math.round(start + ((end - start) * i) / Math.max(1, n - 1)));
  }
  return tiers;
}

function scaleCanvas(src, scale) {
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

function encodePromoJpeg(canvas, quality) {
  const q = Math.max(14, Math.min(92, quality)) / 100;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || new Blob()), "image/jpeg", q);
  });
}

/** Downscale until ≤ target KB — required for lifestyle scenes at ₹49 band. */
async function compressGownToKb(canvas, targetKb) {
  const targetBytes = targetKb * 1024;
  let work = canvas;
  let bestBlob = null;

  for (let attempt = 0; attempt < 14; attempt++) {
    let lo = 14;
    let hi = 92;
    let passBest = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const blob = await encodePromoJpeg(work, mid);
      if (blob.size <= targetBytes) {
        passBest = blob;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (passBest) return { blob: passBest, canvas: work };
    bestBlob = passBest || (await encodePromoJpeg(work, 14));
    if (bestBlob.size <= targetBytes) return { blob: bestBlob, canvas: work };
    if (work.width <= 240) break;
    work = scaleCanvas(work, 0.88);
  }

  return { blob: bestBlob || (await encodePromoJpeg(work, 14)), canvas: work };
}

/**
 * Reference layout: [thin teal] → [wide white mat] → [lifestyle photo + badges].
 * Product is intentionally smaller than tall_static — critical for ₹49 not ₹79.
 */
function buildGownStaticFrameCanvas(img) {
  const outerW = GOWN_STATIC_OUTER_W;
  const outerH = GOWN_STATIC_OUTER_H;

  const base = imageToCanvas(img, 1400);

  const tealOuter = Math.max(18, Math.round(Math.min(outerW, outerH) * GOWN_TEAL_RATIO));
  const whiteX = tealOuter;
  const whiteY = tealOuter;
  const whiteW = outerW - tealOuter * 2;
  const whiteH = outerH - tealOuter * 2;

  const maxProdW = Math.round(whiteW * GOWN_PRODUCT_FILL);
  const maxProdH = Math.round(whiteH * GOWN_PRODUCT_FILL);
  const fitScale = Math.min(maxProdW / base.width, maxProdH / base.height, 1);
  const sw = Math.round(base.width * fitScale);
  const sh = Math.round(base.height * fitScale);

  const px = whiteX + Math.round((whiteW - sw) / 2);
  const py = whiteY + Math.round((whiteH - sh) / 2);

  const padL = px - whiteX;
  const padT = py - whiteY;
  const padR = whiteX + whiteW - (px + sw);
  const padB = whiteY + whiteH - (py + sh);
  const whitePad = Math.round((padL + padT + padR + padB) / 4);

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
  ctx.drawImage(base, 0, 0, base.width, base.height, px, py, sw, sh);

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
    source: base,
    outerW,
    outerH,
  };
}

/** Reference sticker slots — on lifestyle photo, not on white mat. */
function gownStaticPlacements(px, py, dw, dh) {
  const ref = Math.min(dw, dh);
  const bestW = Math.round(ref * 0.36);
  const bestH = Math.round(bestW * 0.7);
  const flashW = Math.round(ref * 0.32);
  const flashH = Math.round(flashW * 0.4);
  const popW = Math.round(ref * 0.44);
  const popH = Math.round(popW * 0.26);
  const inset = Math.max(2, Math.round(ref * 0.015));

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
      y: py + Math.round(dh * 0.03),
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
      x: px - Math.round(popW * 0.04),
      y: py + Math.round(dh * 0.48) - Math.round(popH / 2),
      drawn: false,
    },
  ];
}

async function drawPlacements(ctx, placements) {
  const out = [];
  for (const p of placements) {
    const copy = { ...p };
    try {
      copy.drawn = await drawGownBadge(ctx, () => null, p);
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
    source,
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
    .drawImage(source, 0, 0, source.width, source.height, 0, 0, dw, dh);
  const productOnly = dataUrlFromCanvas(productOnlyCanvas);

  const noBorderCanvas = document.createElement("canvas");
  noBorderCanvas.width = dw;
  noBorderCanvas.height = dh;
  const nbCtx = noBorderCanvas.getContext("2d");
  nbCtx.drawImage(source, 0, 0, source.width, source.height, 0, 0, dw, dh);
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
        gradientBottom: "#4aafb5",
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
      productFill: GOWN_PRODUCT_FILL,
    },
  };
}

export async function buildGownStaticVariants(img, options = {}) {
  const {
    onProgress = () => {},
    count = GOWN_STATIC_VARIANT_COUNT,
  } = options;

  onProgress("Building gown promo frames…");

  const { canvas: sourceCanvas, layers, meta } = await buildGownStaticLayers(img);
  const kbTiers = gownStaticKbTiers(count);
  const variants = [];

  for (let i = 0; i < kbTiers.length; i++) {
    const kb = kbTiers[i];
    onProgress(`Gown promo · ${kb}KB (${i + 1}/${kbTiers.length})`);
    const { blob, canvas: outCanvas } = await compressGownToKb(sourceCanvas, kb);
    const dataUrl = await blobToDataUrl(blob);
    const v = {
      blob,
      dataUrl,
      bytes: blob.size,
      width: outCanvas.width,
      height: outCanvas.height,
      path: "gown_static",
      mode: "Gown Promo",
      label: `Gown Promo · ${outCanvas.width}×${outCanvas.height} · ${kb}KB`,
      recommended: kb === 44 || kb === 46 || kb === 48,
      lowest: i === 0,
      layers,
      meta: {
        ...meta,
        targetKb: kb,
        outerW: outCanvas.width,
        outerH: outCanvas.height,
        canvasW: outCanvas.width,
        canvasH: outCanvas.height,
      },
    };
    v.kb = Math.ceil(blob.size / 1024);
    v.estInr = estimateImageShipping(v);
    variants.push(v);
    await new Promise((r) => setTimeout(r, 0));
  }

  return variants;
}
