// Extension lite loader — full 3777 categories from bundled JSON
// Regenerate: node scripts/build-meesho-categories.mjs

const MeeshoCategories = {
  SOURCE: "extension-json-v1",
  DEFAULT_CATEGORY_ID: 10004,
  DEFAULT_ROOT: "Women Fashion",
  COUNT: 3777,
  WOMEN_FASHION_COUNT: 164,
  CLOTH_RELATED_COUNT: 368,
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

  getClothRelatedList() {
    const ROOT_ORDER = {
      "Women Fashion": 0,
      "Men Fashion": 1,
      Women: 2,
      "Kids & Toys": 3,
    };
    return this.getList()
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

  getDefaultList(limit) {
    const cloth = this.getClothRelatedList();
    if (!cloth.length) {
      const list = this.getList();
      const cap = limit && limit > 0 ? limit : 50;
      return list.slice(0, cap);
    }
    if (limit && limit > 0 && cloth.length > limit) {
      return cloth.slice(0, limit);
    }
    return cloth;
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
    window.MEESHO_EMBEDDED_CATEGORIES = this._list;
    return this._list;
  },

};

window.MeeshoCategories = MeeshoCategories;
