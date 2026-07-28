/**
 * Gown badge edits must not shift other icons or change frozen shipping display.
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
  composeCode.includes("export function gownPlacementPosition"),
  "gownPlacementPosition exported",
);
assert(
  composeCode.includes('slot === "gown-popular"') &&
    composeCode.includes("px - Math.round(w * 0.08)"),
  "gown-popular allows off-canvas x",
);
assert(
  composeCode.includes("isGownArtPlacement") &&
    composeCode.includes("locksH && locksV") &&
    composeCode.includes("gownPlacementPosition(slot, frame, w, h)"),
  "locked gown art uses gown anchor not slider clamp",
);
assert(
  composeCode.includes("finalizePlacementSnapshot"),
  "placement snapshot finalized after slider init",
);

assert(contentCode.includes("freezeRowPricing"), "rows freeze pricing at map time");
assert(contentCode.includes("getRowDisplayShipping"), "display shipping reads frozen values");
assert(
  !contentCode.includes("row.estShipping =") && !contentCode.includes("row.pricingImageUrl ="),
  "editor never overwrites estShipping or pricingImageUrl",
);

assert(
  uiCode.includes("_frozenPricing") && uiCode.includes("frozenEst"),
  "result cards use frozen pricing for display",
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown badge isolation checks passed");
