/** Canvas helpers — trim, white background, Meesho frames. */

const WHITE_TOL = 18;

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function nearWhite(data, i) {
  return (
    255 - data[i] <= WHITE_TOL &&
    255 - data[i + 1] <= WHITE_TOL &&
    255 - data[i + 2] <= WHITE_TOL
  );
}

export function measureWhiteRatio(canvas) {
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  let w = 0;
  const n = canvas.width * canvas.height;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) w++;
  }
  return w / n;
}

export function measureNearWhiteRatio(canvas) {
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  let w = 0;
  const n = canvas.width * canvas.height;
  for (let i = 0; i < data.length; i += 4) if (nearWhite(data, i)) w++;
  return w / n;
}

export function flattenBackgroundWhite(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const total = width * height;
  const seen = new Uint8Array(total);
  const q = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const push = (idx) => {
    if (seen[idx] || !nearWhite(d, idx * 4)) return;
    seen[idx] = 1;
    q[tail++] = idx;
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (head < tail) {
    const idx = q[head++];
    const o = idx * 4;
    d[o] = d[o + 1] = d[o + 2] = 255;
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x > 0) push(idx - 1);
    if (x < width - 1) push(idx + 1);
    if (y > 0) push(idx - width);
    if (y < height - 1) push(idx + width);
  }
  ctx.putImageData(img, 0, 0);
}

function contentBounds(canvas) {
  const { width, height } = canvas;
  const { data } = canvas.getContext("2d").getImageData(0, 0, width, height);
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0,
    found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (nearWhite(data, i)) continue;
      found = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return found ? { minX, minY, maxX, maxY } : null;
}

export function trimMargins(canvas, pad = 0.03) {
  const b = contentBounds(canvas);
  if (!b) return canvas;
  const { width, height } = canvas;
  const px = Math.round(width * pad);
  const py = Math.round(height * pad);
  const x0 = Math.max(0, b.minX - px);
  const y0 = Math.max(0, b.minY - py);
  const x1 = Math.min(width - 1, b.maxX + px);
  const y1 = Math.min(height - 1, b.maxY + py);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
  return c;
}

export function imageToWhiteCanvas(img, maxSide = 2000) {
  let w = img.width;
  let h = img.height;
  const max = Math.max(w, h);
  if (max > maxSide) {
    const s = maxSide / max;
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  flattenBackgroundWhite(c);
  return c;
}

/** Meesho listing: product should occupy ~65–70% of square frame (smaller bounding box → lower slab). */
export const MEESHO_COMPACT_COVERAGE = 0.68;
/** Meesho recommends ≥1200×1200 px square primary images. */
export const MEESHO_SQUARE_SIDE = 1200;

export function fitSquare(img, side = 1024, coverage = MEESHO_COMPACT_COVERAGE) {
  const c = document.createElement("canvas");
  c.width = side;
  c.height = side;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, side, side);
  const scale = (side * coverage) / Math.max(img.width, img.height);
  const dw = Math.round(img.width * scale);
  const dh = Math.round(img.height * scale);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, img.width, img.height, (side - dw) / 2, (side - dh) / 2, dw, dh);
  return c;
}

function borderPx(w, h, maxSide = 1024, scale = 1) {
  const ref = Math.min(Math.max(w, h), maxSide);
  return Math.max(6, Math.round(ref * 0.018 * scale));
}

export function addFrame(canvas, options = {}) {
  const {
    borderColor = "#ff7900",
    maxSide = 1024,
    borderScale = 1,
    stickers = true,
    outerW = null,
    outerH = null,
  } = options;
  const src = canvas;
  let photoW = src.width;
  let photoH = src.height;
  const max = Math.max(photoW, photoH);
  if (max > maxSide) {
    const s = maxSide / max;
    photoW = Math.round(photoW * s);
    photoH = Math.round(photoH * s);
  }
  const border = borderPx(photoW, photoH, maxSide, borderScale);
  const fw = outerW ?? photoW + border * 2;
  const fh = outerH ?? photoH + border * 2;
  const innerW = fw - border * 2;
  const innerH = fh - border * 2;
  const c = document.createElement("canvas");
  c.width = fw;
  c.height = fh;
  const ctx = c.getContext("2d");
  ctx.fillStyle = borderColor;
  ctx.fillRect(0, 0, fw, fh);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, src.width, src.height, border, border, innerW, innerH);
  if (stickers) drawDeliverySticker(ctx, border, innerW, innerH);
  return c;
}

function drawDeliverySticker(ctx, border, innerW, innerH) {
  const pad = Math.max(8, Math.round(Math.min(innerW, innerH) * 0.02));
  const bw = Math.round(innerW * 0.42);
  const bh = Math.round(innerH * 0.055);
  const x = border + pad;
  const y = border + innerH - bh - pad;
  ctx.fillStyle = "#16a34a";
  roundRect(ctx, x, y, bw, bh, 6);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.max(10, Math.round(bh * 0.42))}px system-ui,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FREE DELIVERY", x + bw / 2, y + bh / 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** SupplierDen-style tall frame — 703×1024 with purple border. */
export function tallFrame(img, options = {}) {
  const outerW = 703;
  const outerH = 1024;
  const border = options.borderPx ?? 10;
  const borderColor = options.borderColor ?? "#7c3aed";
  const topM = 0.15;
  const bottomM = 0.05;
  const sideM = 0.1;
  const innerW = outerW - border * 2;
  const innerH = outerH - border * 2;
  const areaW = innerW * (1 - sideM * 2);
  const areaH = innerH * (1 - topM - bottomM);
  const trimmed = trimMargins(imageToWhiteCanvas(img), 0.02);
  const scale = Math.min(areaW / trimmed.width, areaH / trimmed.height);
  const dw = Math.round(trimmed.width * scale);
  const dh = Math.round(trimmed.height * scale);
  const c = document.createElement("canvas");
  c.width = outerW;
  c.height = outerH;
  const ctx = c.getContext("2d");
  ctx.fillStyle = borderColor;
  ctx.fillRect(0, 0, outerW, outerH);
  const ox = border + (innerW - dw) / 2;
  const oy = border + innerH * topM + (areaH - dh) / 2;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, ox, oy, dw, dh);
  drawDeliverySticker(ctx, border, innerW, innerH);
  return c;
}

export function isWideCollage(img) {
  return img.width / img.height >= 1.35;
}

export function splitCollagePanel(img, side = "left") {
  const mid = Math.floor(img.width / 2);
  const sx = side === "left" ? 0 : mid;
  const sw = side === "left" ? mid : img.width - mid;
  const c = document.createElement("canvas");
  c.width = sw;
  c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, sw, img.height);
  ctx.drawImage(img, sx, 0, sw, img.height, 0, 0, sw, img.height);
  return trimMargins(c, 0.02);
}

export function isStudioBackground(img) {
  const scale = Math.min(1, 280 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return measureNearWhiteRatio(c) >= 0.55;
}

export function isTallPortrait(img) {
  return img.height / img.width >= 1.2;
}
