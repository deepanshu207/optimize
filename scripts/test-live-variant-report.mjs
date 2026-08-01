#!/usr/bin/env node
import {
  pickRecommendedVariants,
  analyzeLiveVariants,
  exportReportCsv,
  exportReportTxt,
  parseReportCsv,
  findAllRupeePairs,
} from "../app.suppliersden.com/js/liveVariantReport.mjs";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

function v(price, extra = {}) {
  return {
    variantId: extra.id || `v-${price}`,
    name: extra.name || `Var ${price}`,
    shippingCost: price,
    isVerified: extra.verified ?? true,
    duplicatePid: extra.dup ? extra.pid || 922043735 : extra.pid || null,
    noPid: extra.noPid ?? false,
    variantStyle: extra.style || "standard",
    meta: {
      path: extra.path || "studio",
      kb: extra.kb || 48,
      canvasW: extra.canvasW || 1200,
      canvasH: extra.canvasH || 1200,
      borderPx: extra.borderPx ?? 40,
      badgeCount: extra.badgeCount ?? 3,
      jpegQuality: extra.jpegQuality ?? 0.82,
    },
  };
}

// User example: 60, 61, 69, 95 → pick 60 and 61
const ex1 = pickRecommendedVariants([
  v(60), v(61), v(69), v(95),
  v(60, { id: "v60b", verified: false }),
]);
assert(ex1.strategy === "rupee_pair", "60,61,69,95 uses rupee_pair");
assert(ex1.picks.length === 2, "picks two variants");
assert(
  ex1.picks[0].shippingCost === 60 && ex1.picks[1].shippingCost === 61,
  "picks 60 and 61",
);

// User example: 46, 50 → pick only 46
const ex2 = pickRecommendedVariants([v(46), v(50)]);
assert(ex2.strategy === "single_lowest", "46,50 uses single_lowest");
assert(ex2.picks.length === 1 && ex2.picks[0].shippingCost === 46, "picks only 46");

// 46, 47, 50 → pick 46 and 47
const ex3 = pickRecommendedVariants([v(46), v(47), v(50)]);
assert(ex3.strategy === "rupee_pair", "46,47,50 uses pair at floor");
assert(
  ex3.picks.map((p) => p.shippingCost).join(",") === "46,47",
  "picks 46 and 47",
);

// Multiple ₹1 pairs — lowest wins (46-47 not 60-61)
const ex4 = pickRecommendedVariants([
  v(46), v(47), v(60), v(61),
]);
assert(
  ex4.pair[0] === 46 && ex4.pair[1] === 47,
  "lowest rupee pair wins when multiple exist",
);

// Tie-break: prefer verified non-dup at same price
const ex5 = pickRecommendedVariants([
  v(50, { id: "a", verified: false, dup: false }),
  v(50, { id: "b", verified: true, dup: true, pid: 111 }),
]);
assert(ex5.picks[0].variantId === "b", "tie-break prefers verified with PID");

// No priced variants
const ex6 = pickRecommendedVariants([{ variantId: "x", shippingCost: 0 }]);
assert(ex6.strategy === "none", "no priced → none strategy");

// Full analysis + export round-trip
const analysis = analyzeLiveVariants(
  [v(60), v(61), v(69)],
  {
    primaryResults: [v(60), v(61), v(69)],
    framedExtras: [v(95, { id: "f95" })],
    baselineShipping: 75,
    categoryId: 10004,
    categoryName: "Kurtis",
  },
);
assert(analysis.stats.totalVariants === 4, "combines primary + framed");
assert(analysis.stats.lowestPrice === 60, "lowest price 60");
assert(analysis.recommendation.picks.length === 2, "analysis recommends pair");

const csv = exportReportCsv(analysis);
assert(csv.includes("VARIANT"), "csv has VARIANT rows");
assert(csv.includes("RECOMMENDATION"), "csv has RECOMMENDATION rows");
assert(csv.includes("PATTERN"), "csv has pattern notes");

const parsed = parseReportCsv(csv);
assert(parsed.variants.length === 4, "parse csv restores 4 variants");
assert(parsed.meta.strategy === "rupee_pair", "parse csv restores meta strategy");

const txt = exportReportTxt(analysis);
assert(txt.includes("RECOMMENDATION"), "txt has recommendation section");
assert(txt.includes("PRICE TIERS"), "txt has price tiers");

const pairs = findAllRupeePairs([46, 47, 60, 61]);
assert(pairs.length === 2, "finds all rupee pairs");

// 59 exists with higher ₹1 pair — floor wins
const ex59 = pickRecommendedVariants([v(59), v(64), v(65)]);
assert(ex59.strategy === "single_lowest", "59,64,65 → single lowest 59");
assert(ex59.picks[0].shippingCost === 59, "picks 59 not 64");

const ex59pair = pickRecommendedVariants([v(59), v(60), v(64), v(65)]);
assert(ex59pair.strategy === "rupee_pair", "59,60,64,65 → floor pair");
assert(
  ex59pair.picks.map((p) => p.shippingCost).join(",") === "59,60",
  "picks 59+60 not 64+65",
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll live variant report tests passed");
