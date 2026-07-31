#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const code = readFileSync(
  resolve(root, "app.suppliersden.com/js/meeshoCategories.js"),
  "utf8",
);
const window = {};
// eslint-disable-next-line no-eval
eval(code.replace("window.MeeshoCategories", "window.MeeshoCategories"));
const MeeshoCategories = window.MeeshoCategories;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const topBottom = MeeshoCategories.search("top and bottom sets", 10);
assert(
  topBottom.some((c) => c.id === 10253 && c.name === "Top & Bottom Sets"),
  "search finds Top & Bottom Sets with 'and' instead of '&'",
);

const byId = MeeshoCategories.search("10253", 5);
assert(byId[0]?.id === 10253, "search by numeric id 10253");

const labelId = MeeshoCategories.findByLabel("Kurtis");
assert(labelId === 10004, "findByLabel resolves Kurtis to 10004");

const norm = MeeshoCategories.normalizeSearchText("Top & Bottom Sets");
assert(norm === "top and bottom sets", "normalize converts & to and");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll category search tests passed");
