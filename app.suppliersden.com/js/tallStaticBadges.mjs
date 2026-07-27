/**
 * Tall promo — procedural fallbacks for arrow & truck when PNGs fail.
 * PNG badges load via MeeshoAPI.loadBadge (same as lifestyle/showcase).
 */

/** Top-right arrow — curves down toward the model (reference). */
export function drawCurvedArrow(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "#111111";
  ctx.lineWidth = Math.max(1.4, w * 0.028);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const x0 = x + w * 0.9;
  const y0 = y + h * 0.1;
  const x1 = x + w * 0.18;
  const y1 = y + h * 0.7;
  const cx = x + w * 0.72;
  const cy = y + h * 0.4;
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

/** Truck + motion lines fallback (badge1). */
export function drawDeliveryTruck(ctx, x, y, size) {
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "#111111";
  ctx.lineWidth = Math.max(1.2, size * 0.04);
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
