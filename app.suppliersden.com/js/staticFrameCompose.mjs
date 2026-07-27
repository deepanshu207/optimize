/**
 * Compose / reposition badges on static showcase, lifestyle promo & tall frames.
 * Web-only static variants — does not affect Live Meesho hunt.
 */
import { compressFramedToKb } from "./lib/encoder.js?v=54";
import { drawTallBadge } from "./tallStaticBadges.mjs?v=54";

export const GRADIENT_PRESETS = [
  { id: "showcase", label: "Orange → Green", top: "#FF9800", bottom: "#4CAF50" },
  { id: "sunset", label: "Sunset", top: "#FF6B6B", bottom: "#FECA57" },
  { id: "ocean", label: "Ocean", top: "#2196F3", bottom: "#00BCD4" },
  { id: "berry", label: "Berry", top: "#9C27B0", bottom: "#E91E63" },
  { id: "forest", label: "Forest", top: "#2E7D32", bottom: "#8BC34A" },
  { id: "royal", label: "Royal", top: "#3F51B5", bottom: "#9C27B0" },
  { id: "fire", label: "Fire", top: "#F44336", bottom: "#FF9800" },
  { id: "mint", label: "Mint", top: "#00BFA5", bottom: "#69F0AE" },
];

export const BADGE_ANCHOR_OPTIONS = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "middle-left", label: "Middle left" },
  { value: "middle-right", label: "Middle right" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "top-center", label: "Top center" },
];

const STYLE_DEFAULTS = {
  showcase: {
    frameType: "gradient",
    gradientTop: "#FF9800",
    gradientBottom: "#4CAF50",
    gradientPreset: "showcase",
  },
  lifestyle_promo: {
    frameType: "solid",
    borderColor: "#32d74b",
    gradientTop: "#32d74b",
    gradientBottom: "#1b9e34",
    gradientPreset: null,
  },
  tall_static: {
    frameType: "tall",
    borderColor: "#45a9e5",
    matColor: "#ffffff",
    gradientTop: "#45a9e5",
    gradientBottom: "#1e88c7",
    gradientPreset: null,
  },
};

const DEFAULT_ANCHORS = {
  lifestyle_promo: {
    "lifestyle-hot": "top-right",
    "lifestyle-flash": "middle-left",
    "lifestyle-ship": "bottom-center",
  },
  showcase: {
    "showcase-quality": "top-left",
    "showcase-star": "top-right",
    "showcase-satisfaction": "bottom-left",
  },
  tall_static: {
    "tall-sale": "top-left",
    "tall-arrow": "top-right",
    "tall-ship": "bottom-left",
  },
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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function placementSize(p) {
  const w = p.w || p.size || 48;
  const h = p.h || p.size || 48;
  return { w, h };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function getStaticEffectiveFlags(flags = {}) {
  const f = flags || {};
  let hasStickers = true;
  let hasBorder = true;

  if (f.cleanProduct && !f.stickersAdded && !f.borderAdded && !f.fullDecorationsAdded) {
    return { hasStickers: false, hasBorder: false };
  }

  if (f.cleanProduct) {
    hasStickers = false;
    hasBorder = false;
  } else {
    if (f.stickersRemoved) hasStickers = false;
    if (f.borderOnlyRemoved) hasBorder = false;
  }
  if (f.stickersAdded) hasStickers = true;
  if (f.borderAdded) hasBorder = true;
  if (f.fullDecorationsAdded) {
    hasStickers = true;
    hasBorder = true;
  }
  return { hasStickers, hasBorder };
}

export function isStaticPromoVariant(row) {
  if (!row) return false;
  const style = row.variantStyle || row.meta?.style || row.meta?.path || "";
  return (
    style === "showcase" ||
    style === "lifestyle_promo" ||
    style === "tall_static" ||
    row.meta?.path === "showcase" ||
    row.meta?.path === "lifestyle_promo" ||
    row.meta?.path === "tall_static" ||
    !!row.layers?._staticFrame
  );
}

export function getBadgeSlots(row) {
  const placements = row?.layers?._badgePlacements || [];
  return placements
    .filter((p) => p.id)
    .map((p) => ({
      id: p.id,
      label: p.label || (p.kind === "freeShipping" ? "FREE SHIPPING" : `Badge ${p.num}`),
      anchor: p.anchor || "top-left",
      num: p.num,
      hidden: !!p.hidden,
      posH: p.posH ?? 0,
      posV: p.posV ?? 0,
    }));
}

export function slidersToXY(posH, posV, outerW, outerH, w, h) {
  const maxX = Math.max(0, outerW - w);
  const maxY = Math.max(0, outerH - h);
  const x = Math.round((clamp(posH, 0, 100) / 100) * maxX);
  const y = Math.round((clamp(posV, 0, 100) / 100) * maxY);
  return { x, y };
}

export function xyToSliders(x, y, outerW, outerH, w, h) {
  const maxX = Math.max(1, outerW - w);
  const maxY = Math.max(1, outerH - h);
  return {
    posH: Math.round(clamp((x / maxX) * 100, 0, 100)),
    posV: Math.round(clamp((y / maxY) * 100, 0, 100)),
  };
}

export function positionForAnchor(anchor, frame, w, h) {
  const { px, py, dw, dh, outerW, outerH } = frame;

  if (frame.style === "tall_static" && frame.px != null) {
    const size = Math.max(56, Math.round(Math.min(frame.dw, frame.dh) * 0.14));
    const inset = Math.max(6, Math.round(size * 0.06));
    const fx = frame.px;
    const fy = frame.py;
    const fw = frame.dw;
    const fh = frame.dh;
    let x = fx + inset;
    let y = fy + inset;
    switch (anchor) {
      case "top-left":
        x = fx + inset;
        y = fy + inset;
        break;
      case "top-right":
        x = fx + fw - w - inset;
        y = fy + inset;
        break;
      case "bottom-left":
        x = fx + inset;
        y = fy + fh - h - inset;
        break;
      case "bottom-right":
        x = fx + fw - w - inset;
        y = fy + fh - h - inset;
        break;
      case "middle-left":
        x = fx + inset;
        y = fy + Math.round(fh / 2) - Math.round(h / 2);
        break;
      case "middle-right":
        x = fx + fw - w - inset;
        y = fy + Math.round(fh / 2) - Math.round(h / 2);
        break;
      case "bottom-center":
        x = fx + Math.round(fw / 2) - Math.round(w / 2);
        y = fy + fh - h - inset;
        break;
      case "top-center":
        x = fx + Math.round(fw / 2) - Math.round(w / 2);
        y = fy + inset;
        break;
      default:
        break;
    }
    const edge = 3;
    x = Math.max(edge, Math.min(x, frame.outerW - w - edge));
    y = Math.max(edge, Math.min(y, frame.outerH - h - edge));
    return { x, y };
  }

  let x = px;
  let y = py;
  switch (anchor) {
    case "top-left":
      x = px - Math.round(w * 0.15);
      y = py - Math.round(h * 0.15);
      break;
    case "top-right":
      x = px + dw - w + Math.round(w * 0.1);
      y = py - Math.round(h * 0.1);
      break;
    case "bottom-left":
      x = px - Math.round(w * 0.1);
      y = py + dh - h + Math.round(h * 0.1);
      break;
    case "bottom-right":
      x = px + dw - w - Math.round(dw * 0.02);
      y = py + dh - h - Math.round(dh * 0.04);
      break;
    case "middle-left":
      x = px - Math.round(w * 0.08);
      y = py + Math.round(dh * 0.45) - Math.round(h / 2);
      break;
    case "middle-right":
      x = px + dw - w - Math.round(dw * 0.04);
      y = py + Math.round(dh * 0.45) - Math.round(h / 2);
      break;
    case "bottom-center":
      x = px + Math.round(dw * 0.34) - Math.round(w / 2);
      y = py + Math.round(dh * 0.7) - Math.round(h / 2);
      break;
    case "top-center":
      x = px + Math.round(dw / 2) - Math.round(w / 2);
      y = py + Math.round(dh * 0.02);
      break;
    default:
      break;
  }
  const pad = 3;
  x = Math.max(pad, Math.min(x, outerW - w - pad));
  y = Math.max(pad, Math.min(y, outerH - h - pad));
  return { x, y };
}

export function applyPositionToPlacement(placement, frame) {
  if (!placement || !frame) return placement;
  const { w, h } = placementSize(placement);
  const { outerW, outerH } = frame;

  if (placement.posH != null && placement.posV != null) {
    const { x, y } = slidersToXY(placement.posH, placement.posV, outerW, outerH, w, h);
    placement.x = x;
    placement.y = y;
  } else if (placement.anchor) {
    const { x, y } = positionForAnchor(placement.anchor, frame, w, h);
    placement.x = x;
    placement.y = y;
    const sliders = xyToSliders(x, y, outerW, outerH, w, h);
    placement.posH = sliders.posH;
    placement.posV = sliders.posV;
  }
  return placement;
}

export function applyAnchorToPlacement(placement, frame) {
  if (!placement || !frame) return placement;
  const { w, h } = placementSize(placement);
  const anchor = placement.anchor || "top-left";
  const { x, y } = positionForAnchor(anchor, frame, w, h);
  placement.x = x;
  placement.y = y;
  const sliders = xyToSliders(x, y, frame.outerW, frame.outerH, w, h);
  placement.posH = sliders.posH;
  placement.posV = sliders.posV;
  return placement;
}

function ensureFrameDefaults(frame) {
  if (!frame?.style) return frame;
  const defs = STYLE_DEFAULTS[frame.style] || {};
  if (!frame.frameType) frame.frameType = defs.frameType || "solid";
  if (!frame.gradientTop) frame.gradientTop = defs.gradientTop;
  if (!frame.gradientBottom) frame.gradientBottom = defs.gradientBottom;
  if (frame.gradientPreset === undefined) frame.gradientPreset = defs.gradientPreset;
  if (!frame.borderColor) frame.borderColor = defs.borderColor || frame.gradientTop;
  if (!frame.matColor) frame.matColor = defs.matColor || "#ffffff";
  return frame;
}

function drawFrameBackground(ctx, frame) {
  const { outerW, outerH, px, py, dw, dh, style } = frame;
  ensureFrameDefaults(frame);

  if (frame.frameType === "gradient" || (style === "showcase" && frame.frameType !== "solid")) {
    const grad = ctx.createLinearGradient(0, 0, 0, outerH);
    grad.addColorStop(0, frame.gradientTop || "#FF9800");
    grad.addColorStop(1, frame.gradientBottom || "#4CAF50");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, outerW, outerH);
    if (style === "showcase") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px, py, dw, dh);
    }
  } else if (frame.frameType === "tall" || style === "tall_static") {
    ctx.fillStyle = frame.borderColor || "#45a9e5";
    ctx.fillRect(0, 0, outerW, outerH);
    ctx.fillStyle = frame.matColor || "#ffffff";
    const wx = frame.whiteX ?? 0;
    const wy = frame.whiteY ?? 0;
    const ww = frame.whiteW ?? outerW;
    const wh = frame.whiteH ?? outerH;
    ctx.fillRect(wx, wy, ww, wh);
  } else {
    ctx.fillStyle = frame.borderColor || "#32d74b";
    ctx.fillRect(0, 0, outerW, outerH);
  }
}

async function rebuildFrameCanvas(layers) {
  const frame = ensureFrameDefaults({ ...layers._staticFrame });
  const productUrl = layers.productOnly;
  if (!productUrl || !frame.outerW) return null;

  const productImg = await loadImage(productUrl);
  const canvas = document.createElement("canvas");
  canvas.width = frame.outerW;
  canvas.height = frame.outerH;
  const ctx = canvas.getContext("2d");

  drawFrameBackground(ctx, frame);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(productImg, 0, 0, productImg.width, productImg.height, frame.px, frame.py, frame.dw, frame.dh);

  return { canvas, frame };
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

async function drawPlacementsOnCtx(ctx, placements) {
  for (const p of placements) {
    if (!p || p.drawn === false || p.hidden) continue;
    try {
      if (p.kind === "freeShipping") {
        drawFreeShippingCircle(ctx, p.x, p.y, p.size);
      } else if (p.id?.startsWith("tall-")) {
        await drawTallBadge(ctx, loadBadge, p);
      } else if (p.num != null) {
        const badge = await loadBadge(p.num);
        if (badge) {
          const sz = p.size || p.w || 48;
          ctx.drawImage(badge, p.x, p.y, p.w || sz, p.h || sz);
        }
      }
    } catch (e) {}
  }
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

function encodeJpeg(canvas, quality) {
  const q = Math.max(14, Math.min(92, quality)) / 100;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || new Blob()), "image/jpeg", q);
  });
}

async function compressLifestyleToKb(canvas, targetKb) {
  const targetBytes = targetKb * 1024;
  let work = canvas;
  let bestBlob = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    let lo = 14;
    let hi = 92;
    let passBest = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const blob = await encodeJpeg(work, mid);
      if (blob.size <= targetBytes) {
        passBest = blob;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (passBest) return passBest;
    bestBlob = passBest || (await encodeJpeg(work, 14));
    if (bestBlob.size <= targetBytes) return bestBlob;
    if (work.width <= 260) break;
    work = scaleCanvas(work, 0.88);
  }
  return bestBlob || (await encodeJpeg(canvas, 14));
}

async function compressToTargetKb(canvas, targetKb, style) {
  if (!targetKb || targetKb <= 0) {
    return canvas.toDataURL("image/jpeg", 0.82);
  }
  const blob =
    style === "lifestyle_promo"
      ? await compressLifestyleToKb(canvas, targetKb)
      : await compressFramedToKb(canvas, targetKb);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function frameAppearanceChanged(frame, defaults) {
  if (!frame || !defaults) return false;
  const keys = ["frameType", "gradientTop", "gradientBottom", "borderColor", "matColor", "gradientPreset"];
  return keys.some((k) => frame[k] !== defaults[k]);
}

export function placementChangedFromDefault(p, def) {
  if (!p || !def) return false;
  if (p.hidden !== def.hidden) return true;
  if (p.num !== def.num) return true;
  if (Math.abs((p.posH ?? 0) - (def.posH ?? 0)) > 0.5) return true;
  if (Math.abs((p.posV ?? 0) - (def.posV ?? 0)) > 0.5) return true;
  return false;
}

export function needsStaticCompose(result) {
  if (!result?.layers?._staticFrame) return false;
  if (result._badgesRepositioned || result._staticAppearanceEdited) return true;
  const flags = result.editFlags || {};
  if (isStaticEdited(flags, false)) return true;

  const frame = result.layers._staticFrame;
  const frameDef = result.layers._staticDefaults?.frame;
  if (frameDef && frameAppearanceChanged(frame, frameDef)) return true;

  const placements = result.layers._badgePlacements || [];
  const placementDefs = result.layers._staticDefaults?.placements || {};
  for (const p of placements) {
    if (placementChangedFromDefault(p, placementDefs[p.id])) return true;
  }
  return false;
}

export function pickStaticBaseLayer(layers, flags = {}) {
  const { hasStickers, hasBorder } = getStaticEffectiveFlags(flags);
  const style = layers._staticFrame?.style;

  if (!hasBorder && !hasStickers) {
    return { url: layers.productOnly || layers.full, drawBadges: false, rebuild: false };
  }
  if (hasBorder && !hasStickers) {
    return { url: layers.noStickers || layers.full, drawBadges: false, rebuild: true };
  }
  if (!hasBorder && hasStickers) {
    if (style === "showcase" && layers.noBorder) {
      return { url: layers.noBorder, drawBadges: false, isProductCanvas: true, rebuild: false };
    }
    return {
      url: layers.productOnly || layers.noBorder || layers.full,
      drawBadges: true,
      isProductCanvas: true,
      rebuild: true,
    };
  }
  return { url: layers.noStickers || layers.full, drawBadges: true, rebuild: true };
}

export async function composeStaticPreview(layers, flags = {}, options = {}) {
  if (!layers) return "";
  const targetKb = options.targetKb || 0;
  const style = layers._staticFrame?.style || "";
  const { hasStickers, hasBorder } = getStaticEffectiveFlags(flags);

  if (!hasBorder && !hasStickers) {
    return layers.productOnly || layers.full || "";
  }

  const frameEdited =
    layers._staticFrame &&
    frameAppearanceChanged(layers._staticFrame, layers._staticDefaults?.frame);

  let canvas = null;
  let frame = layers._staticFrame;
  const picked = pickStaticBaseLayer(layers, flags);

  if (frameEdited && layers.productOnly && frame) {
    const rebuilt = await rebuildFrameCanvas(layers);
    if (rebuilt) {
      canvas = rebuilt.canvas;
      frame = rebuilt.frame;
    }
  }

  if (!canvas) {
    if (!picked.drawBadges && !frameEdited) {
      return picked.url || layers.full || "";
    }
    let baseUrl = picked.url;
    if (!baseUrl) {
      if (hasBorder && !hasStickers) baseUrl = layers.noStickers || layers.full;
      else if (!hasBorder && hasStickers) baseUrl = layers.noBorder || layers.productOnly || layers.full;
      else baseUrl = layers.noStickers || layers.full;
    }
    try {
      const img = await loadImage(baseUrl);
      canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
    } catch (e) {
      return layers.full || "";
    }
  }

  if (!hasStickers) {
    return compressToTargetKb(canvas, targetKb, style);
  }

  const placements = (layers._badgePlacements || []).filter((p) => !p.hidden && p.drawn !== false);
  if (!placements.length) {
    return compressToTargetKb(canvas, targetKb, style);
  }

  for (const p of placements) {
    applyPositionToPlacement(p, frame);
  }

  const ctx = canvas.getContext("2d");
  await drawPlacementsOnCtx(ctx, placements);

  return compressToTargetKb(canvas, targetKb, style);
}

export function updatePlacementAnchor(layers, placementId, anchor) {
  if (!layers?._badgePlacements || !layers._staticFrame) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  p.anchor = anchor;
  applyAnchorToPlacement(p, layers._staticFrame);
  return true;
}

export function updatePlacementSliders(layers, placementId, posH, posV) {
  if (!layers?._badgePlacements || !layers._staticFrame) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  p.posH = clamp(posH, 0, 100);
  p.posV = clamp(posV, 0, 100);
  applyPositionToPlacement(p, layers._staticFrame);
  return true;
}

export function updatePlacementBadge(layers, placementId, badgeNum) {
  if (!layers?._badgePlacements) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p || p.kind === "freeShipping") return false;
  const num = Math.max(1, Math.min(25, parseInt(badgeNum, 10) || 1));
  p.num = num;
  p.drawn = true;
  return true;
}

export function setPlacementHidden(layers, placementId, hidden) {
  if (!layers?._badgePlacements) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  p.hidden = !!hidden;
  return true;
}

export function setAllPlacementsHidden(layers, hidden) {
  if (!layers?._badgePlacements) return false;
  for (const p of layers._badgePlacements) {
    if (p.id) p.hidden = !!hidden;
  }
  return true;
}

export function updateFrameAppearance(layers, patch) {
  if (!layers?._staticFrame) return false;
  const frame = layers._staticFrame;
  if (patch.frameType != null) frame.frameType = patch.frameType;
  if (patch.gradientTop != null) frame.gradientTop = patch.gradientTop;
  if (patch.gradientBottom != null) frame.gradientBottom = patch.gradientBottom;
  if (patch.borderColor != null) frame.borderColor = patch.borderColor;
  if (patch.matColor != null) frame.matColor = patch.matColor;
  if (patch.gradientPreset !== undefined) frame.gradientPreset = patch.gradientPreset;
  return true;
}

export function applyGradientPreset(layers, presetId) {
  const preset = GRADIENT_PRESETS.find((g) => g.id === presetId);
  if (!preset || !layers?._staticFrame) return false;
  return updateFrameAppearance(layers, {
    frameType: "gradient",
    gradientTop: preset.top,
    gradientBottom: preset.bottom,
    gradientPreset: presetId,
    borderColor: preset.top,
  });
}

function snapshotDefaults(layers, style) {
  if (!layers?._staticFrame) return;
  if (!layers._staticDefaults) {
    const frame = layers._staticFrame;
    ensureFrameDefaults(frame);
    layers._staticDefaults = {
      frame: {
        frameType: frame.frameType,
        gradientTop: frame.gradientTop,
        gradientBottom: frame.gradientBottom,
        borderColor: frame.borderColor,
        matColor: frame.matColor,
        gradientPreset: frame.gradientPreset,
      },
      placements: {},
    };
    for (const p of layers._badgePlacements || []) {
      if (!p.id) continue;
      layers._staticDefaults.placements[p.id] = {
        num: p.num,
        hidden: !!p.hidden,
        posH: p.posH,
        posV: p.posV,
      };
    }
  }
}

export function ensureStaticPlacementMeta(layers, style) {
  if (!layers?._badgePlacements?.length || !layers._staticFrame) return layers;

  ensureFrameDefaults(layers._staticFrame);
  snapshotDefaults(layers, style);

  const defaults =
    style === "lifestyle_promo"
      ? DEFAULT_ANCHORS.lifestyle_promo
      : style === "tall_static"
      ? DEFAULT_ANCHORS.tall_static
      : DEFAULT_ANCHORS.showcase;

  for (const p of layers._badgePlacements) {
    if (!p.id) continue;
    if (!p.anchor) p.anchor = defaults[p.id] || "top-left";
    if (!p.label) {
      if (p.kind === "freeShipping") p.label = "FREE SHIPPING";
      else if (p.id === "showcase-quality") p.label = "100% Quality";
      else if (p.id === "showcase-star") p.label = "Star ribbon";
      else if (p.id === "showcase-satisfaction") p.label = "Satisfaction";
      else if (p.id === "lifestyle-hot") p.label = "HOT SALE";
      else if (p.id === "lifestyle-flash") p.label = "FLASH SALE";
      else if (p.id === "tall-sale") p.label = "Price tag";
      else if (p.id === "tall-arrow") p.label = "Arrow";
      else if (p.id === "tall-ship") p.label = "Delivery truck";
    }
    applyPositionToPlacement(p, layers._staticFrame);
  }
  return layers;
}

export function resetStaticPlacements(layers) {
  if (!layers?._badgePlacements?.length || !layers._staticFrame) return false;
  const style = layers._staticFrame.style;
  const defaults =
    style === "lifestyle_promo"
      ? DEFAULT_ANCHORS.lifestyle_promo
      : style === "tall_static"
      ? DEFAULT_ANCHORS.tall_static
      : DEFAULT_ANCHORS.showcase;

  const frameDef = layers._staticDefaults?.frame;
  if (frameDef) {
    Object.assign(layers._staticFrame, { ...frameDef });
  } else {
    const defs = STYLE_DEFAULTS[style] || {};
    Object.assign(layers._staticFrame, { ...defs });
  }

  for (const p of layers._badgePlacements) {
    if (!p.id) continue;
    const pDef = layers._staticDefaults?.placements?.[p.id];
    if (pDef) {
      p.num = pDef.num;
      p.hidden = !!pDef.hidden;
      p.posH = pDef.posH;
      p.posV = pDef.posV;
    } else {
      p.anchor = defaults[p.id] || "top-left";
      p.hidden = false;
      applyAnchorToPlacement(p, layers._staticFrame);
    }
    applyPositionToPlacement(p, layers._staticFrame);
  }
  return true;
}

export function isStaticEdited(flags, badgesRepositioned, staticAppearanceEdited) {
  if (badgesRepositioned || staticAppearanceEdited) return true;
  const f = flags || {};
  return !!(
    f.stickersRemoved ||
    f.borderOnlyRemoved ||
    f.cleanProduct ||
    f.stickersAdded ||
    f.borderAdded ||
    f.fullDecorationsAdded
  );
}

if (typeof window !== "undefined") {
  window.StaticFrameCompose = {
    isStaticPromoVariant,
    getBadgeSlots,
    BADGE_ANCHOR_OPTIONS,
    GRADIENT_PRESETS,
    getStaticEffectiveFlags,
    positionForAnchor,
    slidersToXY,
    xyToSliders,
    applyAnchorToPlacement,
    applyPositionToPlacement,
    pickStaticBaseLayer,
    composeStaticPreview,
    updatePlacementAnchor,
    updatePlacementSliders,
    updatePlacementBadge,
    setPlacementHidden,
    setAllPlacementsHidden,
    updateFrameAppearance,
    applyGradientPreset,
    ensureStaticPlacementMeta,
    resetStaticPlacements,
    needsStaticCompose,
    isStaticEdited,
  };
}
