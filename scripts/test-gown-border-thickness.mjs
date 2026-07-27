/**
 * Gown static variant + border thickness default (100% = unchanged frame).
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
  border: 15,
  whitePad: 114,
  baseBorder: 15,
  baseWhitePad: 114,
  basePx: 151,
  basePy: 151,
  baseDw: 401,
  baseDh: 602,
  baseWhiteX: 15,
  baseWhiteY: 15,
  baseWhiteW: 673,
  baseWhiteH: 994,
  px: 151,
  py: 151,
  dw: 401,
  dh: 602,
  outerW: 703,
  outerH: 1024,
  whiteX: 15,
  whiteY: 15,
  whiteW: 673,
  whiteH: 994,
  borderThicknessPct: 100,
};

applyBorderThickness(gownFrame);
assert(gownFrame.border === 15, "100 keeps base border 15");
assert(gownFrame.px === 151, "100 keeps base px 151");
assert(gownFrame.dw === 401, "100 keeps base product width");

gownFrame.borderThicknessPct = 500;
applyBorderThickness(gownFrame);
assert(gownFrame.border > 15, "500 thickens border beyond default");
assert(gownFrame.dw <= gownFrame.baseDw, "500 shrinks product to fit thicker frame");

gownFrame.borderThicknessPct = 1000;
applyBorderThickness(gownFrame);
assert(gownFrame.px >= gownFrame.border, "1000 keeps product inside frame");

gownFrame.borderThicknessPct = 100;
applyBorderThickness(gownFrame);
assert(gownFrame.border === 15, "restore 100 returns exact base border");
assert(gownFrame.px === 151, "restore 100 returns exact base px");

const uiCode = readFileSync(resolve(root, "app.suppliersden.com/js/ui.js"), "utf8");
const contentCode = readFileSync(resolve(root, "app.suppliersden.com/content.js"), "utf8");
const lifestyleCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/livePromoLifestyle.mjs"),
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

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown / border-thickness checks passed");
