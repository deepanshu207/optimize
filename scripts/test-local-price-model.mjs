#!/usr/bin/env node
import {
  samplesFromReportCsv,
  applyLocalPriceEstimates,
} from "../app.suppliersden.com/js/localPriceModel.mjs";
import {
  analyzeLiveVariants,
  exportReportCsv,
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

function row(id, price, kb, path = "studio") {
  return {
    variantId: id,
    name: id,
    shippingCost: price,
    variantStyle: "standard",
    meta: { kb, path, canvasW: 1200, canvasH: 1200 },
  };
}

const analysis = analyzeLiveVariants(
  [row("low", 50, 20), row("mid", 70, 45), row("high", 100, 90)],
  {
    primaryResults: [row("low", 50, 20), row("mid", 70, 45), row("high", 100, 90)],
    categoryId: 10004,
    categoryName: "Kurtis",
  },
);
const csv = exportReportCsv(analysis);
const samples = samplesFromReportCsv(csv);
assert(samples.length === 3, "imports priced rows from report CSV");

const estimated = applyLocalPriceEstimates(
  [
    { variantId: "new-low", name: "new-low", meta: { kb: 21, path: "studio" } },
    { variantId: "new-high", name: "new-high", meta: { kb: 91, path: "studio" } },
  ],
  samples,
  { categoryId: 10004 },
);
assert(estimated.results.length === 2, "estimates all variants");
assert(
  estimated.results[0].shippingCost <= estimated.results[1].shippingCost,
  "sorts by estimated local shipping",
);
assert(estimated.results[0].localPrice === true, "marks local price rows");
assert(estimated.recommendation.picks.length >= 1, "builds local recommendation");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll local price model tests passed");
