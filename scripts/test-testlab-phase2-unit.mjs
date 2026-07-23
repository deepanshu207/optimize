/**
 * Unit tests for Phase 2 candidate picking (no browser).
 */
import { pickLiveVerifyCandidates } from "../app.suppliersden.com/js/testLabBridge.mjs";

const phase1 = [
  { variantId: "p1-1", estShipping: 24, meta: { path: "studio_ultra" } },
  { variantId: "p1-2", estShipping: 28, meta: { path: "studio" } },
  { variantId: "p1-3", estShipping: 50, meta: { path: "tall" } },
];
const phase2 = [
  { variantId: "f1", phase2: true, meta: { path: "framed_live" }, estShipping: 49 },
  { variantId: "f2", phase2: true, meta: { path: "framed_live" }, estShipping: 49 },
];

const picked = pickLiveVerifyCandidates([...phase1, ...phase2], 8);
const ids = picked.map((r) => r.variantId);

if (!ids.includes("f1") || !ids.includes("f2")) {
  console.error("FAIL: phase2 framed should be prioritized", ids);
  process.exit(1);
}
if (ids.indexOf("f1") > ids.indexOf("p1-1")) {
  console.error("FAIL: framed should come before phase1", ids);
  process.exit(1);
}
if (picked.length > 8) {
  console.error("FAIL: should cap at maxCount");
  process.exit(1);
}

console.log("PASS: pickLiveVerifyCandidates", ids);
console.log("PASS: Phase 2 unit tests");
