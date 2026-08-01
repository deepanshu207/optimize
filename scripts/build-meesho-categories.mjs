#!/usr/bin/env node
/**
 * Build js/meeshoCategories.js (web) + js/meeshoCategories-lite.js (extension)
 * from data/meesho-category-tree.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "app.suppliersden.com");
const jsonPath = path.join(root, "data", "meesho-category-tree.json");
const outFull = path.join(root, "js", "meeshoCategories.js");
const outLite = path.join(root, "js", "meeshoCategories-lite.js");

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
        sectionName: c.sectionName || "",
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

function isClothRelatedCategory(cat) {
  if (!cat) return false;
  const root = String(cat.rootName || "");
  const section = String(cat.sectionName || "");
  if (root === "Women Fashion" || root === "Men Fashion") return true;
  if (root === "Women" && /wear|inner|sleep|ethnic/i.test(section)) return true;
  if (section === "Kids Clothing") return true;
  if (/Kids - (Boys|Girls) Western Wear/i.test(section)) return true;
  if (section === "Apparel" && root === "Kids & Toys") return true;
  return false;
}

function isWomenClothRelatedCategory(cat) {
  if (!cat) return false;
  const root = String(cat.rootName || "");
  const section = String(cat.sectionName || "");
  if (root === "Women Fashion") return true;
  if (root === "Women" && /wear|inner|sleep|ethnic/i.test(section)) return true;
  return false;
}

const clothRelatedCount = categories.filter(isClothRelatedCategory).length;
const womenClothRelatedCount = categories.filter(isWomenClothRelatedCategory).length;

const SHARED_METHODS = `
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
      this._list = this.LIST?.length ? this.LIST.slice() : [];
    }
    return this._list;
  },

  isClothRelatedCategory(cat) {
    if (!cat) return false;
    const root = String(cat.rootName || "");
    const section = String(cat.sectionName || "");
    if (root === "Women Fashion" || root === "Men Fashion") return true;
    if (root === "Women" && /wear|inner|sleep|ethnic/i.test(section)) return true;
    if (section === "Kids Clothing") return true;
    if (/Kids - (Boys|Girls) Western Wear/i.test(section)) return true;
    if (section === "Apparel" && root === "Kids & Toys") return true;
    return false;
  },

  getClothRelatedFromList(sourceList) {
    const list = sourceList || this.getList();
    const ROOT_ORDER = {
      "Women Fashion": 0,
      "Men Fashion": 1,
      Women: 2,
      "Kids & Toys": 3,
    };
    return list
      .filter((c) => this.isClothRelatedCategory(c))
      .sort((a, b) => {
        const ra = ROOT_ORDER[a.rootName] ?? 99;
        const rb = ROOT_ORDER[b.rootName] ?? 99;
        if (ra !== rb) return ra - rb;
        const sa = String(a.sectionName || "");
        const sb = String(b.sectionName || "");
        if (sa !== sb) return sa.localeCompare(sb);
        const pa = String(a.parentName || "");
        const pb = String(b.parentName || "");
        if (pa !== pb) return pa.localeCompare(pb);
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  },

  getClothRelatedList() {
    return this.getClothRelatedFromList(this.getList());
  },

  isWomenClothRelatedCategory(cat) {
    if (!cat) return false;
    const root = String(cat.rootName || "");
    const section = String(cat.sectionName || "");
    if (root === "Women Fashion") return true;
    if (root === "Women" && /wear|inner|sleep|ethnic/i.test(section)) return true;
    return false;
  },

  getWomenClothRelatedFromList(sourceList) {
    const list = sourceList || this.getList();
    const SECTION_ORDER = [
      "Ethnic Wear",
      "Western Wear",
      "Women Ethnic Wear",
      "Women Western Wear",
      "Inner & Sleepwear",
      "Women Inner & Sleep Wear",
      "Footwear",
      "Sports & Activewear",
      "Accessories",
      "Maternity",
    ];
    return list
      .filter((c) => this.isWomenClothRelatedCategory(c))
      .sort((a, b) => {
        const sa = String(a.sectionName || "");
        const sb = String(b.sectionName || "");
        const ia = SECTION_ORDER.indexOf(sa);
        const ib = SECTION_ORDER.indexOf(sb);
        if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        const pa = String(a.parentName || "");
        const pb = String(b.parentName || "");
        if (pa !== pb) return pa.localeCompare(pb);
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  },

  getWomenClothRelatedList() {
    return this.getWomenClothRelatedFromList(this.getList());
  },

  getDefaultListFrom(sourceList, limit) {
    const cloth = this.getClothRelatedFromList(sourceList);
    if (!cloth.length) {
      const list = sourceList || this.getList();
      const cap = limit && limit > 0 ? limit : 50;
      return list.slice(0, cap);
    }
    if (limit && limit > 0 && cloth.length > limit) {
      return cloth.slice(0, limit);
    }
    return cloth;
  },

  getDefaultList(limit) {
    return this.getDefaultListFrom(this.getList(), limit);
  },

  getDefaultCategoryId() {
    const list = this.getList();
    if (list.some((c) => c.id === this.DEFAULT_CATEGORY_ID)) {
      return this.DEFAULT_CATEGORY_ID;
    }
    const women = list.find((c) => c.rootName === this.DEFAULT_ROOT);
    return women?.id || list[0]?.id || null;
  },

  findByIdInList(id, sourceList) {
    const parsed = parseInt(id, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    const list = sourceList || this.getList();
    return list.find((c) => c.id === parsed) || null;
  },

  findById(id) {
    return this.findByIdInList(id, this.getList());
  },

  normalizeSearchText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\\s+/g, " ")
      .trim();
  },

  searchInList(query, sourceList, limit = 100) {
    const raw = String(query || "").trim();
    if (!raw) return [];

    const list = sourceList || this.getList();
    const idOnly = raw.match(/^\\d{3,6}$/);
    if (idOnly) {
      const exact = this.findByIdInList(idOnly[0], list);
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

  search(query, limit = 100) {
    return this.searchInList(query, this.getList(), limit);
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
    const title = \`\${cat.name} · ID \${cat.id}\`;
    const path = cat.path || cat.parentName || "";
    const parts = [];
    if (path) parts.push(path);
    parts.push(\`sscat_id \${cat.id} for live pricing\`);
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
    const title = \`Category ID \${parsed}\`;
    const parts = [\`sscat_id \${parsed} for live pricing\`];
    if (options.source === "page") parts.push("from Meesho page");
    return { title, detail: parts.join(" · "), apiId: parsed, path: "" };
  },

  async loadTreeFromUrl(url) {
    const resp = await fetch(url, { cache: "force-cache" });
    if (!resp.ok) throw new Error("Category tree fetch failed: " + resp.status);
    const tree = await resp.json();
    this._list = this.parseTree(tree);
    window.MEESHO_EMBEDDED_CATEGORIES = this._list;
    return this._list;
  },
`;

const fullJs = `// Auto-generated from data/meesho-category-tree.json — do not edit by hand
// Regenerate: node scripts/build-meesho-categories.mjs

const MeeshoCategories = {
  SOURCE: "embedded-v2",
  DEFAULT_CATEGORY_ID: 10004,
  DEFAULT_ROOT: "Women Fashion",
  COUNT: ${categories.length},
  WOMEN_FASHION_COUNT: ${womenFashionCount},
  CLOTH_RELATED_COUNT: ${clothRelatedCount},
  WOMEN_CLOTH_RELATED_COUNT: ${womenClothRelatedCount},
  FULL_CATEGORY_MIN: 3000,
  LIST: ${JSON.stringify(categories)},
  _list: null,
${SHARED_METHODS}
};

window.MeeshoCategories = MeeshoCategories;
window.MEESHO_EMBEDDED_CATEGORIES = MeeshoCategories.getList();
`;

const liteJs = `// Extension lite loader — full ${categories.length} categories from bundled JSON
// Regenerate: node scripts/build-meesho-categories.mjs

const MeeshoCategories = {
  SOURCE: "extension-json-v1",
  DEFAULT_CATEGORY_ID: 10004,
  DEFAULT_ROOT: "Women Fashion",
  COUNT: ${categories.length},
  WOMEN_FASHION_COUNT: ${womenFashionCount},
  CLOTH_RELATED_COUNT: ${clothRelatedCount},
  WOMEN_CLOTH_RELATED_COUNT: ${womenClothRelatedCount},
  FULL_CATEGORY_MIN: 3000,
  LIST: [],
  _list: null,
  _loadPromise: null,

  categoryJsonUrl() {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL("data/meesho-category-tree.json");
    }
    return null;
  },

  async ensureLoaded() {
    if (this._list?.length >= this.FULL_CATEGORY_MIN) return this._list;
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = (async () => {
      const url = this.categoryJsonUrl();
      if (!url) throw new Error("Extension category JSON URL unavailable");
      const list = await this.loadTreeFromUrl(url);
      if (!list?.length) throw new Error("Category tree parsed empty");
      console.log("✅ Extension loaded categories from JSON:", list.length);
      return list;
    })();

    try {
      return await this._loadPromise;
    } catch (e) {
      console.error("Extension category JSON load failed:", e);
      throw e;
    } finally {
      this._loadPromise = null;
    }
  },

${SHARED_METHODS}
};

window.MeeshoCategories = MeeshoCategories;
`;

fs.writeFileSync(outFull, fullJs);
fs.writeFileSync(outLite, liteJs);
console.log(
  `Wrote ${outFull} and ${outLite} (${categories.length} categories, ${womenFashionCount} Women Fashion)`,
);
