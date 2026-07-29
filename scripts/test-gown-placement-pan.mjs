/**
 * Gown H/V placement must not snap back after slider move + compose.
 * Photo pan offsets apply when zoomed in.
 */
import assert from "node:assert/strict";
import {
  computeProductPhotoDrawRect,
  drawProductPhotoCoverFit,
  frameHasProductSlot,
  photoAnchorRect,
  photoContentLayout,
  photoStickerScale,
  productPhotoRect,
} from "../app.suppliersden.com/js/lib/productPhotoFit.mjs";
import {
  applyPositionToPlacement,
  ensureStaticPlacementMeta,
  gownPlacementPosition,
  updatePlacementSliderAxis,
  updateFrameAppearance,
} from "../app.suppliersden.com/js/staticFrameCompose.mjs";

function placementSizeForTest(p, frame) {
  const pct = (p.sizePct ?? 100) / 100;
  let w = Math.max(8, Math.round((p.defaultW ?? p.w ?? 48) * pct));
  let h = Math.max(8, Math.round((p.defaultH ?? p.h ?? w) * pct));
  if (frame && p.kind === "gownArt" && p.lockSize !== false) {
    const z = photoStickerScale(frame);
    w = Math.max(8, Math.round(w * z));
    h = Math.max(8, Math.round(h * z));
  }
  return { w, h };
}

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
  const rect = productPhotoRect(frame);
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

  drawProductPhotoCoverFit(ctx, productImg, frame);
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
  drawProductPhotoCoverFit(ctx2, productImg, centered);
  assert.notEqual(calls[0].dx, callsCenter[0].dx, "pan H=0 should differ from center");
  assert.notEqual(calls[0].dy, callsCenter[0].dy, "pan V=100 should differ from center");
}

// Zoom out centers photo at pan 50 (not top-left)
{
  const frame = {
    px: 58,
    py: 58,
    baseDw: 657,
    baseDh: 978,
    photoZoomPct: 70,
    photoPanH: 50,
    photoPanV: 50,
  };
  const productImg = { width: 800, height: 1200 };
  const rect = computeProductPhotoDrawRect(productImg, frame);
  assert.ok(rect, "draw rect computed");
  const centerX = rect.x + Math.round((rect.w - rect.sw) / 2);
  const centerY = rect.y + Math.round((rect.h - rect.sh) / 2);
  assert.equal(rect.imgX, centerX, "zoom out centers horizontally at pan 50");
  assert.equal(rect.imgY, centerY, "zoom out centers vertically at pan 50");

  const left = computeProductPhotoDrawRect(productImg, { ...frame, photoPanH: 0, photoPanV: 0 });
  assert.equal(left.imgX, rect.x, "zoom out pan H=0 aligns left");
  assert.equal(left.imgY, rect.y, "zoom out pan V=0 aligns top");

  const right = computeProductPhotoDrawRect(productImg, { ...frame, photoPanH: 100, photoPanV: 100 });
  assert.equal(right.imgX, rect.x + rect.w - rect.sw, "zoom out pan H=100 aligns right");
  assert.equal(right.imgY, rect.y + rect.h - rect.sh, "zoom out pan V=100 aligns bottom");
}

// Zoom 100 cover-fit stays pinned at pan 50 when one axis fills exactly
{
  const frame = {
    px: 10,
    py: 20,
    baseDw: 200,
    baseDh: 300,
    photoZoomPct: 100,
    photoPanH: 50,
    photoPanV: 50,
  };
  const productImg = { width: 400, height: 600 };
  const rect = computeProductPhotoDrawRect(productImg, frame);
  assert.equal(rect.sw, 200, "cover-fit width fills slot at 100%");
  assert.equal(rect.sh, 300, "cover-fit height fills slot at 100%");
  assert.equal(rect.imgX, 10, "100% zoom x at slot origin");
  assert.equal(rect.imgY, 20, "100% zoom y at slot origin");
}

// updateFrameAppearance stores pan values
{
  const layers = mockGownLayers();
  updateFrameAppearance(layers, { photoPanH: 12, photoPanV: 88, photoZoomPct: 120 });
  assert.equal(layers._staticFrame.photoPanH, 12);
  assert.equal(layers._staticFrame.photoPanV, 88);
  assert.equal(layers._staticFrame.photoZoomPct, 120);
}

// gown art stickers follow visible photo when zoomed out (letterboxed)
{
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
  const w = 200;
  const h = 140;
  const at100 = gownPlacementPosition("gown-best", frame, w, h);
  frame.photoZoomPct = 89;
  const at89 = gownPlacementPosition("gown-best", frame, w, h);
  assert(at89.x > at100.x, "zoom out moves top-left sticker inward on X");
  assert(at89.y > at100.y, "zoom out moves top-left sticker inward on Y");

  const flash100 = gownPlacementPosition("gown-flash", frame, w, 80);
  frame.photoZoomPct = 100;
  const flashAt100 = gownPlacementPosition("gown-flash", frame, w, 80);
  frame.photoZoomPct = 89;
  const flashAt89 = gownPlacementPosition("gown-flash", frame, w, 80);
  assert(flashAt89.x < flashAt100.x, "zoom out moves top-right sticker inward");

  const anchor = photoAnchorRect(frame);
  assert(anchor.w < 657, "letterboxed anchor is narrower than slot");
}

// locked gown art re-anchors on compose when zoom changes
{
  const layers = mockGownLayers();
  ensureStaticPlacementMeta(layers, "gown_static");
  const p = layers._badgePlacements[0];
  p.lockH = true;
  p.lockV = true;
  const yAt100 = gownPlacementPosition("gown-best", layers._staticFrame, p.w, p.h).y;
  updateFrameAppearance(layers, { photoZoomPct: 89 });
  applyPositionToPlacement(p, layers._staticFrame);
  assert(p.y > yAt100, "compose re-apply moves locked gown art with zoom out");
}

// photo sticker scale tracks zoom in and out
{
  const base = {
    px: 58,
    py: 58,
    dw: 657,
    dh: 978,
    basePx: 58,
    basePy: 58,
    baseDw: 657,
    baseDh: 978,
    photoPanH: 50,
    photoPanV: 50,
  };
  assert(Math.abs(photoStickerScale({ ...base, photoZoomPct: 100 }) - 1) < 0.01);
  assert(photoStickerScale({ ...base, photoZoomPct: 89 }) < 1, "zoom out scale below 1");
  assert(photoStickerScale({ ...base, photoZoomPct: 130 }) > 1, "zoom in scale above 1");
  assert.equal(photoStickerScale({ ...base, photoZoomPct: 130 }), 1.3);
}

// locked gown art size scales with zoom; unlocked size does not
{
  const base = {
    px: 58,
    py: 58,
    dw: 657,
    dh: 978,
    basePx: 58,
    basePy: 58,
    baseDw: 657,
    baseDh: 978,
    photoPanH: 50,
    photoPanV: 50,
  };
  const frame = { ...base, photoZoomPct: 89 };
  const p = {
    id: "gown-best",
    kind: "gownArt",
    defaultW: 200,
    defaultH: 140,
    sizePct: 100,
    lockSize: true,
  };
  const at89 = placementSizeForTest(p, frame);
  frame.photoZoomPct = 100;
  const at100 = placementSizeForTest(p, frame);
  frame.photoZoomPct = 130;
  const at130 = placementSizeForTest(p, frame);
  assert(at89.w < at100.w, "zoom out shrinks locked gown art");
  assert(at130.w > at100.w, "zoom in enlarges locked gown art");
  assert.equal(at100.w, 200);
  p.lockSize = false;
  frame.photoZoomPct = 89;
  assert.equal(placementSizeForTest(p, frame).w, 200, "unlocked size ignores zoom");
}

// zoom in keeps stickers on slot while scaling (cover-crop)
{
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
  const w = 200;
  const h = 140;
  const at100 = gownPlacementPosition("gown-best", frame, w, h);
  frame.photoZoomPct = 140;
  const wBig = Math.round(w * 1.4);
  const hBig = Math.round(h * 1.4);
  const at140 = gownPlacementPosition("gown-best", frame, wBig, hBig);
  assert.equal(at140.x, at100.x, "zoom in keeps top-left anchor on slot");
  assert.equal(at140.y, at100.y, "zoom in keeps top-left anchor on slot");
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

// all placement axes locked by default
{
  const layers = mockGownLayers();
  delete layers._badgePlacements[0].lockH;
  delete layers._badgePlacements[0].lockV;
  delete layers._badgePlacements[0].lockSize;
  ensureStaticPlacementMeta(layers, "gown_static");
  const p = layers._badgePlacements[0];
  assert.equal(p.lockH, true, "lockH defaults true");
  assert.equal(p.lockV, true, "lockV defaults true");
  assert.equal(p.lockSize, true, "lockSize defaults true");
}

console.log("test-gown-placement-pan.mjs: all passed");
