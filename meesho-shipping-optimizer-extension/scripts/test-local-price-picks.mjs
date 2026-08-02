#!/usr/bin/env node
/**
 * Local price tier picking — pickLocalStrategy + tier target cycling.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const content = readFileSync(resolve(root, "content.js"), "utf8");

const pickMatch = content.match(
  /function pickLocalStrategy\(prices\)\s*\{[\s\S]*?\n\}/,
);
if (!pickMatch) {
  console.error("Could not extract pickLocalStrategy");
  process.exit(1);
}

// eslint-disable-next-line no-eval
eval(`globalThis.pickLocalStrategy = ${pickMatch[0].replace(/^function /, "function ")}`);

function buildTierTargets(profile, count) {
  const rec =
    profile?.recommendedPrices?.length
      ? profile.recommendedPrices
      : profile?.tiers?.length
        ? [profile.tiers[0]]
        : [];
  if (!rec.length) return [];
  const targets = [];
  for (let i = 0; i < count; i++) {
    targets.push(rec[i % rec.length]);
  }
  return targets;
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const pair = globalThis.pickLocalStrategy([59, 59, 60, 79]);
assert(pair.strategy === "rupee_pair", "59,60,79 → rupee_pair");
assert(
  pair.recommendedPrices[0] === 59 && pair.recommendedPrices[1] === 60,
  "recommends 59 and 60",
);

const single = globalThis.pickLocalStrategy([59, 65, 79]);
assert(single.strategy === "single_lowest", "59,65,79 → single_lowest");
assert(single.recommendedPrices[0] === 59, "single lowest is 59");

const merged = globalThis.pickLocalStrategy([59, 60, 65, 79]);
assert(
  merged.recommendedPrices[0] === 59 && merged.recommendedPrices[1] === 60,
  "merged tiers pick 59+60 pair",
);

const profile = {
  recommendedPrices: [59, 60],
  strategy: "rupee_pair",
  tiers: [59, 60, 79],
};
const targets2 = buildTierTargets(profile, 2);
assert(targets2.join(",") === "59,60", "2 picks → 59,60 targets");
const targets4 = buildTierTargets(profile, 4);
assert(targets4.join(",") === "59,60,59,60", "4 picks cycle pair");

function getShippingCap(profile) {
  if (!profile?.recommendedPrices?.length) return null;
  if (profile.recommendedPrices.length >= 2) {
    return Math.max(...profile.recommendedPrices);
  }
  return profile.recommendedPrices[0];
}
assert(getShippingCap(profile) === 60, "cap is 60 for 59+60 pair");

function buildSessionProfile(catId, sessionPrices, categoryTiers) {
  const prices = [...new Set(sessionPrices.filter((p) => p > 0))].sort((a, b) => a - b);
  if (!prices.length) return null;
  const sessionPick = globalThis.pickLocalStrategy(prices);
  const learnedFloor = categoryTiers?.length
    ? Math.min(...categoryTiers.filter((n) => n > 0))
    : 0;
  if (learnedFloor > 0 && prices[0] > learnedFloor) return null;
  return {
    strategy: sessionPick.strategy,
    recommendedPrices: sessionPick.recommendedPrices,
    strategyReason: sessionPick.reason,
    hasData: true,
  };
}

const pinkSession = buildSessionProfile("10004", [59, 65, 67, 69, 79], [59, 60, 68]);
assert(pinkSession?.strategy === "single_lowest", "pink session → single_lowest");
assert(
  pinkSession?.recommendedPrices?.[0] === 59 &&
    pinkSession.recommendedPrices.length === 1,
  "pink session recommends only ₹59",
);
assert(
  getShippingCap({ hasData: true, recommendedPrices: pinkSession.recommendedPrices }) === 59,
  "pink session cap is ₹59 not ₹60",
);

const lavenderHigh = buildSessionProfile("10004", [68], [59, 60, 68]);
assert(lavenderHigh === null, "lavender high-slab only → null (category floor)");

const lavenderFloor = buildSessionProfile("10004", [59, 60, 68], [59, 60, 68]);
assert(lavenderFloor?.strategy === "rupee_pair", "lavender with floor → rupee_pair");

function shouldUseCategoryFloorBandLocal(catId, sessionPrices, pricedRows, categoryTiers) {
  const sessionProfile = buildSessionProfile(catId, sessionPrices, categoryTiers);
  if (sessionProfile?.strategy === "single_lowest") return false;
  const cap = getShippingCap({ hasData: true, recommendedPrices: [59, 60] });
  if (!cap) return false;
  let floorCount = 0;
  let highCount = 0;
  if (pricedRows?.length) {
    for (const row of pricedRows) {
      const ship = Number(row.shipping);
      if (ship <= 0) continue;
      if (ship <= cap) floorCount++;
      else highCount++;
    }
  } else {
    const prices = [...new Set(sessionPrices.filter((p) => p > 0))];
    for (const p of prices) {
      if (p <= cap) floorCount++;
      else highCount++;
    }
  }
  if (highCount === 0) return false;
  if (floorCount === 0) return true;
  return highCount > floorCount;
}

const lavenderRows = [
  { shipping: 59 },
  { shipping: 60 },
  ...Array.from({ length: 30 }, () => ({ shipping: 68 })),
];
assert(
  shouldUseCategoryFloorBandLocal("10004", [59, 60, 68], lavenderRows, [59, 60, 68]),
  "lavender 30×68 + 2 floor → category floor band",
);
assert(
  !shouldUseCategoryFloorBandLocal("10004", [59, 65, 67, 69, 79], [{ shipping: 59 }], [59, 60, 68]),
  "pink single_lowest session → not floor band override",
);

const targets5 = buildTierTargets(profile, 5);
assert(targets5.join(",") === "59,60,59,60,59", "5 picks cycle 59+60 pair");

const withGap = globalThis.pickLocalStrategy([59, 64, 65, 79]);
assert(withGap.strategy === "single_lowest", "59,64,65 → floor single (not 64+65 pair)");
assert(withGap.recommendedPrices[0] === 59, "floor single is 59");

const floorPair = globalThis.pickLocalStrategy([59, 60, 64, 65]);
assert(floorPair.strategy === "rupee_pair", "59,60,64,65 → floor rupee_pair");
assert(
  floorPair.recommendedPrices[0] === 59 && floorPair.recommendedPrices[1] === 60,
  "floor pair is 59+60 not 64+65",
);

function poolSizeForPickCount(pickCount) {
  const parsed = parseInt(pickCount, 10);
  const n = Number.isFinite(parsed)
    ? Math.min(10, Math.max(2, parsed))
    : 2;
  return Math.min(20, Math.max(n + 4, n * 3));
}

assert(poolSizeForPickCount(2) === 6, "pool size for 2 picks is 6");
assert(poolSizeForPickCount(4) === 12, "pool size for 4 picks is 12");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nLocal price pick tests passed");
