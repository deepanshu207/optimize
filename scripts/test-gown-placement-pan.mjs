/**
 * Gown H/V placement must not snap back after slider move + compose.
 * Photo pan offsets apply when zoomed in.
 */
import assert from "node:assert/strict";
import {
  applyPositionToPlacement,
  ensureStaticPlacementMeta,
  updatePlacementSliderAxis,
  updateFrameAppearance,
} from "../app.suppliersden.com/js/staticFrameCompose.mjs";
import {
  drawGownPhotoInFixedRect,
  gownFixedPhotoRect,
} from "../app.suppliersden.com/js/liveGownStatic.mjs";

function mockGownLayers() {
  const frame = {
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
  };
  const placement = {
    id: "gown-best",
    kind: "gownArt",
    gownSlot: "gown-best",
    anchor: "top-left",
    w: 236,
    h: 165,
    lockH: false,
    lockV: false,
    drawn: true,
  };
  return {
    _staticFrame: frame,
    _badgePlacements: [placement],
    full: "data:,",
  };
}

// H/V slider move persists through compose-style re-apply
{
  const layers = mockGownLayers();
  ensureStaticPlacementMeta(layers, "gown_static");
  const p = layers._badgePlacements[0];
  const beforeY = p.y;

  const ok = updatePlacementSliderAxis(layers, "gown-best", "v", 72);
  assert.equal(ok, true);
  assert.notEqual(p.y, beforeY, "vertical slider should move gown art");
  assert.equal(p.posV, 72);

  // Simulate compose loop re-applying position
  applyPositionToPlacement(p, layers._staticFrame);
  assert.equal(p.posV, 72, "posV must not snap back after compose re-apply");
  assert.equal(p.y, applyPositionToPlacement({ ...p }, layers._staticFrame).y);
}

// autoLock would re-lock and snap gown art — verify unlocked axes keep slider coords
{
  const layers = mockGownLayers();
  ensureStaticPlacementMeta(layers, "gown_static");
  const p = layers._badgePlacements[0];
  updatePlacementSliderAxis(layers, "gown-best", "h", 35);
  const savedX = p.x;
  applyPositionToPlacement(p, layers._staticFrame);
  assert.equal(p.posH, 35);
  assert.equal(p.x, savedX);
}

// Photo pan shifts draw rect when zoomed in
{
  const frame = {
    px: 10,
    py: 20,
    baseDw: 200,
    baseDh: 300,
    photoZoomPct: 150,
    photoPanH: 0,
    photoPanV: 100,
  };
  const productImg = { width: 400, height: 600 };
  const rect = gownFixedPhotoRect(frame);
  assert.deepEqual(rect, { x: 10, y: 20, w: 200, h: 300 });

  const calls = [];
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    drawImage(_img, _sx, _sy, _sw, _sh, dx, dy, dw, dh) {
      calls.push({ dx, dy, dw, dh });
    },
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
  };

  drawGownPhotoInFixedRect(ctx, productImg, frame);
  assert.equal(calls.length, 1);
  const centered = { ...frame, photoPanH: 50, photoPanV: 50 };
  const callsCenter = [];
  const ctx2 = {
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    drawImage(_img, _sx, _sy, _sw, _sh, dx, dy) {
      callsCenter.push({ dx, dy });
    },
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
  };
  drawGownPhotoInFixedRect(ctx2, productImg, centered);
  assert.notEqual(calls[0].dx, callsCenter[0].dx, "pan H=0 should differ from center");
  assert.notEqual(calls[0].dy, callsCenter[0].dy, "pan V=100 should differ from center");
}

// updateFrameAppearance stores pan values
{
  const layers = mockGownLayers();
  updateFrameAppearance(layers, { photoPanH: 12, photoPanV: 88, photoZoomPct: 120 });
  assert.equal(layers._staticFrame.photoPanH, 12);
  assert.equal(layers._staticFrame.photoPanV, 88);
  assert.equal(layers._staticFrame.photoZoomPct, 120);
}

// placement meta init runs once
{
  const layers = mockGownLayers();
  ensureStaticPlacementMeta(layers, "gown_static");
  layers._badgePlacements[0].lockH = true;
  ensureStaticPlacementMeta(layers, "gown_static");
  assert.equal(
    layers._badgePlacements[0].lockH,
    true,
    "second meta call must not reset locks",
  );
}

console.log("test-gown-placement-pan.mjs: all passed");
