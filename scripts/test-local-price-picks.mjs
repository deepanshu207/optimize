#!/usr/bin/env node
/**
 * Local price tier picking — pickLocalStrategy + tier target cycling.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const content = readFileSync(
  resolve(root, "app.suppliersden.com/content.js"),
  "utf8",
);

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

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nLocal price pick tests passed");
