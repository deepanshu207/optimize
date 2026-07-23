#!/usr/bin/env node
/**
 * Build js/meeshoCategories.js from data/meesho-category-tree.json
 * Replace the JSON file with a fresh fetchCategoryTreeOld export to update categories.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "app.suppliersden.com");
const jsonPath = path.join(root, "data", "meesho-category-tree.json");
const outPath = path.join(root, "js", "meeshoCategories.js");

const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const items = raw?.items || [];
const subCat = items.find((i) => i.type === "sub-sub-category");
const rows = subCat?.data || [];
const categories = rows.map((c) => ({
  id: parseInt(c.id, 10),
  name: c.name,
  parentName: c.parent_name || c.parentName || "",
}));

const js = `// Auto-generated from data/meesho-category-tree.json — do not edit by hand
// Regenerate: node scripts/build-meesho-categories.mjs

const MeeshoCategories = {
  SOURCE: "embedded-v1",
  DEFAULT_CATEGORY_ID: 10004,

  TREE: ${JSON.stringify(raw)},

  parseTree(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw
        .map((c) => ({
          id: parseInt(c.id, 10),
          name: c.name,
          parentName: c.parentName || c.parent_name || "",
        }))
        .filter((c) => c.id && c.name);
    }
    const items = raw.items || [];
    const subCat = items.find((i) => i.type === "sub-sub-category");
    const rows = subCat?.data || raw.data || [];
    return rows
      .map((c) => ({
        id: parseInt(c.id, 10),
        name: c.name,
        parentName: c.parent_name || c.parentName || "",
      }))
      .filter((c) => c.id && c.name);
  },

  getList() {
    if (!this._list) {
      this._list = this.parseTree(this.TREE);
    }
    return this._list;
  },

  getDefaultCategoryId() {
    const list = this.getList();
    if (list.some((c) => c.id === this.DEFAULT_CATEGORY_ID)) {
      return this.DEFAULT_CATEGORY_ID;
    }
    return list[0]?.id || null;
  },
};

window.MeeshoCategories = MeeshoCategories;
window.MEESHO_EMBEDDED_CATEGORIES = MeeshoCategories.getList();
`;

fs.writeFileSync(outPath, js);
console.log(`Wrote ${outPath} (${categories.length} categories)`);
