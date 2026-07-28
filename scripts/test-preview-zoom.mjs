/**
 * Variant editor preview — crisp sticky image, native pinch-zoom (no CSS transform).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const content = readFileSync(
  resolve(root, "app.suppliersden.com/content.js"),
  "utf8",
);
const index = readFileSync(
  resolve(root, "app.suppliersden.com/index.html"),
  "utf8",
);

assert(!content.includes("bindVariantPreviewZoom"), "removed blurry transform zoom");
assert(!content.includes("variant-edit-preview-stage"), "preview stage wrapper removed");
assert(content.includes("openVariantFullPreview"), "tap opens full-size preview overlay");
assert(content.includes("max-height:180px"), "compact preview on editor open");
assert(content.includes('dataset.staticEditorV = "14"'), "editor panel version bumped");
assert(content.includes("touch-action:pan-y"), "scroll area allows vertical pan");
assert(content.includes("touch-action:pan-x"), "sliders allow horizontal pan only");
assert(!index.includes("maximum-scale=1.0"), "viewport allows mobile pinch zoom");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll preview zoom checks passed");
