/**
 * Gown canvas geometry — competitor 773×1094 with larger lifestyle fill.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

import {
  GOWN_STATIC_OUTER_W,
  GOWN_STATIC_OUTER_H,
} from "../app.suppliersden.com/js/liveGownStatic.mjs";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

assert(GOWN_STATIC_OUTER_W === 773, "outer width is 773");
assert(GOWN_STATIC_OUTER_H === 1094, "outer height is 1094");

const gownCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/liveGownStatic.mjs"),
  "utf8",
);
assert(gownCode.includes("GOWN_WHITE_PAD_RATIO = 0.112"), "white mat ratio tuned");
assert(!gownCode.includes("maxProdH / base.height, 1)"), "lifestyle photo may upscale to fill mat");

// Expected base geometry for a 477×715 source (legacy product patch size)
const ref = Math.min(773, 1094);
const teal = Math.max(14, Math.round(ref * 0.025));
const whitePad = Math.max(64, Math.round(ref * 0.112));
const whiteW = 773 - teal * 2;
const whiteH = 1094 - teal * 2;
const maxProdW = whiteW - whitePad * 2;
const maxProdH = whiteH - whitePad * 2;
const srcW = 477;
const srcH = 715;
const fitScale = Math.min(maxProdW / srcW, maxProdH / srcH);
const dw = Math.round(srcW * fitScale);
const dh = Math.round(srcH * fitScale);

assert(teal === 19, `teal border ${teal}px`);
assert(whitePad === 87, `white mat ${whitePad}px`);
assert(dw >= 555 && dw <= 565, `product width ${dw}px (~17% larger than old 477)`);
assert(dh >= 835 && dh <= 845, `product height ${dh}px`);
assert(dw / 773 >= 0.72, `product fills ≥72% of canvas width (${((dw / 773) * 100).toFixed(1)}%)`);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown geometry checks passed");
