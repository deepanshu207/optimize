/**
 * Photo margin changes must re-anchor locked stickers to the photo slot.
 */
import assert from "node:assert/strict";
import {
  photoSlotScale,
  photoStickerScale,
  productPhotoRect,
} from "../app.suppliersden.com/js/lib/productPhotoFit.mjs";
import {
  applyPositionToPlacement,
  reanchorPlacements,
} from "../app.suppliersden.com/js/staticFrameCompose.mjs";

const baseFrame = {
  style: "gown_static",
  outerW: 773,
  outerH: 1094,
  px: 58,
  py: 58,
  dw: 657,
  dh: 978,
  basePx: 58,
  basePy: 58,
  baseDw: 657,
  baseDh: 978,
  photoZoomPct: 100,
  photoPanH: 50,
  photoPanV: 50,
  photoMarginTop: 0,
  photoMarginRight: 0,
  photoMarginBottom: 0,
  photoMarginLeft: 0,
};

const placement = {
  id: "tall-sale",
  kind: "badge",
  anchor: "top-left",
  lockH: true,
  lockV: true,
  lockSize: true,
  defaultSize: 80,
  posH: 8,
  posV: 6,
};

const layers = {
  _staticFrame: { ...baseFrame },
  _badgePlacements: [{ ...placement }],
};

applyPositionToPlacement(layers._badgePlacements[0], layers._staticFrame);
const x0 = layers._badgePlacements[0].x;
const y0 = layers._badgePlacements[0].y;
const size0 = layers._badgePlacements[0].w || 80;

layers._staticFrame.photoMarginLeft = 85;
layers._staticFrame.photoMarginRight = 85;
layers._staticFrame.photoMarginBottom = 89;
reanchorPlacements(layers);

const p = layers._badgePlacements[0];
assert.equal(p.x, x0 + 85, "left margin shifts top-left sticker right");
assert(p.y >= y0, "bottom margin keeps sticker vertically aligned to photo top");

// Compose path uses applyPositionToPlacement — stale posH/posV must not undo reanchor
applyPositionToPlacement(p, layers._staticFrame);
assert.equal(p.x, x0 + 85, "compose apply respects photo anchor after margin change");

assert(
  photoSlotScale(layers._staticFrame) < 1,
  "margins shrink photo slot scale",
);
assert(
  photoStickerScale(layers._staticFrame) < photoStickerScale(baseFrame),
  "sticker scale shrinks with margin inset",
);

// live_framed variant
const liveFrame = {
  style: "live_framed",
  outerW: 800,
  outerH: 1000,
  basePx: 40,
  basePy: 40,
  baseDw: 720,
  baseDh: 920,
  px: 40,
  py: 40,
  dw: 720,
  dh: 920,
  photoMarginTop: 0,
  photoMarginLeft: 0,
};
const liveP = {
  anchor: "top-right",
  lockH: true,
  lockV: true,
  defaultSize: 72,
  posH: 90,
  posV: 5,
};
applyPositionToPlacement(liveP, liveFrame);
const liveX0 = liveP.x;
liveFrame.photoMarginRight = 60;
applyPositionToPlacement(liveP, liveFrame);
assert(liveP.x < liveX0, "right margin pulls top-right sticker left");

assert.deepEqual(
  productPhotoRect({
    ...baseFrame,
    photoMarginLeft: 20,
    photoMarginTop: 10,
  }),
  { x: 78, y: 68, w: 637, h: 968 },
);

console.log("test-margin-sticker-reanchor.mjs: all passed");
