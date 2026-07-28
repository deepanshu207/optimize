/**
 * Gown canvas geometry — competitor 773×1094 with triple-layer mat + cover-fit photo.
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
assert(gownCode.includes("drawGownStaticFrameBackground"), "inner frame stroke drawn");
assert(gownCode.includes("Math.max(dw / base.width, dh / base.height)"), "cover-fit fills photo slot");
assert(
  gownCode.includes("drawImage(noStickersCanvas, px, py, dw, dh"),
  "productOnly/noBorder crop pre-badge frame (not post-sticker canvas)",
);
assert(
  !gownCode.includes(".drawImage(canvas, px, py, dw, dh"),
  "productOnly does not copy post-badge canvas region",
);

const geom = computeGownFrameGeometry(773, 1094);
assert(geom.border === 19, `teal border ${geom.border}px`);
assert(geom.outerMatPad === 50, `outer mat ${geom.outerMatPad}px`);
assert(geom.innerMatPad === 12, `inner mat ${geom.innerMatPad}px`);
assert(geom.whitePad === 62, `total mat inset ${geom.whitePad}px`);
assert(geom.dw === 611, `product slot width ${geom.dw}px`);
assert(geom.dh === 932, `product slot height ${geom.dh}px`);
assert(geom.px === 81, `product slot x ${geom.px}px`);
assert(geom.innerFrameW === 635, `inner frame width ${geom.innerFrameW}px`);
assert(geom.dw / 773 >= 0.78, `photo fills ≥78% of canvas width (${((geom.dw / 773) * 100).toFixed(1)}%)`);
assert(geom.dw / 773 <= 0.82, `photo leaves visible double-mat bands (${((geom.dw / 773) * 100).toFixed(1)}%)`);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown geometry checks passed");
