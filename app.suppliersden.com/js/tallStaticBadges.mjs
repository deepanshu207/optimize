/**
 * Procedural badges for tall static promo — matches reference frame exactly.
 */

/** Red scalloped price tag + diagonal hanging string (top-left of white mat). */
export function drawPriceTag(ctx, x, y, size) {
  const cx = x + size * 0.52;
  const cy = y + size * 0.58;
  const r = size * 0.36;
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1.2, size * 0.022);
  ctx.lineCap = "round";
  // Diagonal string from upper-left corner toward tag
  ctx.beginPath();
  ctx.moveTo(x + size * 0.02, y + size * 0.02);
  ctx.lineTo(cx - r * 0.15, cy - r * 0.92);
  ctx.stroke();
  // Scalloped red tag
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
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1.4, size * 0.028);
  ctx.stroke();
  ctx.restore();
}

/** Thin curved arrow from top-right corner pointing toward model (top-right). */
export function drawCurvedArrow(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "#111111";
  ctx.lineWidth = Math.max(1.5, w * 0.035);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const x0 = x + w * 0.98;
  const y0 = y + h * 0.05;
  const x1 = x + w * 0.18;
  const y1 = y + h * 0.72;
  const cx = x + w * 0.82;
  const cy = y + h * 0.38;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  const angle = Math.atan2(y1 - cy, x1 - cx);
  const ah = Math.max(5, w * 0.14);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x1 - ah * Math.cos(angle - 0.5),
    y1 - ah * Math.sin(angle - 0.5),
  );
  ctx.lineTo(
    x1 - ah * Math.cos(angle + 0.5),
    y1 - ah * Math.sin(angle + 0.5),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Small B&W delivery truck with speed lines (bottom-left of white mat). */
export function drawDeliveryTruck(ctx, x, y, size) {
  ctx.save();
  const bx = x + size * 0.22;
  const by = y + size * 0.32;
  const bw = size * 0.62;
  const bh = size * 0.38;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1.2, size * 0.035);
  ctx.fillRect(bx, by + bh * 0.38, bw * 0.55, bh * 0.5);
  ctx.strokeRect(bx, by + bh * 0.38, bw * 0.55, bh * 0.5);
  ctx.fillRect(bx + bw * 0.5, by + bh * 0.5, bw * 0.42, bh * 0.38);
  ctx.strokeRect(bx + bw * 0.5, by + bh * 0.5, bw * 0.42, bh * 0.38);
  ctx.fillStyle = "#111111";
  const wr = bh * 0.13;
  ctx.beginPath();
  ctx.arc(bx + bw * 0.2, by + bh * 0.95, wr, 0, Math.PI * 2);
  ctx.arc(bx + bw * 0.72, by + bh * 0.95, wr, 0, Math.PI * 2);
  ctx.fill();
  // Speed lines left of truck
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = Math.max(1, size * 0.02);
  for (let i = 0; i < 3; i++) {
    const lx = x + size * 0.04 + i * size * 0.06;
    ctx.beginPath();
    ctx.moveTo(lx, y + size * 0.42 + i * size * 0.04);
    ctx.lineTo(lx - size * 0.05, y + size * 0.52 + i * size * 0.04);
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
