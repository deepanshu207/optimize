/**
 * Gown portrait promo @ 773×1094 — competitor-matched teal frame for ~₹49 band.
 * Isolated from tall_static (do not share max-fill / white-flatten logic).
 */
import { imageToCanvas } from "./lib/canvas-utils.js?v=93";
import { blobToDataUrl } from "./lib/encoder.js?v=93";
import { estimateImageShipping } from "./lib/shipping.js?v=93";
import { drawGownBadge } from "./gownStaticBadges.mjs?v=93";

export const GOWN_STATIC_OUTER_W = 773;
export const GOWN_STATIC_OUTER_H = 1094;
export const GOWN_STATIC_VARIANT_COUNT = 25;

/**
 * Reference frame stack (outside → in):
 * teal border → white mat (similar weight) → teal inner accent → white pad → photo.
 */
export const BORDER_TEAL = "#71cbd3";
const BORDER_TEAL_DARK = "#5eb8c4";
export const GOWN_TEAL_RATIO = 0.025;
/** Primary white mat — similar thickness to outer teal ring. */
export const GOWN_OUTER_MAT_RATIO = 0.025;
export const GOWN_OUTER_MAT_MIN = 18;
/** White padding between inner teal accent and lifestyle photo. */
export const GOWN_INNER_MAT_RATIO = 0.022;
export const GOWN_INNER_MAT_MIN = 14;
/** Thin teal inner accent line (visible third layer on reference listing). */
export const GOWN_INNER_STROKE = 3;
export const GOWN_INNER_STROKE_COLOR = BORDER_TEAL;

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

export function computeGownFrameGeometry(outerW, outerH, overrides = {}) {
  const ref = Math.min(outerW, outerH);
  const border = overrides.border ?? Math.max(14, Math.round(ref * GOWN_TEAL_RATIO));
  const outerMatPad =
    overrides.outerMatPad ??
    Math.max(GOWN_OUTER_MAT_MIN, Math.round(ref * GOWN_OUTER_MAT_RATIO));
  const innerMatPad =
    overrides.innerMatPad ??
    Math.max(GOWN_INNER_MAT_MIN, Math.round(ref * GOWN_INNER_MAT_RATIO));
  const innerStroke = overrides.innerStroke ?? GOWN_INNER_STROKE;

  const whiteX = border;
  const whiteY = border;
  const whiteW = outerW - border * 2;
  const whiteH = outerH - border * 2;

  const innerFrameX = whiteX + outerMatPad;
  const innerFrameY = whiteY + outerMatPad;
  const innerFrameW = whiteW - outerMatPad * 2;
  const innerFrameH = whiteH - outerMatPad * 2;

  const slotInset = innerMatPad + innerStroke;
  const slotX = innerFrameX + slotInset;
  const slotY = innerFrameY + slotInset;
  const maxProdW = innerFrameW - slotInset * 2;
  const maxProdH = innerFrameH - slotInset * 2;

  return {
    border,
    outerMatPad,
    innerMatPad,
    innerStroke,
    innerStrokeColor: overrides.innerStrokeColor ?? GOWN_INNER_STROKE_COLOR,
    whitePad: outerMatPad + innerMatPad + innerStroke,
    whiteX,
    whiteY,
    whiteW,
    whiteH,
    innerFrameX,
    innerFrameY,
    innerFrameW,
    innerFrameH,
    px: slotX,
    py: slotY,
    dw: maxProdW,
    dh: maxProdH,
    outerW,
    outerH,
  };
}

function drawGownInnerAccent(ctx, x, y, w, h, thickness, color) {
  const t = Math.max(2, Math.round(thickness));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, t);
  ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x, y, t, h);
  ctx.fillRect(x + w - t, y, t, h);
}

/** Gown outer border uses a vertical gradient when frameType is gradient or a preset is set. */
export function gownUsesBorderGradient(frame) {
  return frame?.frameType === "gradient" || !!frame?.gradientPreset;
}

function gownBorderFillStyle(ctx, frame, outerW, outerH) {
  if (!gownUsesBorderGradient(frame)) {
    return frame.borderColor || BORDER_TEAL;
  }
  const grad = ctx.createLinearGradient(0, 0, 0, outerH);
  grad.addColorStop(0, frame.gradientTop || frame.borderColor || BORDER_TEAL);
  grad.addColorStop(1, frame.gradientBottom || BORDER_TEAL_DARK);
  return grad;
}

/** Teal border + white mat + teal inner accent (no photo). */
export function drawGownStaticFrameBackground(ctx, frame) {
  const outerW = frame.outerW || 0;
  const outerH = frame.outerH || 0;
  const border = frame.border ?? 0;
  const wx = frame.whiteX ?? border;
  const wy = frame.whiteY ?? border;
  const ww = frame.whiteW ?? outerW - border * 2;
  const wh = frame.whiteH ?? outerH - border * 2;
  const omp = frame.outerMatPad ?? 0;
  const ifx = frame.innerFrameX ?? wx + omp;
  const ify = frame.innerFrameY ?? wy + omp;
  const ifw = frame.innerFrameW ?? ww - omp * 2;
  const ifh = frame.innerFrameH ?? wh - omp * 2;
  const stroke = frame.innerStroke ?? GOWN_INNER_STROKE;
  const outerMatColor = frame.outerMatColor ?? frame.matColor ?? "#ffffff";
  const padColor = frame.padColor ?? frame.innerMatColor ?? frame.matColor ?? "#ffffff";
  const strokeColor = frame.innerStrokeColor ?? GOWN_INNER_STROKE_COLOR;

  ctx.fillStyle = gownBorderFillStyle(ctx, frame, outerW, outerH);
  ctx.fillRect(0, 0, outerW, outerH);

  if (omp > 0 && ww > 0 && wh > 0) {
    ctx.fillStyle = outerMatColor;
    ctx.fillRect(wx, wy, ww, omp);
    ctx.fillRect(wx, wy + wh - omp, ww, omp);
    ctx.fillRect(wx, wy + omp, omp, wh - 2 * omp);
    ctx.fillRect(wx + ww - omp, wy + omp, omp, wh - 2 * omp);
  }

  if (ifw > 0 && ifh > 0) {
    const padX = ifx + stroke;
    const padY = ify + stroke;
    const padW = ifw - 2 * stroke;
    const padH = ifh - 2 * stroke;
    if (padW > 0 && padH > 0) {
      ctx.fillStyle = padColor;
      ctx.fillRect(padX, padY, padW, padH);
    }
    drawGownInnerAccent(ctx, ifx, ify, ifw, ifh, stroke, strokeColor);
  }
}

/** Cover-fit lifestyle photo clipped to the gown photo pad (inside inner accent). */
export function drawGownProductInSlot(ctx, productImg, frame) {
  const ifx = frame.innerFrameX ?? 0;
  const ify = frame.innerFrameY ?? 0;
  const ifw = frame.innerFrameW ?? 0;
  const ifh = frame.innerFrameH ?? 0;
  const stroke = frame.innerStroke ?? GOWN_INNER_STROKE;
  const slotInset = (frame.innerMatPad ?? 0) + stroke;
  const slotX = ifx + slotInset;
  const slotY = ify + slotInset;
  const slotW = ifw - 2 * slotInset;
  const slotH = ifh - 2 * slotInset;
  if (slotW <= 0 || slotH <= 0 || !productImg?.width) return;

  const fitScale = Math.max(slotW / productImg.width, slotH / productImg.height);
  const sw = Math.round(productImg.width * fitScale);
  const sh = Math.round(productImg.height * fitScale);
  const imgX = slotX + Math.round((slotW - sw) / 2);
  const imgY = slotY + Math.round((slotH - sh) / 2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(slotX, slotY, slotW, slotH);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(productImg, 0, 0, productImg.width, productImg.height, imgX, imgY, sw, sh);
  ctx.restore();
}

/** Cover-fit source photo into gown photo slot — same geometry as generation. */
export function drawGownPhotoCoverFit(ctx, base, geom) {
  const { px, py, dw, dh } = geom;
  const fitScale = Math.max(dw / base.width, dh / base.height);
  const sw = Math.round(base.width * fitScale);
  const sh = Math.round(base.height * fitScale);
  const imgX = px + Math.round((dw - sw) / 2);
  const imgY = py + Math.round((dh - sh) / 2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, dw, dh);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(base, 0, 0, base.width, base.height, imgX, imgY, sw, sh);
  ctx.restore();
}

function buildGownStaticFrameCanvas(img) {
  const outerW = GOWN_STATIC_OUTER_W;
  const outerH = GOWN_STATIC_OUTER_H;
  const base = imageToCanvas(img, 1200);
  const geom = computeGownFrameGeometry(outerW, outerH);

  const canvas = document.createElement("canvas");
  canvas.width = outerW;
  canvas.height = outerH;
  const ctx = canvas.getContext("2d");

  drawGownStaticFrameBackground(ctx, {
    ...geom,
    borderColor: BORDER_TEAL,
    matColor: "#ffffff",
    innerStroke: GOWN_INNER_STROKE,
    innerStrokeColor: GOWN_INNER_STROKE_COLOR,
  });
  drawGownPhotoCoverFit(ctx, base, geom);

  return {
    canvas,
    ...geom,
    source: base,
  };
}

function gownStaticPlacements(px, py, dw, dh) {
  const ref = Math.min(dw, dh);
  const bestW = Math.round(ref * 0.36);
  const bestH = Math.round(bestW * 0.7);
  const flashW = Math.round(ref * 0.32);
  const flashH = Math.round(flashW * 0.4);
  const popW = Math.round(ref * 0.42);
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
      x: px - Math.round(popW * 0.08),
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
      copy.drawn = await drawGownBadge(ctx, null, p);
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
    outerMatPad,
    innerMatPad,
    innerStroke,
    innerStrokeColor,
    innerFrameX,
    innerFrameY,
    innerFrameW,
    innerFrameH,
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
  // Crop pre-badge frame (like tall_static uses trimmed, not post-sticker canvas).
  productOnlyCanvas
    .getContext("2d")
    .drawImage(noStickersCanvas, px, py, dw, dh, 0, 0, dw, dh);
  const productOnly = dataUrlFromCanvas(productOnlyCanvas);

  const noBorderCanvas = document.createElement("canvas");
  noBorderCanvas.width = dw;
  noBorderCanvas.height = dh;
  const nbCtx = noBorderCanvas.getContext("2d");
  nbCtx.drawImage(noStickersCanvas, px, py, dw, dh, 0, 0, dw, dh);
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
      _gownPhotoSource: dataUrlFromCanvas(source),
      _stickersRendered: badgePlacements.some((p) => p.drawn),
      _badgePlacements: badgePlacements,
      _staticFrame: {
        style: "gown_static",
        frameType: "tall",
        borderColor: BORDER_TEAL,
        matColor: "#ffffff",
        outerMatColor: "#ffffff",
        padColor: "#ffffff",
        innerStrokeColor: GOWN_INNER_STROKE_COLOR,
        gradientTop: BORDER_TEAL,
        gradientBottom: BORDER_TEAL_DARK,
        gradientPreset: null,
        px,
        py,
        dw,
        dh,
        border,
        whitePad,
        outerMatPad,
        innerMatPad,
        innerFrameX,
        innerFrameY,
        innerFrameW,
        innerFrameH,
        innerStroke,
        baseBorder: border,
        baseOuterMatPad: outerMatPad,
        baseInnerMatPad: innerMatPad,
        baseInnerStroke: innerStroke,
        baseWhitePad: whitePad,
        basePx: px,
        basePy: py,
        baseDw: dw,
        baseDh: dh,
        baseWhiteX: whiteX,
        baseWhiteY: whiteY,
        baseWhiteW: whiteW,
        baseWhiteH: whiteH,
        baseInnerFrameX: innerFrameX,
        baseInnerFrameY: innerFrameY,
        baseInnerFrameW: innerFrameW,
        baseInnerFrameH: innerFrameH,
        borderThicknessPct: 100,
        borderThicknessLocked: true,
        gownLayerPct: {
          border: 100,
          outerMat: 100,
          innerAccent: 100,
          innerMat: 100,
        },
        gownFrameLayersLocked: true,
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
      meta: { ...meta, targetKb: kb, outerW: outCanvas.width, outerH: outCanvas.height },
    };
    v.kb = Math.ceil(blob.size / 1024);
    v.estInr = estimateImageShipping(v);
    variants.push(v);
    await new Promise((r) => setTimeout(r, 0));
  }

  return variants;
}
