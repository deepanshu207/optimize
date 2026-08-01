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

const list = MeeshoCategories.getList();
const women = list.filter((c) => c.rootName === "Women Fashion");
const kurtis = list.find((c) => c.id === 10004);
const ethnic = women.filter((c) => c.sectionName === "Ethnic Wear");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

assert(list.length >= 3000, `full tree has ${list.length} leaf categories`);
assert(women.length >= 150, `Women Fashion has ${women.length} leaf categories`);
assert(kurtis?.name === "Kurtis", "default Kurtis category exists");
assert(
  kurtis?.path?.includes("Women Fashion") &&
    kurtis?.path?.includes("Ethnic Wear"),
  "Kurtis path includes Women Fashion hierarchy",
);
assert(ethnic.length >= 20, `Ethnic Wear section has ${ethnic.length} categories`);

const defaults = MeeshoCategories.getWomenClothRelatedList();
assert(
  defaults.every((c) => MeeshoCategories.isWomenClothRelatedCategory(c)),
  "women cloth list contains only women apparel categories",
);
assert(
  defaults.length === MeeshoCategories.WOMEN_CLOTH_RELATED_COUNT,
  `women cloth list returns all ${MeeshoCategories.WOMEN_CLOTH_RELATED_COUNT} categories`,
);
assert(
  defaults.some((c) => c.sectionName === "Ethnic Wear"),
  "women list includes Ethnic Wear",
);
assert(
  defaults.some((c) => c.id === 10004),
  "women list includes Kurtis 10004",
);
assert(
  !defaults.some((c) => c.rootName === "Men Fashion"),
  "women list excludes Men Fashion",
);

const kurtisDisplay = MeeshoCategories.formatDisplay(kurtis, { source: "default" });
assert(
  kurtisDisplay.title === "Kurtis · ID 10004",
  "formatDisplay shows leaf name and id",
);
assert(
  kurtisDisplay.detail.includes("sscat_id 10004") &&
    kurtisDisplay.detail.includes(kurtis.path),
  "formatDisplay includes path and sscat_id note",
);
assert(
  MeeshoCategories.findById(10004)?.name === "Kurtis",
  "findById returns leaf category",
);

const womenSearch = list.filter((c) =>
  `${c.name} ${c.path}`.toLowerCase().includes("women fashion"),
);
assert(womenSearch.length >= women.length, "Women Fashion searchable via path");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll category tests passed");
