/**
 * Static Promo Studio hub — UI wiring checks (no browser).
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
const contentCode = readFileSync(
  resolve(root, "app.suppliersden.com/content.js"),
  "utf8",
);
const indexHtml = readFileSync(
  resolve(root, "app.suppliersden.com/index.html"),
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
  uiCode.includes("renderStaticPromoHub"),
  "ui.js defines renderStaticPromoHub",
);
assert(
  uiCode.includes('data-static-gen="showcase"'),
  "hub renders showcase button with data-static-gen",
);
assert(
  uiCode.includes("staticPromoHubActive"),
  "getResultsHTML uses staticPromoHubActive",
);
assert(
  !uiCode.includes('id="generate-showcase-btn"') ||
    uiCode.indexOf('id="generate-showcase-btn"') === -1,
  "showcase section no longer duplicates generate-showcase-btn id",
);
const showcaseSection = uiCode.slice(
  uiCode.indexOf("renderShowcaseSection"),
  uiCode.indexOf("renderPromoLifestyleSection"),
);
assert(
  !showcaseSection.includes("generate-showcase-btn"),
  "renderShowcaseSection has no generate button",
);

assert(
  contentCode.includes("bindStaticPromoButtons"),
  "content.js binds all data-static-gen buttons",
);
assert(
  contentCode.includes("staticPromoHubActive: this.shouldShowStaticPromoWorkspace()"),
  "getResultsViewOptions passes staticPromoHubActive",
);
assert(
  contentCode.includes("shouldShowStaticPromoWorkspace()"),
  "refreshResultsAreaForActiveTab includes static workspace",
);

assert(
  indexHtml.includes('data-static-gen="showcase"'),
  "sticky showcase button has data-static-gen",
);
assert(
  indexHtml.includes('data-static-gen="lifestyle"'),
  "sticky lifestyle button has data-static-gen",
);
assert(
  indexHtml.includes('data-static-gen="tall"'),
  "sticky tall button has data-static-gen",
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll static promo hub checks passed");
