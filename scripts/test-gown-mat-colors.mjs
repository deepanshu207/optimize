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

// matching fill mat + pad skips redundant pad ring (full board shows fill mat color)
{
  const ctx = mockCtx();
  drawGownStaticFrameBackground(ctx, baseFrame);
  const padRects = ctx.fills.filter((f) => f.color === "#ffffff" && f.h === 17);
  assert.equal(padRects.length, 0, "pad ring skipped when fill mat matches pad color");
}

// different pad color still draws pad ring on top of fill mat board
{
  const ctx = mockCtx();
  drawGownStaticFrameBackground(ctx, { ...baseFrame, fillMatColor: "#ff0000", padColor: "#ffffff" });
  const fillRects = ctx.fills.filter((f) => f.color === "#ff0000");
  const padRects = ctx.fills.filter((f) => f.color === "#ffffff" && f.h === 17);
  assert.ok(fillRects.length >= 2, "fill mat board draws when enabled");
  assert.equal(padRects.length, 2, "top/bottom pad bands when colors differ");
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

const composeCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/staticFrameCompose.mjs"),
  "utf8",
);
assert(composeCode.includes("resolveGownPhotoSourceUrl"), "compose resolves gown photo source");
assert(composeCode.includes("hasStaticRebuildSources"), "compose checks rebuild sources");
assert(
  composeCode.includes("if (frame.style === \"gown_static\") {\n    applyGownFrameLayers(frame);"),
  "rebuild applies gown layer geometry",
);

console.log("test-gown-mat-colors.mjs: all passed");
