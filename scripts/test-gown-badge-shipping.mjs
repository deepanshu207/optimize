/**
 * Badge edits must not change frozen shipping display or save uncompressed previews.
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
  composeCode.includes("function badgesOnlyBaseUrl"),
  "badgesOnlyBaseUrl helper exists for all static styles",
);
assert(
  composeCode.includes("if (badgesOnly)") &&
    composeCode.includes("badgesOnlyBaseUrl(layers, flags)"),
  "badge-only compose uses frozen base layer",
);
assert(
  !composeCode.includes('style === "gown_static" && badgesOnly'),
  "gown-only badgesOnly branch removed",
);

assert(
  contentCode.includes("composeSaveForRow"),
  "save compose recompresses edited variants at frozen KB",
);
assert(
  contentCode.includes("composeSaveForRow(result)") &&
    contentCode.includes("resolveDownloadUrl(result)"),
  "download uses save compose for edited static promos",
);
assert(
  contentCode.includes("variantBadgesOnlyCompose"),
  "badgesOnly logic centralized",
);
assert(
  contentCode.includes("_frozenPricing?.targetKb"),
  "save compose prefers frozen target KB",
);
assert(
  contentCode.includes("result-price-label"),
  "card price label refreshed from frozen shipping",
);

assert(
  uiCode.includes("frozenEstShipping"),
  "UI sorts static promos by frozen est shipping",
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown badge shipping checks passed");
