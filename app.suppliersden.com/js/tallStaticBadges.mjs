/**
 * Tall static promo badges — PNG assets when available, procedural fallback.
 * Matches reference: red scalloped tag (TL), curved arrow (TR), truck (BL).
 */

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

export async function loadTallBadge(num) {
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

/** Red scalloped tag + white outline + top string (reference top-left). */
export function drawPriceTag(ctx, x, y, size) {
  const cx = x + size * 0.5;
  const cy = y + size * 0.56;
  const r = size * 0.34;
  ctx.save();
  // Hanging string
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1.2, size * 0.02);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, y + size * 0.04);
  ctx.lineTo(cx, cy - r - size * 0.02);
  ctx.stroke();
  // Scalloped body
  ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 - Math.PI / 2;
    const scallop = r + (i % 2 === 0 ? r * 0.11 : 0);
    const px = cx + Math.cos(a) * scallop;
    const py = cy + Math.sin(a) * scallop;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#e53935";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2.5, size * 0.05);
  ctx.stroke();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1.2, size * 0.022);
  ctx.stroke();
  ctx.restore();
}

/** Hand-drawn thin curved arrow — sweeps upward toward the top-right corner. */
export function drawCurvedArrow(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "#111111";
  ctx.lineWidth = Math.max(1.2, w * 0.028);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const x0 = x + w * 0.12;
  const y0 = y + h * 0.82;
  const x1 = x + w * 0.94;
  const y1 = y + h * 0.06;
  const cx = x + w * 0.42;
  const cy = y + h * 0.98;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  const angle = Math.atan2(y1 - cy, x1 - cx);
  const ah = Math.max(4, w * 0.11);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ah * Math.cos(angle - 0.55), y1 - ah * Math.sin(angle - 0.55));
  ctx.lineTo(x1 - ah * Math.cos(angle + 0.55), y1 - ah * Math.sin(angle + 0.55));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Small black delivery truck silhouette (reference bottom-left). */
export function drawDeliveryTruck(ctx, x, y, size) {
  ctx.save();
  const bx = x + size * 0.18;
  const by = y + size * 0.34;
  const bw = size * 0.68;
  const bh = size * 0.36;
  ctx.fillStyle = "#111111";
  ctx.fillRect(bx, by + bh * 0.42, bw * 0.52, bh * 0.45);
  ctx.fillRect(bx + bw * 0.48, by + bh * 0.52, bw * 0.44, bh * 0.35);
  const wr = bh * 0.12;
  ctx.beginPath();
  ctx.arc(bx + bw * 0.18, by + bh * 0.92, wr, 0, Math.PI * 2);
  ctx.arc(bx + bw * 0.7, by + bh * 0.92, wr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export async function drawTallPlacement(ctx, p) {
  if (!p) return false;
  // Procedural icons match the tall promo reference (tag / arrow / truck).
  if (p.kind === "priceTag") {
    drawPriceTag(ctx, p.x, p.y, p.size);
    return true;
  }
  if (p.kind === "curvedArrow") {
    drawCurvedArrow(ctx, p.x, p.y, p.w, p.h);
    return true;
  }
  if (p.kind === "truckIcon") {
    drawDeliveryTruck(ctx, p.x, p.y, p.size);
    return true;
  }
  if (p.num != null) {
    const badge = await loadTallBadge(p.num);
    if (badge) {
      const w = p.w || p.size;
      const h = p.h || p.size;
      ctx.drawImage(badge, p.x, p.y, w, h);
      return true;
    }
  }
  return false;
}
