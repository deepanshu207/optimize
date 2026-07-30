#!/usr/bin/env node
/**
 * Tests Meesho page category + catalog image detection helpers (mock DOM).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const apiCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/meeshoApi.js"),
  "utf8",
);

function mockElement({ tag = "input", attrs = {}, value = "" } = {}) {
  return {
    tagName: tag.toUpperCase(),
    name: attrs.name || "",
    id: attrs.id || "",
    value,
    type: attrs.type || "",
    dataset: attrs.dataset || {},
    getAttribute(name) {
      return attrs[name] ?? attrs[name.replace("data-", "")] ?? null;
    },
    closest() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
}

function loadAPI({ querySelectorImpl, querySelectorAllImpl, href } = {}) {
  const elements = [];
  const document = {
    querySelector(sel) {
      if (querySelectorImpl) return querySelectorImpl(sel);
      return null;
    },
    querySelectorAll(sel) {
      if (querySelectorAllImpl) return querySelectorAllImpl(sel);
      return elements;
    },
  };
  const window = {
    MeeshoCategories: { getDefaultCategoryId: () => 10004 },
    location: { href: href || "https://supplier.meesho.com/cataloging/single/add" },
    document,
    WEB_OPTIMIZER_MODE: false,
  };
  globalThis.document = document;
  globalThis.location = window.location;
  // eslint-disable-next-line no-new-func
  const fn = new Function("window", `${apiCode}\nreturn window.MeeshoAPI;`);
  return fn(window);
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

{
  const el = mockElement({ attrs: { name: "sscat_id", type: "hidden" }, value: "12345" });
  const api = loadAPI({
    querySelectorImpl(sel) {
      if (sel.includes("sscat")) return el;
      return null;
    },
    querySelectorAllImpl() {
      return [];
    },
  });
  assert(api.detectCategoryId() === 12345, "detectCategoryId reads hidden sscat_id");
}

{
  const api = loadAPI({
    href: "https://supplier.meesho.com/cataloging/single/edit?sscat_id=99999",
  });
  assert(api.detectCategoryId() === 99999, "detectCategoryId reads URL sscat_id");
}

{
  const el = mockElement({ attrs: { name: "sscat_id" }, value: "11111" });
  const api = loadAPI({
    querySelectorImpl(sel) {
      if (sel.includes("sscat")) return el;
      return null;
    },
    querySelectorAllImpl() {
      return [];
    },
  });
  assert(
    api.resolveCategoryId({ userCategoryId: 22222 }) === 22222,
    "resolveCategoryId prefers explicit user category",
  );
}

{
  const api = loadAPI();
  assert(api.resolveCategoryId() === 10004, "resolveCategoryId falls back to Kurtis 10004");
}

{
  const api = loadAPI();
  api.setCategory(55555);
  api.setCategory(null);
  assert(api.cache.categoryId == null, "setCategory(null) clears categoryId");
}

{
  const full = "https://images.meesho.com/images/products/123456/abc.jpg";
  const thumb = "https://images.meesho.com/images/thumb/small.jpg";
  const hidden = mockElement({
    attrs: { name: "catalog_image_url", type: "hidden" },
    value: full,
  });
  const imgFull = {
    currentSrc: full,
    src: full,
    getAttribute: () => null,
    closest: () => ({ querySelectorAll: () => [imgFull, imgThumb] }),
  };
  const imgThumb = {
    currentSrc: thumb,
    src: thumb,
    getAttribute: () => null,
    closest: () => null,
  };
  const front = { closest: () => ({ querySelectorAll: () => [imgFull, imgThumb] }) };
  const api = loadAPI({
    querySelectorImpl(sel) {
      if (sel === "#changeFrontImage") return front;
      return null;
    },
    querySelectorAllImpl(sel) {
      if (sel.includes("hidden")) return [hidden];
      if (sel.includes("meesho")) return [imgFull, imgThumb];
      return [];
    },
  });
  const url = api.detectCatalogImageUrl();
  assert(url === full, "detectCatalogImageUrl prefers full product image");
  assert(api.isMeeshoHostedImageUrl(url), "isMeeshoHostedImageUrl accepts Meesho CDN");
  assert(!api.isMeeshoHostedImageUrl("data:image/jpeg;base64,abc"), "rejects data URLs");
}

{
  const api = loadAPI();
  assert(api.parseCategoryId("10004") === 10004, "parseCategoryId parses string");
  assert(api.parseCategoryId(0) === null, "parseCategoryId rejects zero");
}

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll page-context tests passed");
