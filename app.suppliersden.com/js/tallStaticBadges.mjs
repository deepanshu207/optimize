/**
 * Procedural badges for tall static promo — matches competitor reference:
 * red scalloped price tag, curved arrow, B&W delivery truck.
 */

/** Red scalloped price tag with hanging string (top-left). */
export function drawPriceTag(ctx, x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2 + size * 0.06;
  const r = size * 0.38;
  ctx.save();
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = Math.max(1.5, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(cx, y + size * 0.04);
  ctx.lineTo(cx, cy - r);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const scallop = r + (i % 2 === 0 ? r * 0.08 : 0);
    const px = cx + Math.cos(a) * scallop;
    const py = cy + Math.sin(a) * scallop;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#e53935";
  ctx.fill();
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = Math.max(1.5, size * 0.03);
  ctx.stroke();
  ctx.restore();
}

/** Thin curved arrow pointing inward (top-right). */
export function drawCurvedArrow(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "#1a1a1a";
  ctx.fillStyle = "#1a1a1a";
  ctx.lineWidth = Math.max(2, Math.round(w * 0.06));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const x0 = x + w * 0.92;
  const y0 = y + h * 0.08;
  const x1 = x + w * 0.35;
  const y1 = y + h * 0.55;
  const cx = x + w * 0.78;
  const cy = y + h * 0.42;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  const angle = Math.atan2(y1 - cy, x1 - cx);
  const ah = Math.max(6, w * 0.18);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x1 - ah * Math.cos(angle - 0.45),
    y1 - ah * Math.sin(angle - 0.45),
  );
  ctx.lineTo(
    x1 - ah * Math.cos(angle + 0.45),
    y1 - ah * Math.sin(angle + 0.45),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Simple black & white delivery truck (bottom-left). */
export function drawDeliveryTruck(ctx, x, y, size) {
  const pad = size * 0.08;
  const bx = x + pad;
  const by = y + size * 0.28;
  const bw = size - pad * 2;
  const bh = size * 0.42;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = Math.max(1.5, size * 0.04);
  ctx.fillRect(bx, by + bh * 0.35, bw * 0.58, bh * 0.55);
  ctx.strokeRect(bx, by + bh * 0.35, bw * 0.58, bh * 0.55);
  ctx.fillRect(bx + bw * 0.54, by + bh * 0.48, bw * 0.4, bh * 0.42);
  ctx.strokeRect(bx + bw * 0.54, by + bh * 0.48, bw * 0.4, bh * 0.42);
  const wheelR = bh * 0.14;
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(bx + bw * 0.22, by + bh * 0.95, wheelR, 0, Math.PI * 2);
  ctx.arc(bx + bw * 0.76, by + bh * 0.95, wheelR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const lx = bx - size * 0.12 + i * size * 0.07;
    ctx.beginPath();
    ctx.moveTo(lx, by + bh * 0.15);
    ctx.lineTo(lx - size * 0.05, by + bh * 0.32);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTallPlacement(ctx, p) {
  if (!p) return;
  if (p.kind === "priceTag") {
    drawPriceTag(ctx, p.x, p.y, p.size);
  } else if (p.kind === "curvedArrow") {
    drawCurvedArrow(ctx, p.x, p.y, p.w, p.h);
  } else if (p.kind === "truckIcon") {
    drawDeliveryTruck(ctx, p.x, p.y, p.size);
  }
}
