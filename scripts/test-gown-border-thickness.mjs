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
  border: 18,
  whitePad: 95,
  baseBorder: 18,
  baseWhitePad: 95,
  basePx: 113,
  basePy: 113,
  baseDw: 477,
  baseDh: 715,
  baseWhiteX: 18,
  baseWhiteY: 18,
  baseWhiteW: 667,
  baseWhiteH: 988,
  px: 113,
  py: 113,
  dw: 477,
  dh: 715,
  outerW: 703,
  outerH: 1024,
  whiteX: 18,
  whiteY: 18,
  whiteW: 667,
  whiteH: 988,
  borderThicknessPct: 100,
};

applyBorderThickness(gownFrame);
assert(gownFrame.border === 18, "100 keeps base teal border");
assert(gownFrame.dw === 477, "100 keeps product width");
assert(gownFrame.dh === 715, "100 keeps product height");

gownFrame.borderThicknessPct = 50;
applyBorderThickness(gownFrame);
assert(gownFrame.border < 18, "50 thins teal border");
assert(gownFrame.dw === 477, "50 does not shrink product width");
assert(gownFrame.dh === 715, "50 does not shrink product height");

gownFrame.borderThicknessPct = 500;
applyBorderThickness(gownFrame);
assert(gownFrame.border > 18, "500 thickens teal border");
assert(gownFrame.border + gownFrame.whitePad > 113, "500 increases total frame inset");
assert(gownFrame.dw === 477, "500 does not shrink product width");
assert(gownFrame.dh === 715, "500 does not shrink product height");

gownFrame.borderThicknessPct = 100;
applyBorderThickness(gownFrame);
assert(gownFrame.border === 18, "restore 100 returns exact base border");
assert(gownFrame.dw === 477, "restore 100 returns exact product width");

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
assert(gownCode.includes("whiteW - whitePad * 2"), "gown product sized from white mat");
assert(gownCode.includes('BORDER_TEAL = "#71cbd3"'), "gown uses reference teal");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown / border-thickness checks passed");
