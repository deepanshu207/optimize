/**
 * Gown mat colors: preview must rebuild (not baked noStickers) when colors change.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  drawGownStaticFrameBackground,
  resolveGownMatColors,
} from "../app.suppliersden.com/js/liveGownStatic.mjs";
import {
  shouldRebuildStaticFrame,
  updateFrameAppearance,
  ensureGownRebuildUrls,
} from "../app.suppliersden.com/js/staticFrameCompose.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function mockCtx() {
  const fills = [];
  return {
    fills,
    fillStyle: "",
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
  basePx: 58,
  basePy: 58,
  baseDw: 657,
  baseDh: 978,
  borderColor: "#71cbd3",
  outerMatColor: "#ffffff",
  fillMatColor: "#ffffff",
  padColor: "#ffffff",
  fillMatEnabled: true,
};

// matching fill mat + pad skips pad ring (fill mat owns the inner board)
{
  const ctx = mockCtx();
  drawGownStaticFrameBackground(ctx, baseFrame);
  const fillRects = ctx.fills.filter((f) => f.color === "#ffffff");
  const padRects = fillRects.filter((f) => f.h === 17 || f.w === 17);
  assert.ok(fillRects.length >= 2, "fill mat paints inner board");
  assert.equal(padRects.length, 0, "pad ring skipped when fill mat enabled");
}

// fill mat disabled uses photo pad ring
{
  const ctx = mockCtx();
  drawGownStaticFrameBackground(ctx, { ...baseFrame, fillMatEnabled: false, padColor: "#dddddd" });
  const padRects = ctx.fills.filter((f) => f.color === "#dddddd");
  assert.equal(padRects.length, 4, "photo pad draws when fill mat disabled");
}

// purple fill mat paints full inner board when enabled
{
  const ctx = mockCtx();
  drawGownStaticFrameBackground(ctx, { ...baseFrame, fillMatColor: "#7c3aed", padColor: "#ffffff" });
  const fillRects = ctx.fills.filter((f) => f.color === "#7c3aed");
  assert.equal(fillRects.length, 1, "purple fill mat paints inner board");
  assert.equal(fillRects[0].w, 697, "fill mat spans inner frame");
}

// appearance edits rebuild even when only full layer is present
{
  const layers = {
    full: "data:image/jpeg;base64,/9j/4AAQ",
    _staticFrame: { style: "gown_static", outerW: 773, outerH: 1094, ...baseFrame },
    _badgePlacements: [{ id: "gown-best", kind: "gownArt", drawn: true }],
  };
  assert.equal(
    shouldRebuildStaticFrame(layers, { staticAppearanceEdited: false }),
    false,
    "no rebuild without edits",
  );
  updateFrameAppearance(layers, { outerMatColor: "#ff00ff" });
  assert.equal(
    shouldRebuildStaticFrame(layers, { staticAppearanceEdited: true }),
    true,
    "appearance edit rebuilds from full layer when needed",
  );
}

// gown photo source restored from defaults snapshot
{
  const layers = {
    full: "data:image/jpeg;base64,abc",
    _staticFrame: { style: "gown_static", outerW: 773, outerH: 1094, ...baseFrame },
    _staticDefaults: {
      frame: resolveGownMatColors(baseFrame),
      urls: { gownPhotoSource: "data:image/jpeg;base64,gownsrc" },
    },
    _badgePlacements: [],
  };
  assert.equal(
    shouldRebuildStaticFrame(layers, { staticAppearanceEdited: true }),
    true,
    "defaults gown photo source counts as rebuild input",
  );
}

// display url fallback enables rebuild when layer blobs were stripped
{
  const layers = {
    _staticFrame: { style: "gown_static", outerW: 773, outerH: 1094, ...baseFrame },
    _badgePlacements: [],
  };
  ensureGownRebuildUrls(layers, "data:image/jpeg;base64,display");
  assert.equal(
    shouldRebuildStaticFrame(layers, { staticAppearanceEdited: true }),
    true,
    "compose fallback url counts as rebuild source",
  );
}

// tall_static appearance edits rebuild preview like gown
{
  const layers = {
    full: "data:image/jpeg;base64,tall",
    noStickers: "data:image/jpeg;base64,tallns",
    productOnly: "data:image/jpeg;base64,tallprod",
    _staticFrame: {
      style: "tall_static",
      frameType: "tall",
      outerW: 703,
      outerH: 1024,
      border: 40,
      px: 80,
      py: 80,
      dw: 543,
      dh: 864,
      basePx: 80,
      basePy: 80,
      baseDw: 543,
      baseDh: 864,
      baseBorder: 40,
      borderColor: "#45a9e5",
      matColor: "#ffffff",
      borderThicknessPct: 100,
    },
    _badgePlacements: [{ id: "tall-sale", num: 1, x: 10, y: 10, w: 80, h: 80 }],
  };
  updateFrameAppearance(layers, { matColor: "#ffee00" });
  assert.equal(
    shouldRebuildStaticFrame(layers, { staticAppearanceEdited: true }),
    true,
    "tall_static mat color edit triggers rebuild",
  );
}

const composeCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/staticFrameCompose.mjs"),
  "utf8",
);
assert(composeCode.includes("ensureGownDrawGeometry"), "compose ensures gown draw geometry");
assert(composeCode.includes("ensureStaticRebuildUrls"), "compose resolves static rebuild sources");
assert(composeCode.includes("const appearanceEdited"), "compose rebuilds all static appearance edits");
assert(
  composeCode.includes("if (frame.style === \"gown_static\") {\n    applyGownFrameLayers(frame);"),
  "rebuild applies gown layer geometry",
);

console.log("test-gown-mat-colors.mjs: all passed");
