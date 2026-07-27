/**
 * Gown static — reference geometry + ₹49 KB band (not tall_static max-fill).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { applyBorderThickness } from "../app.suppliersden.com/js/staticFrameCompose.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const gownCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/liveGownStatic.mjs"),
  "utf8",
);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

assert(gownCode.includes("imageToCanvas"), "gown keeps lifestyle scene (not white flatten)");
assert(!gownCode.includes("imageToWhiteCanvas"), "gown does not white-flatten product");
assert(gownCode.includes("GOWN_PRODUCT_FILL = 0.64"), "product capped at 64% of white mat");
assert(gownCode.includes("GOWN_TEAL_RATIO = 0.035"), "thin teal border ratio");
assert(gownCode.includes("#64c5d3"), "reference teal color");
assert(gownCode.includes("compressGownToKb"), "downscale compressor for ₹49 KB band");
assert(gownCode.includes("const start = 38"), "KB tiers start at 38 not 45");
assert(gownCode.includes("const end = 48"), "KB tiers end at 48");

const gownFrame = {
  style: "gown_static",
  frameType: "tall",
  border: 25,
  whitePad: 80,
  baseBorder: 25,
  baseWhitePad: 80,
  basePx: 105,
  basePy: 105,
  baseWhiteX: 25,
  baseWhiteY: 25,
  baseWhiteW: 653,
  baseWhiteH: 974,
  px: 105,
  py: 105,
  dw: 418,
  dh: 627,
  outerW: 703,
  outerH: 1024,
  whiteX: 25,
  whiteY: 25,
  whiteW: 653,
  whiteH: 974,
  borderThicknessPct: 100,
};

applyBorderThickness(gownFrame);
assert(gownFrame.border === 25, "100% keeps thin teal border");
assert(gownFrame.whitePad === 80, "100% keeps thick white mat padding");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown reference / ₹49 band checks passed");
