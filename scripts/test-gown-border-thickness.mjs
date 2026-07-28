/**
 * Gown static variant + border thickness (product size locked for gown).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

import {
  applyBorderThickness,
  updateFrameAppearance,
} from "../app.suppliersden.com/js/staticFrameCompose.mjs";
import { computeGownFrameGeometry } from "../app.suppliersden.com/js/liveGownStatic.mjs";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const base = computeGownFrameGeometry(773, 1094);
const gownFrame = {
  style: "gown_static",
  frameType: "tall",
  border: base.border,
  whitePad: base.whitePad,
  outerMatPad: base.outerMatPad,
  innerMatPad: base.innerMatPad,
  innerStroke: base.innerStroke,
  innerFrameX: base.innerFrameX,
  innerFrameY: base.innerFrameY,
  innerFrameW: base.innerFrameW,
  innerFrameH: base.innerFrameH,
  baseBorder: base.border,
  baseOuterMatPad: base.outerMatPad,
  baseInnerMatPad: base.innerMatPad,
  baseInnerStroke: base.innerStroke,
  baseWhitePad: base.whitePad,
  basePx: base.px,
  basePy: base.py,
  baseDw: base.dw,
  baseDh: base.dh,
  baseWhiteX: base.whiteX,
  baseWhiteY: base.whiteY,
  baseWhiteW: base.whiteW,
  baseWhiteH: base.whiteH,
  baseInnerFrameX: base.innerFrameX,
  baseInnerFrameY: base.innerFrameY,
  baseInnerFrameW: base.innerFrameW,
  baseInnerFrameH: base.innerFrameH,
  px: base.px,
  py: base.py,
  dw: base.dw,
  dh: base.dh,
  outerW: 773,
  outerH: 1094,
  whiteX: base.whiteX,
  whiteY: base.whiteY,
  whiteW: base.whiteW,
  whiteH: base.whiteH,
  borderThicknessPct: 100,
};

applyBorderThickness(gownFrame);
assert(gownFrame.border === 19, "100 keeps base teal border");
assert(gownFrame.dw === 657, "100 keeps product width");
assert(gownFrame.dh === 978, "100 keeps product height");
assert(gownFrame.innerMatPad === 17, "100 keeps inner mat band");
assert(gownFrame.innerStroke === 3, "100 keeps teal accent");

gownFrame.borderThicknessPct = 50;
applyBorderThickness(gownFrame);
assert(gownFrame.border < 19, "50 thins teal border");
assert(gownFrame.outerMatPad < 19, "50 thins outer white mat");
assert(gownFrame.dw === 657, "50 does not shrink product width");
assert(gownFrame.dh === 978, "50 does not shrink product height");
assert(gownFrame.innerMatPad === 17, "50 keeps inner mat fixed");
assert(gownFrame.innerStroke === 3, "50 keeps teal accent fixed");

gownFrame.gownLayerPct = { border: 100, outerMat: 100, innerAccent: 100, innerMat: 100 };
gownFrame.borderThicknessPct = 500;
applyBorderThickness(gownFrame);
assert(gownFrame.border >= 40, "500 thickens teal border noticeably");
assert(gownFrame.outerMatPad >= 40, "500 thickens outer white mat");
assert(
  gownFrame.border + gownFrame.outerMatPad + gownFrame.innerStroke + gownFrame.innerMatPad > 58,
  "500 increases total frame inset",
);
assert(gownFrame.dw === 657, "500 does not shrink product width");
assert(gownFrame.dh === 978, "500 does not shrink product height");

gownFrame.borderThicknessPct = 100;
applyBorderThickness(gownFrame);

const layerFrame = { ...gownFrame, gownLayerPct: { border: 100, outerMat: 50, innerAccent: 100, innerMat: 100 } };
updateFrameAppearance({ _staticFrame: layerFrame }, { gownLayerPct: { outerMat: 50 } });
assert(layerFrame.border === 19, "layer edit keeps outer border at default");
assert(layerFrame.outerMatPad < 19, "layer edit thins outer mat only");
assert(layerFrame.innerStroke === 3, "layer edit keeps inner accent");

const accentFrame = { ...gownFrame, gownLayerPct: { border: 100, outerMat: 100, innerAccent: 50, innerMat: 100 } };
updateFrameAppearance({ _staticFrame: accentFrame }, { gownLayerPct: { innerAccent: 50 } });
assert(accentFrame.innerStroke < 3, "inner accent scales independently");
assert(accentFrame.outerMatPad === 19, "inner accent edit keeps outer mat");

gownFrame.borderThicknessPct = 100;
gownFrame.gownLayerPct = { border: 100, outerMat: 100, innerAccent: 100, innerMat: 100 };
applyBorderThickness(gownFrame);
assert(gownFrame.border === 19, "restore 100 returns exact base border");
assert(gownFrame.dw === 657, "restore 100 returns exact product width");

const uiCode = readFileSync(resolve(root, "app.suppliersden.com/js/ui.js"), "utf8");
const contentCode = readFileSync(resolve(root, "app.suppliersden.com/content.js"), "utf8");
const lifestyleCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/livePromoLifestyle.mjs"),
  "utf8",
);
const gownCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/liveGownStatic.mjs"),
  "utf8",
);
const composeCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/staticFrameCompose.mjs"),
  "utf8",
);

assert(uiCode.includes("renderGownStaticSection"), "ui has gown section");
assert(uiCode.includes('data-static-gen="gown"'), "hub has gown button");
assert(contentCode.includes("generateGownStaticFrames"), "content has gown generator");
assert(contentCode.includes('max="1000"'), "editor border slider goes to 1000");
assert(
  /},\s*\n\s*meta:\s*\{[\s\S]*style:\s*"lifestyle_promo"/.test(lifestyleCode),
  "lifestyle promo keeps top-level meta block",
);
assert(gownCode.includes("GOWN_OUTER_MAT_RATIO"), "gown has outer mat band");
assert(gownCode.includes("GOWN_INNER_MAT_RATIO"), "gown has inner mat band");
assert(gownCode.includes("drawGownInnerAccent"), "gown draws teal inner accent");
assert(gownCode.includes("GOWN_INNER_STROKE_COLOR = BORDER_TEAL"), "inner accent is teal not grey");
assert(gownCode.includes("Math.max(dw / base.width, dh / base.height)"), "gown uses cover-fit");
assert(composeCode.includes("ensureGownLayerPcts"), "compose has gown layer pct helper");
assert(composeCode.includes("applyGownFrameLayers"), "compose applies gown layers independently");
assert(contentCode.includes("static-border-lock"), "border thickness has lock button");
assert(contentCode.includes("borderThicknessLocked"), "border lock stored on frame");
assert(contentCode.includes("static-size-lock"), "badge size has lock button");
assert(contentCode.includes("lockSize"), "badge size lock stored on placement");
assert(contentCode.includes("toggleStaticPlacementSizeLock"), "badge size lock toggle wired");
assert(contentCode.includes('dataset.staticEditorV = "9"'), "editor panel layout v9");
assert(contentCode.includes("static-color-outer-mat"), "gown has outer mat color");
assert(contentCode.includes("static-color-inner-accent"), "gown has inner accent color");
assert(contentCode.includes("static-color-pad"), "gown has photo pad color");
assert(contentCode.includes("openStaticColorPicker"), "custom colour picker modal");
assert(contentCode.includes("applyStaticGownLayerPcts"), "gown layer preview batches all sliders");
assert(!contentCode.includes('id="${id}-r"'), "rgb inputs removed from color rows");
assert(contentCode.includes("static-gown-layer-pct"), "gown has per-layer frame sliders");
assert(contentCode.includes("openVariantFullPreview"), "preview tap opens full size");
assert(gownCode.includes("outerMatColor"), "gown frame stores outer mat color");
assert(gownCode.includes("padColor"), "gown frame stores photo pad color");
assert(gownCode.includes("outerMatColor ?? frame.matColor"), "gown draws separate outer mat");
assert(gownCode.includes("padColor ?? frame.innerMatColor"), "gown draws separate photo pad");
assert(contentCode.includes('style !== "gown_static"'), "gradient preset hidden for gown");
assert(!contentCode.includes("bindVariantPreviewZoom"), "no blurry transform zoom");
assert(contentCode.includes("static-slider-locked"), "locked sliders use class not whole-row fade");
assert(contentCode.includes("min-height:0"), "flex scroll child can shrink");
assert(contentCode.includes("queueStaticBorderThickness"), "border slider is debounced");
assert(contentCode.includes("preview: true"), "editor preview skips targetKb recompress");
assert(contentCode.includes("pricingImageUrl"), "pricing image kept separate from preview");
assert(gownCode.includes('GOWN_STATIC_OUTER_W = 773'), "gown canvas width 773");
assert(gownCode.includes('GOWN_STATIC_OUTER_H = 1094'), "gown canvas height 1094");
assert(gownCode.includes('BORDER_TEAL = "#71cbd3"'), "gown uses reference teal");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown / border-thickness checks passed");
