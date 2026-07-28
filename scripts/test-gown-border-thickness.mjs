/**
 * Gown static variant + border thickness (product size locked for gown).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

import { applyBorderThickness } from "../app.suppliersden.com/js/staticFrameCompose.mjs";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const gownFrame = {
  style: "gown_static",
  frameType: "tall",
  border: 19,
  whitePad: 37,
  baseBorder: 19,
  baseWhitePad: 37,
  basePx: 56,
  basePy: 56,
  baseDw: 661,
  baseDh: 982,
  baseWhiteX: 19,
  baseWhiteY: 19,
  baseWhiteW: 735,
  baseWhiteH: 1056,
  px: 56,
  py: 56,
  dw: 661,
  dh: 982,
  outerW: 773,
  outerH: 1094,
  whiteX: 19,
  whiteY: 19,
  whiteW: 735,
  whiteH: 1056,
  borderThicknessPct: 100,
};

applyBorderThickness(gownFrame);
assert(gownFrame.border === 19, "100 keeps base teal border");
assert(gownFrame.dw === 661, "100 keeps product width");
assert(gownFrame.dh === 982, "100 keeps product height");

gownFrame.borderThicknessPct = 50;
applyBorderThickness(gownFrame);
assert(gownFrame.border < 19, "50 thins teal border");
assert(gownFrame.dw === 661, "50 does not shrink product width");
assert(gownFrame.dh === 982, "50 does not shrink product height");

gownFrame.borderThicknessPct = 500;
applyBorderThickness(gownFrame);
assert(gownFrame.border >= 40, "500 thickens teal border noticeably");
assert(gownFrame.border + gownFrame.whitePad > 56, "500 increases total frame inset");
assert(gownFrame.dw === 661, "500 does not shrink product width");
assert(gownFrame.dh === 982, "500 does not shrink product height");

gownFrame.borderThicknessPct = 100;
applyBorderThickness(gownFrame);
assert(gownFrame.border === 19, "restore 100 returns exact base border");
assert(gownFrame.dw === 661, "restore 100 returns exact product width");

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

assert(uiCode.includes("renderGownStaticSection"), "ui has gown section");
assert(uiCode.includes('data-static-gen="gown"'), "hub has gown button");
assert(contentCode.includes("generateGownStaticFrames"), "content has gown generator");
assert(contentCode.includes('max="1000"'), "editor border slider goes to 1000");
assert(
  /},\s*\n\s*meta:\s*\{[\s\S]*style:\s*"lifestyle_promo"/.test(lifestyleCode),
  "lifestyle promo keeps top-level meta block",
);
assert(!gownCode.includes("GOWN_INNER_PRODUCT_FILL"), "gown fills white mat not double-padded");
assert(gownCode.includes("Math.max(maxProdW / base.width, maxProdH / base.height)"), "gown uses cover-fit");
assert(contentCode.includes("static-border-lock"), "border thickness has lock button");
assert(contentCode.includes("borderThicknessLocked"), "border lock stored on frame");
assert(contentCode.includes("static-size-lock"), "badge size has lock button");
assert(contentCode.includes("lockSize"), "badge size lock stored on placement");
assert(contentCode.includes("toggleStaticPlacementSizeLock"), "badge size lock toggle wired");
assert(contentCode.includes("staticEditorV = \"5\""), "editor panel layout v5 with scroll fix");
assert(contentCode.includes("variant-edit-scroll"), "editor has dedicated scroll region");
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
