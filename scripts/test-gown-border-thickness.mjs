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
  border: 28,
  whitePad: 12,
  baseBorder: 28,
  baseWhitePad: 12,
  basePx: 40,
  basePy: 40,
  baseWhiteX: 28,
  baseWhiteY: 28,
  baseWhiteW: 647,
  baseWhiteH: 968,
  px: 40,
  py: 40,
  dw: 623,
  dh: 944,
  outerW: 703,
  outerH: 1024,
  whiteX: 28,
  whiteY: 28,
  whiteW: 647,
  whiteH: 968,
  borderThicknessPct: 100,
};

applyBorderThickness(gownFrame);
assert(gownFrame.border === 28, "100% keeps base border 28");
assert(gownFrame.px === 40, "100% keeps base px 40");
assert(gownFrame.whiteX === 28, "100% keeps base whiteX 28");

gownFrame.borderThicknessPct = 50;
applyBorderThickness(gownFrame);
assert(gownFrame.border === 14, "50% scales border to 14");
assert(gownFrame.whiteX === 14, "50% scales white mat inset");

gownFrame.borderThicknessPct = 100;
applyBorderThickness(gownFrame);
assert(gownFrame.border === 28, "restore 100% returns exact base border");
assert(gownFrame.px === 40, "restore 100% returns exact base px");

const uiCode = readFileSync(resolve(root, "app.suppliersden.com/js/ui.js"), "utf8");
const contentCode = readFileSync(resolve(root, "app.suppliersden.com/content.js"), "utf8");
const lifestyleCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/livePromoLifestyle.mjs"),
  "utf8",
);

assert(uiCode.includes("renderGownStaticSection"), "ui has gown section");
assert(uiCode.includes('data-static-gen="gown"'), "hub has gown button");
assert(contentCode.includes("generateGownStaticFrames"), "content has gown generator");
assert(contentCode.includes("static-border-thickness"), "editor has border thickness slider");
assert(
  /},\s*\n\s*meta:\s*\{[\s\S]*style:\s*"lifestyle_promo"/.test(lifestyleCode),
  "lifestyle promo keeps top-level meta block",
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown / border-thickness checks passed");
