/**
 * Compose / reposition badges on static showcase & lifestyle promo frames.
 * Web-only static variants — does not affect Live Meesho hunt.
 */

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

export function isStaticPromoVariant(row) {
  if (!row) return false;
  const style = row.variantStyle || row.meta?.style || row.meta?.path || "";
  return (
    style === "showcase" ||
    style === "lifestyle_promo" ||
    row.meta?.path === "showcase" ||
    row.meta?.path === "lifestyle_promo" ||
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
    }));
}

function placementSize(p) {
  return {
    w: p.w || p.size || 48,
    h: p.h || p.size || 48,
  };
}

/** Map anchor name → x/y on outer canvas. */
export function positionForAnchor(anchor, frame, w, h) {
  const { px, py, dw, dh, border = 16, outerW, outerH } = frame;
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

export function applyAnchorToPlacement(placement, frame) {
  if (!placement || !frame) return placement;
  const { w, h } = placementSize(placement);
  const anchor = placement.anchor || "top-left";
  const { x, y } = positionForAnchor(anchor, frame, w, h);
  placement.x = x;
  placement.y = y;
  return placement;
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
    if (!p || p.drawn === false) continue;
    try {
      if (p.kind === "freeShipping") {
        drawFreeShippingCircle(ctx, p.x, p.y, p.size);
      } else if (p.num != null) {
        const badge = await loadBadge(p.num);
        if (badge) {
          const { w, h } = placementSize(p);
          ctx.drawImage(badge, p.x, p.y, w, h);
        }
      }
    } catch (e) {}
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Pick base layer + optional badge overlay for static frames.
 */
export function pickStaticBaseLayer(layers, flags = {}) {
  const f = flags || {};
  if (f.cleanProduct || f.borderRemoved) {
    return { url: layers.productOnly || layers.full, drawBadges: false };
  }
  if (f.stickersRemoved) {
    return { url: layers.noStickers || layers.full, drawBadges: false };
  }
  if (f.borderOnlyRemoved) {
    return { url: layers.noBorder || layers.noStickers || layers.full, drawBadges: false };
  }
  return { url: layers.noStickers || layers.full, drawBadges: true };
}

export async function composeStaticPreview(layers, flags = {}) {
  if (!layers) return "";
  const picked = pickStaticBaseLayer(layers, flags);
  if (!picked.url) return layers.full || "";

  if (!picked.drawBadges) return picked.url;

  const placements = (layers._badgePlacements || []).filter((p) => p.drawn !== false);
  if (!placements.length) return layers.full || picked.url;

  try {
    const img = await loadImage(picked.url);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    await drawPlacementsOnCtx(ctx, placements);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch (e) {
    return layers.full || picked.url;
  }
}

export function updatePlacementAnchor(layers, placementId, anchor) {
  if (!layers?._badgePlacements || !layers._staticFrame) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  p.anchor = anchor;
  applyAnchorToPlacement(p, layers._staticFrame);
  return true;
}

export function ensureStaticPlacementMeta(layers, style) {
  if (!layers?._badgePlacements?.length || !layers._staticFrame) return layers;

  const defaults =
    style === "lifestyle_promo"
      ? {
          "lifestyle-hot": "top-right",
          "lifestyle-flash": "middle-left",
          "lifestyle-ship": "bottom-center",
        }
      : {
          "showcase-quality": "top-left",
          "showcase-star": "top-right",
          "showcase-satisfaction": "bottom-left",
        };

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
    }
    applyAnchorToPlacement(p, layers._staticFrame);
  }
  return layers;
}

if (typeof window !== "undefined") {
  window.StaticFrameCompose = {
    isStaticPromoVariant,
    getBadgeSlots,
    BADGE_ANCHOR_OPTIONS,
    positionForAnchor,
    applyAnchorToPlacement,
    pickStaticBaseLayer,
    composeStaticPreview,
    updatePlacementAnchor,
    ensureStaticPlacementMeta,
  };
}
