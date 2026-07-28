/**
 * Compose / reposition badges on static promo & live hunt variants.
 * Shared by web optimizer and extension (preview/save only — pricing locked).
 */
import { compressFramedToKb } from "./lib/encoder.js?v=88";
import { drawTallBadge } from "./tallStaticBadges.mjs?v=88";
import { drawGownBadge } from "./gownStaticBadges.mjs?v=88";
import { drawGownStaticFrameBackground, drawGownProductInSlot } from "./liveGownStatic.mjs?v=88";

export const FREE_SHIPPING_BADGE_VALUE = "free";
export const BORDER_THICKNESS_DEFAULT = 100;
export const BORDER_THICKNESS_MAX = 1000;

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

/** Quick-pick swatches (Meesho generator + frame defaults). */
export const FRAME_COLOR_SWATCHES = [
  { label: "Orange", hex: "#ff9800" },
  { label: "Red", hex: "#ef4444" },
  { label: "Royal Blue", hex: "#2563eb" },
  { label: "Green", hex: "#22c55e" },
  { label: "Purple", hex: "#7c3aed" },
  { label: "Olive", hex: "#84cc16" },
  { label: "Teal", hex: "#06b6d4" },
  { label: "Navy", hex: "#1e293b" },
  { label: "Gown Teal", hex: "#71cbd3" },
  { label: "Lifestyle Green", hex: "#32d74b" },
  { label: "Tall Blue", hex: "#45a9e5" },
  { label: "White", hex: "#ffffff" },
  { label: "Black", hex: "#000000" },
];

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
}

export function rgbToHex(r, g, b) {
  const rr = clampByte(r).toString(16).padStart(2, "0");
  const gg = clampByte(g).toString(16).padStart(2, "0");
  const bb = clampByte(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

function rgbPartsToColor(r, g, b, hex) {
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b), hex: hex.toLowerCase() };
}

export function hexToRgb(hex) {
  const parsed = parseCssColor(hex);
  if (!parsed) return null;
  return { r: parsed.r, g: parsed.g, b: parsed.b, hex: parsed.hex };
}

export function parseCssColor(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const shortHex = /^#([0-9a-f]{3})$/i.exec(raw);
  if (shortHex) {
    const [r, g, b] = shortHex[1].split("");
    const hex = `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    const n = parseInt(hex.slice(1), 16);
    return rgbPartsToColor((n >> 16) & 255, (n >> 8) & 255, n & 255, hex);
  }

  const longHex = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(raw);
  if (longHex) {
    const hex = `#${longHex[1]}`.toLowerCase();
    const n = parseInt(longHex[1], 16);
    return rgbPartsToColor((n >> 16) & 255, (n >> 8) & 255, n & 255, hex);
  }

  const bareHex = /^([0-9a-f]{6})$/i.exec(raw);
  if (bareHex) {
    const hex = `#${bareHex[1]}`.toLowerCase();
    const n = parseInt(bareHex[1], 16);
    return rgbPartsToColor((n >> 16) & 255, (n >> 8) & 255, n & 255, hex);
  }

  const rgb = /^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)/i.exec(
    raw,
  );
  if (rgb) {
    return rgbPartsToColor(rgb[1], rgb[2], rgb[3], rgbToHex(rgb[1], rgb[2], rgb[3]));
  }

  const parts = raw.split(/[\s,;/]+/).filter(Boolean);
  if (parts.length >= 3 && parts.slice(0, 3).every((p) => /^[\d.]+$/.test(p))) {
    return rgbPartsToColor(parts[0], parts[1], parts[2], rgbToHex(parts[0], parts[1], parts[2]));
  }

  return null;
}

export function parseRgbTriplet(input) {
  return parseCssColor(input);
}

export function normalizeFrameColor(input, fallback = null) {
  const parsed = parseCssColor(input);
  if (parsed) return parsed.hex.toLowerCase();
  if (fallback != null) return normalizeFrameColor(fallback);
  return null;
}

export function formatRgbString(input) {
  const parsed = parseCssColor(input);
  if (!parsed) return "";
  return `${parsed.r}, ${parsed.g}, ${parsed.b}`;
}

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
  gown_static: {
    frameType: "tall",
    borderColor: "#71cbd3",
    matColor: "#ffffff",
    gradientTop: "#71cbd3",
    gradientBottom: "#5eb8c4",
    gradientPreset: null,
  },
  live_standard: {
    frameType: "gradient",
    gradientTop: "#3498db",
    gradientBottom: "#2ecc71",
    borderColor: "#3498db",
    gradientPreset: null,
  },
  live_framed: {
    frameType: "tall",
    borderColor: "#add8e6",
    matColor: "#ffffff",
    gradientTop: "#add8e6",
    gradientBottom: "#7ec8e3",
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
  gown_static: {
    "gown-best": "top-left",
    "gown-flash": "top-right",
    "gown-popular": "middle-left",
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

function ensurePlacementDefaults(p) {
  if (!p) return p;
  if (p.defaultW == null && p.defaultH == null && p.defaultSize == null) {
    if (p.w != null && p.h != null) {
      p.defaultW = p.w;
      p.defaultH = p.h;
    } else {
      p.defaultSize = p.size || p.w || p.h || 48;
    }
  }
  if (p.sizePct == null) p.sizePct = 100;
  if (p.lockH == null) p.lockH = true;
  if (p.lockV == null) p.lockV = true;
  if (p.lockSize == null) p.lockSize = true;
  return p;
}

export function isFreeShippingSlot(p) {
  return !!(p && (p.kind === "freeShipping" || p._freeShippingSlot));
}

function placementSize(p) {
  ensurePlacementDefaults(p);
  const pct = clamp(p.sizePct ?? 100, 25, 200) / 100;
  if (p.defaultW != null) {
    return {
      w: Math.max(8, Math.round(p.defaultW * pct)),
      h: Math.max(8, Math.round((p.defaultH ?? p.defaultW) * pct)),
    };
  }
  const base = p.defaultSize || p.size || p.w || 48;
  const s = Math.max(8, Math.round(base * pct));
  return { w: s, h: s };
}

/** Gown vector-art slot box — matches liveGownStatic.mjs geometry. */
export function gownArtDimensions(slotId, frame) {
  if (!slotId?.startsWith("gown-") || !frame) return null;
  const ref = Math.min(frame.dw ?? frame.baseDw, frame.dh ?? frame.baseDh);
  if (slotId === "gown-best") {
    const w = Math.round(ref * 0.36);
    return { w, h: Math.round(w * 0.7) };
  }
  if (slotId === "gown-flash") {
    const w = Math.round(ref * 0.32);
    return { w, h: Math.round(w * 0.4) };
  }
  if (slotId === "gown-popular") {
    const w = Math.round(ref * 0.42);
    return { w, h: Math.round(w * 0.26) };
  }
  return null;
}

/** Numbered PNG badges use a square box (tall/showcase pattern) — avoids stretch on wide gown slots. */
function squareBadgeBox(w, h) {
  return Math.max(8, Math.round(Math.min(w, h)));
}

function restoreGownArtSlotSize(p, layers) {
  const pDef = layers._staticDefaults?.placements?.[p.id];
  if (pDef?.slotW != null && pDef?.slotH != null) {
    p.w = pDef.slotW;
    p.h = pDef.slotH;
    return;
  }
  const dims = gownArtDimensions(p.id, layers._staticFrame);
  if (dims) {
    p.w = dims.w;
    p.h = dims.h;
  }
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

export function isEditableVariant(row) {
  if (!row?.layers) return false;
  return !!(
    row.layers._staticFrame ||
    (row.layers._badgePlacements || []).length
  );
}

export function isStaticPromoVariant(row) {
  if (!row) return false;
  const frameStyle = row.layers?._staticFrame?.style;
  if (frameStyle === "live_standard" || frameStyle === "live_framed") return false;
  const style = row.variantStyle || row.meta?.style || row.meta?.path || "";
  return (
    style === "showcase" ||
    style === "lifestyle_promo" ||
    style === "tall_static" ||
    style === "gown_static" ||
    row.meta?.path === "showcase" ||
    row.meta?.path === "lifestyle_promo" ||
    row.meta?.path === "tall_static" ||
    row.meta?.path === "gown_static" ||
    frameStyle === "showcase" ||
    frameStyle === "lifestyle_promo" ||
    frameStyle === "tall_static" ||
    frameStyle === "gown_static"
  );
}

export function getBadgeSlots(row) {
  const placements = row?.layers?._badgePlacements || [];
  return placements.map((p, i) => ({
    id: p.id || `badge-slot-${i}`,
    label:
      p.label ||
      (p.kind === "freeShipping"
        ? "FREE SHIPPING"
        : `Badge ${p.num || i + 1}`),
    anchor: p.anchor || "top-left",
    num: p.num,
    kind: p.kind,
    freeShippingSlot: isFreeShippingSlot(p),
    hidden: !!p.hidden,
    posH: p.posH ?? 0,
    posV: p.posV ?? 0,
    sizePct: p.sizePct ?? 100,
    lockH: p.lockH !== false,
    lockV: p.lockV !== false,
    lockSize: p.lockSize !== false,
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

  if (
    (frame.style === "tall_static" ||
      frame.style === "gown_static" ||
      frame.style === "live_framed") &&
    frame.px != null
  ) {
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

/** Snapshot base geometry once — default thickness 100 keeps these exact values. */
export function ensureFrameBases(frame) {
  if (!frame) return frame;
  if (frame.borderThicknessPct == null) frame.borderThicknessPct = BORDER_THICKNESS_DEFAULT;
  if (frame.baseBorder == null && frame.border != null) frame.baseBorder = frame.border;
  if (frame.baseWhitePad == null && frame.whitePad != null) frame.baseWhitePad = frame.whitePad;
  if (frame.baseOuterMatPad == null && frame.outerMatPad != null) {
    frame.baseOuterMatPad = frame.outerMatPad;
  }
  if (frame.baseInnerMatPad == null && frame.innerMatPad != null) {
    frame.baseInnerMatPad = frame.innerMatPad;
  }
  if (frame.baseInnerStroke == null && frame.innerStroke != null) {
    frame.baseInnerStroke = frame.innerStroke;
  }
  if (frame.style === "gown_static" && frame.baseInnerStroke == null) {
    frame.baseInnerStroke = 3;
  }
  if (
    frame.baseOuterMatPad == null &&
    frame.style === "gown_static" &&
    frame.baseWhitePad != null
  ) {
    frame.baseInnerMatPad = frame.baseInnerMatPad ?? frame.innerMatPad ?? 12;
    const hairline = frame.baseInnerStroke ?? frame.innerStroke ?? 3;
    frame.baseOuterMatPad = Math.max(
      0,
      frame.baseWhitePad - frame.baseInnerMatPad - hairline,
    );
  }
  if (frame.baseInnerFrameX == null && frame.innerFrameX != null) {
    frame.baseInnerFrameX = frame.innerFrameX;
  }
  if (frame.baseInnerFrameY == null && frame.innerFrameY != null) {
    frame.baseInnerFrameY = frame.innerFrameY;
  }
  if (frame.baseInnerFrameW == null && frame.innerFrameW != null) {
    frame.baseInnerFrameW = frame.innerFrameW;
  }
  if (frame.baseInnerFrameH == null && frame.innerFrameH != null) {
    frame.baseInnerFrameH = frame.innerFrameH;
  }
  if (frame.baseWhitePad == null && frame.px != null && frame.whiteX != null) {
    frame.baseWhitePad = frame.px - frame.whiteX;
  }
  if (frame.basePx == null && frame.px != null) frame.basePx = frame.px;
  if (frame.basePy == null && frame.py != null) frame.basePy = frame.py;
  if (frame.baseDw == null && frame.dw != null) frame.baseDw = frame.dw;
  if (frame.baseDh == null && frame.dh != null) frame.baseDh = frame.dh;
  if (frame.baseWhiteX == null && frame.whiteX != null) frame.baseWhiteX = frame.whiteX;
  if (frame.baseWhiteY == null && frame.whiteY != null) frame.baseWhiteY = frame.whiteY;
  if (frame.baseWhiteW == null && frame.whiteW != null) frame.baseWhiteW = frame.whiteW;
  if (frame.baseWhiteH == null && frame.whiteH != null) frame.baseWhiteH = frame.whiteH;
  if (frame.baseBorder == null && frame.px != null && frame.frameType !== "tall") {
    frame.baseBorder = frame.px;
  }
  return frame;
}

function restoreBaseGeometry(frame) {
  if (frame.baseBorder != null) frame.border = frame.baseBorder;
  if (frame.baseWhitePad != null) frame.whitePad = frame.baseWhitePad;
  if (frame.basePx != null) frame.px = frame.basePx;
  if (frame.basePy != null) frame.py = frame.basePy;
  if (frame.baseDw != null) frame.dw = frame.baseDw;
  if (frame.baseDh != null) frame.dh = frame.baseDh;
  if (frame.baseWhiteX != null) frame.whiteX = frame.baseWhiteX;
  if (frame.baseWhiteY != null) frame.whiteY = frame.baseWhiteY;
  if (frame.baseWhiteW != null) frame.whiteW = frame.baseWhiteW;
  if (frame.baseWhiteH != null) frame.whiteH = frame.baseWhiteH;
  if (frame.baseOuterMatPad != null) frame.outerMatPad = frame.baseOuterMatPad;
  if (frame.baseInnerMatPad != null) frame.innerMatPad = frame.baseInnerMatPad;
  if (frame.baseInnerFrameX != null) frame.innerFrameX = frame.baseInnerFrameX;
  if (frame.baseInnerFrameY != null) frame.innerFrameY = frame.baseInnerFrameY;
  if (frame.baseInnerFrameW != null) frame.innerFrameW = frame.baseInnerFrameW;
  if (frame.baseInnerFrameH != null) frame.innerFrameH = frame.baseInnerFrameH;
  if (frame.baseInnerStroke != null) frame.innerStroke = frame.baseInnerStroke;
}

/** Per-layer gown frame controls (100 = generated default for each band). */
export function ensureGownLayerPcts(frame) {
  if (!frame) return frame;
  if (!frame.gownLayerPct) {
    frame.gownLayerPct = {
      border: BORDER_THICKNESS_DEFAULT,
      outerMat: BORDER_THICKNESS_DEFAULT,
      innerAccent: BORDER_THICKNESS_DEFAULT,
      innerMat: BORDER_THICKNESS_DEFAULT,
    };
  }
  const p = frame.gownLayerPct;
  if (p.border == null) p.border = BORDER_THICKNESS_DEFAULT;
  if (p.outerMat == null) p.outerMat = BORDER_THICKNESS_DEFAULT;
  if (p.innerAccent == null) p.innerAccent = BORDER_THICKNESS_DEFAULT;
  if (p.innerMat == null) p.innerMat = BORDER_THICKNESS_DEFAULT;
  return frame;
}

export function gownFrameLayersEdited(frame) {
  if (!frame || frame.style !== "gown_static") return false;
  ensureGownLayerPcts(frame);
  const p = frame.gownLayerPct;
  return (
    p.border !== BORDER_THICKNESS_DEFAULT ||
    p.outerMat !== BORDER_THICKNESS_DEFAULT ||
    p.innerAccent !== BORDER_THICKNESS_DEFAULT ||
    p.innerMat !== BORDER_THICKNESS_DEFAULT
  );
}

function scaleGownLayerPx(base, pct, minPx = 0) {
  const t = clamp(pct, 0, BORDER_THICKNESS_MAX) / BORDER_THICKNESS_DEFAULT;
  if (t <= 0) return 0;
  const scaled = Math.round(base * t);
  return minPx > 0 ? Math.max(minPx, scaled) : scaled;
}

/** Gown: scale each frame band independently; product slot stays fixed. */
function applyGownFrameLayers(frame) {
  const outerW = frame.outerW || 0;
  const outerH = frame.outerH || 0;
  const baseDw = frame.baseDw ?? frame.dw ?? 0;
  const baseDh = frame.baseDh ?? frame.dh ?? 0;
  const baseBorder = frame.baseBorder ?? frame.border ?? 0;
  const baseOuterMatPad = frame.baseOuterMatPad ?? frame.outerMatPad ?? 0;
  const baseInnerMatPad = frame.baseInnerMatPad ?? frame.innerMatPad ?? 0;
  const baseHairline = frame.baseInnerStroke ?? frame.innerStroke ?? 3;

  ensureGownLayerPcts(frame);
  const p = frame.gownLayerPct;

  frame.dw = baseDw;
  frame.dh = baseDh;
  frame.border = scaleGownLayerPx(baseBorder, p.border, 2);
  frame.outerMatPad = scaleGownLayerPx(baseOuterMatPad, p.outerMat, 0);
  frame.innerStroke = scaleGownLayerPx(
    baseHairline,
    p.innerAccent,
    p.innerAccent > 0 ? 1 : 0,
  );
  frame.innerMatPad = scaleGownLayerPx(baseInnerMatPad, p.innerMat, 0);

  frame.whiteX = frame.border;
  frame.whiteY = frame.border;
  frame.whiteW = outerW - frame.border * 2;
  frame.whiteH = outerH - frame.border * 2;

  const minInnerFrame = Math.max(24, Math.round(baseDw * 0.35));
  let slotInset = frame.innerMatPad + frame.innerStroke;
  let innerFrameW = frame.whiteW - frame.outerMatPad * 2;
  if (innerFrameW < minInnerFrame + slotInset * 2) {
    const maxOuter = Math.max(0, Math.floor((frame.whiteW - minInnerFrame - slotInset * 2) / 2));
    frame.outerMatPad = Math.min(frame.outerMatPad, maxOuter);
    innerFrameW = frame.whiteW - frame.outerMatPad * 2;
  }
  if (innerFrameW < minInnerFrame + slotInset * 2) {
    const maxInset = Math.max(0, Math.floor((innerFrameW - minInnerFrame) / 2));
    if (frame.innerMatPad + frame.innerStroke > maxInset) {
      const ratio =
        frame.innerMatPad + frame.innerStroke > 0
          ? frame.innerMatPad / (frame.innerMatPad + frame.innerStroke)
          : 0.5;
      frame.innerMatPad = Math.max(0, Math.round(maxInset * ratio));
      frame.innerStroke = Math.max(frame.innerAccent > 0 ? 1 : 0, maxInset - frame.innerMatPad);
      slotInset = frame.innerMatPad + frame.innerStroke;
    }
  }

  frame.whitePad = frame.outerMatPad + frame.innerMatPad + frame.innerStroke;

  frame.innerFrameX = frame.whiteX + frame.outerMatPad;
  frame.innerFrameY = frame.whiteY + frame.outerMatPad;
  frame.innerFrameW = frame.whiteW - frame.outerMatPad * 2;
  frame.innerFrameH = frame.whiteH - frame.outerMatPad * 2;

  const slotInsetFinal = frame.innerMatPad + frame.innerStroke;
  const innerW = frame.innerFrameW - slotInsetFinal * 2;
  const innerH = frame.innerFrameH - slotInsetFinal * 2;
  frame.px = frame.innerFrameX + slotInsetFinal + Math.round((innerW - baseDw) / 2);
  frame.py = frame.innerFrameY + slotInsetFinal + Math.round((innerH - baseDh) / 2);
  return frame;
}

function syncGownLayerPctFromLegacySlider(frame, pct) {
  ensureGownLayerPcts(frame);
  const p = frame.gownLayerPct;
  if (p.innerAccent === BORDER_THICKNESS_DEFAULT && p.innerMat === BORDER_THICKNESS_DEFAULT) {
    p.border = pct;
    p.outerMat = pct;
  }
}

/** @deprecated gown uses applyGownFrameLayers — kept for tests calling borderThicknessPct. */
function applyGownBorderThickness(frame, pct) {
  syncGownLayerPctFromLegacySlider(frame, pct);
  return applyGownFrameLayers(frame);
}

export function staticFrameBorderEdited(frame) {
  if (!frame) return false;
  if (frame.style === "gown_static") return gownFrameLayersEdited(frame);
  return (frame.borderThicknessPct ?? BORDER_THICKNESS_DEFAULT) !== BORDER_THICKNESS_DEFAULT;
}

export function shouldRebuildStaticFrame(layers, options = {}) {
  const frame = layers?._staticFrame;
  if (!frame?.outerW) return false;
  if (!layers.productOnly && !layers.noStickers) return false;
  if (staticFrameBorderEdited(frame)) return true;
  if (options.staticAppearanceEdited) return true;
  const frameDef = layers._staticDefaults?.frame;
  if (frameDef && frameAppearanceChanged(frame, frameDef)) return true;
  return false;
}

/**
 * Apply border thickness (0–1000). 100 = exact generated frame.
 * Gown keeps product size fixed; other variants scale border/mat around product.
 */
export function applyBorderThickness(frame, options = {}) {
  if (!frame) return frame;
  ensureFrameBases(frame);
  const pct = clamp(frame.borderThicknessPct ?? BORDER_THICKNESS_DEFAULT, 0, BORDER_THICKNESS_MAX);

  if (pct === BORDER_THICKNESS_DEFAULT && !gownFrameLayersEdited(frame)) {
    restoreBaseGeometry(frame);
    return frame;
  }

  if (frame.style === "gown_static") {
    if (!gownFrameLayersEdited(frame)) {
      syncGownLayerPctFromLegacySlider(frame, pct);
    }
    if (options.syncLegacyGownSlider) {
      syncGownLayerPctFromLegacySlider(frame, pct);
    }
    return applyGownFrameLayers(frame);
  }

  const outerW = frame.outerW || 0;
  const outerH = frame.outerH || 0;
  const baseDw = frame.baseDw ?? frame.dw ?? 0;
  const baseDh = frame.baseDh ?? frame.dh ?? 0;
  const baseBorder = frame.baseBorder ?? frame.border ?? 0;
  const baseWhitePad = frame.baseWhitePad ?? frame.whitePad ?? 0;
  const baseInset = baseBorder + baseWhitePad;
  const t = pct / BORDER_THICKNESS_DEFAULT;
  const minInset = 2;
  const minProduct = Math.max(24, Math.round(Math.min(outerW, outerH) * 0.22));
  const maxInset = Math.max(
    baseInset + 1,
    Math.floor((Math.min(outerW, outerH) - minProduct) / 2),
  );

  let targetInset;
  if (t <= 1) {
    targetInset = Math.round(minInset + (baseInset - minInset) * t);
  } else {
    const hi = BORDER_THICKNESS_MAX / BORDER_THICKNESS_DEFAULT;
    const u = (t - 1) / (hi - 1);
    targetInset = Math.round(baseInset + (maxInset - baseInset) * u);
  }
  targetInset = clamp(targetInset, minInset, maxInset);

  const innerW = Math.max(1, outerW - targetInset * 2);
  const innerH = Math.max(1, outerH - targetInset * 2);
  let newDw = baseDw;
  let newDh = baseDh;
  if (baseDw > 0 && baseDh > 0) {
    const fitScale = Math.min(innerW / baseDw, innerH / baseDh);
    if (fitScale < 1) {
      newDw = Math.max(minProduct, Math.round(baseDw * fitScale));
      newDh = Math.max(minProduct, Math.round(baseDh * fitScale));
    } else if (t < 1) {
      const grow = Math.min(fitScale, 1.28);
      newDw = Math.round(baseDw * grow);
      newDh = Math.round(baseDh * grow);
    }
  }

  const isTall =
    frame.frameType === "tall" ||
    frame.style === "tall_static" ||
    frame.style === "live_framed";

  if (isTall) {
    const borderRatio = baseInset > 0 ? baseBorder / baseInset : 0.14;
    frame.border = Math.max(2, Math.round(targetInset * borderRatio));
    frame.whitePad = Math.max(0, targetInset - frame.border);
    frame.whiteX = frame.border;
    frame.whiteY = frame.border;
    frame.whiteW = outerW - frame.border * 2;
    frame.whiteH = outerH - frame.border * 2;
  } else {
    frame.border = targetInset;
  }

  frame.dw = newDw;
  frame.dh = newDh;
  frame.px = targetInset + Math.round((innerW - newDw) / 2);
  frame.py = targetInset + Math.round((innerH - newDh) / 2);
  return frame;
}

export function reanchorPlacements(layers) {
  if (!layers?._badgePlacements?.length || !layers._staticFrame) return false;
  for (const p of layers._badgePlacements) {
    if (p.anchor) applyAnchorToPlacement(p, layers._staticFrame);
    else applyPositionToPlacement(p, layers._staticFrame);
  }
  return true;
}

function drawLiveStandardBackground(ctx, frame) {
  const { outerW, outerH } = frame;
  if (frame.frameType === "solid" || frame.gradientAxis === "solid") {
    ctx.fillStyle = frame.gradientTop || frame.borderColor || "#3498db";
    ctx.fillRect(0, 0, outerW, outerH);
    return;
  }
  let grad;
  const axis = frame.gradientAxis || "vertical";
  if (axis === "horizontal") grad = ctx.createLinearGradient(0, 0, outerW, 0);
  else if (axis === "diagonal") grad = ctx.createLinearGradient(0, 0, outerW, outerH);
  else grad = ctx.createLinearGradient(0, 0, 0, outerH);
  grad.addColorStop(0, frame.gradientTop || "#3498db");
  grad.addColorStop(1, frame.gradientBottom || "#2ecc71");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, outerW, outerH);
}

function drawFrameBackground(ctx, frame) {
  const { outerW, outerH, px, py, dw, dh, style } = frame;
  ensureFrameDefaults(frame);

  if (style === "live_standard") {
    drawLiveStandardBackground(ctx, frame);
    return;
  }

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
  } else if (
    frame.frameType === "tall" ||
    style === "tall_static" ||
    style === "live_framed"
  ) {
    ctx.fillStyle = frame.borderColor || "#45a9e5";
    ctx.fillRect(0, 0, outerW, outerH);
    ctx.fillStyle = frame.matColor || "#ffffff";
    const wx = frame.whiteX ?? 0;
    const wy = frame.whiteY ?? 0;
    const ww = frame.whiteW ?? outerW;
    const wh = frame.whiteH ?? outerH;
    ctx.fillRect(wx, wy, ww, wh);
  } else if (style === "gown_static") {
    drawGownStaticFrameBackground(ctx, frame);
  } else {
    ctx.fillStyle = frame.borderColor || "#32d74b";
    ctx.fillRect(0, 0, outerW, outerH);
  }
}

async function loadProductForFrame(layers, frame) {
  if (layers.productOnly) return loadImage(layers.productOnly);
  const dw = frame.baseDw ?? frame.dw;
  const dh = frame.baseDh ?? frame.dh;
  const px = frame.basePx ?? frame.px;
  const py = frame.basePy ?? frame.py;
  if (!layers.noStickers || !dw || !dh || px == null || py == null) return null;
  const src = await loadImage(layers.noStickers);
  const c = document.createElement("canvas");
  c.width = dw;
  c.height = dh;
  c.getContext("2d").drawImage(src, px, py, dw, dh, 0, 0, dw, dh);
  return c;
}

async function rebuildFrameCanvas(layers) {
  if (!layers?._staticFrame) return null;
  const frame = ensureFrameDefaults({ ...layers._staticFrame });
  ensureFrameBases(frame);
  applyBorderThickness(frame);

  let productImg = null;
  try {
    productImg = await loadProductForFrame(layers, frame);
  } catch (e) {
    return null;
  }
  if (!productImg || !frame.outerW) return null;

  const canvas = document.createElement("canvas");
  canvas.width = frame.outerW;
  canvas.height = frame.outerH;
  const ctx = canvas.getContext("2d");

  drawFrameBackground(ctx, frame);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (frame.style === "gown_static") {
    drawGownProductInSlot(ctx, productImg, frame);
  } else {
    ctx.drawImage(
      productImg,
      0,
      0,
      productImg.width,
      productImg.height,
      frame.px,
      frame.py,
      frame.dw,
      frame.dh,
    );
  }

  Object.assign(layers._staticFrame, frame);
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
    const { w, h } = placementSize(p);
    try {
      if (p.kind === "freeShipping") {
        drawFreeShippingCircle(ctx, p.x, p.y, w);
      } else if (p.id?.startsWith("tall-")) {
        const copy = { ...p, w, h };
        await drawTallBadge(ctx, loadBadge, copy);
      } else if (p.id?.startsWith("gown-") || p.kind === "gownArt") {
        const copy = { ...p, w, h };
        await drawGownBadge(ctx, loadBadge, copy);
      } else if (p.num != null) {
        const badge = await loadBadge(p.num);
        if (badge) ctx.drawImage(badge, p.x, p.y, w, h);
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

async function compressPreview(canvas, options = {}) {
  const targetKb = options.targetKb || options.preserveKb || 0;
  const style = options.style || "";
  const jpegQuality = options.jpegQuality;

  if (targetKb > 0) {
    return compressToTargetKb(canvas, targetKb, style);
  }
  if (jpegQuality > 0 && jpegQuality <= 1) {
    return canvas.toDataURL("image/jpeg", jpegQuality);
  }
  return canvas.toDataURL("image/jpeg", 0.82);
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
  const keys = [
    "frameType",
    "gradientTop",
    "gradientBottom",
    "borderColor",
    "matColor",
    "outerMatColor",
    "innerStrokeColor",
    "padColor",
    "gradientPreset",
    "borderThicknessPct",
  ];
  return keys.some((k) => frame[k] !== defaults[k]);
}

export function placementChangedFromDefault(p, def) {
  if (!p || !def) return false;
  if (p.hidden !== def.hidden) return true;
  if ((p.kind || "badge") !== (def.kind || "badge")) return true;
  if (p.num !== def.num) return true;
  if (Math.abs((p.sizePct ?? 100) - (def.sizePct ?? 100)) > 0.5) return true;
  if (Math.abs((p.posH ?? 0) - (def.posH ?? 0)) > 0.5) return true;
  if (Math.abs((p.posV ?? 0) - (def.posV ?? 0)) > 0.5) return true;
  return false;
}

export function needsStaticCompose(result) {
  if (!result?.layers) return false;
  const layers = result.layers;
  if (!layers._staticFrame && !(layers._badgePlacements || []).length) return false;
  if (result._badgesRepositioned || result._staticAppearanceEdited) return true;
  if (staticFrameBorderEdited(layers._staticFrame)) return true;
  const flags = result.editFlags || {};
  if (isStaticEdited(flags, false)) return true;

  const frame = layers._staticFrame;
  if (!frame) return false;
  const frameDef = layers._staticDefaults?.frame;
  if (frameDef && frameAppearanceChanged(frame, frameDef)) return true;

  const placements = layers._badgePlacements || [];
  const placementDefs = layers._staticDefaults?.placements || {};
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

  const frameEdited = shouldRebuildStaticFrame(layers, {
    staticAppearanceEdited: !!options.staticAppearanceEdited,
  });

  let canvas = null;
  let frame = layers._staticFrame;
  const picked = pickStaticBaseLayer(layers, flags);

  if (frameEdited && layers._staticFrame) {
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
    return compressPreview(canvas, {
      targetKb,
      preserveKb: options.preserveKb,
      jpegQuality: options.jpegQuality,
      style,
    });
  }

  const placements = (layers._badgePlacements || []).filter((p) => !p.hidden && p.drawn !== false);
  if (!placements.length) {
    return compressPreview(canvas, {
      targetKb,
      preserveKb: options.preserveKb,
      jpegQuality: options.jpegQuality,
      style,
    });
  }

  for (const p of placements) {
    applyPositionToPlacement(p, frame);
    const { w, h } = placementSize(p);
    if (p.kind === "freeShipping") p.size = w;
    else {
      p.w = w;
      p.h = h;
      if (!p.defaultW) p.size = w;
    }
  }

  const ctx = canvas.getContext("2d");
  await drawPlacementsOnCtx(ctx, placements);

  return compressPreview(canvas, {
    targetKb,
    preserveKb: options.preserveKb,
    jpegQuality: options.jpegQuality,
    style,
  });
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
  ensurePlacementDefaults(p);
  p.posH = clamp(posH, 0, 100);
  p.posV = clamp(posV, 0, 100);
  applyPositionToPlacement(p, layers._staticFrame);
  return true;
}

export function updatePlacementSliderAxis(layers, placementId, axis, value, options = {}) {
  if (!layers?._badgePlacements || !layers._staticFrame) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  ensurePlacementDefaults(p);
  const v = clamp(value, 0, 100);
  if (axis === "h") {
    if (p.lockH && !options.force) return false;
    p.posH = v;
    if (options.autoLock) p.lockH = true;
  } else if (axis === "v") {
    if (p.lockV && !options.force) return false;
    p.posV = v;
    if (options.autoLock) p.lockV = true;
  } else {
    return false;
  }
  applyPositionToPlacement(p, layers._staticFrame);
  return true;
}

export function setPlacementAxisLock(layers, placementId, axis, locked) {
  if (!layers?._badgePlacements) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  ensurePlacementDefaults(p);
  if (axis === "h") p.lockH = !!locked;
  else if (axis === "v") p.lockV = !!locked;
  else return false;
  return true;
}

export function setPlacementSizeLock(layers, placementId, locked) {
  if (!layers?._badgePlacements) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  ensurePlacementDefaults(p);
  p.lockSize = !!locked;
  return true;
}

export function updatePlacementSize(layers, placementId, sizePct, options = {}) {
  if (!layers?._badgePlacements) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  ensurePlacementDefaults(p);
  if (p.lockSize && !options.force) return false;
  p.sizePct = clamp(sizePct, 25, 200);
  if (options.autoLock) p.lockSize = true;
  if (layers._staticFrame) applyPositionToPlacement(p, layers._staticFrame);
  return true;
}

export function updatePlacementBadge(layers, placementId, badgeValue) {
  if (!layers?._badgePlacements) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  ensurePlacementDefaults(p);

  const raw = String(badgeValue ?? "").trim();
  if (raw === "gown-art") {
    if (!p.id?.startsWith("gown-")) return false;
    p.kind = "gownArt";
    p.gownSlot = p.id;
    p.num = undefined;
    p.defaultW = undefined;
    p.defaultH = undefined;
    p.defaultSize = undefined;
    p.size = undefined;
    restoreGownArtSlotSize(p, layers);
    p.drawn = true;
    if (p.id === "gown-best") p.label = "Best PRICE";
    else if (p.id === "gown-flash") p.label = "FLASH SALE";
    else if (p.id === "gown-popular") p.label = "MOST POPULAR";
    else p.label = "Gown art";
    if (layers._staticFrame) applyPositionToPlacement(p, layers._staticFrame);
    return true;
  }
  if (raw === FREE_SHIPPING_BADGE_VALUE) {
    if (!isFreeShippingSlot(p)) return false;
    const { w } = placementSize(p);
    p.kind = "freeShipping";
    p._freeShippingSlot = true;
    p.defaultSize = w;
    p.defaultW = undefined;
    p.defaultH = undefined;
    p.size = w;
    p.num = undefined;
    p.drawn = true;
    p.label = "FREE SHIPPING";
    if (layers._staticFrame) applyPositionToPlacement(p, layers._staticFrame);
    return true;
  }

  const num = Math.max(1, Math.min(25, parseInt(raw, 10) || 0));
  if (!num) return false;

  if (p.kind === "freeShipping" || p.kind === "gownArt") {
    const { w, h } = placementSize(p);
    if (!p.gownSlot && p.id?.startsWith("gown-")) p.gownSlot = p.id;
    p.kind = "badge";
    if (p.id?.startsWith("gown-")) {
      const side = squareBadgeBox(w, h);
      p.defaultW = side;
      p.defaultH = side;
      p.w = side;
      p.h = side;
    } else {
      p.defaultW = w;
      p.defaultH = h;
      p.w = w;
      p.h = h;
    }
    p.defaultSize = undefined;
    p.size = undefined;
  }

  p.num = num;
  p.drawn = true;
  p.label = `Badge ${num}`;
  if (layers._staticFrame) applyPositionToPlacement(p, layers._staticFrame);
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
    p.hidden = !!hidden;
  }
  return true;
}

export function updateFrameAppearance(layers, patch) {
  if (!layers?._staticFrame) return false;
  const frame = layers._staticFrame;
  if (patch.frameType != null) frame.frameType = patch.frameType;
  if (patch.gradientTop != null) {
    const hex = normalizeFrameColor(patch.gradientTop);
    if (hex) frame.gradientTop = hex;
  }
  if (patch.gradientBottom != null) {
    const hex = normalizeFrameColor(patch.gradientBottom);
    if (hex) frame.gradientBottom = hex;
  }
  if (patch.borderColor != null) {
    const hex = normalizeFrameColor(patch.borderColor);
    if (hex) frame.borderColor = hex;
  }
  if (patch.outerMatColor != null) {
    const hex = normalizeFrameColor(patch.outerMatColor);
    if (hex) frame.outerMatColor = hex;
  }
  if (patch.innerStrokeColor != null) {
    const hex = normalizeFrameColor(patch.innerStrokeColor);
    if (hex) frame.innerStrokeColor = hex;
  }
  if (patch.padColor != null) {
    const hex = normalizeFrameColor(patch.padColor);
    if (hex) frame.padColor = hex;
  }
  if (patch.matColor != null) {
    const hex = normalizeFrameColor(patch.matColor);
    if (hex) {
      frame.matColor = hex;
      if (frame.style === "gown_static") {
        if (patch.outerMatColor == null && frame.outerMatColor == null) frame.outerMatColor = hex;
        if (patch.padColor == null && frame.padColor == null) frame.padColor = hex;
      }
    }
  }
  if (patch.gradientPreset !== undefined) frame.gradientPreset = patch.gradientPreset || null;
  if (patch.gownLayerPct != null && frame.style === "gown_static") {
    ensureGownLayerPcts(frame);
    Object.assign(frame.gownLayerPct, patch.gownLayerPct);
    applyGownFrameLayers(frame);
  }
  if (patch.borderThicknessPct != null) {
    frame.borderThicknessPct = clamp(patch.borderThicknessPct, 0, BORDER_THICKNESS_MAX);
    applyBorderThickness(frame, { syncLegacyGownSlider: frame.style === "gown_static" });
  }
  return true;
}

export function applyGradientPreset(layers, presetId) {
  const preset = GRADIENT_PRESETS.find((g) => g.id === presetId);
  if (!preset || !layers?._staticFrame) return false;
  if (layers._staticFrame.style === "gown_static") return false;
  return updateFrameAppearance(layers, {
    frameType: "gradient",
    gradientTop: preset.top,
    gradientBottom: preset.bottom,
    gradientPreset: presetId,
    borderColor: preset.top,
  });
}

export function clearGradientPreset(layers) {
  if (!layers?._staticFrame) return false;
  const frame = layers._staticFrame;
  const style = frame.style;
  const defs = STYLE_DEFAULTS[style];
  frame.gradientPreset = null;
  if (defs?.frameType) frame.frameType = defs.frameType;
  return true;
}

export function staticStyleUsesGradientColors(style, frame) {
  if (style === "showcase" || style === "live_standard") return true;
  return !!frame?.gradientPreset;
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
        borderThicknessPct: frame.borderThicknessPct ?? 100,
        borderThicknessLocked: frame.borderThicknessLocked !== false,
        outerMatColor: frame.outerMatColor,
        innerStrokeColor: frame.innerStrokeColor,
        padColor: frame.padColor,
        gownLayerPct: frame.gownLayerPct
          ? { ...frame.gownLayerPct }
          : {
              border: 100,
              outerMat: 100,
              innerAccent: 100,
              innerMat: 100,
            },
        gownFrameLayersLocked: frame.gownFrameLayersLocked !== false,
      },
      placements: {},
    };
    for (const p of layers._badgePlacements || []) {
      if (!p.id) continue;
      layers._staticDefaults.placements[p.id] = {
        kind: p.kind,
        num: p.num,
        hidden: !!p.hidden,
        posH: p.posH,
        posV: p.posV,
        sizePct: p.sizePct ?? 100,
        freeShippingSlot: isFreeShippingSlot(p),
        slotW: p.w,
        slotH: p.h,
      };
    }
  }
}

export async function bootstrapLiveFrameAsync(row) {
  const layers = row?.layers;
  if (!layers || layers._staticFrame) return layers;
  if (!(layers._badgePlacements || []).length) return layers;

  const meta = row.meta || {};
  if (!meta.canvasW || !meta.canvasH) {
    const url = layers.noStickers || layers.full;
    if (url) {
      try {
        const img = await loadImage(url);
        meta.canvasW = img.width;
        meta.canvasH = img.height;
        if (!meta.borderPx && layers._staticFrame === undefined) {
          const p0 = layers._badgePlacements[0];
          if (p0?.x != null && p0?.y != null) {
            meta.borderPx = Math.max(8, Math.min(p0.x, p0.y));
          }
        }
        row.meta = meta;
      } catch (e) {}
    }
  }
  return bootstrapLiveFrame(row);
}

export function bootstrapLiveFrame(row) {
  const layers = row?.layers;
  const meta = row?.meta || {};
  if (!layers || layers._staticFrame) return layers;
  if (!(layers._badgePlacements || []).length) return layers;

  const outerW = meta.canvasW || meta.outerW;
  const outerH = meta.canvasH || meta.outerH;
  if (!outerW || !outerH) return layers;

  const isFramed = meta.style === "framed_low" || row.variantStyle === "framed";
  const border = meta.borderPx || Math.max(16, Math.round(Math.min(outerW, outerH) * 0.05));
  const dw = meta.productW || outerW - border * 2;
  const dh = meta.productH || outerH - border * 2;
  const px = isFramed ? border : border;
  const py = isFramed ? border : border;

  if (isFramed) {
    const blueOuter = meta.blueOuter || border;
    layers._staticFrame = {
      style: "live_framed",
      frameType: "tall",
      borderColor: meta.borderColor || "#add8e6",
      matColor: "#ffffff",
      gradientTop: meta.borderColor || "#add8e6",
      gradientBottom: "#7ec8e3",
      px,
      py,
      dw,
      dh,
      border: blueOuter,
      outerW,
      outerH,
      whiteX: blueOuter,
      whiteY: blueOuter,
      whiteW: outerW - blueOuter * 2,
      whiteH: outerH - blueOuter * 2,
    };
  } else {
    const gradType = meta.gradType ?? 2;
    layers._staticFrame = {
      style: "live_standard",
      frameType: gradType === 0 ? "solid" : "gradient",
      gradientTop: meta.gradientTop || meta.borderColor || "#3498db",
      gradientBottom: meta.gradientBottom || "#2ecc71",
      gradientAxis:
        gradType === 1 ? "horizontal" : gradType === 3 ? "diagonal" : gradType === 0 ? "solid" : "vertical",
      borderColor: meta.gradientTop || "#3498db",
      px: border,
      py: border,
      dw,
      dh,
      border,
      outerW,
      outerH,
    };
  }

  layers._badgePlacements.forEach((p, i) => {
    if (!p.id) p.id = `live-badge-${i}`;
    if (!p.label) p.label = p.kind === "freeShipping" ? "FREE SHIPPING" : `Badge ${i + 1}`;
    if (p.drawn == null) p.drawn = true;
    ensurePlacementDefaults(p);
  });

  return layers;
}

export async function ensureVariantPlacementMeta(row) {
  const layers = row?.layers;
  if (!layers) return layers;
  await bootstrapLiveFrameAsync(row);
  if (layers._staticFrame && (layers._badgePlacements || []).length) {
    ensureStaticPlacementMeta(layers, layers._staticFrame.style);
  }
  return layers;
}

export function ensureStaticPlacementMeta(layers, style) {
  if (!layers?._badgePlacements?.length) return layers;
  if (!layers._staticFrame) return layers;

  ensureFrameDefaults(layers._staticFrame);
  snapshotDefaults(layers, style);

  const anchorMap = DEFAULT_ANCHORS[style] || {};

  for (let i = 0; i < layers._badgePlacements.length; i++) {
    const p = layers._badgePlacements[i];
    if (!p.id) p.id = `badge-slot-${i}`;
    ensurePlacementDefaults(p);
    if (!p.anchor && anchorMap[p.id]) p.anchor = anchorMap[p.id];
    if (!p.label) {
      if (p.kind === "freeShipping") p.label = "FREE SHIPPING";
      else if (p.id === "showcase-quality") p.label = "100% Quality";
      else if (p.id === "showcase-star") p.label = "Star ribbon";
      else if (p.id === "showcase-satisfaction") p.label = "Satisfaction";
      else if (p.id === "lifestyle-hot") p.label = "HOT SALE";
      else if (p.id === "lifestyle-flash") p.label = "FLASH SALE";
      else if (p.id === "lifestyle-ship") {
        p.label = "FREE SHIPPING";
        p._freeShippingSlot = true;
      }
      else if (p.id === "tall-sale") p.label = "Price tag";
      else if (p.id === "tall-arrow") p.label = "Arrow";
      else if (p.id === "tall-ship") p.label = "Delivery truck";
      else if (p.id === "gown-best") p.label = "Best PRICE";
      else if (p.id === "gown-flash") p.label = "FLASH SALE";
      else if (p.id === "gown-popular") p.label = "MOST POPULAR";
      else if (p.id.startsWith("live-badge-")) p.label = `Badge ${parseInt(p.id.split("-").pop(), 10) + 1}`;
      else p.label = `Badge ${p.num || ""}`.trim();
    }
    if (p.posH == null || p.posV == null) {
      const { w, h } = placementSize(p);
      const sliders = xyToSliders(p.x || 0, p.y || 0, layers._staticFrame.outerW, layers._staticFrame.outerH, w, h);
      p.posH = sliders.posH;
      p.posV = sliders.posV;
    } else {
      applyPositionToPlacement(p, layers._staticFrame);
    }
  }
  return layers;
}

export function resetStaticPlacements(layers) {
  if (!layers?._badgePlacements?.length || !layers._staticFrame) return false;
  const style = layers._staticFrame.style;
  const anchorMap = DEFAULT_ANCHORS[style] || {};

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
      if (pDef.freeShippingSlot) p._freeShippingSlot = true;
      if (pDef.kind === "freeShipping") {
        p.kind = "freeShipping";
        p.num = undefined;
        p.label = "FREE SHIPPING";
      } else if (pDef.kind === "gownArt") {
        p.kind = "gownArt";
        p.gownSlot = p.id;
        p.num = undefined;
        p.defaultW = undefined;
        p.defaultH = undefined;
        p.defaultSize = undefined;
        p.size = undefined;
        if (pDef.slotW != null && pDef.slotH != null) {
          p.w = pDef.slotW;
          p.h = pDef.slotH;
        } else {
          const dims = gownArtDimensions(p.id, layers._staticFrame);
          if (dims) {
            p.w = dims.w;
            p.h = dims.h;
          }
        }
        if (p.id === "gown-best") p.label = "Best PRICE";
        else if (p.id === "gown-flash") p.label = "FLASH SALE";
        else if (p.id === "gown-popular") p.label = "MOST POPULAR";
      } else {
        p.kind = pDef.kind || "badge";
        p.num = pDef.num;
        if (p.num) p.label = `Badge ${p.num}`;
      }
      p.hidden = !!pDef.hidden;
      p.posH = pDef.posH;
      p.posV = pDef.posV;
      p.sizePct = pDef.sizePct ?? 100;
      p.lockH = true;
      p.lockV = true;
      p.lockSize = true;
    } else if (anchorMap[p.id]) {
      p.anchor = anchorMap[p.id];
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
    isEditableVariant,
    getBadgeSlots,
    BADGE_ANCHOR_OPTIONS,
    GRADIENT_PRESETS,
    FRAME_COLOR_SWATCHES,
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
    updatePlacementSliderAxis,
    setPlacementAxisLock,
    setPlacementSizeLock,
    updatePlacementSize,
    updatePlacementBadge,
    FREE_SHIPPING_BADGE_VALUE,
    isFreeShippingSlot,
    setPlacementHidden,
    setAllPlacementsHidden,
    updateFrameAppearance,
    applyGradientPreset,
    clearGradientPreset,
    staticStyleUsesGradientColors,
    parseCssColor,
    normalizeFrameColor,
    hexToRgb,
    rgbToHex,
    parseRgbTriplet,
    formatRgbString,
    bootstrapLiveFrame,
    bootstrapLiveFrameAsync,
    ensureVariantPlacementMeta,
    ensureStaticPlacementMeta,
    resetStaticPlacements,
    needsStaticCompose,
    isStaticEdited,
    ensureFrameBases,
    applyBorderThickness,
    ensureGownLayerPcts,
    gownFrameLayersEdited,
    reanchorPlacements,
    staticFrameBorderEdited,
    shouldRebuildStaticFrame,
    BORDER_THICKNESS_DEFAULT,
    BORDER_THICKNESS_MAX,
  };
}
