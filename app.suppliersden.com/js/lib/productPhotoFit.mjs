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

export function frameHasProductSlot(frame) {
  const { w, h } = productPhotoRect(frame);
  return w > 0 && h > 0;
}

/** Cover-fit into fixed photo rect; zoom scales inside clip without resizing the box. */
export function drawProductPhotoCoverFit(ctx, productImg, frame) {
  const { x, y, w, h } = productPhotoRect(frame);
  if (w <= 0 || h <= 0 || !productImg?.width) return;

  const zoom = clampPhotoZoom(frame?.photoZoomPct) / 100;
  const fitScale = Math.max(w / productImg.width, h / productImg.height) * zoom;
  const sw = Math.round(productImg.width * fitScale);
  const sh = Math.round(productImg.height * fitScale);
  const maxPanX = Math.max(0, sw - w);
  const maxPanY = Math.max(0, sh - h);
  const panH = Math.max(0, Math.min(100, frame?.photoPanH ?? 50));
  const panV = Math.max(0, Math.min(100, frame?.photoPanV ?? 50));
  const imgX = x - Math.round(maxPanX * (panH / 100));
  const imgY = y - Math.round(maxPanY * (panV / 100));

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(productImg, 0, 0, productImg.width, productImg.height, imgX, imgY, sw, sh);
  ctx.restore();
}
