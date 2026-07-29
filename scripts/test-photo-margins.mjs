/**
 * Per-side photo margins inset the draw slot; locked by default.
 */
import assert from "node:assert/strict";
import {
  clampPhotoMarginSide,
  productPhotoRect,
  snapshotPhotoControls,
} from "../app.suppliersden.com/js/lib/productPhotoFit.mjs";
import { updateFrameAppearance } from "../app.suppliersden.com/js/staticFrameCompose.mjs";

const frame = {
  basePx: 58,
  basePy: 58,
  baseDw: 657,
  baseDh: 978,
};

assert.deepEqual(productPhotoRect(frame), { x: 58, y: 58, w: 657, h: 978 }, "0 margin uses base slot");

const inset = {
  ...frame,
  photoMarginTop: 10,
  photoMarginLeft: 20,
  photoMarginRight: 30,
  photoMarginBottom: 40,
};
assert.deepEqual(productPhotoRect(inset), { x: 78, y: 68, w: 607, h: 928 }, "margins inset slot");

assert.equal(clampPhotoMarginSide(frame, "left", 999), 200, "left margin clamped to PHOTO_MARGIN_MAX");

const layers = { _staticFrame: { style: "gown_static", ...frame } };
updateFrameAppearance(layers, { photoMarginTop: 12, photoMarginRight: 8 });
assert.equal(layers._staticFrame.photoMarginTop, 12);
assert.equal(layers._staticFrame.photoMarginRight, 8);

const defaults = snapshotPhotoControls({});
assert.equal(defaults.photoMarginTop, 0);
assert.equal(defaults.photoMarginTopLocked, true);
assert.equal(defaults.photoMarginLeftLocked, true);

console.log("test-photo-margins.mjs: all passed");
