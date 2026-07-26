/**
 * Tall static promo badges — exact PNG assets from Badge/ folder.
 * badge3 = red scalloped price seal (TL)
 * badge2 = thin curved arrow toward top-right (TR)
 * badge1 = delivery truck silhouette (BL)
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
    img.crossOrigin = "anonymous";
    img.onload = () => {
      badgeCache[num] = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Procedural fallbacks only when PNG assets fail to load. */
export function drawPriceTag(ctx, x, y, size) {
  const cx = x + size * 0.5;
  const cy = y + size * 0.56;
  const r = size * 0.34;
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1.2, size * 0.02);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, y + size * 0.04);
  ctx.lineTo(cx, cy - r - size * 0.02);
  ctx.stroke();
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

export function drawCurvedArrow(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "#111111";
  ctx.lineWidth = Math.max(1.2, w * 0.028);
  ctx.lineCap = "round";
  const x0 = x + w * 0.1;
  const y0 = y + h * 0.78;
  const x1 = x + w * 0.92;
  const y1 = y + h * 0.08;
  const cx = x + w * 0.38;
  const cy = y + h * 0.92;
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

export function drawDeliveryTruck(ctx, x, y, size) {
  ctx.save();
  const bx = x + size * 0.12;
  const by = y + size * 0.28;
  const bw = size * 0.76;
  const bh = size * 0.4;
  ctx.fillStyle = "#111111";
  ctx.fillRect(bx, by + bh * 0.38, bw * 0.5, bh * 0.5);
  ctx.fillRect(bx + bw * 0.46, by + bh * 0.48, bw * 0.46, bh * 0.38);
  ctx.fillRect(bx + bw * 0.46, by + bh * 0.1, bw * 0.22, bh * 0.42);
  const wr = bh * 0.11;
  ctx.beginPath();
  ctx.arc(bx + bw * 0.16, by + bh * 0.95, wr, 0, Math.PI * 2);
  ctx.arc(bx + bw * 0.72, by + bh * 0.95, wr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export async function drawTallPlacement(ctx, p) {
  if (!p) return false;

  if (p.num != null) {
    const badge = await loadTallBadge(p.num);
    if (badge) {
      const w = p.w || p.size;
      const h = p.h || p.size;
      ctx.drawImage(badge, p.x, p.y, w, h);
      return true;
    }
  }

  if (p.kind === "priceTag" || p.id === "tall-sale") {
    drawPriceTag(ctx, p.x, p.y, p.size);
    return true;
  }
  if (p.kind === "curvedArrow" || p.id === "tall-arrow") {
    drawCurvedArrow(ctx, p.x, p.y, p.w, p.h);
    return true;
  }
  if (p.kind === "truckIcon" || p.id === "tall-ship") {
    drawDeliveryTruck(ctx, p.x, p.y, p.size);
    return true;
  }
  return false;
}
