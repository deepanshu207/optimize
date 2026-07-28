/** Cover-fit lifestyle photo in a fixed rect with optional zoom + pan. */

export const PHOTO_ZOOM_DEFAULT = 100;
export const PHOTO_ZOOM_MIN = 50;
export const PHOTO_ZOOM_MAX = 200;

export function clampPhotoZoom(pct) {
  return Math.max(PHOTO_ZOOM_MIN, Math.min(PHOTO_ZOOM_MAX, pct ?? PHOTO_ZOOM_DEFAULT));
}

export function productPhotoRect(frame) {
  const w = frame?.baseDw ?? frame?.dw ?? 0;
  const h = frame?.baseDh ?? frame?.dh ?? 0;
  return {
    x: frame?.px ?? frame?.basePx ?? 0,
    y: frame?.py ?? frame?.basePy ?? 0,
    w,
    h,
  };
}

/** Cover-fit draw rect: zooms from center; pan 50 = centered in each axis. */
export function computeProductPhotoDrawRect(productImg, frame) {
  const { x, y, w, h } = productPhotoRect(frame);
  if (w <= 0 || h <= 0 || !productImg?.width) return null;

  const zoom = clampPhotoZoom(frame?.photoZoomPct) / 100;
  const fitScale = Math.max(w / productImg.width, h / productImg.height) * zoom;
  const sw = Math.round(productImg.width * fitScale);
  const sh = Math.round(productImg.height * fitScale);
  const panH = Math.max(0, Math.min(100, frame?.photoPanH ?? 50));
  const panV = Math.max(0, Math.min(100, frame?.photoPanV ?? 50));

  let imgX;
  if (sw >= w) {
    const maxPanX = sw - w;
    imgX = x - Math.round(maxPanX * (panH / 100));
  } else {
    const slackX = w - sw;
    imgX = x + Math.round(slackX * (panH / 100));
  }

  let imgY;
  if (sh >= h) {
    const maxPanY = sh - h;
    imgY = y - Math.round(maxPanY * (panV / 100));
  } else {
    const slackY = h - sh;
    imgY = y + Math.round(slackY * (panV / 100));
  }

  return { x, y, w, h, imgX, imgY, sw, sh };
}

export function drawProductPhotoCoverFit(ctx, productImg, frame) {
  const rect = computeProductPhotoDrawRect(productImg, frame);
  if (!rect) return;
  const { x, y, w, h, imgX, imgY, sw, sh } = rect;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(productImg, 0, 0, productImg.width, productImg.height, imgX, imgY, sw, sh);
  ctx.restore();
}

export function frameHasProductSlot(frame) {
  const { w, h } = productPhotoRect(frame);
  return w > 0 && h > 0;
}

/** Default locked photo zoom/pan on any frame with a product slot. */
export function ensureFramePhotoDefaults(frame) {
  if (!frameHasProductSlot(frame)) return frame;
  if (frame.photoZoomPct == null) frame.photoZoomPct = PHOTO_ZOOM_DEFAULT;
  if (frame.photoPanH == null) frame.photoPanH = 50;
  if (frame.photoPanV == null) frame.photoPanV = 50;
  if (frame.photoZoomLocked == null) frame.photoZoomLocked = true;
  if (frame.photoPanHLocked == null) frame.photoPanHLocked = true;
  if (frame.photoPanVLocked == null) frame.photoPanVLocked = true;
  return frame;
}
