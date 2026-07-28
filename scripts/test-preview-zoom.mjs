/**
 * Variant editor preview — pinch-zoom stage markup and viewport policy.
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

assert(content.includes("variant-edit-preview-stage"), "preview wrapped in zoom stage");
assert(content.includes("bindVariantPreviewZoom"), "pinch-zoom handler wired");
assert(content.includes("Pinch to zoom"), "mobile zoom hint shown");
assert(content.includes('dataset.staticEditorV = "6"'), "editor panel version bumped");
assert(!index.includes("maximum-scale=1.0"), "viewport allows mobile pinch zoom");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll preview zoom checks passed");
