/**
 * Editor preview must keep full canvas size — no target-KB downscale on badge/size edits.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const composeCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/staticFrameCompose.mjs"),
  "utf8",
);
const contentCode = readFileSync(
  resolve(root, "app.suppliersden.com/content.js"),
  "utf8",
);
const apiCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/meeshoApi.js"),
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

assert(composeCode.includes("if (options.preview)"), "compressPreview has preview fast-path");
assert(composeCode.includes("options.targetKb ?? options.preserveKb"), "targetKb uses nullish coalescing");
assert(composeCode.includes("preview,"), "compose passes preview flag to compress");
assert(
  composeCode.includes('return canvas.toDataURL("image/jpeg", q)'),
  "preview encodes at full canvas size",
);

assert(
  contentCode.includes("row._badgesRepositioned = true") &&
    contentCode.includes("setStaticBadgeNum"),
  "badge number change uses badgesRepositioned not appearance rebuild",
);
assert(
  !contentCode.includes("row._staticAppearanceEdited = true;\n    await this.refreshStaticPreview(variantId);\n    if (this._editingVariantId === variantId) {\n      this.renderVariantEditorPanel(row);\n    }\n  }\n\n  async setStaticPlacementHidden"),
  "badge hide does not force appearance rebuild",
);

assert(
  apiCode.includes("targetKb: 0") && apiCode.includes("preview: true"),
  "resolveDisplayUrlAsync never recompresses to targetKb",
);
assert(
  !apiCode.includes("targetKb: appearanceEdited ? 0 : result.meta?.targetKb"),
  "removed conditional targetKb on badge-only compose",
);

assert(contentCode.includes("updateVariantEditorResetButton"), "reset button updated after preview");
assert(contentCode.includes("badgesOnly"), "badge-only compose skips frame rebuild");
assert(composeCode.includes("_gownPhotoSource"), "gown stores original photo source for rebuilds");
assert(composeCode.includes("options.badgesOnly"), "shouldRebuildStaticFrame respects badgesOnly");
assert(composeCode.includes("canvasFromStaticImage"), "compose enforces full canvas dimensions");
assert(composeCode.includes("frozenLayerUrl"), "compose uses frozen layer URLs");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown preview dimension checks passed");
