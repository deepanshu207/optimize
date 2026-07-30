#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const liteCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/meeshoCategories-lite.js"),
  "utf8",
);
const tree = JSON.parse(
  readFileSync(resolve(root, "app.suppliersden.com/data/meesho-category-tree.json"), "utf8"),
);

const window = { chrome: { runtime: { getURL: (p) => `chrome-extension://test/${p}` } } };
globalThis.window = window;
globalThis.chrome = window.chrome;

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (String(url).includes("meesho-category-tree.json")) {
    return {
      ok: true,
      async json() {
        return tree;
      },
    };
  }
  return originalFetch(url);
};

// eslint-disable-next-line no-eval
eval(liteCode.replace("window.MeeshoCategories", "globalThis.MeeshoCategories"));
const MeeshoCategories = globalThis.MeeshoCategories;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const list = await MeeshoCategories.ensureLoaded();
assert(list.length === 3777, `extension lite loads ${list.length} categories`);
assert(
  MeeshoCategories.search("top and bottom sets", 5).some((c) => c.id === 10253),
  "lite search finds Top & Bottom Sets",
);
assert(MeeshoCategories.findById(10004)?.name === "Kurtis", "lite findById works");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nExtension category lite tests passed");
