/**
 * Gown canvas geometry — triple layer: teal → white → teal accent → white → photo.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

import {
  GOWN_STATIC_OUTER_W,
  GOWN_STATIC_OUTER_H,
  BORDER_TEAL,
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
assert(gownCode.includes("drawGownInnerAccent"), "teal inner accent drawn");
assert(gownCode.includes("GOWN_INNER_STROKE_COLOR = BORDER_TEAL"), "inner accent uses teal");
assert(gownCode.includes("drawGownPhotoInFixedRect"), "cover-fit fills photo slot");
assert(
  gownCode.includes("drawImage(noStickersCanvas, px, py, dw, dh"),
  "productOnly crops pre-badge frame",
);

const geom = computeGownFrameGeometry(773, 1094);
assert(geom.border === 19, `teal border ${geom.border}px`);
assert(geom.outerMatPad === 19, `outer white mat ${geom.outerMatPad}px`);
assert(geom.innerMatPad === 17, `inner white pad ${geom.innerMatPad}px`);
assert(geom.innerStroke === 3, `teal accent ${geom.innerStroke}px`);
assert(geom.whitePad === 39, `total inset ${geom.whitePad}px`);
assert(geom.dw === 657, `product slot width ${geom.dw}px`);
assert(geom.dh === 978, `product slot height ${geom.dh}px`);
assert(geom.px === 58, `product slot x ${geom.px}px`);
assert(geom.innerStrokeColor === BORDER_TEAL, "accent color matches border teal");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown geometry checks passed");
