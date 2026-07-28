/**
 * Gradient preset clear restores style-specific frame type and color field count.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const SFC = await import(
  new URL("../app.suppliersden.com/js/staticFrameCompose.mjs", import.meta.url).href
);

const {
  applyGradientPreset,
  clearGradientPreset,
  staticStyleUsesGradientColors,
} = SFC;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const layers = {
  _staticFrame: {
    style: "gown_static",
    frameType: "tall",
    borderColor: "#71cbd3",
    matColor: "#ffffff",
    gradientPreset: null,
  },
};

assert(!staticStyleUsesGradientColors("gown_static", layers._staticFrame), "gown custom shows border+mat only");
assert(applyGradientPreset(layers, "sunset"), "apply sunset preset");
assert(layers._staticFrame.frameType === "gradient", "preset sets gradient frame");
assert(staticStyleUsesGradientColors("gown_static", layers._staticFrame), "gown with preset shows gradient fields");
assert(clearGradientPreset(layers), "clear preset");
assert(layers._staticFrame.gradientPreset == null, "preset cleared");
assert(layers._staticFrame.frameType === "tall", "gown frameType restored to tall");
assert(!staticStyleUsesGradientColors("gown_static", layers._staticFrame), "after clear back to 2 color fields logic");

const contentCode = readFileSync(resolve(root, "app.suppliersden.com/content.js"), "utf8");
assert(contentCode.includes("clearGradientPreset"), "editor clears gradient preset");
assert(contentCode.includes("clear-upload-btn"), "upload cancel button wired");
assert(contentCode.includes("clearUploadedImage"), "clear upload handler exists");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gradient preset / upload cancel checks passed");
