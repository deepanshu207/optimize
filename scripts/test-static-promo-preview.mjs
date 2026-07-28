/**
 * Static promo card preview — composed imageUrl preferred on grid cards.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const uiCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/ui.js"),
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

assert(
  uiCode.includes("isStaticPromoEditorRow(r)"),
  "ui.js defines isStaticPromoEditorRow",
);
assert(
  uiCode.includes('style === "showcase"') &&
    uiCode.includes('style === "lifestyle_promo"') &&
    uiCode.includes('style === "tall_static"') &&
    uiCode.includes('style === "gown_static"'),
  "isStaticPromoEditorRow covers static promo styles",
);
assert(
  uiCode.includes("preferComposed") && uiCode.includes("r.imageUrl"),
  "pickResultImageSrc prefers composed imageUrl when edited/static promo",
);
assert(
  uiCode.includes("Tap image to edit colors, zoom, pan, and badges"),
  "static promo cards show full editor tap hint",
);
assert(
  uiCode.includes("staticPromoEditor") &&
    uiCode.includes("r.imageUrl || OptimizerUI.pickResultImageSrc(r)"),
  "renderResultCard prefers imageUrl for static promo rows",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll static promo preview checks passed.");
