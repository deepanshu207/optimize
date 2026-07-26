/**
 * Web-only lifestyle promo frames — competitor-style solid green border @ 48–54 KB.
 * Keeps original scene (no white flatten); isolated from tall ₹50 and showcase paths.
 */
import {
  imageToCanvas,
  trimUniformEdges,
} from "./lib/canvas-utils.js?v=39";
import { compressFramedToKb } from "./lib/encoder.js?v=39";
import { estimateImageShipping } from "./lib/shipping.js?v=39";

/** HOT SALE, FLASH SALE — match competitor listing stickers. */
export const PROMO_LIFESTYLE_BADGES = {
  hotSale: 19,
  flashSale: 22,
};

export const PROMO_LIFESTYLE_MAX_W = 720;
export const PROMO_LIFESTYLE_MAX_H = 960;
export const PROMO_LIFESTYLE_BORDER_RATIO = 0.055;
export const PROMO_LIFESTYLE_VARIANT_COUNT = 25;

const BORDER_COLOR = "#22c55e";

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

async function preloadPromoBadges() {
  if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.preloadBadges) {
    await MeeshoAPI.preloadBadges();
    return;
  }
  await Promise.all(
    Object.values(PROMO_LIFESTYLE_BADGES).map((n) => loadBadge(n)),
  );
}

function promoKbTiers(count = PROMO_LIFESTYLE_VARIANT_COUNT) {
  const n = Math.max(20, Math.min(30, count));
  const start = 48;
  const end = 54;
  const tiers = [];
  for (let i = 0; i < n; i++) {
    tiers.push(Math.round(start + ((end - start) * i) / Math.max(1, n - 1)));
  }
  return tiers;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFreeShippingSticker(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = "#16a34a";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.max(10, Math.round(h * 0.42))}px system-ui,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FREE SHIPPING", x + w / 2, y + h / 2);
}

/**
 * Solid green border around lifestyle photo — no white mat / letterbox.
 */
function buildPromoLifestyleCanvas(img) {
  const base = trimUniformEdges(imageToCanvas(img, 1400), 0.018);
  let dw = base.width;
  let dh = base.height;

  const borderGuess = Math.max(
    20,
    Math.round(Math.min(dw, dh) * PROMO_LIFESTYLE_BORDER_RATIO),
  );
  const maxDw = PROMO_LIFESTYLE_MAX_W - borderGuess * 2;
  const maxDh = PROMO_LIFESTYLE_MAX_H - borderGuess * 2;
  const fitScale = Math.min(maxDw / dw, maxDh / dh, 1);
  if (fitScale < 1) {
    dw = Math.round(dw * fitScale);
    dh = Math.round(dh * fitScale);
  }

  const border = Math.max(
    20,
    Math.round(Math.min(dw, dh) * PROMO_LIFESTYLE_BORDER_RATIO),
  );
  const outerW = dw + border * 2;
  const outerH = dh + border * 2;
  const px = border;
  const py = border;

  const canvas = document.createElement("canvas");
  canvas.width = outerW;
  canvas.height = outerH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BORDER_COLOR;
  ctx.fillRect(0, 0, outerW, outerH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(base, 0, 0, base.width, base.height, px, py, dw, dh);

  return { canvas, px, py, dw, dh, border, base, outerW, outerH };
}

/** HOT SALE top-right, FLASH SALE mid-left, FREE SHIPPING bottom — on green strip. */
function promoPlacements(px, py, dw, dh, border, outerW, outerH) {
  const hotSize = Math.min(
    Math.max(44, Math.round(border * 1.15)),
    Math.round(outerW / 4.5),
  );
  const flashSize = Math.max(36, Math.round(hotSize * 0.88));
  const overlap = Math.round(hotSize * 0.28);

  const shipW = Math.round(dw * 0.46);
  const shipH = Math.max(22, Math.round(border * 0.72));

  const placements = [
    {
      num: PROMO_LIFESTYLE_BADGES.hotSale,
      size: hotSize,
      x: px + dw - hotSize + overlap,
      y: py - overlap,
      drawn: false,
    },
    {
      num: PROMO_LIFESTYLE_BADGES.flashSale,
      size: flashSize,
      x: px - Math.round(flashSize * 0.35),
      y: py + Math.round(dh * 0.38),
      drawn: false,
    },
  ];

  const pad = 3;
  for (const p of placements) {
    p.x = Math.max(pad, Math.min(p.x, outerW - p.size - pad));
    p.y = Math.max(pad, Math.min(p.y, outerH - p.size - pad));
  }

  const shipX = px + Math.round((dw - shipW) / 2);
  const shipY = py + dh - shipH - Math.round(border * 0.35);

  return { placements, shipX, shipY, shipW, shipH };
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

function dataUrlFromCanvas(canvas, quality = 0.8) {
  return canvas.toDataURL("image/jpeg", quality);
}

async function buildPromoLayers(img) {
  const built = buildPromoLifestyleCanvas(img);
  const { canvas, px, py, dw, dh, border, base, outerW, outerH } = built;
  const { placements, shipX, shipY, shipW, shipH } = promoPlacements(
    px,
    py,
    dw,
    dh,
    border,
    outerW,
    outerH,
  );

  const noStickersCanvas = document.createElement("canvas");
  noStickersCanvas.width = canvas.width;
  noStickersCanvas.height = canvas.height;
  noStickersCanvas.getContext("2d").drawImage(canvas, 0, 0);
  const noStickers = dataUrlFromCanvas(noStickersCanvas);

  const fullCtx = canvas.getContext("2d");
  const badgePlacements = await drawPlacements(fullCtx, placements);
  drawFreeShippingSticker(fullCtx, shipX, shipY, shipW, shipH);
  const full = dataUrlFromCanvas(canvas);

  const productOnlyCanvas = document.createElement("canvas");
  productOnlyCanvas.width = dw;
  productOnlyCanvas.height = dh;
  productOnlyCanvas
    .getContext("2d")
    .drawImage(base, 0, 0, base.width, base.height, 0, 0, dw, dh);
  const productOnly = dataUrlFromCanvas(productOnlyCanvas);

  return {
    canvas,
    layers: {
      full,
      noStickers,
      noBorder: productOnly,
      productOnly,
      _stickersRendered: badgePlacements.some((p) => p.drawn),
      _badgePlacements: badgePlacements,
    },
    meta: {
      style: "lifestyle_promo",
      showcasePreset: "lifestyle-green-promo",
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
 * Generate lifestyle promo variants (48–54 KB) — competitor ₹54 band.
 */
export async function buildPromoLifestyleVariants(img, options = {}) {
  const {
    onProgress = () => {},
    count = PROMO_LIFESTYLE_VARIANT_COUNT,
  } = options;

  await preloadPromoBadges();
  onProgress("Building lifestyle promo frames…");

  const { canvas, layers, meta } = await buildPromoLayers(img);
  const kbTiers = promoKbTiers(count);
  const variants = [];

  for (let i = 0; i < kbTiers.length; i++) {
    const kb = kbTiers[i];
    onProgress(`Lifestyle promo · ${kb}KB (${i + 1}/${kbTiers.length})`);
    const blob = await compressFramedToKb(canvas, kb);
    const v = {
      blob,
      bytes: blob.size,
      width: meta.outerW,
      height: meta.outerH,
      path: "lifestyle_promo",
      mode: "Lifestyle Promo",
      label: `Lifestyle Promo · ${meta.outerW}×${meta.outerH} · ${kb}KB`,
      recommended: kb === 50 || kb === 52,
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
