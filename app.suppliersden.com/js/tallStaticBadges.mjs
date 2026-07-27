/**
 * Tall promo badges — match reference frame #2 exactly.
 * badge3 = red scalloped seal (TL)
 * Procedural arrow TR → down toward model
 * badge1 = fast-delivery truck + motion lines (BL)
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

/** Knock out near-black PNG backgrounds so badges sit cleanly on white mat. */
function drawBadgeKnockout(ctx, img, x, y, w, h) {
  const tw = Math.max(1, Math.round(w));
  const th = Math.max(1, Math.round(h));
  const tmp = document.createElement("canvas");
  tmp.width = tw;
  tmp.height = th;
  const tc = tmp.getContext("2d");
  tc.drawImage(img, 0, 0, tw, th);
  try {
    const id = tc.getImageData(0, 0, tw, th);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 28 && d[i + 1] < 28 && d[i + 2] < 28) d[i + 3] = 0;
    }
    tc.putImageData(id, 0, 0);
  } catch (e) {
    /* tainted canvas — draw as-is */
  }
  ctx.drawImage(tmp, x, y, tw, th);
}

/** Red scalloped seal fallback (badge3). */
export function drawPriceTag(ctx, x, y, size) {
  const cx = x + size * 0.5;
  const cy = y + size * 0.58;
  const r = size * 0.32;
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, y + size * 0.02);
  ctx.lineTo(cx, cy - r - size * 0.02);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const scallop = r + (i % 2 === 0 ? r * 0.1 : 0);
    const px = cx + Math.cos(a) * scallop;
    const py = cy + Math.sin(a) * scallop;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#e53935";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.stroke();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.stroke();
  ctx.restore();
}

/** Top-right arrow — curves down toward the model (reference #2). */
export function drawCurvedArrow(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "#111111";
  ctx.lineWidth = Math.max(1.1, w * 0.024);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const x0 = x + w * 0.9;
  const y0 = y + h * 0.1;
  const x1 = x + w * 0.2;
  const y1 = y + h * 0.68;
  const cx = x + w * 0.72;
  const cy = y + h * 0.42;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  const angle = Math.atan2(y1 - cy, x1 - cx);
  const ah = Math.max(3.5, w * 0.1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ah * Math.cos(angle - 0.55), y1 - ah * Math.sin(angle - 0.55));
  ctx.lineTo(x1 - ah * Math.cos(angle + 0.55), y1 - ah * Math.sin(angle + 0.55));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Truck fallback with motion lines (reference bottom-left). */
export function drawDeliveryTruck(ctx, x, y, size) {
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "#111111";
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const ly = y + size * (0.38 + i * 0.12);
    ctx.beginPath();
    ctx.moveTo(x + size * 0.04, ly);
    ctx.lineTo(x + size * (0.22 - i * 0.04), ly);
    ctx.stroke();
  }
  const bx = x + size * 0.22;
  const by = y + size * 0.34;
  const bw = size * 0.68;
  const bh = size * 0.36;
  ctx.fillRect(bx, by + bh * 0.42, bw * 0.5, bh * 0.46);
  ctx.fillRect(bx + bw * 0.46, by + bh * 0.52, bw * 0.46, bh * 0.36);
  ctx.fillRect(bx + bw * 0.48, by + bh * 0.08, bw * 0.2, bh * 0.4);
  const wr = bh * 0.11;
  ctx.beginPath();
  ctx.arc(bx + bw * 0.16, by + bh * 0.94, wr, 0, Math.PI * 2);
  ctx.arc(bx + bw * 0.72, by + bh * 0.94, wr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export async function drawTallPlacement(ctx, p) {
  if (!p) return false;

  if (p.kind === "curvedArrow" || p.id === "tall-arrow") {
    drawCurvedArrow(ctx, p.x, p.y, p.w, p.h);
    return true;
  }

  if (p.num != null) {
    const badge = await loadTallBadge(p.num);
    if (badge) {
      const w = p.w || p.size;
      const h = p.h || p.size;
      drawBadgeKnockout(ctx, badge, p.x, p.y, w, h);
      return true;
    }
  }

  if (p.kind === "priceTag" || p.id === "tall-sale") {
    drawPriceTag(ctx, p.x, p.y, p.size);
    return true;
  }
  if (p.kind === "truckIcon" || p.id === "tall-ship") {
    drawDeliveryTruck(ctx, p.x, p.y, p.size);
    return true;
  }
  return false;
}
