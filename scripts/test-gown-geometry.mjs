/**
 * Gown canvas geometry — competitor 773×1094 with triple-layer mat + hairline + cover-fit.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

import {
  GOWN_STATIC_OUTER_W,
  GOWN_STATIC_OUTER_H,
  computeGownFrameGeometry,
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
assert(gownCode.includes("GOWN_OUTER_MAT_RATIO"), "outer white mat ratio");
assert(gownCode.includes("GOWN_INNER_MAT_RATIO"), "inner white mat ratio");
assert(gownCode.includes("drawGownHairline"), "dark hairline border drawn");
assert(gownCode.includes('GOWN_INNER_STROKE_COLOR = "#2a2a2a"'), "hairline is dark grey");
assert(gownCode.includes("Math.max(dw / base.width, dh / base.height)"), "cover-fit fills photo slot");
assert(
  gownCode.includes("drawImage(noStickersCanvas, px, py, dw, dh"),
  "productOnly/noBorder crop pre-badge frame (not post-sticker canvas)",
);

const geom = computeGownFrameGeometry(773, 1094);
assert(geom.border === 22, `teal border ${geom.border}px`);
assert(geom.outerMatPad === 68, `outer mat ${geom.outerMatPad}px`);
assert(geom.innerMatPad === 9, `inner mat ${geom.innerMatPad}px`);
assert(geom.innerStroke === 1, `hairline stroke ${geom.innerStroke}px`);
assert(geom.whitePad === 78, `total mat inset ${geom.whitePad}px`);
assert(geom.dw === 573, `product slot width ${geom.dw}px`);
assert(geom.dh === 894, `product slot height ${geom.dh}px`);
assert(geom.px === 100, `product slot x ${geom.px}px`);
assert(geom.innerFrameW === 593, `inner frame width ${geom.innerFrameW}px`);
assert(geom.dw / 773 >= 0.73, `photo fills ≥73% of canvas width (${((geom.dw / 773) * 100).toFixed(1)}%)`);
assert(geom.dw / 773 <= 0.76, `thick outer mat leaves visible bands (${((geom.dw / 773) * 100).toFixed(1)}%)`);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown geometry checks passed");
