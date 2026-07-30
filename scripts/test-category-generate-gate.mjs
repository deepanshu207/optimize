#!/usr/bin/env node

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

function parseCategoryId(id) {
  const parsed = parseInt(id, 10);
  return parsed > 0 ? parsed : null;
}

function makePricingApi() {
  const cache = { categoryId: null };
  let pricingRun = null;
  return {
    cache,
    beginPricingRun(meta = {}) {
      const sscatId = parseCategoryId(meta.sscatId);
      if (!sscatId) return null;
      pricingRun = { sscatId, locked: true };
      cache.categoryId = sscatId;
      return pricingRun;
    },
    endPricingRun() {
      pricingRun = null;
    },
    getPricingSscatId(fallback) {
      if (pricingRun?.sscatId) return pricingRun.sscatId;
      const cached = parseCategoryId(cache.categoryId);
      if (cached) return cached;
      return fallback ?? 18044;
    },
  };
}

const api = makePricingApi();
api.beginPricingRun({ sscatId: 10123, categoryName: "Gowns - Ethnic" });
assert(api.getPricingSscatId() === 10123, "pricing run locks gown sscat 10123");
api.cache.categoryId = 10004;
assert(
  api.getPricingSscatId() === 10123,
  "locked sscat survives kurtis cache overwrite",
);
api.endPricingRun();
assert(
  api.getPricingSscatId() === 10004,
  "after unlock uses cache category again",
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll category pricing lock tests passed");
