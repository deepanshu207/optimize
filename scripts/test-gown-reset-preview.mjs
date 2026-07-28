/**
 * Gown reset restores frame geometry and editor uses immediate preview helpers.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const SFC = await import(
  new URL("../app.suppliersden.com/js/staticFrameCompose.mjs", import.meta.url).href
);

const { applyBorderThickness, resetStaticPlacements, updateFrameAppearance } = SFC;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const layers = {
  full: "data:image/jpeg;base64,abc",
  productOnly: "data:image/jpeg;base64,prod",
  noStickers: "data:image/jpeg;base64,nostickers",
  _badgePlacements: [
    {
      id: "gown-best",
      kind: "gownArt",
      gownSlot: "gown-best",
      x: 10,
      y: 10,
      w: 100,
      h: 70,
      posH: 0,
      posV: 0,
      sizePct: 100,
    },
  ],
  _staticFrame: {
    style: "gown_static",
    frameType: "tall",
    border: 19,
    outerMatPad: 19,
    innerMatPad: 17,
    innerStroke: 3,
    baseBorder: 19,
    baseOuterMatPad: 19,
    baseInnerMatPad: 17,
    baseInnerStroke: 3,
    basePx: 58,
    basePy: 58,
    baseDw: 657,
    baseDh: 978,
    px: 58,
    py: 58,
    dw: 657,
    dh: 978,
    outerW: 773,
    outerH: 1094,
    whiteX: 19,
    whiteY: 19,
    whiteW: 735,
    whiteH: 1056,
    innerFrameX: 38,
    innerFrameY: 38,
    innerFrameW: 697,
    innerFrameH: 1018,
    borderColor: "#71cbd3",
    gownLayerPct: { border: 100, outerMat: 100, innerAccent: 100, innerMat: 100 },
    borderThicknessPct: 100,
  },
};

SFC.ensureStaticPlacementMeta(layers, "gown_static");

updateFrameAppearance(layers, {
  gownLayerPct: { border: 200, outerMat: 200, innerAccent: 100, innerMat: 100 },
});
assert(layers._staticFrame.border > 19, "layer edit thickens border before reset");

resetStaticPlacements(layers);
assert(layers._staticFrame.border === 19, "reset restores default border thickness");
assert(layers._staticFrame.outerMatPad === 19, "reset restores default outer mat");
assert(
  layers._staticFrame.gownLayerPct.border === 100,
  "reset restores default layer pct",
);
assert(
  layers._staticFrame.borderColor === "#71cbd3",
  "reset restores default border color",
);

const contentCode = readFileSync(
  resolve(root, "app.suppliersden.com/content.js"),
  "utf8",
);
const composeCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/staticFrameCompose.mjs"),
  "utf8",
);

assert(contentCode.includes("applyRowStaticPreview"), "editor has unified preview apply");
assert(contentCode.includes("applyStaticPreviewToRow"), "editor updates preview img directly");
assert(
  contentCode.includes("this._staticControlsVariantId = null"),
  "reset forces static controls re-render",
);
assert(
  composeCode.includes("applyBorderThickness(layers._staticFrame)"),
  "reset reapplies frame geometry",
);
assert(
  !contentCode.includes("row.pricingImageUrl ="),
  "editor never overwrites pricingImageUrl",
);
assert(contentCode.includes("preview: true"), "preview compose skips targetKb recompress");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown reset/preview immediacy checks passed");
