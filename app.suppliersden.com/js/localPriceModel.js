// localPriceModel.js — learns from imported CSV reports, estimates best configs
// Loaded as a content script (no ES module syntax).
(function () {
  "use strict";

  const STORAGE_KEY = "meesho_local_price_db";
  const MAX_STORED = 5000; // max variant rows kept across all reports

  // ── Storage helpers ────────────────────────────────────────────────────────

  function loadDb() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { variants: [], meta: {} };
      return JSON.parse(raw);
    } catch (_e) {
      return { variants: [], meta: {} };
    }
  }

  function saveDb(db) {
    try {
      // Keep newest MAX_STORED rows
      if (db.variants.length > MAX_STORED) {
        db.variants = db.variants.slice(-MAX_STORED);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      return true;
    } catch (_e) {
      return false;
    }
  }

  // ── Variant fingerprinting ─────────────────────────────────────────────────
  // We group by "configuration" — image style features that determine shipping.

  function configKey(v) {
    // Normalise so minor noise doesn't create extra buckets
    const kb = Math.round(Number(v.kb) || 0);
    const w = Number(v.width) || 0;
    const h = Number(v.height) || 0;
    const border = Number(v.borderPx) || 0;
    const badges = Number(v.badgeCount) || 0;
    const style = String(v.path || v.variantStyle || v.mode || "").toLowerCase().trim();
    return `${style}|${w}x${h}|${kb}kb|b${border}|n${badges}`;
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  /**
   * Import an array of variant rows parsed from a CSV report into the database.
   * Only rows with a positive shippingCost are stored (unpriced rows carry no signal).
   */
  function importVariants(variants, reportMeta) {
    if (!Array.isArray(variants) || !variants.length) return { added: 0, total: 0 };
    const db = loadDb();
    const priced = variants.filter((v) => num(v.shippingCost) > 0);
    const ts = Date.now();
    priced.forEach((v) => {
      db.variants.push({
        key: configKey(v),
        shipping: num(v.shippingCost),
        estShipping: num(v.estShipping),
        path: String(v.path || v.variantStyle || ""),
        kb: num(v.kb),
        width: num(v.width),
        height: num(v.height),
        borderPx: num(v.borderPx),
        badgeCount: num(v.badgeCount),
        mode: String(v.mode || ""),
        variantStyle: String(v.variantStyle || ""),
        category: String(reportMeta?.categoryName || ""),
        categoryId: num(reportMeta?.categoryId),
        ts,
        reportTs: reportMeta?.generatedAt || "",
        isVerified: !!v.isVerified,
        liveVerified: !!v.liveVerified,
      });
    });
    if (!db.meta) db.meta = {};
    db.meta.lastImport = new Date().toISOString();
    db.meta.reportCount = (db.meta.reportCount || 0) + 1;
    saveDb(db);
    return { added: priced.length, total: db.variants.length };
  }

  // ── Analysis ───────────────────────────────────────────────────────────────

  /**
   * From all stored variants, group by config key, compute per-config stats,
   * then return the top-N configs sorted by minimum observed shipping.
   */
  function getBestConfigs(topN) {
    topN = Math.min(Math.max(Number(topN) || 10, 2), 20);
    const db = loadDb();
    const rows = db.variants || [];
    if (!rows.length) return { configs: [], totalVariants: 0 };

    const buckets = {};
    rows.forEach((v) => {
      const k = v.key;
      if (!buckets[k]) {
        buckets[k] = {
          key: k,
          path: v.path || v.variantStyle || v.mode || "unknown",
          kb: v.kb,
          width: v.width,
          height: v.height,
          borderPx: v.borderPx,
          badgeCount: v.badgeCount,
          shippings: [],
          categories: new Set(),
          verifiedCount: 0,
          sampleCount: 0,
          lastTs: 0,
        };
      }
      const b = buckets[k];
      b.shippings.push(v.shipping);
      b.sampleCount++;
      if (v.isVerified || v.liveVerified) b.verifiedCount++;
      if (v.category) b.categories.add(v.category);
      if (v.ts > b.lastTs) b.lastTs = v.ts;
    });

    const configs = Object.values(buckets).map((b) => {
      const sorted = b.shippings.slice().sort((a, c) => a - c);
      const minShip = sorted[0];
      const maxShip = sorted[sorted.length - 1];
      const avgShip = sorted.reduce((s, x) => s + x, 0) / sorted.length;
      const p25 = sorted[Math.floor(sorted.length * 0.25)] ?? minShip;
      return {
        key: b.key,
        path: b.path,
        kb: b.kb,
        width: b.width,
        height: b.height,
        borderPx: b.borderPx,
        badgeCount: b.badgeCount,
        minShipping: minShip,
        maxShipping: maxShip,
        avgShipping: Math.round(avgShip),
        p25Shipping: p25,
        sampleCount: b.sampleCount,
        verifiedCount: b.verifiedCount,
        categories: [...b.categories].slice(0, 3).join(", "),
        confidence: Math.min(1, b.sampleCount / 5),
        lastTs: b.lastTs,
      };
    });

    // Sort: lowest minShipping first; break ties by more samples
    configs.sort((a, b) => {
      if (a.minShipping !== b.minShipping) return a.minShipping - b.minShipping;
      return b.sampleCount - a.sampleCount;
    });

    return { configs: configs.slice(0, topN), totalVariants: rows.length };
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  function getSummary() {
    const db = loadDb();
    const rows = db.variants || [];
    const priced = rows.filter((v) => v.shipping > 0);
    const uniqueKeys = new Set(rows.map((v) => v.key)).size;
    const prices = priced.map((v) => v.shipping).sort((a, b) => a - b);
    return {
      totalVariants: rows.length,
      uniqueConfigs: uniqueKeys,
      pricedCount: priced.length,
      lowestSeen: prices[0] ?? null,
      highestSeen: prices[prices.length - 1] ?? null,
      reportCount: db.meta?.reportCount || 0,
      lastImport: db.meta?.lastImport || null,
    };
  }

  // ── Clear ──────────────────────────────────────────────────────────────────

  function clearAll() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_e) {}
  }

  // ── Parse a CSV report file (wrapper around LiveVariantReport if available) ─

  function parseReportCsvText(text) {
    if (window.LiveVariantReport?.parseReportCsv) {
      return window.LiveVariantReport.parseReportCsv(text);
    }
    // Minimal fallback parser: extract VARIANT rows only
    const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { variants: [], meta: {} };
    const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""));
    const col = (name) => header.indexOf(name);
    const variants = [];
    const meta = {};
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",");
      const type = (row[col("record_type")] || "").replace(/^"|"$/g, "");
      if (type === "META") {
        const k = (row[col("key")] || "").replace(/^"|"$/g, "");
        const v = (row[col("value")] || "").replace(/^"|"$/g, "");
        if (k) meta[k] = v;
      } else if (type === "VARIANT") {
        variants.push({
          variantId: (row[col("variant_id")] || "").replace(/^"|"$/g, ""),
          name: (row[col("name")] || "").replace(/^"|"$/g, ""),
          shippingCost: Number((row[col("shipping_inr")] || "").replace(/^"|"$/g, "")),
          estShipping: Number((row[col("est_inr")] || "").replace(/^"|"$/g, "")),
          isVerified: (row[col("verified")] || "").replace(/^"|"$/g, "") === "true",
          variantStyle: (row[col("variant_style")] || "").replace(/^"|"$/g, ""),
          path: (row[col("path")] || "").replace(/^"|"$/g, ""),
          kb: Number((row[col("kb")] || "").replace(/^"|"$/g, "")),
          width: Number((row[col("width")] || "").replace(/^"|"$/g, "")),
          height: Number((row[col("height")] || "").replace(/^"|"$/g, "")),
          borderPx: Number((row[col("border_px")] || "").replace(/^"|"$/g, "")),
          badgeCount: Number((row[col("badge_count")] || "").replace(/^"|"$/g, "")),
        });
      }
    }
    return { variants, meta };
  }

  // ── Expose ─────────────────────────────────────────────────────────────────

  window.LocalPriceModel = {
    importVariants,
    getBestConfigs,
    getSummary,
    clearAll,
    parseReportCsvText,
  };
})();
