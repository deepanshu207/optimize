/**
 * Unit tests for Phase 2 candidate picking (no browser).
 */
import { pickLiveVerifyCandidates } from "../app.suppliersden.com/js/testLabBridge.mjs";

const phase1 = [
  { variantId: "p1-1", estShipping: 24, meta: { path: "studio_ultra" } },
  { variantId: "p1-2", estShipping: 28, meta: { path: "studio" } },
  { variantId: "p1-3", estShipping: 50, meta: { path: "tall" } },
  { variantId: "p1-4", estShipping: 42, meta: { path: "flatlay" } },
];
const phase2 = Array.from({ length: 8 }, (_, i) => ({
  variantId: `f${i + 1}`,
  phase2: true,
  meta: { path: "framed_live" },
  estShipping: 49 + i,
}));

const picked = pickLiveVerifyCandidates([...phase1, ...phase2], 12);
const ids = picked.map((r) => r.variantId);

if (!ids.includes("p1-1") || !ids.includes("p1-3")) {
  console.error("FAIL: phase1 paths should be represented", ids);
  process.exit(1);
}
const framedPicked = picked.filter((r) => r.meta?.path === "framed_live");
if (framedPicked.length > 5) {
  console.error("FAIL: should cap framed_live picks at 5", framedPicked.length);
  process.exit(1);
}
if (framedPicked.length < 1) {
  console.error("FAIL: should include some framed_live", ids);
  process.exit(1);
}
if (picked.length > 12) {
  console.error("FAIL: should cap at maxCount");
  process.exit(1);
}

console.log("PASS: pickLiveVerifyCandidates", ids);
console.log("PASS: Phase 2 unit tests");
