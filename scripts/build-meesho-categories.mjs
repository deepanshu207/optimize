#!/usr/bin/env node
/**
 * Build js/meeshoCategories.js from data/meesho-category-tree.json
 * Replace the JSON with a fresh fetchCategoryTreeOld export to update categories.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "app.suppliersden.com");
const jsonPath = path.join(root, "data", "meesho-category-tree.json");
const outPath = path.join(root, "js", "meeshoCategories.js");

const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

function indexById(rows = []) {
  const map = new Map();
  for (const row of rows) {
    if (row?.id != null) map.set(String(row.id), row);
  }
  return map;
}

function buildHierarchyMaps(tree) {
  const items = tree?.items || [];
  const superCat = indexById(
    items.find((i) => i.type === "super-category")?.data || [],
  );
  const category = indexById(
    items.find((i) => i.type === "category")?.data || [],
  );
  const subCategory = indexById(
    items.find((i) => i.type === "sub-category")?.data || [],
  );
  return { superCat, category, subCategory };
}

function parseTree(tree) {
  if (!tree) return [];
  if (Array.isArray(tree)) {
    return tree
      .map((c) => ({
        id: parseInt(c.id, 10),
        name: c.name,
        parentName: c.parentName || c.parent_name || "",
        rootName: c.rootName || "",
        path: c.path || c.parentName || c.parent_name || "",
      }))
      .filter((c) => c.id && c.name);
  }

  const { superCat, category, subCategory } = buildHierarchyMaps(tree);
  const items = tree.items || [];
  const subSub = items.find((i) => i.type === "sub-sub-category");
  const rows = subSub?.data || tree.data || [];

  return rows
    .map((c) => {
      const sub = subCategory.get(String(c.parent_id));
      const cat = sub ? category.get(String(sub.parent_id)) : null;
      const root = cat ? superCat.get(String(cat.parent_id)) : null;
      const parentName = c.parent_name || c.parentName || sub?.name || "";
      const sectionName = cat?.name || "";
      const rootName = root?.name || cat?.parent_name || "";
      const parts = [rootName, sectionName, parentName].filter(Boolean);
      const path = parts.length ? parts.join(" › ") : parentName;
      return {
        id: parseInt(c.id, 10),
        name: c.name,
        parentName,
        sectionName,
        rootName,
        path,
      };
    })
    .filter((c) => c.id && c.name);
}

const categories = parseTree(raw);
const womenFashionCount = categories.filter(
  (c) => c.rootName === "Women Fashion",
).length;

const js = `// Auto-generated from data/meesho-category-tree.json — do not edit by hand
// Regenerate: node scripts/build-meesho-categories.mjs

const MeeshoCategories = {
  SOURCE: "embedded-v2",
  DEFAULT_CATEGORY_ID: 10004,
  DEFAULT_ROOT: "Women Fashion",
  COUNT: ${categories.length},
  WOMEN_FASHION_COUNT: ${womenFashionCount},

  LIST: ${JSON.stringify(categories)},

  parseTree(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw
        .map((c) => ({
          id: parseInt(c.id, 10),
          name: c.name,
          parentName: c.parentName || c.parent_name || "",
          sectionName: c.sectionName || "",
          rootName: c.rootName || "",
          path: c.path || c.parentName || c.parent_name || "",
        }))
        .filter((c) => c.id && c.name);
    }
    const items = raw.items || [];
    const superRows = items.find((i) => i.type === "super-category")?.data || [];
    const catRows = items.find((i) => i.type === "category")?.data || [];
    const subRows = items.find((i) => i.type === "sub-category")?.data || [];
    const superById = Object.fromEntries(superRows.map((r) => [String(r.id), r]));
    const catById = Object.fromEntries(catRows.map((r) => [String(r.id), r]));
    const subById = Object.fromEntries(subRows.map((r) => [String(r.id), r]));
    const subSub = items.find((i) => i.type === "sub-sub-category");
    const rows = subSub?.data || raw.data || [];
    return rows
      .map((c) => {
        const sub = subById[String(c.parent_id)];
        const cat = sub ? catById[String(sub.parent_id)] : null;
        const root = cat ? superById[String(cat.parent_id)] : null;
        const parentName = c.parent_name || c.parentName || sub?.name || "";
        const sectionName = cat?.name || "";
        const rootName = root?.name || cat?.parent_name || "";
        const parts = [rootName, sectionName, parentName].filter(Boolean);
        const path = parts.length ? parts.join(" › ") : parentName;
        return {
          id: parseInt(c.id, 10),
          name: c.name,
          parentName,
          sectionName,
          rootName,
          path,
        };
      })
      .filter((c) => c.id && c.name);
  },

  getList() {
    if (!this._list) {
      this._list = this.LIST?.length ? this.LIST.slice() : this.parseTree(this.TREE);
    }
    return this._list;
  },

  getDefaultList(limit = 50) {
    const list = this.getList();
    const preferred = list.filter((c) => c.rootName === this.DEFAULT_ROOT);
    if (!preferred.length) return list.slice(0, limit);
    if (preferred.length >= limit) return preferred.slice(0, limit);
    const rest = list.filter((c) => c.rootName !== this.DEFAULT_ROOT);
    return preferred.concat(rest).slice(0, limit);
  },

  getDefaultCategoryId() {
    const list = this.getList();
    if (list.some((c) => c.id === this.DEFAULT_CATEGORY_ID)) {
      return this.DEFAULT_CATEGORY_ID;
    }
    const women = list.find((c) => c.rootName === this.DEFAULT_ROOT);
    return women?.id || list[0]?.id || null;
  },

  findById(id) {
    const parsed = parseInt(id, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return this.getList().find((c) => c.id === parsed) || null;
  },

  normalizeSearchText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  search(query, limit = 100) {
    const raw = String(query || "").trim();
    if (!raw) return [];

    const list = this.getList();
    const idOnly = raw.match(/^\d{3,6}$/);
    if (idOnly) {
      const exact = this.findById(idOnly[0]);
      return exact ? [exact] : [];
    }

    const norm = this.normalizeSearchText(raw);
    if (!norm) return [];

    const tokens = norm.split(" ").filter(Boolean);
    const scored = [];

    for (const cat of list) {
      const hay = this.normalizeSearchText(
        [cat.id, cat.name, cat.parentName, cat.sectionName, cat.rootName, cat.path].join(
          " ",
        ),
      );
      if (!tokens.every((tok) => hay.includes(tok))) continue;

      let score = 0;
      const nameNorm = this.normalizeSearchText(cat.name);
      if (nameNorm === norm) score += 200;
      if (nameNorm.startsWith(norm)) score += 80;
      if (hay.includes(norm)) score += 40;
      if (String(cat.id) === raw) score += 300;
      score -= nameNorm.length * 0.01;
      scored.push({ cat, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((row) => row.cat);
  },

  findByLabel(label) {
    const results = this.search(label, 8);
    if (!results.length) return null;
    const norm = this.normalizeSearchText(label);
    const exact = results.find((c) => this.normalizeSearchText(c.name) === norm);
    return (exact || results[0]).id;
  },

  formatDisplay(cat, options = {}) {
    if (!cat?.id) return { title: "", detail: "", apiId: null };
    const title = `${cat.name} · ID ${cat.id}`;
    const path = cat.path || cat.parentName || "";
    const parts = [];
    if (path) parts.push(path);
    parts.push(`sscat_id ${cat.id} for live pricing`);
    if (options.source === "page") parts.push("from Meesho page");
    else if (options.source === "default") parts.push("default");
    else if (options.source === "user") parts.push("your selection");
    return { title, detail: parts.join(" · "), apiId: cat.id, path };
  },

  formatIdOnly(id, options = {}) {
    const parsed = parseInt(id, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { title: "", detail: "", apiId: null };
    }
    const title = `Category ID ${parsed}`;
    const parts = [`sscat_id ${parsed} for live pricing`];
    if (options.source === "page") parts.push("from Meesho page");
    return { title, detail: parts.join(" · "), apiId: parsed, path: "" };
  },

  async loadTreeFromUrl(url) {
    const resp = await fetch(url, { cache: "force-cache" });
    if (!resp.ok) throw new Error("Category tree fetch failed: " + resp.status);
    const tree = await resp.json();
    this._list = this.parseTree(tree);
    return this._list;
  },
};

window.MeeshoCategories = MeeshoCategories;
window.MEESHO_EMBEDDED_CATEGORIES = MeeshoCategories.getList();
`;

fs.writeFileSync(outPath, js);
console.log(
  `Wrote ${outPath} (${categories.length} categories, ${womenFashionCount} Women Fashion)`,
);
