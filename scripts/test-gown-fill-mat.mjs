/**
 * Gown fill mat: inner board between photo and border, separate from photo pad ring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  drawGownStaticFrameBackground,
  drawGownFillMatBoard,
  ensureGownDrawGeometry,
  resolveGownMatColors,
} from "../app.suppliersden.com/js/liveGownStatic.mjs";
import {
  ensureStaticPlacementMeta,
  resetStaticPlacements,
  updateFrameAppearance,
} from "../app.suppliersden.com/js/staticFrameCompose.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function mockCtx() {
  const fills = [];
  const rects = [];
  return {
    fills,
    rects,
    fillStyle: "",
    save() {},
    restore() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    set fillStyle(v) {
      this._fillStyle = v;
    },
    get fillStyle() {
      return this._fillStyle;
    },
    fillRect(x, y, w, h) {
      fills.push({ color: this._fillStyle, x, y, w, h });
      rects.push({ x, y, w, h });
    },
  };
}

const baseFrame = {
  outerW: 773,
  outerH: 1094,
  border: 19,
  whiteX: 19,
  whiteY: 19,
  whiteW: 735,
  whiteH: 1056,
  outerMatPad: 19,
  innerFrameX: 38,
  innerFrameY: 38,
  innerFrameW: 697,
  innerFrameH: 1018,
  innerMatPad: 17,
  px: 58,
  py: 58,
  dw: 657,
  dh: 978,
  borderColor: "#71cbd3",
  outerMatColor: "#ffffff",
  fillMatColor: "#eeeeee",
  padColor: "#dddddd",
  fillMatEnabled: true,
};

// fill mat and pad use different colors — fill mat owns board, pad only when fill mat off
{
  const ctx = mockCtx();
  drawGownStaticFrameBackground(ctx, { ...baseFrame, fillMatEnabled: false, fillMatColor: "#eeeeee", padColor: "#dddddd" });
  const fillRects = ctx.fills.filter((f) => f.color === "#eeeeee");
  const padRects = ctx.fills.filter((f) => f.color === "#dddddd");
  assert.equal(fillRects.length, 0, "fill mat skipped when disabled");
  assert.equal(padRects.length, 4, "photo pad draws when fill mat disabled");
}

// fill mat board paints full inner frame (photo composites on top in rebuild)
{
  const ctx = mockCtx();
  drawGownFillMatBoard(ctx, baseFrame, "#ff00ff");
  const fills = ctx.fills.filter((f) => f.color === "#ff00ff");
  assert.equal(fills.length, 1, "fill mat paints full inner board");
  assert.equal(fills[0].w, 697, "fill mat spans inner frame width");
}

// fill mat disabled skips inner board fill
{
  const ctx = mockCtx();
  drawGownStaticFrameBackground(ctx, { ...baseFrame, fillMatEnabled: false });
  const fillRects = ctx.fills.filter((f) => f.color === "#eeeeee");
  assert.equal(fillRects.length, 0, "disabled fill mat skips inner board");
}

// legacy frames without fillMatColor fall back to padColor
{
  const colors = resolveGownMatColors({ matColor: "#ffffff", padColor: "#fafafa" });
  assert.equal(colors.fillMatColor, "#fafafa");
  assert.equal(colors.fillMatEnabled, true);
}

// snapshot + reset keeps fill mat settings
{
  const layers = {
    full: "data:image/jpeg;base64,abc",
    _badgePlacements: [{ id: "gown-best", kind: "gownArt", gownSlot: "gown-best", x: 10, y: 10, w: 100, h: 70 }],
    _staticFrame: {
      style: "gown_static",
      ...baseFrame,
      basePx: 58,
      basePy: 58,
      baseDw: 657,
      baseDh: 978,
      baseBorder: 19,
      baseOuterMatPad: 19,
      baseInnerMatPad: 17,
      gownLayerPct: { border: 100, outerMat: 100, innerMat: 100 },
    },
  };
  ensureStaticPlacementMeta(layers, "gown_static");
  assert.equal(layers._staticDefaults?.frame?.fillMatColor, "#eeeeee");
  updateFrameAppearance(layers, {
    fillMatColor: "#ff00ff",
    fillMatEnabled: false,
    padColor: "#00ff00",
  });
  resetStaticPlacements(layers);
  assert.equal(layers._staticFrame.fillMatColor, "#eeeeee");
  assert.equal(layers._staticFrame.fillMatEnabled, true);
  assert.equal(layers._staticFrame.padColor, "#dddddd");
}

const contentCode = readFileSync(resolve(root, "app.suppliersden.com/content.js"), "utf8");
const gownCode = readFileSync(resolve(root, "app.suppliersden.com/js/liveGownStatic.mjs"), "utf8");
assert(contentCode.includes("static-fill-mat-enabled"), "editor has fill mat toggle");
assert(contentCode.includes("static-color-fill-mat"), "editor has fill mat color row");
assert(gownCode.includes("drawGownFillMatBoard"), "gown draws fill mat board around photo");

console.log("test-gown-fill-mat.mjs: all passed");
