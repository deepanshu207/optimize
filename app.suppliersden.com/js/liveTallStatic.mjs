/**
 * Web-only tall portrait promo frames — 703×1024 blue border + corner badges @ ₹50 band.
 * Isolated from Live Meesho hunt and analysis tallFrame strategy.
 */
import {
  imageToWhiteCanvas,
  trimMargins,
  isTallPortrait,
} from "./lib/canvas-utils.js?v=44";
import { compressFramedToKb } from "./lib/encoder.js?v=44";
import { estimateImageShipping } from "./lib/shipping.js?v=44";

/** HOT SALE red tag, star ribbon — truck drawn procedurally. */
export const TALL_STATIC_BADGES = {
  saleTag: 19,
  arrow: 5,
};

export const TALL_STATIC_OUTER_W = 703;
export const TALL_STATIC_OUTER_H = 1024;
export const TALL_STATIC_VARIANT_COUNT = 25;

const BORDER_BLUE = "#add8e6";
const WHITE_PAD = 8;

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

async function preloadTallStaticBadges() {
  if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.preloadBadges) {
    await MeeshoAPI.preloadBadges();
    return;
  }
  await Promise.all(
    Object.values(TALL_STATIC_BADGES).map((n) => loadBadge(n)),
  );
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

function drawTruckIcon(ctx, cx, cy, size) {
  const w = size * 0.42;
  const h = size * 0.22;
  const x = cx - w / 2;
  const y = cy - h / 2 + size * 0.04;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y + h * 0.35, w * 0.62, h * 0.55);
  ctx.fillRect(x + w * 0.58, y + h * 0.5, w * 0.38, h * 0.4);
  ctx.beginPath();
  ctx.arc(x + w * 0.22, y + h * 0.95, h * 0.18, 0, Math.PI * 2);
  ctx.arc(x + w * 0.78, y + h * 0.95, h * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawFreeShippingCircle(ctx, x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#e53935";
  ctx.fill();
  ctx.lineWidth = Math.max(2, Math.round(size * 0.04));
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  const fs = Math.max(6, Math.round(size * 0.1));
  ctx.font = `bold ${fs}px system-ui,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FREE", cx, cy - size * 0.14);
  ctx.fillText("SHIPPING", cx, cy - size * 0.02);
  drawTruckIcon(ctx, cx, cy + size * 0.14, size);
  ctx.restore();
}

/**
 * Fixed 703×1024 — thick blue outer, white mat, tall product centered.
 */
function buildTallStaticFrameCanvas(img) {
  const outerW = TALL_STATIC_OUTER_W;
  const outerH = TALL_STATIC_OUTER_H;
  const blueBorder = Math.max(52, Math.round(Math.min(outerW, outerH) * 0.1));
  const border = blueBorder + WHITE_PAD;
  const innerW = outerW - border * 2;
  const innerH = outerH - border * 2;

  const trimmed = trimMargins(imageToWhiteCanvas(img), 0.035);
  const topM = 0.12;
  const bottomM = 0.04;
  const sideM = 0.08;
  const areaW = innerW * (1 - sideM * 2);
  const areaH = innerH * (1 - topM - bottomM);
  const scale = Math.min(areaW / trimmed.width, areaH / trimmed.height);
  const dw = Math.round(trimmed.width * scale);
  const dh = Math.round(trimmed.height * scale);
  const px = border + Math.round((innerW - dw) / 2);
  const py = border + Math.round(innerH * topM + (areaH - dh) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = outerW;
  canvas.height = outerH;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BORDER_BLUE;
  ctx.fillRect(0, 0, outerW, outerH);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(blueBorder, blueBorder, outerW - blueBorder * 2, outerH - blueBorder * 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, px, py, dw, dh);

  ctx.strokeStyle = "#9ec5e8";
  ctx.lineWidth = Math.max(2, Math.round(Math.min(dw, dh) * 0.006));
  ctx.strokeRect(px - 1, py - 1, dw + 2, dh + 2);

  return {
    canvas,
    px,
    py,
    dw,
    dh,
    border: blueBorder,
    trimmed,
    outerW,
    outerH,
  };
}

function tallStaticPlacements(px, py, dw, dh, outerW, outerH) {
  const ref = Math.min(dw, dh);
  const tagSize = Math.round(ref * 0.2);
  const arrowSize = Math.round(ref * 0.16);
  const shipSize = Math.round(ref * 0.18);
  const overlap = Math.round(tagSize * 0.12);

  const placements = [
    {
      id: "tall-sale",
      label: "Sale tag",
      anchor: "top-left",
      kind: "badge",
      num: TALL_STATIC_BADGES.saleTag,
      w: tagSize,
      h: tagSize,
      x: px - overlap,
      y: py - overlap,
      drawn: false,
    },
    {
      id: "tall-arrow",
      label: "Arrow ribbon",
      anchor: "top-right",
      kind: "badge",
      num: TALL_STATIC_BADGES.arrow,
      w: arrowSize,
      h: arrowSize,
      x: px + dw - arrowSize + overlap,
      y: py - Math.round(overlap * 0.5),
      drawn: false,
    },
    {
      id: "tall-ship",
      label: "FREE SHIPPING",
      anchor: "bottom-left",
      kind: "freeShipping",
      size: shipSize,
      x: px - Math.round(shipSize * 0.06),
      y: py + dh - shipSize + Math.round(shipSize * 0.08),
      drawn: false,
    },
  ];

  const pad = 3;
  for (const p of placements) {
    const w = p.w || p.size;
    const h = p.h || p.size;
    p.x = Math.max(pad, Math.min(p.x, outerW - w - pad));
    p.y = Math.max(pad, Math.min(p.y, outerH - h - pad));
  }
  return placements;
}

async function drawPlacements(ctx, placements) {
  const out = [];
  for (const p of placements) {
    const copy = { ...p };
    try {
      if (p.kind === "freeShipping") {
        drawFreeShippingCircle(ctx, p.x, p.y, p.size);
        copy.drawn = true;
      } else if (p.kind === "badge" && p.num != null) {
        const badge = await loadBadge(p.num);
        if (badge) {
          ctx.drawImage(badge, p.x, p.y, p.w, p.h);
          copy.drawn = true;
        }
      }
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
      tallPortrait: isTallPortrait(img),
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

  await preloadTallStaticBadges();
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
