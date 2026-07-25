/**
 * Live tab "See more" — static showcase presets (no Meesho API).
 * Replicates the promo frame: yellow top + lime right border, 3 corner badges.
 */
import {
  imageToWhiteCanvas,
  trimMargins,
} from "./lib/canvas-utils.js?v=34";
import { compressFramedToKb } from "./lib/encoder.js?v=34";
import { estimateImageShipping } from "./lib/shipping.js?v=34";

/** Fixed badge assets matching the reference layout. */
export const SHOWCASE_BADGES = {
  topLeft: 4, // 100% QUALITY gold seal
  topRight: 5, // orange star ribbon
  bottomLeft: 18, // 100% SATISFACTION GUARANTEED
};

const SHOWCASE_KB_TIERS = [64, 68, 71];

const SHOWCASE_FRAME = {
  top: { color: "#FFC107", scale: 0.13 },
  right: { color: "#8BC34A", scale: 0.13 },
  left: { color: "#E53935", scale: 0.09 },
  bottom: { color: "#1E88E5", scale: 0.09 },
};

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

async function preloadShowcaseBadges() {
  if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.preloadBadges) {
    await MeeshoAPI.preloadBadges();
    return;
  }
  await Promise.all(
    Object.values(SHOWCASE_BADGES).map((n) => loadBadge(n)),
  );
}

function normalizeProduct(img, maxSide = 1024) {
  const trimmed = trimMargins(imageToWhiteCanvas(img), 0.02);
  let w = trimmed.width;
  let h = trimmed.height;
  const max = Math.max(w, h);
  if (max > maxSide) {
    const s = maxSide / max;
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  return { trimmed, w, h };
}

function borderPx(minDim, scale) {
  return Math.max(18, Math.round(minDim * scale));
}

/**
 * Draw asymmetric colored frame + product on white.
 * Returns canvas and inner product rect.
 */
function buildShowcaseFrameCanvas(img, frame = SHOWCASE_FRAME) {
  const { trimmed, w, h } = normalizeProduct(img);
  const minDim = Math.min(w, h);
  const topB = borderPx(minDim, frame.top.scale);
  const rightB = borderPx(minDim, frame.right.scale);
  const leftB = borderPx(minDim, frame.left.scale);
  const bottomB = borderPx(minDim, frame.bottom.scale);

  const finalW = leftB + w + rightB;
  const finalH = topB + h + bottomB;
  const canvas = document.createElement("canvas");
  canvas.width = finalW;
  canvas.height = finalH;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, finalW, finalH);

  ctx.fillStyle = frame.top.color;
  ctx.fillRect(0, 0, finalW, topB);
  ctx.fillStyle = frame.right.color;
  ctx.fillRect(finalW - rightB, 0, rightB, finalH);
  ctx.fillStyle = frame.left.color;
  ctx.fillRect(0, 0, leftB, finalH);
  ctx.fillStyle = frame.bottom.color;
  ctx.fillRect(0, finalH - bottomB, finalW, bottomB);

  const px = leftB;
  const py = topB;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, px, py, w, h);

  return { canvas, px, py, dw: w, dh: h, borders: { topB, rightB, leftB, bottomB } };
}

function showcasePlacements(px, py, dw, dh, canvasW) {
  const largeSize = Math.max(48, Math.round(canvasW / 6));
  const smallSize = Math.max(28, Math.round(largeSize * 0.52));
  const inset = Math.max(4, Math.round(largeSize * 0.04));
  return [
    {
      num: SHOWCASE_BADGES.topLeft,
      size: largeSize,
      x: px + inset,
      y: py + inset,
      drawn: false,
    },
    {
      num: SHOWCASE_BADGES.topRight,
      size: largeSize,
      x: px + dw - largeSize - inset,
      y: py + inset,
      drawn: false,
    },
    {
      num: SHOWCASE_BADGES.bottomLeft,
      size: smallSize,
      x: px + inset,
      y: py + dh - smallSize - inset,
      drawn: false,
    },
  ];
}

async function drawPlacements(ctx, placements) {
  const out = [];
  for (const p of placements) {
    const copy = { ...p };
    try {
      const badge = await loadBadge(p.num);
      if (badge) {
        ctx.drawImage(badge, p.x, p.y, p.size, p.size);
        copy.drawn = true;
      }
    } catch (e) {}
    out.push(copy);
  }
  return out;
}

function dataUrlFromCanvas(canvas, quality = 0.82) {
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Build full layer set for one showcase frame (editor-compatible).
 */
async function buildShowcaseLayers(img) {
  const { canvas, px, py, dw, dh } = buildShowcaseFrameCanvas(img);
  const placements = showcasePlacements(px, py, dw, dh, canvas.width);

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
  const trimmed = trimMargins(imageToWhiteCanvas(img), 0.02);
  const pCtx = productOnlyCanvas.getContext("2d");
  pCtx.drawImage(
    trimmed,
    0,
    0,
    trimmed.width,
    trimmed.height,
    0,
    0,
    dw,
    dh,
  );
  const productOnly = dataUrlFromCanvas(productOnlyCanvas);

  const noBorderCanvas = document.createElement("canvas");
  noBorderCanvas.width = dw;
  noBorderCanvas.height = dh;
  const nbCtx = noBorderCanvas.getContext("2d");
  nbCtx.drawImage(
    trimmed,
    0,
    0,
    trimmed.width,
    trimmed.height,
    0,
    0,
    dw,
    dh,
  );
  const shifted = badgePlacements.map((p) => ({
    num: p.num,
    size: p.size,
    x: p.x - px,
    y: p.y - py,
    drawn: p.drawn,
  }));
  await drawPlacements(nbCtx, shifted);
  const noBorder = dataUrlFromCanvas(noBorderCanvas);

  const stickersRendered = badgePlacements.some((p) => p.drawn);

  return {
    canvas,
    layers: {
      full,
      noStickers,
      noBorder,
      productOnly,
      _stickersRendered: stickersRendered,
      _badgePlacements: badgePlacements,
    },
    meta: {
      style: "showcase",
      showcasePreset: "quality-seal-frame",
      canvasW: canvas.width,
      canvasH: canvas.height,
      productW: dw,
      productH: dh,
    },
  };
}

/**
 * Generate static showcase variants for Live analysis "See more".
 */
export async function buildShowcaseVariants(img, options = {}) {
  const { onProgress = () => {} } = options;
  await preloadShowcaseBadges();

  onProgress("Building showcase frame presets…");
  const built = await buildShowcaseLayers(img);
  const { canvas, layers, meta } = built;
  const variants = [];

  for (let i = 0; i < SHOWCASE_KB_TIERS.length; i++) {
    const kb = SHOWCASE_KB_TIERS[i];
    onProgress(`Showcase preset · ${kb}KB`);
    const blob = await compressFramedToKb(canvas, kb);
    const v = {
      blob,
      bytes: blob.size,
      width: canvas.width,
      height: canvas.height,
      path: "showcase",
      mode: "Showcase",
      label: `Showcase · Quality seal · ${kb}KB · ${canvas.width}×${canvas.height}`,
      recommended: kb === 68,
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
