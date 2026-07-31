// Test suite for localPriceModel.js + liveVariantReport.js (non-module versions)
import { readFileSync } from "fs";
import { createRequire } from "module";

// Minimal browser shim
const ls = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
})();
global.window = { LiveVariantReport: null, LocalPriceModel: null };
global.localStorage = ls;

const lvrCode = readFileSync("./app.suppliersden.com/js/liveVariantReport.js", "utf8");
const lpmCode = readFileSync("./app.suppliersden.com/js/localPriceModel.js", "utf8");
const evalCtx = new Function("window", "localStorage", lvrCode + "\n" + lpmCode);
evalCtx(global.window, global.localStorage);

const LPM = global.window.LocalPriceModel;
const LVR = global.window.LiveVariantReport;

function ok(label, cond) {
  if (!cond) throw new Error("FAIL: " + label);
  console.log("ok:", label);
}

// 1. Empty state
ok("empty summary has 0 variants", LPM.getSummary().totalVariants === 0);

// 2. Import variants
const fakeVariants = [
  { variantId: "v1", shippingCost: 60, isVerified: true, path: "live_standard", kb: 48, width: 800, height: 800, borderPx: 0, badgeCount: 2 },
  { variantId: "v2", shippingCost: 61, path: "live_framed", kb: 50, width: 800, height: 800, borderPx: 3, badgeCount: 2 },
  { variantId: "v3", shippingCost: 75, path: "live_standard", kb: 62, width: 800, height: 800, borderPx: 0, badgeCount: 4 },
  { variantId: "v4", shippingCost: 0, path: "unpriced", kb: 48 }, // unpriced — should not be stored
];
const r1 = LPM.importVariants(fakeVariants, { categoryName: "Kurtis", categoryId: 10004, generatedAt: new Date().toISOString() });
ok("imports 3 priced variants (not unpriced)", r1.added === 3);
ok("total in db is 3", r1.total === 3);

// 3. Summary
const s = LPM.getSummary();
ok("summary totalVariants 3", s.totalVariants === 3);
ok("summary lowestSeen 60", s.lowestSeen === 60);
ok("summary reportCount 1", s.reportCount === 1);

// 4. getBestConfigs
const { configs } = LPM.getBestConfigs(10);
ok("best config has lowest shipping first", configs[0].minShipping === 60);
ok("returns 2 configs (live_standard different kb/badges gives diff keys)", configs.length >= 2);

// 5. Import second report, improve estimates
const secondReport = [
  { variantId: "v5", shippingCost: 55, path: "live_standard", kb: 46, width: 800, height: 800, borderPx: 0, badgeCount: 2 },
];
LPM.importVariants(secondReport, { categoryName: "Kurtis", categoryId: 10004 });
const s2 = LPM.getSummary();
ok("after second import lowestSeen is 55", s2.lowestSeen === 55);
ok("reportCount is 2", s2.reportCount === 2);
const { configs: c2 } = LPM.getBestConfigs(5);
ok("best config now 55", c2[0].minShipping === 55);

// 6. Parse CSV from LVR
const analysis = LVR.analyzeLiveVariants(fakeVariants, {});
const csv = LVR.exportReportCsv(analysis);
const parsed = LPM.parseReportCsvText(csv);
// CSV includes all 4 variants (the exporter doesn't filter unpriced rows)
ok("parseReportCsvText extracts all VARIANT rows", parsed.variants.length === 4);
ok("parsed variant has shippingCost 60", parsed.variants.some((v) => v.shippingCost === 60));

// 7. Import from parsed CSV
LPM.clearAll();
const r2 = LPM.importVariants(parsed.variants, parsed.meta);
ok("import from parsed csv: 3 priced", r2.added === 3);

// 8. Clear
LPM.clearAll();
ok("clearAll resets to 0", LPM.getSummary().totalVariants === 0);

console.log("\nAll local price model tests passed");
