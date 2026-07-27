/**
 * Frame color parse/normalize + editor RGB field wiring.
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
  parseCssColor,
  normalizeFrameColor,
  hexToRgb,
  rgbToHex,
  updateFrameAppearance,
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

assert(parseCssColor("#71cbd3")?.hex === "#71cbd3", "6-digit hex");
assert(parseCssColor("#71c")?.hex === "#7711cc", "3-digit hex expands");
assert(parseCssColor("rgb(113, 203, 211)")?.r === 113, "rgb() red channel");
assert(parseCssColor("rgba(50, 215, 75, 0.9)")?.hex === "#32d74b", "rgba() parses");
assert(normalizeFrameColor("RGB(255, 152, 0)") === "#ff9800", "normalize rgb string");
assert(rgbToHex(113, 203, 211) === "#71cbd3", "rgb to hex");

const layers = {
  _staticFrame: {
    style: "gown_static",
    borderColor: "rgb(113, 203, 211)",
    matColor: "#ffffff",
    borderThicknessPct: 100,
  },
};
assert(
  updateFrameAppearance(layers, { borderColor: "rgb(255, 0, 0)" }),
  "updateFrameAppearance applies border",
);
assert(layers._staticFrame.borderColor === "#ff0000", "stores normalized hex");
assert(
  updateFrameAppearance(layers, { gradientPreset: "" }),
  "clear preset with empty string",
);
assert(layers._staticFrame.gradientPreset == null, "empty preset becomes null");

const contentCode = readFileSync(
  resolve(root, "app.suppliersden.com/content.js"),
  "utf8",
);
assert(contentCode.includes("buildStaticColorFieldHtml"), "editor builds RGB rows");
assert(parseCssColor("113, 203, 211")?.hex === "#71cbd3", "comma-separated RGB triplet");
assert(contentCode.includes("static-color-r"), "editor has R inputs");
assert(contentCode.includes("static-color-rgb"), "editor has RGB paste field");
assert(!contentCode.includes("static-color-hex"), "hex code not shown for manual entry");
assert(contentCode.includes("bindStaticColorFields"), "editor wires RGB sync");
assert(contentCode.includes("readStaticColorField"), "editor reads RGB values");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll static frame color tests passed");
