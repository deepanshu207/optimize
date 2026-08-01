// Meesho Shipping Optimizer v6.0.0 - Main Entry Point

// ─── Local Price Database ───────────────────────────────────────────────────
// Accumulates past report/CSV results in localStorage to estimate best local
// shipping without a live Meesho API call.
function parseReportCsvInline(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return { variants: [], meta: {}, tiers: [] };

  const parseCsvLine = (line) => {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };

  const header = parseCsvLine(lines[0]);
  const idx = (name) => header.indexOf(name);
  const variants = [];
  const meta = {};
  const tiers = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const type = row[idx("record_type")];
    if (type === "META") {
      meta[row[idx("key")]] = row[idx("value")];
    } else if (type === "VARIANT") {
      variants.push({
        variantId: row[idx("variant_id")],
        name: row[idx("name")],
        shippingCost: Number(row[idx("shipping_inr")]) || 0,
        estShipping: Number(row[idx("est_inr")]) || 0,
        isVerified: row[idx("verified")] === "true",
        liveVerified: row[idx("live_verified")] === "true",
        duplicatePid: row[idx("duplicate_pid")] || "",
        noPid: row[idx("no_pid")] === "true",
        variantStyle: row[idx("variant_style")],
        meta: {
          path: row[idx("path")],
          kb: row[idx("kb")],
          width: row[idx("width")],
          height: row[idx("height")],
        },
      });
    } else if (type === "PRICE_TIER") {
      tiers.push({
        variantId: row[idx("variant_id")],
        name: row[idx("name")],
        price: Number(row[idx("shipping_inr")]) || 0,
        gapToNext: row[idx("gap_to_next")],
        count: Number(row[idx("tier_count")]) || 0,
      });
    }
  }

  const uniquePrices = (meta.unique_prices || "")
    .split("|")
    .filter(Boolean)
    .map(Number)
    .filter((p) => p > 0);
  const recommendedPrices = (meta.recommended_prices || "")
    .split("|")
    .filter(Boolean)
    .map(Number)
    .filter((p) => p > 0);

  return {
    variants,
    meta,
    tiers,
    strategy: meta.strategy || "",
    strategyReason: meta.strategy_reason || "",
    uniquePrices,
    recommendedPrices,
  };
}

function pickLocalStrategy(prices) {
  const sorted = [...new Set(prices.filter((p) => p > 0))].sort((a, b) => a - b);
  if (!sorted.length) {
    return { strategy: "none", recommendedPrices: [], reason: "No price data." };
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] - sorted[i] === 1) {
      return {
        strategy: "rupee_pair",
        recommendedPrices: [sorted[i], sorted[i + 1]],
        reason: `₹1 pair at ₹${sorted[i]} & ₹${sorted[i + 1]} — test both.`,
      };
    }
  }
  return {
    strategy: "single_lowest",
    recommendedPrices: [sorted[0]],
    reason: `No ₹1 gap (${sorted.join(", ")}) — recommend only ₹${sorted[0]}.`,
  };
}

const LocalPriceDB = {
  KEY: "meesho_local_price_db",
  REPORTS_KEY: "meesho_local_price_reports",
  SEEDED_KEY: "meesho_local_price_seeded",
  MAX_ENTRIES: 200,
  MAX_REPORTS: 50,

  _read() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || "[]");
    } catch {
      return [];
    }
  },

  _write(entries) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(entries.slice(-this.MAX_ENTRIES)));
    } catch {}
  },

  _readReports() {
    try {
      return JSON.parse(localStorage.getItem(this.REPORTS_KEY) || "[]");
    } catch {
      return [];
    }
  },

  _writeReports(reports) {
    try {
      localStorage.setItem(
        this.REPORTS_KEY,
        JSON.stringify(reports.slice(-this.MAX_REPORTS)),
      );
    } catch {}
  },

  /** Save all priced variants from a completed run. */
  saveRun(variants, context = {}) {
    if (!variants?.length) return;
    const priced = variants.filter((v) => Number(v.shippingCost) > 0);
    if (!priced.length) return;
    const ts = Date.now();
    const cat = String(context.categoryId || "");
    const entries = this._read();
    priced.forEach((v) => {
      entries.push({
        ts,
        cat,
        price: Number(v.shippingCost),
        variantId: v.variantId || "",
        name: v.name || "",
        kb: v.meta?.kb || v.meta?.actualKb || "",
        width: v.meta?.width || v.meta?.canvasW || "",
        height: v.meta?.height || v.meta?.canvasH || "",
        borderPx: v.meta?.borderPx ?? "",
        style: v.variantStyle || v.meta?.style || "",
      });
    });
    this._write(entries);
  },

  /** Import a live report CSV (VARIANT + META + PRICE_TIER rows). */
  importCsv(text) {
    const parsed = parseReportCsvInline(text);
    const catId = String(parsed.meta.category_id || "");
    const priced = parsed.variants.filter((v) => Number(v.shippingCost) > 0);

    if (!priced.length && !parsed.uniquePrices.length) {
      return { ok: false, error: "No variant or tier data found in CSV." };
    }

    if (priced.length) {
      this.saveRun(priced, { categoryId: catId });
    }

    const reports = this._readReports();
    reports.push({
      ts: Date.now(),
      categoryId: catId,
      categoryName: parsed.meta.category_name || "",
      categoryPath: parsed.meta.category_path || "",
      strategy: parsed.strategy || pickLocalStrategy(parsed.uniquePrices).strategy,
      strategyReason:
        parsed.strategyReason || pickLocalStrategy(parsed.uniquePrices).reason,
      uniquePrices: parsed.uniquePrices,
      recommendedPrices:
        parsed.recommendedPrices.length
          ? parsed.recommendedPrices
          : pickLocalStrategy(parsed.uniquePrices).recommendedPrices,
      tiers: parsed.tiers,
      variantCount: parsed.variants.length,
      baselineShipping: Number(parsed.meta.baseline_shipping_inr) || 0,
    });
    this._writeReports(reports);

    return {
      ok: true,
      categoryId: catId,
      categoryName: parsed.meta.category_name || "",
      tiers: parsed.uniquePrices,
      recommendedPrices:
        parsed.recommendedPrices.length
          ? parsed.recommendedPrices
          : pickLocalStrategy(parsed.uniquePrices).recommendedPrices,
      variantCount: priced.length,
    };
  },

  /** Aggregated category profile from saved reports + variant history. */
  getCategoryProfile(catId) {
    const id = String(catId || "");
    const reports = this._readReports().filter((r) => r.categoryId === id);
    const tierSet = new Set();
    const tierCounts = {};

    reports.forEach((r) => {
      (r.uniquePrices || []).forEach((p) => {
        tierSet.add(p);
        tierCounts[p] = (tierCounts[p] || 0) + 1;
      });
    });

    this._read()
      .filter((e) => e.cat === id)
      .forEach((e) => {
        const p = Number(e.price);
        if (p > 0) {
          tierSet.add(p);
          tierCounts[p] = (tierCounts[p] || 0) + 1;
        }
      });

    const tiers = [...tierSet].sort((a, b) => a - b);
    const latest = reports[reports.length - 1];
    const strategyPick = pickLocalStrategy(tiers);

    return {
      categoryId: id,
      tiers,
      tierCounts,
      strategy: latest?.strategy || strategyPick.strategy,
      strategyReason: latest?.strategyReason || strategyPick.reason,
      recommendedPrices:
        latest?.recommendedPrices?.length
          ? latest.recommendedPrices
          : strategyPick.recommendedPrices,
      runCount: reports.length,
      hasData: tiers.length > 0,
    };
  },

  /** Tag a variant with a local tier estimate (no live price). */
  _tagLocalVariant(v, tierPrice, recommended) {
    return {
      ...v,
      localEstShipping: tierPrice,
      localRecommended: recommended,
      estShipping: tierPrice,
      shippingCost: 0,
      isVerified: false,
      localOnly: true,
      meta: {
        ...(v.meta || {}),
        localPrice: true,
        localTier: tierPrice,
        localEstimated: true,
      },
    };
  },

  /**
   * Pick exactly 2–3 variants for local generate — lowest shipping focus.
   * single_lowest (kurti): 3 picks all at lowest tier (e.g. ₹59).
   * rupee_pair: exactly 2 picks at the ₹1-apart pair.
   */
  buildLocalPicks(variants, catId) {
    const DISPLAY_MIN = 2;
    const DISPLAY_MAX = 3;
    const profile = this.getCategoryProfile(catId);

    const sorted = [...(variants || [])].sort(
      (a, b) =>
        (a.estShipping || a.meta?.estInr || 999) -
        (b.estShipping || b.meta?.estInr || 999),
    );

    if (!sorted.length) return [];

    if (!profile.hasData) {
      const count = Math.min(
        DISPLAY_MAX,
        Math.max(DISPLAY_MIN, sorted.length),
      );
      return sorted.slice(0, count).map((v, i) =>
        this._tagLocalVariant(
          v,
          v.estShipping || v.meta?.estInr || 0,
          i < count,
        ),
      );
    }

    const tiers = profile.tiers || [];
    const lowestTier =
      profile.recommendedPrices?.[0] || tiers[0] || sorted[0].estShipping || 0;

    if (
      profile.strategy === "rupee_pair" &&
      profile.recommendedPrices.length >= 2
    ) {
      const [low, high] = profile.recommendedPrices;
      const picks = [];
      const lowPick = sorted[0];
      if (lowPick) picks.push(this._tagLocalVariant(lowPick, low, true));
      const highPick =
        sorted.find((v) => v.variantId !== lowPick?.variantId) || sorted[1];
      if (highPick) picks.push(this._tagLocalVariant(highPick, high, true));
      return picks.slice(0, 2);
    }

    // single_lowest — e.g. kurti ₹59 only: 2–3 best est variants, all at lowest tier
    const count = Math.min(
      DISPLAY_MAX,
      Math.max(DISPLAY_MIN, sorted.length),
    );
    return sorted.slice(0, count).map((v) =>
      this._tagLocalVariant(v, lowestTier, true),
    );
  },

  /** Map generated variants to local tier estimates from category history. */
  assignLocalTiers(variants, catId) {
    const profile = this.getCategoryProfile(catId);
    const tiers = profile.tiers || [];
    if (!variants?.length) return [];

    const sorted = [...variants].sort(
      (a, b) =>
        (a.estShipping || a.meta?.estInr || 999) -
        (b.estShipping || b.meta?.estInr || 999),
    );

    if (!tiers.length) {
      return sorted.map((v) => ({
        ...v,
        localEstShipping: v.estShipping || 0,
        localRecommended: false,
      }));
    }

    const tierCount = tiers.length;
    const recommendedSet = new Set();

    profile.recommendedPrices.forEach((targetPrice) => {
      let best = null;
      let bestEst = 999;
      sorted.forEach((v, i) => {
        const tierIdx = Math.min(
          Math.floor((i / sorted.length) * tierCount),
          tierCount - 1,
        );
        if (tiers[tierIdx] === targetPrice) {
          const est = v.estShipping || v.meta?.estInr || 999;
          if (est < bestEst) {
            bestEst = est;
            best = v;
          }
        }
      });
      if (best) recommendedSet.add(best.variantId);
    });

    return sorted.map((v, i) => {
      const tierIdx = Math.min(
        Math.floor((i / sorted.length) * tierCount),
        tierCount - 1,
      );
      const localTier = tiers[tierIdx];
      return {
        ...v,
        localEstShipping: localTier,
        localRecommended: recommendedSet.has(v.variantId),
        estShipping: localTier,
        shippingCost: 0,
        isVerified: false,
        localOnly: true,
        meta: {
          ...(v.meta || {}),
          localPrice: true,
          localTier,
          localEstimated: true,
        },
      };
    });
  },

  /** Return all unique prices seen across all saved runs, sorted ascending. */
  allPrices(catFilter = "") {
    const entries = this._read();
    const rows = catFilter
      ? entries.filter((e) => e.cat === String(catFilter))
      : entries;
    const prices = [...new Set(rows.map((e) => Number(e.price)).filter((p) => p > 0))];
    const profile = catFilter ? this.getCategoryProfile(catFilter) : null;
    if (profile?.tiers?.length) {
      profile.tiers.forEach((p) => prices.push(p));
    }
    return [...new Set(prices)].sort((a, b) => a - b);
  },

  /** Best local price estimate: lowest price seen ≥ 2 times, or overall lowest. */
  bestLocalPrice(catFilter = "") {
    const profile = catFilter ? this.getCategoryProfile(catFilter) : null;
    if (profile?.recommendedPrices?.length) {
      return profile.recommendedPrices[0];
    }

    const entries = this._read();
    const rows = catFilter
      ? entries.filter((e) => e.cat === String(catFilter))
      : entries;
    const counts = {};
    rows.forEach((e) => {
      const p = Number(e.price);
      if (p > 0) counts[p] = (counts[p] || 0) + 1;
    });
    const confirmed = Object.keys(counts)
      .map(Number)
      .filter((p) => counts[p] >= 2)
      .sort((a, b) => a - b);
    if (confirmed.length) return confirmed[0];
    const all = Object.keys(counts).map(Number).sort((a, b) => a - b);
    return all[0] || null;
  },

  /** Summary for display. */
  summary(catFilter = "") {
    const entries = this._read();
    const rows = catFilter
      ? entries.filter((e) => e.cat === String(catFilter))
      : entries;
    const profile = catFilter ? this.getCategoryProfile(catFilter) : null;
    if (!rows.length && !profile?.hasData) return null;

    const prices = rows.map((e) => Number(e.price)).filter((p) => p > 0);
    if (profile?.tiers?.length) {
      profile.tiers.forEach((p) => prices.push(p));
    }
    const best = this.bestLocalPrice(catFilter);
    const min = prices.length ? Math.min(...prices) : best;
    const max = prices.length ? Math.max(...prices) : best;
    const runs =
      new Set(rows.map((e) => e.ts)).size + (profile?.runCount || 0);
    return {
      best,
      min,
      max,
      count: rows.length,
      runs,
      tiers: profile?.tiers || [],
      strategy: profile?.strategy || "",
      recommendedPrices: profile?.recommendedPrices || [],
    };
  },

  clear() {
    localStorage.removeItem(this.KEY);
    localStorage.removeItem(this.REPORTS_KEY);
    localStorage.removeItem(this.SEEDED_KEY);
  },

  async seedIfEmpty() {
    if (localStorage.getItem(this.SEEDED_KEY)) return;
    if (this._readReports().length > 0) {
      localStorage.setItem(this.SEEDED_KEY, "1");
      return;
    }

    let url = "data/seed-reports/kurti-10004.csv";
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      url = chrome.runtime.getURL(url);
    }

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const text = await res.text();
      const result = this.importCsv(text);
      if (result.ok) {
        localStorage.setItem(this.SEEDED_KEY, "1");
        console.log("[LocalPriceDB] Seeded kurti profile:", result);
      }
    } catch (e) {
      console.warn("[LocalPriceDB] Seed skipped:", e);
    }
  },
};

class MeeshoShippingOptimizer {
  constructor() {
    this.currentShippingCost = null;
    this.lastDetectedCost = null;
    this.isProcessing = false;
    this.shouldStop = false;
    this.currentResults = [];
    this.framedExtraResults = [];
    this.showFramedExtras = false;
    this.liveAnalysis = null;
    this.analysisPrimaryResults = [];
    this.analysisExtraResults = [];
    this.showAnalysisExtras = false;
    this.showcaseResults = [];
    this.showShowcaseResults = false;
    this.isGeneratingShowcase = false;
    this.promoLifestyleResults = [];
    this.showPromoLifestyleResults = false;
    this.isGeneratingPromoLifestyle = false;
    this.tallStaticResults = [];
    this.showTallStaticResults = false;
    this.isGeneratingTallStatic = false;
    this.gownStaticResults = [];
    this.showGownStaticResults = false;
    this.isGeneratingGownStatic = false;
    this.localPriceMode = false;
    this.localPriceProfile = null;
    this.lastProcessedFile = null;
    // Test Lab state — mirrors Live, isolated from currentResults
    this.testLabCurrentResults = [];
    this.testLabFramedExtraResults = [];
    this.testLabShowFramedExtras = false;
    this.testLabLiveAnalysis = null;
    this.testLabAnalysisPrimaryResults = [];
    this.testLabAnalysisExtraResults = [];
    this.testLabShowAnalysisExtras = false;
    this.activeOptimizerTab = "live";
    this.variationCount = 6;
    this.isLicensed = false;
    this.originalImageUrl = null;
    this.modal = null;
    this.autoPopupShown = false;
    this._borderThicknessTimer = null;
    this._gownLayerTimer = null;
    this._gownPhotoZoomTimer = null;
    this._gownPhotoPanTimer = null;
    this._gownPhotoMarginTimer = null;
    this._borderComposeGen = 0;
    this._staticControlsVariantId = null;
    this._categoryUserPicked = false;
    this._categoryUserEditing = false;
    this._categoryEditingTimer = null;
    this._categorySearchCommittedValue = "";
    this._uploadUserPicked = false;
    this._uploadUserCleared = false;
    this.init();
  }

  /** Web app or extension modal with Live / Test Lab tabs */
  isTabbedOptimizerUI() {
    return (
      !!window.WEB_OPTIMIZER_MODE ||
      !!document.querySelector("[data-optimizer-tab]")
    );
  }

  getTestLabModuleUrl() {
    if (window.WEB_OPTIMIZER_MODE) {
      return "/js/testLabBridge.mjs?v=33";
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL("js/testLabBridge.mjs?v=33");
    }
    return "/js/testLabBridge.mjs?v=33";
  }

  getLiveAnalysisModuleUrl() {
    if (window.WEB_OPTIMIZER_MODE) {
      return "/js/liveAnalysisBridge.mjs?v=96";
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL("js/liveAnalysisBridge.mjs?v=96");
    }
    return "/js/liveAnalysisBridge.mjs?v=96";
  }

  getLiveVariantReportModuleUrl() {
    if (window.WEB_OPTIMIZER_MODE) {
      return "/js/liveVariantReport.mjs?v=2";
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL("js/liveVariantReport.mjs?v=2");
    }
    return "/js/liveVariantReport.mjs?v=2";
  }

  getStaticComposeModuleUrl() {
    if (window.WEB_OPTIMIZER_MODE) {
      return "/js/staticFrameCompose.mjs?v=127";
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL("js/staticFrameCompose.mjs?v=127");
    }
    return "/js/staticFrameCompose.mjs?v=127";
  }

  async importOptimizerModule(getUrl, isReady, cacheKey) {
    if (isReady()) return true;
    if (window[cacheKey]) {
      try {
        return await window[cacheKey];
      } catch (e) {
        window[cacheKey] = null;
      }
    }
    if (!window[cacheKey]) {
      window[cacheKey] = this._loadOptimizerModule(getUrl, isReady, cacheKey);
    }
    return window[cacheKey];
  }

  async _loadOptimizerModule(getUrl, isReady, cacheKey) {
    const primary = getUrl();
    const fallback = primary.replace(/\?.*$/, "");
    const urls = primary === fallback ? [primary] : [primary, fallback];
    for (const url of urls) {
      try {
        await import(url);
        if (isReady()) return true;
      } catch (e) {
        console.warn("Module preload failed:", url, e);
      }
    }
    window[cacheKey] = null;
    return false;
  }

  async preloadStaticComposeModule() {
    return this.importOptimizerModule(
      () => this.getStaticComposeModuleUrl(),
      () => !!window.StaticFrameCompose?.composeStaticPreview,
      "__staticComposePromise",
    );
  }

  async preloadLiveAnalysisModule() {
    return this.importOptimizerModule(
      () => this.getLiveAnalysisModuleUrl(),
      () => !!window.LiveAnalysis?.runLiveAnalysis,
      "__liveAnalysisModulePromise",
    );
  }

  async preloadLiveVariantReportModule() {
    return this.importOptimizerModule(
      () => this.getLiveVariantReportModuleUrl(),
      () => !!window.LiveVariantReport?.createAndDownloadReport,
      "__liveVariantReportModulePromise",
    );
  }

  isStaticPromoRow(row) {
    if (row?.layers?._staticFrame) return true;
    if (typeof window.StaticFrameCompose !== "undefined") {
      return window.StaticFrameCompose.isStaticPromoVariant(row);
    }
    const style = row?.variantStyle || row?.meta?.path || "";
    return style === "showcase" || style === "lifestyle_promo" || style === "tall_static" || style === "gown_static";
  }

  async runLiveStaticAnalysis(file) {
    const ready = await this.preloadLiveAnalysisModule();
    if (!ready || !window.LiveAnalysis?.runLiveAnalysis) return null;
    return window.LiveAnalysis.runLiveAnalysis(file, {
      onProgress: (msg) => console.log("Analysis:", msg),
    });
  }

  async runShowcaseGeneration(file) {
    const ready = await this.preloadLiveAnalysisModule();
    if (!ready || !window.LiveAnalysis?.runShowcaseGeneration) return null;
    return window.LiveAnalysis.runShowcaseGeneration(file, {
      onProgress: (msg) => console.log("Showcase:", msg),
    });
  }

  async getImageFileForShowcase() {
    if (this.lastProcessedFile) return this.lastProcessedFile;
    const fileInput = document.getElementById("image-input");
    if (fileInput?.files?.[0]) return fileInput.files[0];
    if (this._pendingFile) return this._pendingFile;
    if (window.__webPendingFile) return window.__webPendingFile;
    return null;
  }

  async runPromoLifestyleGeneration(file) {
    const ready = await this.preloadLiveAnalysisModule();
    if (!ready || !window.LiveAnalysis?.runPromoLifestyleGeneration) return null;
    return window.LiveAnalysis.runPromoLifestyleGeneration(file, {
      onProgress: (msg) => console.log("Promo lifestyle:", msg),
    });
  }

  async runTallStaticGeneration(file) {
    const ready = await this.preloadLiveAnalysisModule();
    if (!ready || !window.LiveAnalysis?.runTallStaticGeneration) return null;
    return window.LiveAnalysis.runTallStaticGeneration(file, {
      onProgress: (msg) => console.log("Tall static:", msg),
    });
  }

  async runGownStaticGeneration(file) {
    const ready = await this.preloadLiveAnalysisModule();
    if (!ready || !window.LiveAnalysis?.runGownStaticGeneration) return null;
    return window.LiveAnalysis.runGownStaticGeneration(file, {
      onProgress: (msg) => console.log("Gown static:", msg),
    });
  }

  async generatePromoLifestyleFrames() {
    if (!window.WEB_OPTIMIZER_MODE) return;
    if (this.isGeneratingPromoLifestyle) return;

    const scrollToResults = !this.hasStaticPromoResults();
    const file = await this.getImageFileForShowcase();
    if (!file) {
      OptimizerUtils.showNotification("Choose an image first", "error");
      return;
    }

    this.lastProcessedFile = file;
    this.isGeneratingPromoLifestyle = true;
    this.displayLiveResultsPanel({ scroll: false });

    const processingArea = document.getElementById("processing-area");
    if (processingArea) {
      processingArea.style.display = "block";
      processingArea.innerHTML = `
        <div style="text-align:center;padding:24px 16px;">
          <div style="font-size:15px;font-weight:600;margin-bottom:8px;">Building lifestyle promo frames…</div>
          <div style="font-size:12px;color:#666;">Solid green frame · HOT/FLASH sale · 48–54 KB</div>
        </div>`;
    }

    try {
      const out = await this.runPromoLifestyleGeneration(file);
      if (!out?.success || !out.results?.length) {
        OptimizerUtils.showNotification(
          "Could not generate lifestyle promo frames",
          "error",
        );
        return;
      }
      this.promoLifestyleResults = out.results.map((r, i) =>
        this.mapResultFromApi(r, i + 70000),
      );
      this.promoLifestyleResults.sort(
        (a, b) => (a.estShipping || 999) - (b.estShipping || 999),
      );
      this.showPromoLifestyleResults = true;
      OptimizerUtils.showNotification(
        `✅ ${this.promoLifestyleResults.length} lifestyle promo frames ready (est ₹${this.promoLifestyleResults[0]?.estShipping || "—"})`,
        "success",
      );
      this.displayLiveResultsPanel({ scroll: scrollToResults });
    } catch (e) {
      console.error("Promo lifestyle generate:", e);
      OptimizerUtils.showNotification("Lifestyle promo generation failed", "error");
    } finally {
      this.isGeneratingPromoLifestyle = false;
      if (processingArea) processingArea.style.display = "none";
      this.displayLiveResultsPanel({ scroll: false });
    }
  }

  async generateTallStaticFrames() {
    if (!window.WEB_OPTIMIZER_MODE) return;
    if (this.isGeneratingTallStatic) return;

    const scrollToResults = !this.hasStaticPromoResults();
    const file = await this.getImageFileForShowcase();
    if (!file) {
      OptimizerUtils.showNotification("Choose an image first", "error");
      return;
    }

    this.lastProcessedFile = file;
    this.isGeneratingTallStatic = true;
    this.displayLiveResultsPanel({ scroll: false });

    const processingArea = document.getElementById("processing-area");
    if (processingArea) {
      processingArea.style.display = "block";
      processingArea.innerHTML = `
        <div style="text-align:center;padding:24px 16px;">
          <div style="font-size:15px;font-weight:600;margin-bottom:8px;">Building tall promo frames…</div>
          <div style="font-size:12px;color:#666;">703×1024 blue frame · corner badges · ₹50 band</div>
        </div>`;
    }

    try {
      const out = await this.runTallStaticGeneration(file);
      if (!out?.success || !out.results?.length) {
        OptimizerUtils.showNotification(
          "Could not generate tall promo frames",
          "error",
        );
        return;
      }
      this.tallStaticResults = out.results.map((r, i) =>
        this.mapResultFromApi(r, i + 80000),
      );
      this.tallStaticResults.sort(
        (a, b) => (a.estShipping || 999) - (b.estShipping || 999),
      );
      this.showTallStaticResults = true;
      OptimizerUtils.showNotification(
        `✅ ${this.tallStaticResults.length} tall promo frames ready (est ₹${this.tallStaticResults[0]?.estShipping || "—"})`,
        "success",
      );
      this.displayLiveResultsPanel({ scroll: scrollToResults });
    } catch (e) {
      console.error("Tall static generate:", e);
      OptimizerUtils.showNotification("Tall promo generation failed", "error");
    } finally {
      this.isGeneratingTallStatic = false;
      if (processingArea) processingArea.style.display = "none";
      this.displayLiveResultsPanel({ scroll: false });
    }
  }

  async generateShowcaseFrames() {
    if (!window.WEB_OPTIMIZER_MODE) return;
    if (this.isGeneratingShowcase) return;

    const scrollToResults = !this.hasStaticPromoResults();
    const file = await this.getImageFileForShowcase();
    if (!file) {
      OptimizerUtils.showNotification("Choose an image first", "error");
      return;
    }

    this.lastProcessedFile = file;
    this.isGeneratingShowcase = true;
    this.displayLiveResultsPanel({ scroll: false });

    const processingArea = document.getElementById("processing-area");
    if (processingArea) {
      processingArea.style.display = "block";
      processingArea.innerHTML = `
        <div style="text-align:center;padding:24px 16px;">
          <div style="font-size:15px;font-weight:600;margin-bottom:8px;">Building showcase frames…</div>
          <div style="font-size:12px;color:#666;">Tight portrait frame · static · no Meesho session</div>
        </div>`;
    }

    try {
      const out = await this.runShowcaseGeneration(file);
      if (!out?.success || !out.results?.length) {
        OptimizerUtils.showNotification(
          "Could not generate showcase frames",
          "error",
        );
        return;
      }
      this.showcaseResults = out.results.map((r, i) =>
        this.mapResultFromApi(r, i + 60000),
      );
      this.showcaseResults.sort(
        (a, b) => (a.estShipping || 999) - (b.estShipping || 999),
      );
      this.showShowcaseResults = true;
      OptimizerUtils.showNotification(
        `✅ ${this.showcaseResults.length} showcase frames ready (static est ₹)`,
        "success",
      );
      this.displayLiveResultsPanel({ scroll: scrollToResults });
    } catch (e) {
      console.error("Showcase generate:", e);
      OptimizerUtils.showNotification("Showcase generation failed", "error");
    } finally {
      this.isGeneratingShowcase = false;
      if (processingArea) processingArea.style.display = "none";
      this.displayLiveResultsPanel({ scroll: false });
    }
  }

  async generateGownStaticFrames() {
    if (!window.WEB_OPTIMIZER_MODE) return;
    if (this.isGeneratingGownStatic) return;

    const scrollToResults = !this.hasStaticPromoResults();
    const file = await this.getImageFileForShowcase();
    if (!file) {
      OptimizerUtils.showNotification("Choose an image first", "error");
      return;
    }

    this.lastProcessedFile = file;
    this.isGeneratingGownStatic = true;
    this.displayLiveResultsPanel({ scroll: false });

    const processingArea = document.getElementById("processing-area");
    if (processingArea) {
      processingArea.style.display = "block";
      processingArea.innerHTML = `
        <div style="text-align:center;padding:24px 16px;">
          <div style="font-size:15px;font-weight:600;margin-bottom:8px;">Building gown promo frames…</div>
          <div style="font-size:12px;color:#666;">773×1094 teal frame · lifestyle scene · thick white mat · ~₹49 band</div>
        </div>`;
    }

    try {
      const out = await this.runGownStaticGeneration(file);
      if (!out?.success || !out.results?.length) {
        OptimizerUtils.showNotification(
          "Could not generate gown promo frames",
          "error",
        );
        return;
      }
      this.gownStaticResults = out.results.map((r, i) =>
        this.mapResultFromApi(r, i + 90000),
      );
      this.gownStaticResults.sort(
        (a, b) => (a.estShipping || 999) - (b.estShipping || 999),
      );
      this.showGownStaticResults = true;
      OptimizerUtils.showNotification(
        `✅ ${this.gownStaticResults.length} gown promo frames ready (est ₹${this.gownStaticResults[0]?.estShipping || "—"})`,
        "success",
      );
      this.displayLiveResultsPanel({ scroll: scrollToResults });
    } catch (e) {
      console.error("Gown static generate:", e);
      OptimizerUtils.showNotification("Gown promo generation failed", "error");
    } finally {
      this.isGeneratingGownStatic = false;
      if (processingArea) processingArea.style.display = "none";
      this.displayLiveResultsPanel({ scroll: false });
    }
  }

  displayLiveResultsPanel(options = {}) {
    this.refreshLiveResultsPanel(options);
  }

  hasImageForStaticPromo() {
    return !!(
      this.lastProcessedFile ||
      this._pendingFile ||
      window.__webPendingFile ||
      document.getElementById("image-input")?.files?.[0]
    );
  }

  hasStaticPromoResults() {
    return !!(
      this.showcaseResults.length ||
      this.promoLifestyleResults.length ||
      this.tallStaticResults.length ||
      this.gownStaticResults.length
    );
  }

  shouldShowStaticPromoWorkspace() {
    return window.WEB_OPTIMIZER_MODE && (this.hasImageForStaticPromo() || this.hasStaticPromoResults());
  }

  refreshLiveResultsPanel(options = {}) {
    const resultsArea = document.getElementById("results-area");
    if (!resultsArea) return;

    const hasLiveContent =
      this.currentResults.length > 0 || this.analysisPrimaryResults.length > 0;
    const hasStaticWorkspace = this.shouldShowStaticPromoWorkspace();

    if (!window.WEB_OPTIMIZER_MODE) {
      if (!hasLiveContent) return;
    } else if (!hasLiveContent && !hasStaticWorkspace) {
      return;
    }

    resultsArea.style.display = "block";
    delete resultsArea.dataset.view;
    resultsArea.innerHTML = OptimizerUI.getResultsHTML(
      this.currentResults,
      this.getResultsViewOptions(),
    );
    this.setupResultsEvents();
    this.syncStaticPromoChrome();

    const shouldScroll =
      options.scroll !== false &&
      window.WEB_OPTIMIZER_MODE &&
      (this.hasStaticPromoResults() || hasLiveContent);
    if (shouldScroll) {
      resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  syncStaticPromoChrome() {
    const sticky = document.getElementById("generate-sticky");
    if (!sticky) return;
    const hideStaticBtns = this.shouldShowStaticPromoWorkspace();
    sticky.querySelectorAll("[data-static-gen]").forEach((btn) => {
      btn.style.display = hideStaticBtns ? "none" : "";
    });
  }

  bindStaticPromoButtons(root = document) {
    if (!window.WEB_OPTIMIZER_MODE) return;
    const hasFile = this.hasImageForStaticPromo();

    root.querySelectorAll('[data-static-gen="showcase"]').forEach((btn) => {
      btn.disabled = !hasFile || this.isGeneratingShowcase;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        void this.generateShowcaseFrames();
      };
    });
    root.querySelectorAll('[data-static-gen="lifestyle"]').forEach((btn) => {
      btn.disabled = !hasFile || this.isGeneratingPromoLifestyle;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        void this.generatePromoLifestyleFrames();
      };
    });
    root.querySelectorAll('[data-static-gen="tall"]').forEach((btn) => {
      btn.disabled = !hasFile || this.isGeneratingTallStatic;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        void this.generateTallStaticFrames();
      };
    });
    root.querySelectorAll('[data-static-gen="gown"]').forEach((btn) => {
      btn.disabled = !hasFile || this.isGeneratingGownStatic;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        void this.generateGownStaticFrames();
      };
    });
  }

  init() {
    console.log("Initializing optimizer...");

    if (!window.WEB_OPTIMIZER_MODE) {
      // Listen for messages from popup
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Message received:", message);
        if (message.action === "openOptimizer") {
          this.openModal();
          sendResponse({ success: true });
        }
        return true;
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup());
    } else {
      this.setup();
    }

    // Also listen for URL changes (SPA navigation)
    this.observeUrlChanges();
  }

  // Observe URL changes for SPA
  observeUrlChanges() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log("URL changed:", url);
        this.autoPopupShown = false;
        setTimeout(() => this.setup(), 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  async setup() {
    console.log("Setup called, URL:", window.location.href);

    // Only run on Meesho cataloging pages (avoid login/session flows)
    if (!this.isMeeshoPage() || !this.isCatalogPage()) return;

    console.log("Meesho catalog page detected");
    this.isLicensed = true;
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI && typeof MeeshoAPI.init === "function") {
      MeeshoAPI.init();
    }

    // Always provide an entry point on catalog pages, even if image input isn't present yet.
    this.addFloatingOptimizerButton();

    // Wait for page to load and add button
    this.waitForElement("#changeFrontImage", () => {
      console.log("Image input found, adding button");
      this.addOptimizerButton();
      this.detectShipping();
      this.scheduleMeeshoPageSync();
    });
  }

  // Wait for element to appear
  waitForElement(selector, callback, maxAttempts = 20) {
    let attempts = 0;
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        callback(element);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(check, 500);
      } else {
        console.log(
          "Element not found after",
          maxAttempts,
          "attempts:",
          selector
        );
      }
    };
    check();
  }

  // Check if current page is Meesho
  isMeeshoPage() {
    return window.location.href.includes("supplier.meesho.com");
  }

  // Check if current page is a catalog/product page
  isCatalogPage() {
    const url = window.location.href;
    return (
      url.includes("/catalogs/single") ||
      url.includes("/cataloging/") ||
      url.includes("/catalog/") ||
      url.includes("/catalogs/single/add") ||
      document.querySelector("#changeFrontImage") !== null
    );
  }

  addFloatingOptimizerButton() {
    if (document.getElementById("meesho-optimizer-fab")) return;

    const fab = document.createElement("button");
    fab.id = "meesho-optimizer-fab";
    fab.type = "button";
    fab.textContent = "AI Optimizer";
    const isNarrow = window.matchMedia("(max-width: 640px)").matches;
    fab.style.cssText = `
      position: fixed;
      right: ${isNarrow ? "12px" : "18px"};
      bottom: ${isNarrow ? "12px" : "18px"};
      z-index: 2147483647;
      background: linear-gradient(135deg, #FFD700, #C9A227);
      color: #fff;
      border: none;
      padding: ${isNarrow ? "14px 18px" : "12px 16px"};
      min-height: 48px;
      min-width: 48px;
      border-radius: 999px;
      font-weight: 700;
      font-size: ${isNarrow ? "14px" : "13px"};
      font-family: 'Segoe UI', sans-serif;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      cursor: pointer;
    `;

    fab.onclick = () => this.openModal();

    document.documentElement.appendChild(fab);
  }

  async checkLicense() {
    this.isLicensed = true;
    return true;
  }

  addOptimizerButton() {
    if (document.querySelector(".shipping-optimizer-btn")) {
      console.log("Button already exists");
      return;
    }

    const imageInput = document.querySelector("#changeFrontImage");
    if (!imageInput) {
      console.log("Image input not found");
      return;
    }

    console.log("Adding optimizer button");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "shipping-optimizer-btn";
    btn.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:22px;">🚀</span>
                <div>
                    <div style="font-weight:700;font-size:15px;">AI Shipping Cost Optimizer</div>
                    <div style="font-size:11px;opacity:0.9;">Click to optimize images</div>
                </div>
            </div>
        `;
    btn.style.cssText = `
            background: linear-gradient(135deg, #FFD700, #C9A227);
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 12px;
            cursor: pointer;
            width: 100%;
            max-width: 350px;
            box-shadow: 0 6px 20px rgba(102,126,234,0.4);
            font-family: 'Segoe UI', sans-serif;
            margin: 10px 0;
            transition: transform 0.2s, box-shadow 0.2s;
        `;
    btn.onmouseenter = () => {
      btn.style.transform = "translateY(-2px)";
      btn.style.boxShadow = "0 8px 25px rgba(102,126,234,0.5)";
    };
    btn.onmouseleave = () => {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "0 6px 20px rgba(102,126,234,0.4)";
    };
    btn.onclick = () => this.openModal();

    const wrapper = document.createElement("div");
    wrapper.style.margin = "10px 0";
    wrapper.appendChild(btn);

    const parent = imageInput.closest("div") || imageInput.parentElement;
    if (parent) {
      parent.appendChild(wrapper);
      console.log("Button added successfully");
    }
  }

  detectShipping() {
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.syncCatalogPricing) {
      MeeshoAPI.syncCatalogPricing();
      const catalog = MeeshoAPI.detectCatalogPricing?.();
      if (
        catalog?.customerShipping >= 25 &&
        catalog.customerShipping <= 150
      ) {
        console.log("Shipping from Meesho panel:", catalog.customerShipping);
        this.currentShippingCost = catalog.customerShipping;
        return catalog.customerShipping;
      }
    }

    const parseCost = (txt) => {
      const m = String(txt || "").match(/₹\s*(\d+)/);
      if (!m) return null;
      const cost = parseInt(m[1], 10);
      if (cost >= 25 && cost <= 150) return cost;
      return null;
    };

    const labelPatterns = [
      /shipping\s*charge[s]?/i,
      /delivery\s*charge[s]?/i,
      /logistics\s*charge[s]?/i,
    ];

    const tryElement = (el) => {
      const txt = el?.textContent || "";
      if (!txt.includes("₹")) return null;
      const self = parseCost(txt);
      if (self) return self;
      const parentText = el.parentElement?.textContent || "";
      if (labelPatterns.some((re) => re.test(parentText))) {
        return parseCost(txt) || parseCost(parentText);
      }
      return null;
    };

    const selectors = [
      "p.MuiTypography-root.MuiTypography-body1.css-v40lxd",
      '[class*="css-v40lxd"]',
      '[class*="shipping"]',
      '[class*="Shipping"]',
      ".MuiTypography-body1",
      ".MuiTypography-root",
    ];

    for (const sel of selectors) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          const cost = tryElement(el);
          if (cost) {
            console.log("Shipping found:", cost, "via", sel);
            this.currentShippingCost = cost;
            return cost;
          }
        }
      } catch (e) {}
    }

    return this.currentShippingCost;
  }

  mountEmbedded(root) {
    this.embeddedRoot = root || document.getElementById("optimizer-app");
    this.isLicensed = true;

    // Keep static HTML from index.html if upload input already exists
    if (!document.getElementById("image-input") && typeof OptimizerUI !== "undefined") {
      this.embeddedRoot.innerHTML = OptimizerUI.createModalHTML(true);
    }

    const processingArea = document.getElementById("processing-area");
    const resultsArea = document.getElementById("results-area");
    const testResultsArea = document.getElementById("test-results-area");
    const generateBtn = document.getElementById("generate-btn");
    const testGenBtn = document.getElementById("test-generate-btn");
    const uploadArea = document.getElementById("upload-area");
    if (processingArea) processingArea.style.display = "none";
    if (resultsArea) resultsArea.style.display = "none";
    if (testResultsArea) {
      testResultsArea.style.display = "none";
      testResultsArea.innerHTML = "";
    }
    this.testLabCurrentResults = [];
    this.testLabAnalysisPrimaryResults = [];
    this.setTestLabChromeVisible(true);
    if (uploadArea) uploadArea.style.display = "block";
    if (generateBtn) {
      generateBtn.style.display = "block";
      const hasFile =
        this._pendingFile ||
        window.__webPendingFile ||
        document.getElementById("image-input")?.files?.[0];
      if (hasFile) generateBtn.disabled = false;
    }
    const showcaseBtn = document.getElementById("generate-showcase-btn");
    if (showcaseBtn) {
      const hasFile =
        this._pendingFile ||
        window.__webPendingFile ||
        document.getElementById("image-input")?.files?.[0];
      showcaseBtn.disabled = !hasFile;
    }
    const promoBtn = document.getElementById("generate-promo-lifestyle-btn");
    if (promoBtn) {
      const hasFile =
        this._pendingFile ||
        window.__webPendingFile ||
        document.getElementById("image-input")?.files?.[0];
      promoBtn.disabled = !hasFile;
    }
    const tallStaticBtn = document.getElementById("generate-tall-static-btn");
    if (tallStaticBtn) {
      const hasFile =
        this._pendingFile ||
        window.__webPendingFile ||
        document.getElementById("image-input")?.files?.[0];
      tallStaticBtn.disabled = !hasFile;
    }
    const gownStaticBtn = document.getElementById("generate-gown-static-btn");
    if (gownStaticBtn) {
      const hasFile =
        this._pendingFile ||
        window.__webPendingFile ||
        document.getElementById("image-input")?.files?.[0];
      gownStaticBtn.disabled = !hasFile;
    }
    const localPriceGenBtn = document.getElementById("local-price-generate-btn");
    if (localPriceGenBtn) {
      const hasFile =
        this._pendingFile ||
        window.__webPendingFile ||
        document.getElementById("image-input")?.files?.[0];
      localPriceGenBtn.disabled = !hasFile;
    }
    document.querySelectorAll(".opt-section").forEach((s) => {
      s.style.display = "block";
    });

    this.setupMainEvents();
    this.bindStaticPromoButtons();

    void this.preloadLiveAnalysisModule();

    try {
      if (typeof MeeshoAPI !== "undefined") {
        this.safeEnsureEmbeddedCategories();
        MeeshoAPI.init();
      }
    } catch (e) {
      console.warn("Category init skipped:", e);
    }

    if (typeof WebSession !== "undefined") {
      WebSession.updateStatus();
    }

    const bootMsg = document.getElementById("boot-msg");
    if (bootMsg) {
      bootMsg.textContent = this._pendingFile || document.getElementById("image-input")?.files?.[0]
        ? "Image ready — tap Generate Variants"
        : "Ready — choose an image";
    }
  }

  async openModal() {
    if (window.WEB_OPTIMIZER_MODE) {
      const root = document.getElementById("optimizer-app");
      if (root) {
        this.mountEmbedded(root);
        return;
      }
    }

    this.isLicensed = true;

    if (window.WEB_OPTIMIZER_MODE && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.init();
    } else if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.init?.();
      MeeshoAPI.detectAllValues?.();
    }

    const existing = document.getElementById("opt-modal");
    if (existing) existing.remove();

    this.modal = document.createElement("div");
    this.modal.id = "opt-modal";
    const isNarrow = window.matchMedia("(max-width: 640px)").matches;
    this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 99999;
            display: flex;
            justify-content: ${isNarrow ? "stretch" : "center"};
            align-items: ${isNarrow ? "stretch" : "center"};
            backdrop-filter: blur(5px);
        `;

    const content = document.createElement("div");
    content.style.cssText = isNarrow
      ? "width:100%;height:100%;max-width:100%;max-height:100%;overflow-y:auto;"
      : "max-width:480px;width:95%;max-height:90vh;overflow-y:auto;";
    content.innerHTML = OptimizerUI.createModalHTML();

    this.modal.appendChild(content);
    document.body.appendChild(this.modal);

    this.setupMainEvents();

    this.modal.onclick = (e) => {
      if (e.target === this.modal) this.closeModal();
    };

    setTimeout(() => {
      this.detectShipping();
      const el = document.getElementById("current-shipping");
      if (el && this.currentShippingCost) {
        el.textContent = "₹" + this.currentShippingCost;
      }
      this.scheduleMeeshoPageSync();
    }, 100);
  }

  closeModal() {
    if (window.WEB_OPTIMIZER_MODE && this.embeddedRoot) {
      this.mountEmbedded(this.embeddedRoot);
      return;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  setupLicenseEvents() {
    const closeBtn = document.getElementById("close-modal");
    if (closeBtn) closeBtn.onclick = () => this.closeModal();

    const activateBtn = document.getElementById("activate-license-btn");
    const keyInput = document.getElementById("license-key-input");

    // Plan buy buttons
    const planBtns = document.querySelectorAll(".plan-buy-btn");
    planBtns.forEach((btn) => {
      btn.onclick = async () => {
        const plan = btn.dataset.plan;
        const price = btn.dataset.price;
        const duration = btn.dataset.duration;

        try {
          const settings = await LicenseManager.getWhatsAppSettings();
          const message = `Hi! I want to purchase Meesho Shipping Cost AI Optimizer.

📦 *Plan Selected:* ${duration}
💰 *Price:* ₹${price}

Please share payment details and license key.`;

          window.open(
            `https://wa.me/${settings.number}?text=${encodeURIComponent(
              message
            )}`,
            "_blank"
          );
        } catch (error) {
          const message = `Hi! I want to purchase Meesho Shipping Cost AI Optimizer - ${duration} plan (₹${price})`;
          window.open(
            `https://wa.me/918905811996?text=${encodeURIComponent(message)}`,
            "_blank"
          );
        }
      };

      // Hover effects
      btn.onmouseenter = () => {
        btn.style.transform = "scale(1.03)";
        btn.style.boxShadow = "0 4px 15px rgba(102,126,234,0.4)";
      };
      btn.onmouseleave = () => {
        btn.style.transform = "scale(1)";
        btn.style.boxShadow = "none";
      };
    });

    // License activation
    if (activateBtn && keyInput) {
      activateBtn.onclick = async () => {
        const key = keyInput.value.trim();
        if (!key) {
          OptimizerUtils.showNotification(
            "Please enter a license key",
            "error"
          );
          return;
        }

        if (key.length < 10) {
          OptimizerUtils.showNotification("License key is too short", "error");
          return;
        }

        activateBtn.textContent = "Verifying...";
        activateBtn.disabled = true;

        try {
          const result = await LicenseManager.verifyLicenseKey(key);

          if (result.success) {
            this.isLicensed = true;
            OptimizerUtils.showNotification(
              "License activated successfully!",
              "success"
            );
            this.closeModal();
            setTimeout(() => this.openModal(), 300);
          } else {
            OptimizerUtils.showNotification(
              result.message || "License verification failed",
              "error"
            );
            activateBtn.textContent = "Activate License";
            activateBtn.disabled = false;
          }
        } catch (error) {
          console.error("Activation error:", error);
          OptimizerUtils.showNotification("Error: " + error.message, "error");
          activateBtn.textContent = "Activate License";
          activateBtn.disabled = false;
        }
      };

      keyInput.onkeypress = (e) => {
        if (e.key === "Enter") activateBtn.click();
      };
    }
  }

  async ensureFullCategories() {
    const minFull =
      (typeof MeeshoCategories !== "undefined" && MeeshoCategories.FULL_CATEGORY_MIN) ||
      3000;

    try {
      if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.ensureFullCategories) {
        const list = await MeeshoAPI.ensureFullCategories();
        if (list?.length >= minFull) return list;
      }
    } catch (e) {
      console.warn("ensureFullCategories failed:", e);
    }

    const embedded = this.safeEnsureEmbeddedCategories();
    if (embedded?.length >= minFull) return embedded;

    if (typeof MeeshoAPI !== "undefined") {
      const list = await MeeshoAPI.fetchCategories(false);
      if (list?.length) return list;
    }

    return embedded || [];
  }

  safeEnsureEmbeddedCategories() {
    try {
      if (typeof MeeshoAPI === "undefined") return null;
      if (typeof MeeshoAPI.ensureEmbeddedCategories === "function") {
        return MeeshoAPI.ensureEmbeddedCategories();
      }
      if (typeof MeeshoAPI.getEmbeddedCategories === "function") {
        const embedded = MeeshoAPI.getEmbeddedCategories();
        if (embedded?.length) {
          MeeshoAPI.cache.categories = embedded;
          MeeshoAPI._lastCategoryFetchWasEmbedded = true;
          return embedded;
        }
      }
      if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.getList) {
        const list = MeeshoCategories.getList();
        if (list?.length) {
          MeeshoAPI.cache.categories = list;
          MeeshoAPI._lastCategoryFetchWasEmbedded = true;
          return list;
        }
      }
    } catch (e) {
      console.warn("Could not load embedded categories:", e);
    }
    return null;
  }

  setupMainEvents() {
    const closeBtn = document.getElementById("close-modal");
    if (closeBtn) {
      closeBtn.onclick = () => {
        if (window.WEB_OPTIMIZER_MODE) {
          this.mountEmbedded(this.embeddedRoot || document.getElementById("optimizer-app"));
        } else {
          this.closeModal();
        }
      };
    }

    // File input + generate — wire FIRST so upload always works
    const fileInput = document.getElementById("image-input");
    const uploadArea = document.getElementById("upload-area");
    const generateBtn = document.getElementById("generate-btn");
    const tabbedGenerateMode = this.isTabbedOptimizerUI() && generateBtn;

    const showFilePreview = (file) => {
      const previewBox = document.getElementById("preview-box");
      const previewImg = document.getElementById("preview-img");
      if (!previewBox || !previewImg) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        previewImg.src = ev.target.result;
        this.originalImageUrl = ev.target.result;
        previewBox.style.display = "block";
        const label = previewBox.querySelector(".preview-label");
        if (label) label.textContent = file.name;
        if (uploadArea) uploadArea.style.display = "none";
        this.wireClearUploadButton();
      };
      reader.readAsDataURL(file);
    };

    const getUploadFile = () => {
      if (fileInput?.files?.[0]) return fileInput.files[0];
      if (this._pendingFile) return this._pendingFile;
      if (window.__webPendingFile) {
        this._pendingFile = window.__webPendingFile;
        return window.__webPendingFile;
      }
      return null;
    };

    const isImageFile = (file) => {
      if (!file) return false;
      if (file.type && file.type.startsWith("image/")) return true;
      return /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name || "");
    };

    const onFilePicked = (file) => {
      if (!file) return;
      if (!isImageFile(file)) {
        OptimizerUtils.showNotification("Please choose a JPG, PNG, or WebP image", "error");
        return;
      }

      console.log("File selected:", file.name);
      this.setOptimizerUploadFile(file, { source: "user" });

      const bootMsg = document.getElementById("boot-msg");
      const testGenBtn = document.getElementById("test-generate-btn");
      const showcaseBtn = document.getElementById("generate-showcase-btn");
      const promoBtn = document.getElementById("generate-promo-lifestyle-btn");
      const tallStaticBtn = document.getElementById("generate-tall-static-btn");
      const gownStaticBtn = document.getElementById("generate-gown-static-btn");
      const localPriceGenBtn = document.getElementById("local-price-generate-btn");
      if (tabbedGenerateMode) {
        generateBtn.disabled = false;
        if (testGenBtn) testGenBtn.disabled = false;
        if (showcaseBtn) showcaseBtn.disabled = false;
        if (promoBtn) promoBtn.disabled = false;
        if (tallStaticBtn) tallStaticBtn.disabled = false;
        if (gownStaticBtn) gownStaticBtn.disabled = false;
        if (localPriceGenBtn) localPriceGenBtn.disabled = false;
        if (bootMsg) {
          bootMsg.textContent =
            this.getActiveOptimizerTab() === "test"
              ? "Image ready — tap Run Test Lab"
              : "Image ready — tap Generate Variants";
        }
        this.setupOptimizerTabs();
        this.refreshLiveResultsPanel({ scroll: false });
        this.bindStaticPromoButtons();
        return;
      }

      setTimeout(() => this.processImage(file), 500);
    };

    if (fileInput) {
      fileInput.onclick = () => {
        fileInput.value = "";
      };
      fileInput.onchange = (e) => onFilePicked(e.target.files?.[0]);
    }

    const pending =
      window.__webPendingFile ||
      fileInput?.files?.[0] ||
      this._pendingFile;
    if (pending && tabbedGenerateMode) {
      onFilePicked(pending);
    } else if (pending) {
      this._pendingFile = pending;
    }

    if (tabbedGenerateMode) {
      const runGenerate = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const file = getUploadFile();
        if (!file) {
          OptimizerUtils.showNotification("Choose an image first", "error");
          return;
        }
        if (this.isProcessing) return;
        // Route by tab: Live uses existing processImage — do not modify that path for Test Lab.
        if (this.getActiveOptimizerTab() === "test") {
          void this.processImageTestLab(file);
        } else {
          void this.processImage(file);
        }
      };

      generateBtn.disabled = !getUploadFile();
      generateBtn.onclick = runGenerate;
      const testGenBtn = document.getElementById("test-generate-btn");
      if (testGenBtn) {
        testGenBtn.disabled = !getUploadFile();
        testGenBtn.onclick = runGenerate;
      }
      const showcaseBtn = document.getElementById("generate-showcase-btn");
      if (showcaseBtn) {
        showcaseBtn.disabled = !getUploadFile();
        showcaseBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          void this.generateShowcaseFrames();
        };
      }
      const promoBtn = document.getElementById("generate-promo-lifestyle-btn");
      if (promoBtn) {
        promoBtn.disabled = !getUploadFile();
        promoBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          void this.generatePromoLifestyleFrames();
        };
      }
      const tallStaticBtn = document.getElementById("generate-tall-static-btn");
      if (tallStaticBtn) {
        tallStaticBtn.disabled = !getUploadFile();
        tallStaticBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          void this.generateTallStaticFrames();
        };
      }
      const gownStaticBtn = document.getElementById("generate-gown-static-btn");
      if (gownStaticBtn) {
        gownStaticBtn.disabled = !getUploadFile();
        gownStaticBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          void this.generateGownStaticFrames();
        };
      }
    }

    if (uploadArea) {
      uploadArea.ondragover = (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = "#667eea";
      };
      uploadArea.ondragleave = () => {
        uploadArea.style.borderColor = "rgba(102,126,234,0.5)";
      };
      uploadArea.ondrop = (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = "rgba(102,126,234,0.5)";
        if (e.dataTransfer.files.length && fileInput) {
          fileInput.files = e.dataTransfer.files;
          fileInput.dispatchEvent(new Event("change"));
        }
      };
    }

    // Categories + session — must not block generate button
    try {
      if (typeof MeeshoAPI !== "undefined") {
        MeeshoAPI.syncFromSession?.();
        this.safeEnsureEmbeddedCategories();
      }
    } catch (e) {
      console.warn("MeeshoAPI init skipped:", e);
    }
    if (window.WEB_OPTIMIZER_MODE && typeof WebSession !== "undefined") {
      WebSession.wireForm();
    }
    this.loadCategoryDropdown();

    // Live vs Test Lab tabs (web + extension modal)
    if (this.isTabbedOptimizerUI()) {
      this.setupOptimizerTabs();
    }

    const categorySelect = document.getElementById("category-select");
    if (categorySelect) {
      categorySelect.onchange = () => {
        const categoryId = parseInt(categorySelect.value);
        if (categoryId && typeof MeeshoAPI !== "undefined") {
          MeeshoAPI.setCategory(categoryId);
          console.log("📁 Category:", categoryId);
        }
        this.refreshLocalPriceUI();
      };
    }

    this.wireClearUploadButton();
    this.wireLocalPriceButtons();
  }

  wireLocalPriceButtons() {
    const genBtn = document.getElementById("local-price-generate-btn");
    if (genBtn) {
      genBtn.onclick = () => {
        const file =
          this._pendingFile ||
          window.__webPendingFile ||
          document.getElementById("image-input")?.files?.[0];
        if (!file) {
          OptimizerUtils.showNotification("Choose an image first", "error");
          return;
        }
        if (this.isProcessing) return;
        void this.processImageLocalPrice(file);
      };
    }

    const importBtn = document.getElementById("local-price-import-btn");
    const importInput = document.getElementById("local-price-import-input");
    if (importBtn && importInput) {
      importBtn.onclick = () => importInput.click();
      importInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = LocalPriceDB.importCsv(ev.target.result);
          if (result.ok) {
            OptimizerUtils.showNotification(
              `Imported ${result.variantCount} variants · cat ${result.categoryId} · tiers ₹${result.tiers.join(", ")} · recommend ₹${result.recommendedPrices.join(", ")}`,
              "success",
              8000,
            );
            this.refreshLocalPriceUI();
          } else {
            OptimizerUtils.showNotification(result.error || "Import failed", "error");
          }
        };
        reader.readAsText(file);
        importInput.value = "";
      };
    }

    const saveBtn = document.getElementById("local-price-save-btn");
    if (saveBtn) saveBtn.onclick = () => this.saveLocalPriceSnapshot();
    const viewBtn = document.getElementById("local-price-view-btn");
    if (viewBtn) viewBtn.onclick = () => this.showLocalPriceReport();
    const clearBtn = document.getElementById("local-price-clear-btn");
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (!confirm("Clear all local price history?")) return;
        LocalPriceDB.clear();
        OptimizerUtils.showNotification("Local price history cleared.", "info");
        this.refreshLocalPriceUI();
      };
    }

    void LocalPriceDB.seedIfEmpty().then(() => this.refreshLocalPriceUI());
  }

  refreshLocalPriceUI() {
    const hint = document.getElementById("local-price-hint");
    if (!hint) return;
    const categorySelect = document.getElementById("category-select");
    const catId = categorySelect?.value || "";
    const summary = LocalPriceDB.summary(catId);
    const profile = catId ? LocalPriceDB.getCategoryProfile(catId) : null;

    if (summary) {
      const tierText =
        summary.tiers?.length
          ? `tiers ₹${summary.tiers.join(", ")}`
          : `range ₹${summary.min}–₹${summary.max}`;
      const recText = summary.recommendedPrices?.length
        ? ` → recommend ₹${summary.recommendedPrices.join(" + ₹")}`
        : "";
      hint.textContent = `📦 Local best ₹${summary.best} · ${tierText}${recText} (${summary.runs} reports)`;
      hint.style.color = "#047857";
    } else if (profile?.hasData) {
      hint.textContent = `📦 Tiers ₹${profile.tiers.join(", ")} · recommend ₹${profile.recommendedPrices.join(", ")}`;
      hint.style.color = "#047857";
    } else {
      hint.textContent =
        "Import CSV reports or run live → save to build local tiers per category";
      hint.style.color = "#6b7280";
    }
  }

  categoryMatchesQuery(cat, query) {
    if (!query) return true;
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.search) {
      const hits = MeeshoCategories.search(query, 200);
      return hits.some((c) => c.id === cat.id);
    }
    const hay = [
      cat.id,
      cat.name,
      cat.parentName,
      cat.sectionName,
      cat.rootName,
      cat.path,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/&/g, " and ");
    const q = String(query).toLowerCase().replace(/&/g, " and ");
    return hay.includes(q);
  }

  parseCategorySearchQuery(raw) {
    const text = String(raw || "").trim();
    if (/^\d{3,6}$/.test(text)) {
      return { mode: "id", id: parseInt(text, 10), text };
    }
    const stripped = text.replace(/\s*\(\d{3,6}\)\s*$/, "").trim();
    const idFromSuffix = text.match(/\((\d{3,6})\)\s*$/);
    if (idFromSuffix) {
      return {
        mode: "id",
        id: parseInt(idFromSuffix[1], 10),
        text: stripped || text,
      };
    }
    return { mode: "text", text: stripped || text };
  }

  resolveCategoryFromSearchInput(raw, limit = 12) {
    const query = String(raw || "").trim();
    if (!query) return { status: "empty" };

    const parsed = this.parseCategorySearchQuery(query);
    if (parsed.mode === "id") {
      const cat = this.findCategoryById(parsed.id);
      if (cat) return { status: "resolved", cat, hits: [cat], query };
      return { status: "not_found", query };
    }

    const hits = this.filterCategoriesForSearch(query, limit);
    if (!hits.length) return { status: "not_found", query };
    if (hits.length === 1) return { status: "resolved", cat: hits[0], hits, query };

    const norm = parsed.text.toLowerCase();
    const exact = hits.find(
      (c) =>
        String(c.name || "").toLowerCase() === norm ||
        String(c.id) === parsed.text,
    );
    if (exact) return { status: "resolved", cat: exact, hits, query };

    return { status: "ambiguous", hits, query };
  }

  filterCategoriesForSearch(raw, limit = 100) {
    const parsed = this.parseCategorySearchQuery(raw);
    if (!parsed.text && parsed.mode !== "id") {
      return this.getDefaultCategorySlice(Math.min(limit, 50));
    }

    if (parsed.mode === "id") {
      const cat = this.findCategoryById(parsed.id);
      return cat ? [cat] : [];
    }

    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.search) {
      return MeeshoCategories.search(parsed.text, limit);
    }

    const query = parsed.text.toLowerCase();
    return (this.allCategories || [])
      .filter((cat) => this.categoryMatchesQuery(cat, query))
      .slice(0, limit);
  }

  applyPageCategoryIfAvailable(options = {}) {
    if (this._categoryUserPicked || typeof MeeshoAPI === "undefined") return false;
    if (this._categoryUserEditing && !options.force) return false;

    const searchEl = document.getElementById("category-search");
    if (searchEl && document.activeElement === searchEl && !options.force) return false;

    MeeshoAPI.syncCatalogPricing?.();
    const pageId = MeeshoAPI.detectCategoryId?.();
    if (!pageId) return false;

    const categorySelect = document.getElementById("category-select");
    const existing = parseInt(categorySelect?.value, 10);
    const cat = this.findCategoryById(pageId);

    if (existing === pageId && cat) {
      this.refreshCategoryApiPreview({ id: pageId, source: "page", cat });
      return true;
    }

    if (cat) {
      this.applyCategorySelection(cat, { source: "page" });
    } else {
      this.applyCategoryByIdOnly(pageId, { source: "page" });
    }
    return true;
  }

  scheduleMeeshoPageSync(maxAttempts = 12, delayMs = 500) {
    if (window.WEB_OPTIMIZER_MODE || !this.isCatalogPage?.()) return;

    let attempts = 0;
    const tick = () => {
      if (this._categoryUserPicked && this._uploadUserPicked) return;

      const searchEl = document.getElementById("category-search");
      if (
        this._categoryUserEditing &&
        searchEl &&
        document.activeElement === searchEl
      ) {
        if (attempts < maxAttempts) setTimeout(tick, delayMs);
        return;
      }
      if (
        this._categoryUserEditing &&
        searchEl &&
        document.activeElement !== searchEl
      ) {
        this._categoryUserEditing = false;
      }

      attempts++;
      const gotCategory =
        !this._categoryUserPicked && this.applyPageCategoryIfAvailable();
      void this.importPageImageIfNeeded();

      if (attempts < maxAttempts && !gotCategory && !this._categoryUserPicked) {
        setTimeout(tick, delayMs);
      }
    };

    tick();
  }

  syncFromMeeshoPage() {
    if (window.WEB_OPTIMIZER_MODE || !this.isCatalogPage?.()) return;
    const searchEl = document.getElementById("category-search");
    if (
      this._categoryUserEditing &&
      searchEl &&
      document.activeElement === searchEl
    ) {
      return;
    }
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.syncCatalogPricing?.();
      MeeshoAPI.detectCatalogImageUrl?.();
    }
    this.applyPageCategoryIfAvailable();
    void this.importPageImageIfNeeded();
  }

  setOptimizerUploadFile(file, options = {}) {
    if (!file) return false;

    this._pendingFile = file;
    if (typeof window !== "undefined") window.__webPendingFile = file;

    if (options.source === "user") {
      this._uploadUserPicked = true;
      this._uploadUserCleared = false;
    } else if (options.source === "page") {
      this._uploadFromPage = true;
    }

    const previewBox = document.getElementById("preview-box");
    const previewImg = document.getElementById("preview-img");
    const uploadArea = document.getElementById("upload-area");
    const generateBtn = document.getElementById("generate-btn");
    const testGenBtn = document.getElementById("test-generate-btn");
    const bootMsg = document.getElementById("boot-msg");

    const showPreview = (dataUrl) => {
      if (previewImg) previewImg.src = dataUrl;
      this.originalImageUrl = dataUrl;
      if (previewBox) previewBox.style.display = "block";
      const label = previewBox?.querySelector(".preview-label");
      if (label) {
        label.textContent =
          options.source === "page"
            ? "From Meesho page"
            : file.name || "product.jpg";
      }
      if (uploadArea) uploadArea.style.display = "none";
      this.wireClearUploadButton();
    };

    if (previewImg && file.type?.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => showPreview(ev.target.result);
      reader.readAsDataURL(file);
    }

    const enable = () => {
      if (generateBtn) generateBtn.disabled = false;
      if (testGenBtn) testGenBtn.disabled = false;
      [
        "generate-showcase-btn",
        "generate-promo-lifestyle-btn",
        "generate-tall-static-btn",
        "generate-gown-static-btn",
        "local-price-generate-btn",
        "local-price-import-btn",
      ].forEach((id) => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = false;
      });
      if (bootMsg) {
        bootMsg.textContent =
          this.getActiveOptimizerTab?.() === "test"
            ? "Image ready — tap Run Test Lab"
            : "Image ready — tap Generate Variants";
      }
    };
    enable();

    return true;
  }

  async importPageImageIfNeeded() {
    if (this._uploadUserPicked || this._uploadUserCleared) return false;
    if (this._pendingFile || document.getElementById("image-input")?.files?.[0]) {
      return false;
    }
    if (typeof MeeshoAPI === "undefined" || !MeeshoAPI.detectCatalogImageUrl) {
      return false;
    }

    const url = MeeshoAPI.detectCatalogImageUrl();
    if (!url) return false;

    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) return false;
      const blob = await resp.blob();
      if (!blob?.size || blob.size < 500) return false;

      const file = new File([blob], "meesho-catalog.jpg", {
        type: blob.type || "image/jpeg",
      });
      this.setOptimizerUploadFile(file, { source: "page" });
      console.log("📷 Imported product image from Meesho page");
      return true;
    } catch (e) {
      console.warn("Page image import failed:", e.message);
      return false;
    }
  }

  findCategoryById(id) {
    const parsed = parseInt(id, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.findById) {
      return MeeshoCategories.findById(parsed);
    }
    return this.allCategories?.find((c) => c.id === parsed) || null;
  }

  formatCategoryUi(cat, options = {}) {
    if (!cat?.id) return { title: "", detail: "" };
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.formatDisplay) {
      return MeeshoCategories.formatDisplay(cat, options);
    }
    const title = `${cat.name} · ID ${cat.id}`;
    const path = cat.path || cat.parentName || "";
    const detail = [path, `sscat_id ${cat.id} for live pricing`]
      .filter(Boolean)
      .join(" · ");
    return { title, detail, apiId: cat.id, path };
  }

  formatCategoryIdUi(id, options = {}) {
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.formatIdOnly) {
      return MeeshoCategories.formatIdOnly(id, options);
    }
    const parsed = parseInt(id, 10);
    return {
      title: `Category ID ${parsed}`,
      detail: `sscat_id ${parsed} for live pricing`,
      apiId: parsed,
      path: "",
    };
  }

  paintCategorySelection(display, { showSelected = true } = {}) {
    const selectedCategory = document.getElementById("selected-category");
    const selectedCategoryName = document.getElementById("selected-category-name");
    const selectedCategoryDetail = document.getElementById("selected-category-detail");

    if (!display?.title) {
      if (selectedCategory) selectedCategory.style.display = "none";
      if (selectedCategoryName) selectedCategoryName.textContent = "";
      if (selectedCategoryDetail) selectedCategoryDetail.textContent = "";
      return;
    }

    if (showSelected && selectedCategory) selectedCategory.style.display = "block";
    if (selectedCategoryName) selectedCategoryName.textContent = display.title;
    if (selectedCategoryDetail) {
      selectedCategoryDetail.textContent = display.detail || "";
    }
  }

  refreshCategoryApiPreview(resolved) {
    const preview = document.getElementById("category-api-preview");
    if (!preview) return;

    const categorySelect = document.getElementById("category-select");
    const peek = resolved || this.peekCategoryForLiveApi(categorySelect);
    if (!peek?.id) {
      preview.style.display = "none";
      preview.textContent = "";
      return;
    }

    const cat = peek.cat || this.findCategoryById(peek.id);
    const display = cat
      ? this.formatCategoryUi(cat, { source: peek.source })
      : this.formatCategoryIdUi(peek.id, { source: peek.source });

    const action =
      peek.source === "user"
        ? "Will request"
        : peek.source === "page"
          ? "Will request (from Meesho page)"
          : peek.source === "default"
            ? "Will request (default)"
            : "Will request";

    preview.style.display = "block";
    preview.textContent = `${action}: ${display.title}${
      display.path ? ` — ${display.path}` : ""
    }. Meesho API uses leaf sscat_id ${peek.id} (not the full path).`;
  }

  peekCategoryForLiveApi(categorySelect) {
    const manualMode = this.isManualShippingMode();
    const needsCategoryForLiveApi =
      !window.WEB_OPTIMIZER_MODE && !manualMode && typeof MeeshoAPI !== "undefined";

    const userPick = categorySelect?.value
      ? parseInt(categorySelect.value, 10)
      : null;
    if (userPick > 0) {
      return {
        id: userPick,
        source: "user",
        cat: this.findCategoryById(userPick),
      };
    }

    if (typeof MeeshoAPI !== "undefined" && !userPick) {
      MeeshoAPI.syncCatalogPricing?.();
    }

    if (typeof MeeshoAPI !== "undefined") {
      const pageId = MeeshoAPI.detectCategoryId?.();
      if (pageId > 0) {
        return {
          id: pageId,
          source: "page",
          cat: this.findCategoryById(pageId),
        };
      }
    }

    if (!needsCategoryForLiveApi) {
      return { id: null, source: "none", cat: null };
    }

    const defId =
      typeof MeeshoCategories !== "undefined"
        ? MeeshoCategories.getDefaultCategoryId()
        : 10004;
    if (defId) {
      return {
        id: defId,
        source: "default",
        cat: this.findCategoryById(defId),
      };
    }
    return { error: true };
  }

  getDefaultCategorySlice(limit = 50) {
    if (
      typeof MeeshoCategories !== "undefined" &&
      MeeshoCategories.getDefaultList
    ) {
      return MeeshoCategories.getDefaultList(limit);
    }
    return (this.allCategories || []).slice(0, limit);
  }

  // Load categories into dropdown
  bindCategoryUI(categories) {
    const categorySearch = document.getElementById("category-search");
    const categoryDropdown = document.getElementById("category-dropdown");
    const categorySelect = document.getElementById("category-select");
    const categoryClear = document.getElementById("category-clear");
    const selectedCategory = document.getElementById("selected-category");
    const refreshBtn = document.getElementById("refresh-categories");
    const categoryError = document.getElementById("category-error");

    if (!categorySearch || !categoryDropdown || !categories?.length) return false;

    this.allCategories = categories;
    const embedded = MeeshoAPI?._lastCategoryFetchWasEmbedded;
    categorySearch.placeholder = `🔍 Search ${categories.length} categories by name or ID…`;
    const countHint = document.getElementById("category-count-hint");
    if (countHint) {
      countHint.textContent =
        categories.length >= 3000
          ? `${categories.length} leaf categories loaded — type to search all`
          : `${categories.length} categories loaded`;
    }
    if (refreshBtn) refreshBtn.style.display = embedded ? "none" : "block";
    if (categoryError) categoryError.style.display = "none";

    categorySearch.onfocus = () => {
      this._categoryUserEditing = true;
      clearTimeout(this._categoryEditingTimer);
    };

    categorySearch.onblur = () => {
      clearTimeout(this._categoryEditingTimer);
      this._categoryEditingTimer = setTimeout(() => {
        if (document.activeElement !== categorySearch) {
          this._categoryUserEditing = false;
        }
      }, 200);
    };

    categorySearch.onkeydown = (e) => {
      if (e.key === "Escape") {
        categoryDropdown.style.display = "none";
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const raw = categorySearch.value.trim();
        if (!raw) return;
        const result = this.resolveCategoryFromSearchInput(raw, 12);
        if (result.status === "resolved" && result.cat) {
          this.applyCategorySelection(result.cat, { source: "user" });
          categoryDropdown.style.display = "none";
        } else if (result.status === "ambiguous" && result.hits?.[0]) {
          this.applyCategorySelection(result.hits[0], { source: "user" });
          categoryDropdown.style.display = "none";
        } else {
          OptimizerUtils.showNotification(
            `No category found for "${raw}"`,
            "error",
          );
        }
        return;
      }
      if (
        this._categorySearchCommittedValue &&
        categorySearch.value === this._categorySearchCommittedValue &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        categorySearch.value = e.key;
        this._categorySearchCommittedValue = "";
        e.preventDefault();
        categorySearch.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };

    categorySearch.oninput = () => {
      this._categoryUserEditing = true;
      const raw = categorySearch.value.trim();
      if (categoryClear) categoryClear.style.display = raw ? "block" : "none";

      if (!raw) {
        this.renderCategoryDropdown(this.getDefaultCategorySlice(50));
      } else {
        this.renderCategoryDropdown(this.filterCategoriesForSearch(raw, 150));
      }
      categoryDropdown.style.display = "block";
    };

    if (categoryClear) {
      categoryClear.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        categorySearch.value = "";
        categoryClear.style.display = "none";
        this._categorySearchCommittedValue = "";
        this._categoryUserEditing = true;
        if (categorySelect) categorySelect.value = "";
        if (selectedCategory) selectedCategory.style.display = "none";
        const selectedCategoryDetail = document.getElementById("selected-category-detail");
        if (selectedCategoryDetail) selectedCategoryDetail.textContent = "";
        this._categoryUserPicked = false;
        if (typeof MeeshoAPI !== "undefined") MeeshoAPI.setCategory(null);
        this.renderCategoryDropdown(this.getDefaultCategorySlice(50));
        this.refreshCategoryApiPreview();
        this.applyPageCategoryIfAvailable();
        categorySearch.focus();
      };
    }

    if (!this._categoryClickBound) {
      this._categoryClickBound = true;
      document.addEventListener("click", (e) => {
        if (
          !e.target.closest("#category-search") &&
          !e.target.closest("#category-dropdown")
        ) {
          categoryDropdown.style.display = "none";
        }
      });
    }

    console.log("✅ Loaded", categories.length, "categories");
    if (!window.WEB_OPTIMIZER_MODE) {
      this.applyDefaultCategoryIfNeeded();
      this.scheduleMeeshoPageSync();
    } else {
      this.refreshCategoryApiPreview();
    }
    return true;
  }

  renderCategoryDropdown(categories) {
    const dropdown = document.getElementById("category-dropdown");
    if (!dropdown) return;

    if (!categories?.length) {
      dropdown.innerHTML =
        '<div class="category-empty">No matching categories — try name or ID</div>';
      dropdown.style.display = "block";
      return;
    }

    let html = "";
    categories.forEach((cat) => {
      const path = cat.path || cat.parentName || "";
      const safeName = String(cat.name || "").replace(/"/g, "&quot;");
      const safePath = String(path).replace(/"/g, "&quot;");
      html += `
                <div class="cat-item" data-id="${cat.id}" data-name="${safeName}" data-path="${safePath}">
                    <div class="cat-item-name">
                      <span>${cat.name}</span>
                      <span class="cat-item-id">ID ${cat.id}</span>
                    </div>
                    <div class="cat-item-path">${path || "Leaf category (sscat_id)"}</div>
                </div>
            `;
    });
    dropdown.innerHTML = html;
    dropdown.style.display = "block";

    dropdown.querySelectorAll(".cat-item").forEach((item) => {
      item.onmouseenter = () => {
        item.style.background = "rgba(102,126,234,0.12)";
      };
      item.onmouseleave = () => {
        item.style.background = "transparent";
      };
      item.onclick = () => {
        const id = parseInt(item.dataset.id, 10);
        const cat =
          this.allCategories?.find((c) => c.id === id) ||
          this.findCategoryById(id) || {
            id,
            name: item.dataset.name,
            path: item.dataset.path,
            parentName: item.dataset.path,
          };
        this.applyCategorySelection(cat, { source: "user" });
        this._categoryUserPicked = true;
        const categoryDropdown = document.getElementById("category-dropdown");
        if (categoryDropdown) categoryDropdown.style.display = "none";
      };
    });
  }

  async loadCategoryDropdown() {
    const categorySearch = document.getElementById("category-search");
    const categoryDropdown = document.getElementById("category-dropdown");
    const categorySelect = document.getElementById("category-select");
    const categoryClear = document.getElementById("category-clear");
    const selectedCategory = document.getElementById("selected-category");
    const selectedCategoryName = document.getElementById(
      "selected-category-name"
    );
    const refreshBtn = document.getElementById("refresh-categories");
    const categoryError = document.getElementById("category-error");

    if (!categorySearch || !categoryDropdown) return;

    if (typeof MeeshoAPI === "undefined") {
      categorySearch.placeholder = "API not available";
      if (refreshBtn) refreshBtn.style.display = "block";
      if (categoryError) categoryError.style.display = "block";
      return;
    }

    // Refresh button handler
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        refreshBtn.textContent = "⏳...";
        MeeshoAPI.cache.categories = null;
        try {
          const categories = await MeeshoAPI.fetchCategories(true);
          if (categories?.length && this.bindCategoryUI(categories)) {
            refreshBtn.textContent = "🔄 Refresh";
            return;
          }
        } catch (e) {
          console.warn("Live category refresh failed:", e);
        }
        await this.loadCategoryDropdown();
        refreshBtn.textContent = "🔄 Refresh";
      };
    }

    categorySearch.placeholder = "Loading categories...";

    try {
      const categories = await this.ensureFullCategories();

      if (categories?.length && this.bindCategoryUI(categories)) {
        return;
      }

      if (window.WEB_OPTIMIZER_MODE) {
        categorySearch.placeholder = "Optional — skip to generate variants";
        if (categoryError) categoryError.style.display = "none";
        if (refreshBtn) refreshBtn.style.display = "block";
        return;
      }

      categorySearch.placeholder = "Not loaded — click Refresh";
      if (refreshBtn) refreshBtn.style.display = "block";
      if (categoryError) categoryError.style.display = "block";
    } catch (error) {
      console.error("Failed to load categories:", error);
      if (window.WEB_OPTIMIZER_MODE) {
        categorySearch.placeholder = "Optional — skip to generate variants";
        if (categoryError) categoryError.style.display = "none";
      } else {
        categorySearch.placeholder = "Failed - Click Refresh";
        if (categoryError) categoryError.style.display = "block";
      }
      if (refreshBtn) refreshBtn.style.display = "block";
    }
  }

  applyCategorySelection(catOrId, options = {}) {
    const categorySelect = document.getElementById("category-select");
    const categorySearch = document.getElementById("category-search");
    const categoryClear =
      document.getElementById("category-clear-btn") ||
      document.getElementById("category-clear");

    const cat =
      typeof catOrId === "object"
        ? catOrId
        : this.findCategoryById(catOrId);
    if (!cat?.id) return false;

    const display = this.formatCategoryUi(cat, { source: options.source });

    if (options.source === "user") {
      this._categoryUserPicked = true;
    }

    this._categoryUserEditing = false;
    clearTimeout(this._categoryEditingTimer);

    if (categorySelect) categorySelect.value = String(cat.id);
    if (categorySearch) {
      const displayValue = `${cat.name} (${cat.id})`;
      categorySearch.value = displayValue;
      this._categorySearchCommittedValue = displayValue;
    }
    this.paintCategorySelection(display, { showSelected: options.showSelected !== false });
    if (categoryClear) categoryClear.style.display = "block";
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(cat.id);
    }
    this.refreshCategoryApiPreview({
      id: cat.id,
      source: options.source || "user",
      cat,
    });
    return true;
  }

  applyCategoryByIdOnly(id, options = {}) {
    const categorySelect = document.getElementById("category-select");
    const categorySearch = document.getElementById("category-search");
    const categoryClear =
      document.getElementById("category-clear-btn") ||
      document.getElementById("category-clear");
    const parsed = parseInt(id, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return false;

    const known = this.findCategoryById(parsed);
    if (known) {
      return this.applyCategorySelection(known, options);
    }

    const display = this.formatCategoryIdUi(parsed, { source: options.source });

    this._categoryUserEditing = false;
    clearTimeout(this._categoryEditingTimer);

    if (categorySelect) categorySelect.value = String(parsed);
    if (categorySearch) {
      const displayValue = `ID ${parsed}`;
      categorySearch.value = displayValue;
      this._categorySearchCommittedValue = displayValue;
    }
    this.paintCategorySelection(display, { showSelected: options.showSelected !== false });
    if (categoryClear) categoryClear.style.display = "block";
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(parsed);
    }
    this.refreshCategoryApiPreview({
      id: parsed,
      source: options.source || "page",
      cat: null,
    });
    return true;
  }

  /**
   * Live API category priority: optimizer dropdown → Meesho page sscat → Kurtis default.
   */
  resolveCategoryForLiveApi(categorySelect) {
    const searchEl = document.getElementById("category-search");
    const raw = searchEl?.value?.trim() || "";
    const selectedId = parseInt(categorySelect?.value, 10);

    if (raw && (this._categoryUserEditing || !selectedId)) {
      const result = this.resolveCategoryFromSearchInput(raw, 12);
      if (result.status === "resolved" && result.cat) {
        this.applyCategorySelection(result.cat, { source: "user" });
        const resolved = {
          id: result.cat.id,
          source: "user",
          cat: result.cat,
        };
        if (typeof MeeshoAPI !== "undefined") {
          MeeshoAPI.setCategory(resolved.id);
        }
        return resolved;
      }
      if (result.status === "ambiguous") {
        return {
          error: true,
          message: `Pick a category from the list (${result.hits.length} matches for "${raw}")`,
        };
      }
      if (result.status === "not_found") {
        return {
          error: true,
          message: `No category found for "${raw}" — try name or numeric ID`,
        };
      }
    }

    const resolved = this.peekCategoryForLiveApi(categorySelect);
    if (resolved.error) return resolved;

    if (resolved.id) {
      if (resolved.cat) {
        if (resolved.source !== "user") {
          this.applyCategorySelection(resolved.cat, {
            source: resolved.source,
            showSelected: true,
          });
        } else {
          this.refreshCategoryApiPreview(resolved);
        }
      } else if (resolved.source === "page") {
        this.applyCategoryByIdOnly(resolved.id, { source: "page" });
      } else if (resolved.source === "default") {
        const defCat = this.findCategoryById(resolved.id);
        if (defCat) {
          this.applyCategorySelection(defCat, { source: "default" });
        }
      } else {
        this.refreshCategoryApiPreview(resolved);
      }

      if (typeof MeeshoAPI !== "undefined") {
        MeeshoAPI.setCategory(resolved.id);
      }
    }

    return resolved;
  }

  applyDefaultCategoryIfNeeded() {
    if (!this.allCategories?.length) {
      this.refreshCategoryApiPreview();
      return;
    }

    if (this._categoryUserPicked) {
      this.refreshCategoryApiPreview();
      return;
    }

    if (this.applyPageCategoryIfAvailable()) return;

    const categorySelect = document.getElementById("category-select");
    if (categorySelect?.value) {
      this.refreshCategoryApiPreview();
      return;
    }

    const defId =
      typeof MeeshoCategories !== "undefined"
        ? MeeshoCategories.getDefaultCategoryId()
        : 10004;
    const targetCat =
      this.findCategoryById(defId) ||
      this.allCategories.find((c) => c.id === defId) ||
      this.allCategories[0];

    if (!targetCat) {
      this.refreshCategoryApiPreview();
      return;
    }
    this.applyCategorySelection(targetCat, { source: "default" });
  }

  gatherSettings() {
    const customText = document.getElementById("custom-text");
    const textBgColor = document.getElementById("text-bg-color");

    // Only text settings - everything else is random
    ImageGenerator.updateSettings({
      customText: customText?.value || "",
      textBgColor: textBgColor?.value || "#667eea",
    });

    if (typeof ImageGenerator.preloadBadges === "function") {
      void ImageGenerator.preloadBadges();
    }
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.preloadBadges) {
      void MeeshoAPI.preloadBadges();
    }

    // Set category in MeeshoAPI (dropdown wins; else page-detected sscat)
    const categorySelect = document.getElementById("category-select");
    const resolved = this.resolveCategoryForLiveApi(categorySelect);
    if (resolved.id && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(resolved.id);
    }
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.syncCatalogPricing) {
      const pricing = MeeshoAPI.syncCatalogPricing();
      if (pricing.priceUsed) {
        console.log("📋 Catalog Meesho Price for live checks: ₹" + pricing.priceUsed);
      }
    }
  }

  // ─── Optimizer tabs (web + extension) ───────────────────────────────────
  // Live tab → processImage() — production path, unchanged below.
  // Test Lab tab → processImageTestLab() — isolated experiments only.

  getActiveOptimizerTab() {
    if (!this.isTabbedOptimizerUI()) return "live";
    return this.activeOptimizerTab || "live";
  }

  setupOptimizerTabs() {
    const tabs = document.querySelectorAll("[data-optimizer-tab]");
    if (!tabs.length) return;

    const switchTab = (tabName) => {
      this.activeOptimizerTab = tabName === "test" ? "test" : "live";
      tabs.forEach((btn) => {
        const active = btn.dataset.optimizerTab === this.activeOptimizerTab;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      document.querySelectorAll("[data-optimizer-panel]").forEach((panel) => {
        panel.classList.toggle(
          "active",
          panel.dataset.optimizerPanel === this.activeOptimizerTab
        );
      });

      const genBtn = document.getElementById("generate-btn");
      const testGenBtn = document.getElementById("test-generate-btn");
      const isTest = this.activeOptimizerTab === "test";
      if (genBtn) {
        genBtn.style.display = isTest ? "none" : "block";
      }
      if (testGenBtn) {
        testGenBtn.style.display = isTest ? "block" : "none";
        if (genBtn && isTest) {
          testGenBtn.disabled = genBtn.disabled;
        }
      }

      if (isTest) {
        this.preloadLiveAnalysisModule();
        this.refreshTestLabSessionHint();
      }

      const resultsArea = document.getElementById("results-area");
      const testResults = document.getElementById("test-results-area");
      if (testResults) {
        testResults.style.display = "none";
        testResults.innerHTML = "";
      }
      this.refreshResultsAreaForActiveTab();

      const boot = document.getElementById("boot-msg");
      const hasFile =
        this._pendingFile ||
        window.__webPendingFile ||
        document.getElementById("image-input")?.files?.[0];
      if (boot && hasFile) {
        boot.textContent =
          this.activeOptimizerTab === "test"
            ? "Image ready — tap Run Test Lab"
            : "Image ready — tap Generate Variants";
      }
    };

    tabs.forEach((btn) => {
      btn.onclick = () => switchTab(btn.dataset.optimizerTab || "live");
    });

    switchTab(this.activeOptimizerTab || "live");
  }

  refreshTestLabSessionHint() {
    const el = document.getElementById("test-lab-session-hint");
    if (!el) return;
    const ready =
      typeof MeeshoAPI !== "undefined" && MeeshoAPI.isReady?.();
    if (window.WEB_OPTIMIZER_MODE) {
      el.style.display = "block";
      el.className = ready
        ? "session-hint session-status ok"
        : "session-hint session-status warn";
      el.textContent = ready
        ? "✅ Meesho session ready — adaptive live hunt enabled"
        : "⚠️ Add Meesho session for live adaptive hunt (static analysis still runs)";
      return;
    }
    el.style.display = "block";
    el.className = ready
      ? "session-hint session-status ok"
      : "session-hint session-status warn";
    el.textContent = ready
      ? "✅ Logged into Meesho — adaptive hunt uses your supplier session"
      : "⚠️ Open supplier.meesho.com while logged in for live adaptive hunt";
  }

  async preloadTestLabModule() {
    if (window.TestLabOptimizer?.runTestLab) return true;
    if (!window.__testLabModulePromise) {
      window.__testLabModulePromise = (async () => {
        try {
          await import(this.getTestLabModuleUrl());
          window.__testLabLoadError = null;
          return !!window.TestLabOptimizer?.runTestLab;
        } catch (e) {
          window.__testLabLoadError = e;
          console.warn("Test Lab preload:", e);
          return false;
        }
      })();
    }
    return window.__testLabModulePromise;
  }

  async waitForTestLabReady(timeoutMs = 15000) {
    if (window.TestLabOptimizer?.runTestLab) return true;
    await this.preloadTestLabModule();
    if (window.TestLabOptimizer?.runTestLab) return true;
    if (window.__testLabLoadError) return false;
    if (window.__testLabReady) return !!window.TestLabOptimizer?.runTestLab;
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      const finish = () => {
        clearTimeout(timer);
        resolve(!!window.TestLabOptimizer?.runTestLab);
      };
      window.addEventListener("testlab-ready", finish, { once: true });
    });
  }

  refreshResultsAreaForActiveTab() {
    const resultsArea = document.getElementById("results-area");
    const testResults = document.getElementById("test-results-area");
    if (testResults) {
      testResults.style.display = "none";
      testResults.innerHTML = "";
    }
    if (!resultsArea) return;

    if (
      this.activeOptimizerTab === "test" &&
      (this.testLabCurrentResults.length || this.testLabAnalysisPrimaryResults.length)
    ) {
      resultsArea.style.display = "block";
      resultsArea.dataset.view = "test";
      resultsArea.innerHTML = OptimizerUI.getResultsHTML(
        this.testLabCurrentResults,
        this.getTestLabResultsViewOptions()
      );
      this.setupResultsEvents();
      return;
    }

    if (
      this.activeOptimizerTab === "live" &&
      (this.currentResults.length ||
        this.analysisPrimaryResults.length ||
        this.shouldShowStaticPromoWorkspace())
    ) {
      resultsArea.style.display = "block";
      delete resultsArea.dataset.view;
      resultsArea.innerHTML = OptimizerUI.getResultsHTML(
        this.currentResults,
        this.getResultsViewOptions()
      );
      this.setupResultsEvents();
      return;
    }

    resultsArea.style.display = "none";
    resultsArea.innerHTML = "";
    delete resultsArea.dataset.view;
  }

  setTestLabChromeVisible(visible) {
    const ids = [
      "upload-area",
      "preview-box",
      "generate-sticky",
      "optimizer-tabs",
      "boot-msg",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (visible) {
        el.classList.remove("optimizer-chrome-hidden");
      } else {
        el.classList.add("optimizer-chrome-hidden");
      }
    });
    document.querySelectorAll("[data-optimizer-panel]").forEach((panel) => {
      if (visible) {
        panel.classList.remove("optimizer-chrome-hidden");
      } else {
        panel.classList.add("optimizer-chrome-hidden");
      }
    });
    if (visible) {
      this.setupOptimizerTabs();
    }
  }

  restoreTestLabFormUi() {
    this.resetToUploadForm({ keepImage: true });
  }

  resetToUploadForm(options = {}) {
    const keepImage = !!options.keepImage;

    this.isProcessing = false;
    this.shouldStop = false;
    this.currentResults = [];
    this.framedExtraResults = [];
    this.showFramedExtras = false;
    this.liveAnalysis = null;
    this.analysisPrimaryResults = [];
    this.analysisExtraResults = [];
    this.showAnalysisExtras = false;
    this.showcaseResults = [];
    this.showShowcaseResults = false;
    this.isGeneratingShowcase = false;
    this.promoLifestyleResults = [];
    this.showPromoLifestyleResults = false;
    this.isGeneratingPromoLifestyle = false;
    this.tallStaticResults = [];
    this.showTallStaticResults = false;
    this.isGeneratingTallStatic = false;
    this.gownStaticResults = [];
    this.showGownStaticResults = false;
    this.isGeneratingGownStatic = false;
    this.testLabCurrentResults = [];
    this.testLabFramedExtraResults = [];
    this.testLabShowFramedExtras = false;
    this.testLabLiveAnalysis = null;
    this.testLabAnalysisPrimaryResults = [];
    this.testLabAnalysisExtraResults = [];
    this.testLabShowAnalysisExtras = false;

    if (!keepImage) {
      this._pendingFile = null;
      this.lastProcessedFile = null;
      this.originalImageUrl = null;
      this._uploadUserCleared = true;
      this._uploadUserPicked = false;
      if (typeof window !== "undefined") window.__webPendingFile = null;
    }

    this.closeVariantEditor();
    this.setTestLabChromeVisible(true);

    const processingArea = document.getElementById("processing-area");
    const resultsArea = document.getElementById("results-area");
    const testResultsArea = document.getElementById("test-results-area");
    const uploadArea = document.getElementById("upload-area");
    const previewBox = document.getElementById("preview-box");
    const previewImg = document.getElementById("preview-img");
    const imageInput = document.getElementById("image-input");
    const generateBtn = document.getElementById("generate-btn");
    const testGenBtn = document.getElementById("test-generate-btn");
    const generateSticky = document.getElementById("generate-sticky");

    if (processingArea) {
      processingArea.style.display = "none";
      processingArea.innerHTML = "";
    }
    if (resultsArea) {
      resultsArea.style.display = "none";
      resultsArea.innerHTML = "";
      delete resultsArea.dataset.view;
    }
    if (testResultsArea) {
      testResultsArea.style.display = "none";
      testResultsArea.innerHTML = "";
    }

    const hasFile =
      keepImage &&
      (this._pendingFile ||
        window.__webPendingFile ||
        imageInput?.files?.[0]);

    if (!keepImage && imageInput) imageInput.value = "";
    if (!keepImage) {
      if (previewImg) previewImg.src = "";
      if (previewBox) previewBox.style.display = "none";
    } else if (previewBox && previewImg && this.originalImageUrl) {
      previewImg.src = this.originalImageUrl;
      previewBox.style.display = "block";
    }

    if (uploadArea) {
      uploadArea.style.display = hasFile ? "none" : "block";
    }

    document.querySelectorAll(".opt-section").forEach((s) => {
      s.style.display = "block";
    });

    if (generateSticky) generateSticky.style.display = "";
    if (generateBtn) {
      generateBtn.style.display =
        this.getActiveOptimizerTab() === "test" ? "none" : "block";
      generateBtn.disabled = !hasFile;
    }
    if (testGenBtn) {
      testGenBtn.style.display =
        this.getActiveOptimizerTab() === "test" ? "block" : "none";
      testGenBtn.disabled = !hasFile;
    }

    this.setupOptimizerTabs();
    this.syncStaticPromoChrome();
    if (window.WEB_OPTIMIZER_MODE && hasFile) {
      this.refreshLiveResultsPanel({ scroll: false });
    }
  }

  /**
   * TEST LAB — mirrors Live processImage but uses smartSearchAdaptive (skips higher ₹).
   * Does not modify Live tab state or MeeshoAPI.smartSearch.
   */
  async processImageTestLab(file) {
    if (!file) {
      OptimizerUtils.showNotification("Choose an image first", "error");
      return;
    }
    if (this.isProcessing) return;

    if (window.WEB_OPTIMIZER_MODE && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.syncFromSession?.();
    }

    const categorySelect = document.getElementById("category-select");
    const resolved = this.resolveCategoryForLiveApi(categorySelect);
    if (resolved.error) {
      OptimizerUtils.showNotification(
        resolved.message || "Select a category for live Meesho shipping checks",
        "error",
      );
      return;
    }
    if (resolved.id && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(resolved.id);
      const cat = resolved.cat || this.findCategoryById(resolved.id);
      const label = cat
        ? this.formatCategoryUi(cat, { source: resolved.source }).title
        : `ID ${resolved.id}`;
      console.log(`📁 Live API category (${resolved.source}):`, label);
    }

    const manualMode = this.isManualShippingMode();

    this.isProcessing = true;
    this.shouldStop = false;
    this.testLabCurrentResults = [];
    this.testLabFramedExtraResults = [];
    this.testLabShowFramedExtras = false;
    this.testLabLiveAnalysis = null;
    this.testLabAnalysisPrimaryResults = [];
    this.testLabAnalysisExtraResults = [];
    this.testLabShowAnalysisExtras = false;

    const uploadArea = document.getElementById("upload-area");
    const sections = document.querySelectorAll(".opt-section");
    const processingArea = document.getElementById("processing-area");
    const resultsArea = document.getElementById("results-area");
    const generateBtn = document.getElementById("generate-btn");
    const testGenBtn = document.getElementById("test-generate-btn");

    if (uploadArea) uploadArea.style.display = "none";
    if (generateBtn) {
      generateBtn.style.display = "none";
      generateBtn.disabled = true;
    }
    if (testGenBtn) {
      testGenBtn.style.display = "none";
      testGenBtn.disabled = true;
    }
    sections.forEach((s) => (s.style.display = "none"));
    if (resultsArea) {
      resultsArea.style.display = "none";
      resultsArea.innerHTML = "";
    }

    const targetShipping =
      parseInt(document.getElementById("test-target-shipping")?.value) ||
      parseInt(document.getElementById("target-shipping")?.value) ||
      50;
    const maxAttempts =
      parseInt(document.getElementById("test-max-attempts")?.value, 10) ||
      parseInt(document.getElementById("max-attempts")?.value, 10) ||
      100;

    const startTime = Date.now();
    const renderProgress = (attempt, max, bestSoFar, noPidCount, skipHigher, phaseLabel) => {
      if (!processingArea || this.shouldStop) return;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      processingArea.innerHTML = this.getSmartModeHTML(
        attempt,
        max,
        targetShipping,
        bestSoFar,
        noPidCount,
        elapsed,
        {
          testLab: true,
          skipHigherCount: skipHigher || 0,
          phaseLabel: phaseLabel || "",
        }
      );
      const stopBtn = document.getElementById("stop-btn");
      if (stopBtn) stopBtn.onclick = () => { this.shouldStop = true; };
    };

    if (processingArea) {
      processingArea.style.display = "block";
      renderProgress(0, maxAttempts, null, 0, 0);
    }

    try {
      const blob = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          fetch(e.target.result).then((r) => r.blob()).then(resolve);
        };
        reader.readAsDataURL(file);
      });

      await this.ensureOriginalImageUrl(file);
      this.gatherSettings();

      const analysisPromise = this.runLiveStaticAnalysis(file).catch((e) => {
        console.warn("Test Lab static analysis failed:", e);
        return null;
      });

      let result = { success: false, results: [] };

      if (
        !manualMode &&
        typeof MeeshoAPI.smartSearchAdaptive === "function" &&
        (!window.WEB_OPTIMIZER_MODE || MeeshoAPI.isReady())
      ) {
        OptimizerUtils.showNotification(
          "🧪 Test Lab adaptive hunt — skipping higher ₹ after best is found",
          "info"
        );
        result = await MeeshoAPI.smartSearchAdaptive(
          blob,
          targetShipping,
          maxAttempts,
          (attempt, max, bestSoFar, noPidCount, skipHigher, phaseLabel) => {
            renderProgress(attempt, max, bestSoFar, noPidCount, skipHigher, phaseLabel);
          },
          (foundResult) => {
            OptimizerUtils.showNotification(
              `🎉 Test Lab target ₹${foundResult.shippingCost}!`,
              "success"
            );
          },
          () => this.shouldStop
        );
      }

      if (
        window.WEB_OPTIMIZER_MODE &&
        (manualMode || !result.success || !result.results.length)
      ) {
        result = await MeeshoAPI.generateLocalVariations(
          blob,
          maxAttempts,
          (attempt, max) => renderProgress(attempt, max, null, 0, 0),
          () => this.shouldStop
        );
      }

      const analysisOut = await analysisPromise;
      if (analysisOut?.success) {
        this.testLabLiveAnalysis = analysisOut.analysis;
        this.testLabAnalysisPrimaryResults = (analysisOut.primary || []).map(
          (r, i) => this.mapResultFromApi(r, i + 40000)
        );
        this.testLabAnalysisExtraResults = (analysisOut.seeMore || []).map(
          (r, i) => this.mapResultFromApi(r, i + 50000)
        );
        this.testLabAnalysisPrimaryResults.sort(
          (a, b) => (a.estShipping || 999) - (b.estShipping || 999)
        );
        this.testLabShowAnalysisExtras = false;
      }

      if (result.success && result.results.length > 0) {
        this.testLabCurrentResults = result.results.map((r, i) =>
          this.mapResultFromApi(r, i)
        );
        this.testLabFramedExtraResults = (result.framedExtras || []).map(
          (r, i) => this.mapResultFromApi(r, i + 45000)
        );
        this.testLabShowFramedExtras = false;

        const skipNote = result.skipHigherCount
          ? ` · ${result.skipHigherCount} higher skipped`
          : "";
        const recoveryNote = result.recoveryTriggered ? " · recovery mode used" : "";
        OptimizerUtils.showNotification(
          `🧪 Best: ₹${result.bestResult?.shippingCost || "—"}${skipNote}${recoveryNote}`,
          "success"
        );
      } else if (this.testLabAnalysisPrimaryResults.length > 0) {
        OptimizerUtils.showNotification(
          `📊 Test Lab: ${this.testLabAnalysisPrimaryResults.length} analysis options (est ₹)`,
          "success"
        );
      } else {
        OptimizerUtils.showNotification(
          "Test Lab: no results — check Meesho session or try another image",
          "error"
        );
      }
    } catch (err) {
      console.error("Test Lab error:", err);
      OptimizerUtils.showNotification("Test Lab: " + err.message, "error");
    }

    if (processingArea) processingArea.style.display = "none";

    if (
      this.testLabCurrentResults.length > 0 ||
      this.testLabAnalysisPrimaryResults.length > 0
    ) {
      if (resultsArea) {
        resultsArea.style.display = "block";
        resultsArea.dataset.view = "test";
        resultsArea.innerHTML = OptimizerUI.getResultsHTML(
          this.testLabCurrentResults,
          this.getTestLabResultsViewOptions()
        );
        this.setupResultsEvents();
      }
    } else {
      this.restoreTestLabFormUi();
    }

    this.isProcessing = false;
  }

  // LIVE MODE ONLY — production generate path. Test Lab uses processImageTestLab().
  async processImage(file) {
    this.localPriceMode = false;
    this.localPriceProfile = null;
    if (!file) {
      OptimizerUtils.showNotification("Choose an image first", "error");
      return;
    }

    if (this.isProcessing) return;

    // Sync session + category before generation
    if (window.WEB_OPTIMIZER_MODE && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.syncFromSession?.();
    }

    const categorySelect = document.getElementById("category-select");
    const resolved = this.resolveCategoryForLiveApi(categorySelect);
    if (resolved.error) {
      OptimizerUtils.showNotification(
        resolved.message || "Select a category for live Meesho shipping checks",
        "error",
      );
      return;
    }
    if (resolved.id && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(resolved.id);
      const cat = resolved.cat || this.findCategoryById(resolved.id);
      const label = cat
        ? this.formatCategoryUi(cat, { source: resolved.source }).title
        : `ID ${resolved.id}`;
      console.log(`📁 Live API category (${resolved.source}):`, label);
    }

    const manualMode = this.isManualShippingMode();

    this.isProcessing = true;
    this.shouldStop = false;
    this.lastProcessedFile = file;
    this.currentResults = [];
    this.framedExtraResults = [];
    this.showFramedExtras = false;
    this.liveAnalysis = null;
    this.analysisPrimaryResults = [];
    this.analysisExtraResults = [];
    this.showAnalysisExtras = false;
    this.showcaseResults = [];
    this.showShowcaseResults = false;
    this.isGeneratingShowcase = false;
    this.promoLifestyleResults = [];
    this.showPromoLifestyleResults = false;
    this.isGeneratingPromoLifestyle = false;
    this.tallStaticResults = [];
    this.showTallStaticResults = false;
    this.isGeneratingTallStatic = false;
    this.gownStaticResults = [];
    this.showGownStaticResults = false;
    this.isGeneratingGownStatic = false;

    const uploadArea = document.getElementById("upload-area");
    const sections = document.querySelectorAll(".opt-section");
    const processingArea = document.getElementById("processing-area");
    const generateBtn = document.getElementById("generate-btn");

    if (uploadArea) uploadArea.style.display = "none";
    if (generateBtn) {
      generateBtn.style.display = "none";
      generateBtn.disabled = true;
    }
    sections.forEach((s) => (s.style.display = "none"));

    // ALWAYS use Smart Mode
    const targetShipping =
      parseInt(document.getElementById("target-shipping")?.value) || 80;
    const maxAttempts =
      parseInt(document.getElementById("max-attempts")?.value, 10) || 20;

    console.log(`🎯 Target ≤ ₹${targetShipping}, Max: ${maxAttempts}`);

    if (processingArea) {
      processingArea.style.display = "block";
      processingArea.innerHTML = this.getSmartModeHTML(
        0,
        maxAttempts,
        targetShipping,
        null,
        0,
        0
      );

      const stopBtn = document.getElementById("stop-btn");
      if (stopBtn)
        stopBtn.onclick = () => {
          console.log("⏹️ Stop");
          this.shouldStop = true;
        };
    }

    // Start timer
    const startTime = Date.now();

    try {
      // Convert file to blob
      const blob = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          fetch(e.target.result)
            .then((r) => r.blob())
            .then(resolve);
        };
        reader.readAsDataURL(file);
      });

      this.gatherSettings();

      const analysisPromise = this.runLiveStaticAnalysis(file).catch((e) => {
        console.warn("Static analysis failed:", e);
        return null;
      });

      let result = { success: false, results: [] };

      if (
        !manualMode &&
        window.WEB_OPTIMIZER_MODE &&
        typeof MeeshoAPI.isReady === "function"
      ) {
        OptimizerUtils.showNotification(
          MeeshoAPI.isReady()
            ? "Checking live Meesho shipping…"
            : "Trying live API… save a Meesho session for real prices",
          "info"
        );
      }

      if (
        !manualMode &&
        typeof MeeshoAPI.smartSearch === "function" &&
        (!window.WEB_OPTIMIZER_MODE || MeeshoAPI.isReady())
      ) {
        result = await MeeshoAPI.smartSearch(
          blob,
          targetShipping,
          maxAttempts,
          (attempt, max, bestSoFar, noPidCount) => {
            if (processingArea && !this.shouldStop) {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              processingArea.innerHTML = this.getSmartModeHTML(
                attempt,
                max,
                targetShipping,
                bestSoFar,
                noPidCount,
                elapsed
              );
              const stopBtn = document.getElementById("stop-btn");
              if (stopBtn)
                stopBtn.onclick = () => {
                  console.log("⏹️ Stop");
                  this.shouldStop = true;
                };
            }
          },
          (foundResult) => {
            OptimizerUtils.showNotification(
              `🎉 Found ₹${foundResult.shippingCost}!`,
              "success"
            );
          },
          () => this.shouldStop
        );
      }

      if (
        window.WEB_OPTIMIZER_MODE &&
        (manualMode || !result.success || !result.results.length)
      ) {
        if (manualMode) {
          OptimizerUtils.showNotification(
            "Generating variants — enter Meesho prices manually after upload",
            "info"
          );
        } else {
          OptimizerUtils.showNotification(
            "Generating image variants locally…",
            "info"
          );
        }
        result = await MeeshoAPI.generateLocalVariations(
          blob,
          maxAttempts,
          (attempt, max) => {
            if (processingArea && !this.shouldStop) {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              processingArea.innerHTML = this.getSmartModeHTML(
                attempt,
                max,
                targetShipping,
                null,
                0,
                elapsed
              );
              const stopBtn = document.getElementById("stop-btn");
              if (stopBtn)
                stopBtn.onclick = () => {
                  this.shouldStop = true;
                };
            }
          },
          () => this.shouldStop
        );
      }

      const analysisOut = await analysisPromise;
      if (analysisOut?.success) {
        this.liveAnalysis = analysisOut.analysis;
        this.analysisPrimaryResults = (analysisOut.primary || []).map((r, i) =>
          this.mapResultFromApi(r, i + 20000)
        );
        this.analysisExtraResults = (analysisOut.seeMore || []).map((r, i) =>
          this.mapResultFromApi(r, i + 30000)
        );
        this.analysisPrimaryResults.sort(
          (a, b) => (a.estShipping || 999) - (b.estShipping || 999)
        );
        this.showAnalysisExtras = false;
      }

      if (
        (result.success && result.results.length > 0) ||
        this.analysisPrimaryResults.length > 0
      ) {
        if (result.success && result.results.length > 0) {
          this.currentResults = result.results.map((r, i) =>
            this.mapResultFromApi(r, i)
          );
          this.framedExtraResults = (result.framedExtras || []).map((r, i) =>
            this.mapResultFromApi(r, i + 10000)
          );
          this.showFramedExtras = false;

          if (result.localOnly) {
            OptimizerUtils.showNotification(
              manualMode
                ? `✅ ${result.results.length} variants — download, test on Meesho, type ₹ below`
                : `✅ ${result.results.length} variants ready — download & test on Meesho`,
              "success"
            );
          } else if (result.targetReached) {
            OptimizerUtils.showNotification(
              `🎯 Target! ₹${result.bestResult.shippingCost}`,
              "success"
            );
          } else if (this.shouldStop) {
            OptimizerUtils.showNotification(
              `Stopped. Best: ₹${result.bestResult?.shippingCost || "—"}`,
              "info"
            );
          } else if (result.bestResult?.shippingCost) {
            OptimizerUtils.showNotification(
              `✅ Best: ₹${result.bestResult.shippingCost} (${result.verifiedCount || 0} verified, ${result.noPidCount || 0} no PID)`,
              "info"
            );
          }
        } else if (this.analysisPrimaryResults.length > 0) {
          OptimizerUtils.showNotification(
            `📊 ${this.analysisPrimaryResults.length} analysis options ready (est ₹, no Meesho needed)`,
            "success"
          );
        }
      } else if (!window.WEB_OPTIMIZER_MODE) {
        OptimizerUtils.showNotification(
          `⚠️ No results yet. Try different image or check Meesho session.`,
          "error"
        );
      }
    } catch (err) {
      console.error("❌ Error:", err);
      OptimizerUtils.showNotification("Error: " + err.message, "error");
    }

    // Auto-save priced results to local price DB
    try { this.saveToLocalPriceDB(); } catch (e) { console.warn("LocalPriceDB save:", e); }

    // Show results
    const resultsArea = document.getElementById("results-area");
    if (processingArea) processingArea.style.display = "none";

    if (this.currentResults.length > 0 || this.analysisPrimaryResults.length > 0 || (window.WEB_OPTIMIZER_MODE && (this.showcaseResults.length > 0 || this.promoLifestyleResults.length > 0 || this.tallStaticResults.length > 0 || this.gownStaticResults.length > 0))) {
      if (resultsArea) {
        resultsArea.style.display = "block";
        delete resultsArea.dataset.view;
        resultsArea.innerHTML = OptimizerUI.getResultsHTML(
          this.currentResults,
          this.getResultsViewOptions()
        );
        this.setupResultsEvents();
      }
    } else {
      if (resultsArea) resultsArea.style.display = "none";
      if (uploadArea) uploadArea.style.display = "block";
      sections.forEach((s) => (s.style.display = "block"));
      if (generateBtn) {
        generateBtn.style.display = "block";
        generateBtn.disabled =
          !this._pendingFile &&
          !window.__webPendingFile &&
          !document.getElementById("image-input")?.files?.[0];
      }
      if (window.WEB_OPTIMIZER_MODE) {
        OptimizerUtils.showNotification(
          "No variants generated — try another image",
          "error"
        );
      }
    }

    this.isProcessing = false;
  }

  /**
   * Generate exactly 2–3 local variants for lowest shipping (no live Meesho API).
   * Kurti + correct image → 3 picks all at lowest tier (₹59 from report).
   */
  async processImageLocalPrice(file) {
    const LOCAL_POOL_SIZE = 6;

    if (this.isProcessing) return;
    this.isProcessing = true;
    this.shouldStop = false;
    this.localPriceMode = true;
    this.lastProcessedFile = file;

    const processingArea = document.getElementById("processing-area");
    const resultsArea = document.getElementById("results-area");
    const uploadArea = document.getElementById("upload-area");
    const sections = document.querySelectorAll(".opt-section");
    const generateBtn = document.getElementById("generate-btn");
    const localGenBtn = document.getElementById("local-price-generate-btn");

    this.currentResults = [];
    this.framedExtraResults = [];
    this.analysisPrimaryResults = [];
    this.analysisExtraResults = [];
    this.showFramedExtras = false;
    this.showAnalysisExtras = false;
    this.liveAnalysis = null;

    if (uploadArea) uploadArea.style.display = "none";
    sections.forEach((s) => (s.style.display = "none"));
    if (generateBtn) generateBtn.style.display = "none";
    if (localGenBtn) localGenBtn.disabled = true;

    const categorySelect = document.getElementById("category-select");
    const catId = categorySelect?.value || "";
    const profile = catId
      ? LocalPriceDB.getCategoryProfile(catId)
      : LocalPriceDB.getCategoryProfile("");

    this.localPriceProfile = profile;

    if (!profile.hasData) {
      OptimizerUtils.showNotification(
        "No local tiers for this category — import a CSV report or run live first, then save.",
        "error",
        8000,
      );
    } else {
      OptimizerUtils.showNotification(
        `📍 Local mode · tiers ₹${profile.tiers.join(", ")} · ${profile.strategyReason}`,
        "info",
        6000,
      );
    }

    if (processingArea) {
      processingArea.style.display = "block";
      processingArea.innerHTML = `
        <div style="text-align:center;padding:24px;">
          <div style="font-size:40px;margin-bottom:8px;">📍</div>
          <h3 style="margin:0 0 6px;color:#047857;font-size:16px;">Generating Local Price Variants</h3>
          <p style="color:#6b7280;font-size:12px;">No live API — using saved category tiers</p>
        </div>`;
    }

    const startTime = Date.now();

    try {
      const blob = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          fetch(e.target.result).then((r) => r.blob()).then(resolve);
        };
        reader.readAsDataURL(file);
      });

      await this.ensureOriginalImageUrl(file);
      this.gatherSettings();

      const analysisPromise = this.runLiveStaticAnalysis(file).catch((e) => {
        console.warn("Local price static analysis failed:", e);
        return null;
      });

      let rawResults = [];
      if (typeof MeeshoAPI.generateLocalVariations === "function") {
        const result = await MeeshoAPI.generateLocalVariations(
          blob,
          LOCAL_POOL_SIZE,
          (attempt, max) => {
            if (processingArea && !this.shouldStop) {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              processingArea.innerHTML = this.getSmartModeHTML(
                attempt,
                max,
                profile.recommendedPrices[0] || 59,
                null,
                0,
                elapsed,
                { testLab: true, phaseLabel: "Local variants (no live check)" },
              );
            }
          },
          () => this.shouldStop,
        );
        if (result?.success) {
          rawResults = result.results || [];
        }
      }

      const analysisOut = await analysisPromise;
      if (analysisOut?.success && analysisOut.primary?.length) {
        this.liveAnalysis = analysisOut.analysis;
        const analysisMapped = (analysisOut.primary || []).map((r, i) =>
          this.mapResultFromApi(r, i + 20000),
        );
        if (!rawResults.length) {
          rawResults = analysisMapped.slice(0, LOCAL_POOL_SIZE);
        } else {
          rawResults = rawResults.map((r, i) => {
            const mapped = this.mapResultFromApi(r, i);
            if (!mapped.estShipping && analysisMapped[i]) {
              mapped.estShipping =
                analysisMapped[i].estShipping ||
                analysisMapped[i].meta?.estInr ||
                0;
            }
            return mapped;
          });
        }
      } else {
        rawResults = rawResults.map((r, i) => this.mapResultFromApi(r, i));
      }

      const display = LocalPriceDB.buildLocalPicks(rawResults, catId);

      display.sort(
        (a, b) =>
          (a.localEstShipping || a.estShipping || 999) -
          (b.localEstShipping || b.estShipping || 999),
      );

      this.currentResults = display;

      const recPrices = profile.recommendedPrices || [];
      const bestEst = display[0]?.localEstShipping || display[0]?.estShipping || "—";
      OptimizerUtils.showNotification(
        profile.hasData
          ? `📍 ${display.length} picks for lowest shipping · recommend ₹${recPrices.join(" + ₹")} · est ₹${bestEst}`
          : `📍 ${display.length} picks (est only — import CSV for tier mapping)`,
        "success",
        8000,
      );
    } catch (err) {
      console.error("Local price generate failed:", err);
      OptimizerUtils.showNotification("Local price failed: " + err.message, "error");
    }

    if (processingArea) processingArea.style.display = "none";

    if (this.currentResults.length > 0) {
      if (resultsArea) {
        resultsArea.style.display = "block";
        delete resultsArea.dataset.view;
        resultsArea.innerHTML = OptimizerUI.getResultsHTML(
          this.currentResults,
          this.getResultsViewOptions(),
        );
        this.setupResultsEvents();
      }
    } else {
      if (resultsArea) resultsArea.style.display = "none";
      if (uploadArea) uploadArea.style.display = "block";
      sections.forEach((s) => (s.style.display = "block"));
      if (generateBtn) generateBtn.style.display = "block";
    }

    if (localGenBtn) localGenBtn.disabled = false;
    this.isProcessing = false;
    this.refreshLocalPriceUI();
  }

  // Smart Mode HTML - Enhanced
  getSmartModeHTML(
    attempt,
    maxAttempts,
    target,
    bestSoFar,
    noPidCount = 0,
    elapsedTime = 0,
    options = {}
  ) {
    const testLab = !!options.testLab;
    const skipHigherCount = options.skipHigherCount || 0;
    const phaseLabel = options.phaseLabel || "";
    const pct = Math.round((attempt / maxAttempts) * 100);

    // Format elapsed time
    const mins = Math.floor(elapsedTime / 60);
    const secs = elapsedTime % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    // Estimate remaining time
    let estRemaining = "";
    if (attempt > 0 && elapsedTime > 0) {
      const avgPerAttempt = elapsedTime / attempt;
      const remaining = Math.round(avgPerAttempt * (maxAttempts - attempt));
      if (remaining > 60) {
        estRemaining = `~${Math.ceil(remaining / 60)}m left`;
      } else if (remaining > 0) {
        estRemaining = `~${remaining}s left`;
      }
    }

    return `
            <div style="text-align:center;padding:20px;">
                <div style="font-size:50px;margin-bottom:10px;">🎯</div>
                <h3 style="margin:0 0 5px 0;color:#10b981;font-size:18px;">${testLab ? "🧪 Test Lab — Adaptive Lowest ₹ Hunt" : "AI Is Finding Best Shipping"}</h3>
                <p style="color:##0f0f10;font-size:14px;margin-bottom:3px;">Target: ≤ ₹${target}</p>
                <p style="color:#9ca3af;font-size:11px;margin-bottom:5px;">${attempt} / ${maxAttempts}${
      noPidCount > 0 ? ` • ${noPidCount} no PID (kept)` : ""
    }${skipHigherCount > 0 ? ` • ${skipHigherCount} skipped higher` : ""}</p>
                ${
                  testLab && phaseLabel
                    ? `<p style="color:#047857;font-size:11px;margin-bottom:8px;">${phaseLabel}</p>`
                    : ""
                }
                <p style="color:#667eea;font-size:12px;margin-bottom:12px;">⏱️ ${timeStr}${
      estRemaining ? ` • ${estRemaining}` : ""
    }</p>
                
                ${
                  bestSoFar
                    ? `
                    <div style="background:${
                      bestSoFar <= target
                        ? "rgba(16,185,129,0.2)"
                        : "rgba(102,126,234,0.15)"
                    };border:2px solid ${
                        bestSoFar <= target
                          ? "#10b981"
                          : "rgba(102,126,234,0.5)"
                      };border-radius:12px;padding:12px;margin-bottom:12px;">
                        <div style="font-size:11px;color:#9ca3af;">Best Found</div>
                        <div style="font-size:32px;font-weight:700;color:${
                          bestSoFar <= target ? "#10b981" : "#667eea"
                        };">₹${bestSoFar}</div>
                        ${
                          bestSoFar <= target
                            ? '<div style="font-size:11px;color:#10b981;margin-top:3px;font-weight:300;">✅ Target Reached!</div>'
                            : '<div style="font-size:10px;color:#10b981;margin-top:3px;font-weight:300;">✓ Live Meesho API</div>'
                        }
                    </div>
                `
                    : `
                    <div style="background:rgba(102,126,234,0.15);border:1px solid rgba(102,126,234,0.3);border-radius:12px;padding:15px;margin-bottom:12px;">
                        <div style="font-size:28px;color:#667eea;">🔍</div>
                        <div style="font-size:11px;color:#9ca3af;margin-top:5px;">Searching...</div>
                    </div>
                `
                }
                
                <div style="background:rgba(255,255,255,0.1);border-radius:10px;height:10px;margin-bottom:8px;overflow:hidden;">
                    <div style="width:${pct}%;background:linear-gradient(135deg, #FFD700, #C9A227);height:100%;border-radius:10px;transition:width 0.3s;"></div>
                </div>
                <div style="font-size:11px;color:#a78bfa;margin-bottom:12px;">${pct}%</div>
                <button id="stop-btn" class="opt-btn opt-btn-danger" style="padding:10px 25px;font-size:13px;border-radius:10px;">⏹️ Stop</button>
            </div>
        `;
  }

  async testVariations(variations) {
    const processingArea = document.getElementById("processing-area");
    const resultsArea = document.getElementById("results-area");

    console.log("🔄 Testing", variations.length, "variations");

    // Check if MeeshoAPI is available
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.isValidCatalogPage()) {
      console.log("✅ Using Meesho API");

      // Check if API is ready
      if (!MeeshoAPI.isReady()) {
        console.log("⚠️ API not ready, waiting...");
        await new Promise((r) => setTimeout(r, 1000));
        MeeshoAPI.detectAllValues();
      }

      // Use real Meesho API
      const apiResult = await MeeshoAPI.testVariationsShipping(
        variations,
        (current, total, name) => {
          if (this.shouldStop) return;
          if (processingArea) {
            processingArea.innerHTML = OptimizerUI.getProcessingHTML(
              current,
              total,
              this.originalImageUrl
            );
            const stopBtn = document.getElementById("stop-btn");
            if (stopBtn) stopBtn.onclick = () => this.stopProcessing();
          }
        }
      );

      if (apiResult.success && apiResult.results.length > 0) {
        // Store results with uploaded URLs for accurate apply
        this.currentResults = apiResult.results.map((r) => ({
          name: r.name,
          imageUrl: r.dataUrl,
          uploadedUrl: r.uploadedUrl, // Keep this for reference
          shippingCost: r.shippingCost,
          savings: r.savings || 0,
          isRealPrice: true,
        }));

        console.log("✅ Got", this.currentResults.length, "real prices");

        if (apiResult.failed > 0) {
          OptimizerUtils.showNotification(
            `${apiResult.failed} failed, ${this.currentResults.length} success`,
            "warning"
          );
        }
      } else {
        console.warn("⚠️ API failed, using estimation");
        OptimizerUtils.showNotification(
          "API failed, using estimation",
          "warning"
        );
        await this.testVariationsWithEstimation(variations, processingArea);
      }
    } else {
      console.log("⚠️ Not on catalog page, using estimation");
      await this.testVariationsWithEstimation(variations, processingArea);
    }

    // Show results
    if (processingArea) processingArea.style.display = "none";
    if (resultsArea && this.currentResults.length > 0) {
      resultsArea.style.display = "block";
      resultsArea.innerHTML = OptimizerUI.getResultsHTML(
        this.currentResults,
        this.getResultsViewOptions()
      );
      this.setupResultsEvents();

      const best = this.currentResults[0];
      const priceType = best.isRealPrice ? "✅ Real" : "📊 Est.";
      OptimizerUtils.showNotification(
        `Best: ₹${best.shippingCost} ${priceType}`,
        "success"
      );
    }
  }

  // Fallback estimation method
  async testVariationsWithEstimation(variations, processingArea) {
    const baseCost = this.detectShipping() || 50;

    for (let i = 0; i < variations.length; i++) {
      if (this.shouldStop) break;

      const v = variations[i];

      if (processingArea) {
        processingArea.innerHTML = OptimizerUI.getProcessingHTML(
          i + 1,
          variations.length,
          this.originalImageUrl
        );
        const stopBtn = document.getElementById("stop-btn");
        if (stopBtn) stopBtn.onclick = () => this.stopProcessing();
      }

      const estimatedCost = v.estimatedShipping || baseCost;
      const savings = v.savings || 0;

      this.currentResults.push({
        name: v.name,
        imageUrl: v.dataUrl,
        shippingCost: estimatedCost,
        savings: savings,
        isRealPrice: false,
      });

      await new Promise((r) => setTimeout(r, 30));
    }

    this.currentResults.sort((a, b) => a.shippingCost - b.shippingCost);
  }

  async uploadAndGetShipping(dataUrl) {
    try {
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();
      const file = new File([blob], "product-" + Date.now() + ".jpg", {
        type: "image/jpeg",
      });

      const imageInput = document.querySelector("#changeFrontImage");
      if (!imageInput) {
        return this.currentShippingCost || 100;
      }

      const oldShipping = this.detectShipping();

      const dt = new DataTransfer();
      dt.items.add(file);
      imageInput.files = dt.files;

      imageInput.dispatchEvent(new Event("change", { bubbles: true }));
      imageInput.dispatchEvent(new Event("input", { bubbles: true }));

      await new Promise((r) => setTimeout(r, 2000));

      await this.triggerPriceRefresh();

      await new Promise((r) => setTimeout(r, 2500));

      const newShipping = await this.waitForShippingUpdate(oldShipping);

      return newShipping;
    } catch (err) {
      console.error("Upload error:", err);
      return this.currentShippingCost || 100;
    }
  }

  async waitForShippingUpdate(oldValue) {
    for (let i = 0; i < 10; i++) {
      const currentValue = this.detectShipping();

      if (currentValue && currentValue > 0) {
        this.lastDetectedCost = currentValue;
        return currentValue;
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    return this.currentShippingCost || 100;
  }

  async triggerPriceRefresh() {
    const priceSelectors = [
      'input[name="price"]',
      'input[name="mrp"]',
      'input[name="sellingPrice"]',
      'input[placeholder*="price" i]',
      'input[placeholder*="mrp" i]',
      'input[id*="price" i]',
      'input[class*="price" i]',
      ".MuiInputBase-input",
      'input[type="number"]',
    ];

    let priceInput = null;

    for (const sel of priceSelectors) {
      try {
        const inputs = document.querySelectorAll(sel);
        for (const inp of inputs) {
          if (
            inp.value &&
            inp.value.match(/^\d+$/) &&
            parseInt(inp.value) >= 10
          ) {
            priceInput = inp;
            break;
          }
        }
        if (priceInput) break;
      } catch (e) {}
    }

    if (priceInput) {
      const currentValue = priceInput.value;

      priceInput.focus();
      priceInput.click();
      await new Promise((r) => setTimeout(r, 100));

      priceInput.select();
      priceInput.value = currentValue;

      priceInput.dispatchEvent(
        new Event("input", { bubbles: true, cancelable: true })
      );
      priceInput.dispatchEvent(
        new Event("change", { bubbles: true, cancelable: true })
      );
      priceInput.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Tab", keyCode: 9 })
      );
      priceInput.dispatchEvent(
        new KeyboardEvent("keyup", { bubbles: true, key: "Tab", keyCode: 9 })
      );

      await new Promise((r) => setTimeout(r, 100));

      priceInput.blur();
      priceInput.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      priceInput.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));

      document.body.click();
    }

    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || "").toLowerCase().trim();
      if (
        text.includes("calculate") ||
        text.includes("update") ||
        text === "save"
      ) {
        btn.click();
        await new Promise((r) => setTimeout(r, 500));
        break;
      }
    }
  }

  isManualShippingMode() {
    if (!window.WEB_OPTIMIZER_MODE) return false;
    const el = document.getElementById("manual-shipping-mode");
    return el ? el.checked : true;
  }

  getBaselineShipping() {
    const el = document.getElementById("current-shipping-baseline");
    const fromInput = parseInt(el?.value, 10);
    if (fromInput > 0) return fromInput;
    if (this.currentShippingCost > 0) return this.currentShippingCost;
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.detectCatalogPricing) {
      const catalog = MeeshoAPI.detectCatalogPricing();
      if (catalog?.customerShipping > 0) return catalog.customerShipping;
    }
    return 0;
  }

  buildLiveReportContext() {
    const categorySelect = document.getElementById("category-select");
    const peek = this.peekCategoryForLiveApi(categorySelect);
    const cat = peek?.cat || this.findCategoryById(peek?.id);
    const display = cat
      ? this.formatCategoryUi(cat, { source: peek?.source })
      : peek?.id
      ? this.formatCategoryIdUi(peek.id, { source: peek?.source })
      : { title: "", path: "" };
    const productLabel =
      document.getElementById("custom-text")?.value?.trim() ||
      document.querySelector("[data-product-name]")?.textContent?.trim() ||
      "";

    return {
      generatedAt: new Date().toISOString(),
      baselineShipping: this.getBaselineShipping(),
      categoryId: peek?.id || "",
      categoryName: display.title || cat?.name || "",
      categoryPath: display.path || cat?.path || "",
      categorySource: peek?.source || "",
      manualMode: this.isManualShippingMode(),
      productLabel,
      primaryResults: this.currentResults,
      framedExtras: this.framedExtraResults,
      liveAnalysis: this.liveAnalysis || null,
    };
  }

  async createLiveVariantReport() {
    const priced = this.currentResults.filter((r) => r.shippingCost > 0);
    if (!priced.length) {
      OptimizerUtils.showNotification(
        "Add live shipping prices first, then create report",
        "error",
      );
      return null;
    }

    const ready = await this.preloadLiveVariantReportModule();
    if (!ready || !window.LiveVariantReport?.createAndDownloadReport) {
      OptimizerUtils.showNotification("Report module failed to load", "error");
      return null;
    }

    try {
      const context = this.buildLiveReportContext();
      const analysis = window.LiveVariantReport.createAndDownloadReport(
        [...this.currentResults, ...this.framedExtraResults],
        context,
      );
      const rec = analysis.recommendation;
      const pickPrices = (rec.picks || [])
        .map((p) => `₹${p.shippingCost}`)
        .join(" + ");
      OptimizerUtils.showNotification(
        rec.picks?.length
          ? `Report saved — recommend ${pickPrices} (${rec.strategy})`
          : "Report saved",
        "success",
      );
      return analysis;
    } catch (e) {
      console.error("Create report failed:", e);
      OptimizerUtils.showNotification(
        "Report failed: " + (e.message || "unknown error"),
        "error",
      );
      return null;
    }
  }

  /** Auto-save priced results to local DB after every report or generate run. */
  saveToLocalPriceDB() {
    const all = [...(this.currentResults || []), ...(this.framedExtraResults || [])];
    const context = this.buildLiveReportContext();
    LocalPriceDB.saveRun(all, context);
  }

  showLocalPriceReport() {
    const categorySelect = document.getElementById("category-select");
    const catId = categorySelect?.value || "";
    const summary = LocalPriceDB.summary(catId);
    const profile = catId ? LocalPriceDB.getCategoryProfile(catId) : null;
    const prices = LocalPriceDB.allPrices(catId);

    if (!summary && !profile?.hasData) {
      OptimizerUtils.showNotification(
        "No local price history — import CSV reports or run live shipping, then save.",
        "error",
      );
      return;
    }

    const lines = [
      `📦 Local Price${catId ? ` · category ${catId}` : ""}`,
      summary
        ? `Reports: ${summary.runs}  |  Variants: ${summary.count}`
        : `Reports: ${profile?.runCount || 0}`,
    ];

    if (profile?.tiers?.length) {
      lines.push(`Tiers: ₹${profile.tiers.join(", ")}`);
      lines.push(`Strategy: ${profile.strategy} — ${profile.strategyReason}`);
      lines.push(`Recommend: ₹${profile.recommendedPrices.join(" + ₹")}`);
    } else if (summary) {
      lines.push(`Range: ₹${summary.min} – ₹${summary.max}`);
      lines.push(`Best estimate: ₹${summary.best}`);
    }

    if (prices.length) {
      lines.push(`All prices: ${prices.map((p) => "₹" + p).join(", ")}`);
    }

    for (let i = 0; i < prices.length - 1; i++) {
      if (prices[i + 1] - prices[i] === 1) {
        lines.push(`✓ ₹1 pair: ₹${prices[i]} + ₹${prices[i + 1]} — test BOTH`);
        break;
      }
    }

    OptimizerUtils.showNotification(lines.join("\n"), "success", 10000);
    console.log("[LocalPriceDB] Reports:", LocalPriceDB._readReports());
    console.log("[LocalPriceDB] Variants:", LocalPriceDB._read());
  }

  saveLocalPriceSnapshot() {
    this.saveToLocalPriceDB();
    const categorySelect = document.getElementById("category-select");
    const catId = categorySelect?.value || "";
    const summary = LocalPriceDB.summary(catId);
    if (summary) {
      OptimizerUtils.showNotification(
        `Saved! Best local price: ₹${summary.best}  (${summary.runs} runs, ${summary.count} variants)`,
        "success",
      );
    } else {
      OptimizerUtils.showNotification("Saved to local history.", "success");
    }
  }

  getResultsViewOptions() {
    return {
      manualMode: this.isManualShippingMode(),
      baselineShipping: this.getBaselineShipping(),
      framedExtras: this.framedExtraResults,
      showFramedExtras: this.showFramedExtras,
      liveAnalysis: this.liveAnalysis,
      analysisPrimary: this.analysisPrimaryResults,
      analysisExtras: this.analysisExtraResults,
      showAnalysisExtras: this.showAnalysisExtras,
      showcaseResults: this.showcaseResults,
      showShowcaseResults: this.showShowcaseResults,
      isGeneratingShowcase: this.isGeneratingShowcase,
      showcaseVariantCount: 25,
      promoLifestyleResults: this.promoLifestyleResults,
      showPromoLifestyleResults: this.showPromoLifestyleResults,
      isGeneratingPromoLifestyle: this.isGeneratingPromoLifestyle,
      promoLifestyleVariantCount: 25,
      tallStaticResults: this.tallStaticResults,
      showTallStaticResults: this.showTallStaticResults,
      isGeneratingTallStatic: this.isGeneratingTallStatic,
      tallStaticVariantCount: 25,
      gownStaticResults: this.gownStaticResults,
      showGownStaticResults: this.showGownStaticResults,
      isGeneratingGownStatic: this.isGeneratingGownStatic,
      gownStaticVariantCount: 25,
      staticPromoHubActive: this.shouldShowStaticPromoWorkspace(),
      localPriceMode: this.localPriceMode,
      localPriceProfile: this.localPriceProfile,
    };
  }

  getTestLabResultsViewOptions() {
    return {
      manualMode: this.isManualShippingMode(),
      baselineShipping: this.getBaselineShipping(),
      framedExtras: this.testLabFramedExtraResults,
      showFramedExtras: this.testLabShowFramedExtras,
      liveAnalysis: this.testLabLiveAnalysis,
      analysisPrimary: this.testLabAnalysisPrimaryResults,
      analysisExtras: this.testLabAnalysisExtraResults,
      showAnalysisExtras: this.testLabShowAnalysisExtras,
    };
  }

  getVariantLayerCaps(row) {
    if (
      typeof MeeshoAPI !== "undefined" &&
      MeeshoAPI.getEffectiveLayerCapabilities &&
      row?.layers
    ) {
      return MeeshoAPI.getEffectiveLayerCapabilities(
        row.layers,
        row.editFlags,
      );
    }
    return {
      hasStickers: false,
      hasBorder: false,
      canRemoveStickers: false,
      canRemoveBorder: false,
      canRemoveBoth: false,
      canAddStickers: false,
      canAddBorder: false,
      canAddBoth: false,
      isStaticPromo: false,
      canAdjustBadges: false,
    };
  }

  isVariantEdited(editFlags, layers, row) {
    if (!editFlags && !row?._badgesRepositioned && !row?._staticAppearanceEdited)
      return false;
    if (row?._badgesRepositioned || row?._staticAppearanceEdited) return true;
    if (
      layers?._staticFrame &&
      typeof window.StaticFrameCompose?.isStaticEdited === "function"
    ) {
      return window.StaticFrameCompose.isStaticEdited(editFlags, false);
    }
    return !!(
      editFlags.stickersRemoved ||
      editFlags.borderOnlyRemoved ||
      editFlags.cleanProduct ||
      editFlags.borderRemoved ||
      editFlags.stickersAdded ||
      editFlags.borderAdded ||
      editFlags.fullDecorationsAdded
    );
  }

  normalizeEditFlags(editFlags, previousFlags = {}) {
    const flags = editFlags || {};
    const prev = previousFlags || {};
    const wasClean = !!(prev.cleanProduct || prev.borderRemoved);
    const addingDecorations = !!(
      flags.stickersAdded ||
      flags.borderAdded ||
      flags.fullDecorationsAdded ||
      flags.decorationsAdded
    );
    let cleanProduct = addingDecorations
      ? false
      : !!(flags.cleanProduct || flags.borderRemoved);
    let stickersRemoved = cleanProduct ? false : !!flags.stickersRemoved;
    let borderOnlyRemoved = cleanProduct ? false : !!flags.borderOnlyRemoved;
    let stickersAdded = !!flags.stickersAdded;
    let borderAdded = !!flags.borderAdded;
    let fullDecorationsAdded = !!(
      flags.fullDecorationsAdded || flags.decorationsAdded
    );

    if (!addingDecorations && stickersRemoved && borderOnlyRemoved) {
      cleanProduct = true;
      stickersRemoved = false;
      borderOnlyRemoved = false;
    }

    if (fullDecorationsAdded) {
      stickersRemoved = false;
      borderOnlyRemoved = false;
      stickersAdded = false;
      borderAdded = false;
      cleanProduct = false;
    } else {
      if (stickersAdded) {
        stickersRemoved = false;
        cleanProduct = false;
        if (wasClean && !borderAdded) {
          borderOnlyRemoved = true;
        }
      }
      if (borderAdded) {
        borderOnlyRemoved = false;
        cleanProduct = false;
        if (wasClean && !stickersAdded) {
          stickersRemoved = true;
        }
      }
      if (stickersRemoved) stickersAdded = false;
      if (borderOnlyRemoved) borderAdded = false;
    }

    return {
      stickersRemoved,
      borderOnlyRemoved,
      cleanProduct,
      stickersAdded,
      borderAdded,
      fullDecorationsAdded,
    };
  }

  freezeRowPricing(row, source = {}) {
    const estShipping = source.estShipping ?? source.meta?.estInr ?? row.estShipping ?? 0;
    row._frozenPricing = {
      estShipping,
      shippingCost: source.shippingCost ?? row.shippingCost ?? 0,
      pricingImageUrl:
        source.pricingImageUrl ||
        row.pricingImageUrl ||
        source.dataUrl ||
        row.dataUrl ||
        "",
      metaKb: source.meta?.kb ?? row.meta?.kb,
      metaEstInr: source.meta?.estInr ?? estShipping,
      targetKb: source.meta?.targetKb ?? row.meta?.targetKb,
    };
    return row;
  }

  ensureFrozenPricing(row) {
    if (!row) return row;
    if (row._frozenPricing?.estShipping > 0 || row._frozenPricing?.metaEstInr > 0) {
      return row;
    }
    return this.freezeRowPricing(row, {
      estShipping: row.estShipping,
      shippingCost: row.shippingCost,
      pricingImageUrl: row.pricingImageUrl,
      dataUrl: row.dataUrl,
      meta: row.meta,
    });
  }

  async ensureRowComposeReady(row) {
    if (!row?.layers) return row;
    await this.preloadStaticComposeModule();
    this.ensureFrozenPricing(row);
    if (window.StaticFrameCompose?.ensureVariantPlacementMeta) {
      await window.StaticFrameCompose.ensureVariantPlacementMeta(row);
    }
    return row;
  }

  getRowDisplayShipping(row) {
    const frozen = row?._frozenPricing;
    if (frozen) {
      if (frozen.shippingCost > 0) return { amount: frozen.shippingCost, verified: true };
      if (frozen.estShipping > 0) return { amount: frozen.estShipping, verified: false };
      if (frozen.metaEstInr > 0) return { amount: frozen.metaEstInr, verified: false };
    }
    if (row?.shippingCost > 0) return { amount: row.shippingCost, verified: true };
    const est = row?.estShipping ?? row?.meta?.estInr ?? 0;
    return { amount: est, verified: false };
  }

  mapResultFromApi(r, index) {
    const variantId =
      r.variantId || `var-${index + 1}-${Math.random().toString(36).slice(2, 7)}`;
    const layers = r.layers || null;
    const pricingImageUrl = r.pricingImageUrl || r.dataUrl || r.imageUrl || "";
    const editFlags = this.normalizeEditFlags(r.editFlags);
    const row = {
      variantId,
      name: r.name || `Var-${index + 1}`,
      pricingImageUrl,
      dataUrl: layers?.length ? "" : r.dataUrl || r.imageUrl || pricingImageUrl || "",
      blob: r.blob || null,
      layers,
      editFlags,
      variantStyle: r.variantStyle || "standard",
      meta: r.meta || null,
      shippingCost: r.shippingCost || 0,
      estShipping: r.estShipping ?? r.meta?.estInr ?? 0,
      isVerified: r.isVerified ?? !r.localOnly,
      duplicatePid: r.duplicatePid,
      manualPrice: !!r.manualPrice,
      uploadedUrl: r.uploadedUrl,
      savings: r.savings,
      isRealPrice: r.isRealPrice,
      liveVerified: r.liveVerified,
      liveTotalPrice: r.liveTotalPrice,
      meeshoPriceUsed: r.meeshoPriceUsed,
      testLab: !!r.testLab,
      noPid: !!r.noPid,
      analysisMode: !!r.analysisMode,
    };
    row.imageUrl =
      typeof MeeshoAPI !== "undefined" && MeeshoAPI.resolveDisplayUrl
        ? MeeshoAPI.resolveDisplayUrl(row) || pricingImageUrl
        : pricingImageUrl;
    this.freezeRowPricing(row, {
      estShipping: row.estShipping,
      shippingCost: row.shippingCost,
      pricingImageUrl,
      dataUrl: row.dataUrl,
      meta: row.meta,
    });
    return row;
  }

  isTestLabResultsActive() {
    const resultsArea = document.getElementById("results-area");
    return !!(
      (this.testLabCurrentResults.length ||
        this.testLabAnalysisPrimaryResults.length) &&
      resultsArea?.style.display === "block" &&
      resultsArea?.dataset?.view === "test"
    );
  }

  getActiveResultList() {
    if (this.isTestLabResultsActive()) return this.testLabCurrentResults;
    return this.currentResults;
  }

  getBestActiveResult() {
    const list = this.getActiveResultList();
    if (list.length) return list[0];
    if (this.isTestLabResultsActive() && this.testLabAnalysisPrimaryResults.length) {
      return this.testLabAnalysisPrimaryResults[0];
    }
    if (this.analysisPrimaryResults.length) return this.analysisPrimaryResults[0];
    if (window.WEB_OPTIMIZER_MODE && this.gownStaticResults.length) {
      return this.gownStaticResults[0];
    }
    if (window.WEB_OPTIMIZER_MODE && this.tallStaticResults.length) {
      return this.tallStaticResults[0];
    }
    if (window.WEB_OPTIMIZER_MODE && this.promoLifestyleResults.length) {
      return this.promoLifestyleResults[0];
    }
    if (window.WEB_OPTIMIZER_MODE && this.showcaseResults.length) {
      return this.showcaseResults[0];
    }
    return null;
  }

  resolveDownloadUrl(result) {
    if (!result) return "";
    return (
      result.pricingImageUrl ||
      result.dataUrl ||
      result.imageUrl ||
      result.uploadedUrl ||
      ""
    );
  }

  resolveResultImageSrc(result) {
    return this.resolveDownloadUrl(result);
  }

  async ensureOriginalImageUrl(file) {
    if (this.originalImageUrl) return this.originalImageUrl;

    const previewImg = document.getElementById("preview-img");
    if (previewImg?.src?.startsWith("data:")) {
      this.originalImageUrl = previewImg.src;
      return this.originalImageUrl;
    }

    if (!file) return null;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.originalImageUrl = ev.target.result;
        resolve(this.originalImageUrl);
      };
      reader.onerror = () => reject(new Error("Could not read image preview"));
      reader.readAsDataURL(file);
    });
  }

  openVariantFullPreview(row) {
    if (!row) return;
    const src =
      document.getElementById("variant-edit-preview")?.src ||
      this.resolveResultImageSrc(row);
    if (!src) {
      OptimizerUtils.showNotification("No preview for this variant", "error");
      return;
    }

    let overlay = document.getElementById("variant-full-preview-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "variant-full-preview-overlay";
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;";
      overlay.innerHTML = `
        <button type="button" id="variant-full-preview-close" style="position:absolute;top:12px;right:12px;background:#fff;border:none;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;z-index:1;">Close</button>
        <img id="variant-full-preview-img" alt="Full preview" style="max-width:100%;max-height:92vh;object-fit:contain;border-radius:8px;background:#fff;touch-action:pan-x pan-y pinch-zoom;">
        <div id="variant-full-preview-title" style="color:#fff;font-size:13px;margin-top:10px;text-align:center;max-width:90vw;"></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector("#variant-full-preview-close").onclick = () => {
        overlay.style.display = "none";
      };
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.style.display = "none";
      };
    }

    const img = overlay.querySelector("#variant-full-preview-img");
    const title = overlay.querySelector("#variant-full-preview-title");
    if (img) img.src = src;
    if (title) title.textContent = row.name || "Variant preview";
    overlay.style.display = "flex";
  }

  openTestLabImagePreview(row) {
    if (!row) return;
    const src = this.resolveResultImageSrc(row);
    if (!src) {
      OptimizerUtils.showNotification("No preview for this variant", "error");
      return;
    }

    let overlay = document.getElementById("test-lab-preview-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "test-lab-preview-overlay";
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;";
      overlay.innerHTML = `
        <button type="button" id="test-lab-preview-close" style="position:absolute;top:12px;right:12px;background:#fff;border:none;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;">Close</button>
        <img id="test-lab-preview-img" alt="Preview" style="max-width:100%;max-height:70vh;object-fit:contain;border-radius:8px;background:#fff;">
        <div id="test-lab-preview-title" style="color:#fff;font-size:13px;margin-top:10px;text-align:center;"></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector("#test-lab-preview-close").onclick = () => {
        overlay.style.display = "none";
      };
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.style.display = "none";
      };
    }

    const img = overlay.querySelector("#test-lab-preview-img");
    const title = overlay.querySelector("#test-lab-preview-title");
    if (img) img.src = src;
    if (title) title.textContent = row.name || "Test Lab variant";
    overlay.style.display = "flex";
  }

  wireTestLabImageFallbacks() {
    document.querySelectorAll(".result-img[data-variant-id]").forEach((img) => {
      const variantId = img.dataset.variantId;
      if (!variantId) return;
      img.onerror = () => {
        const row = this.findResultRow(variantId);
        const alt = this.resolveResultImageSrc(row);
        if (alt && img.src !== alt) img.src = alt;
      };
    });
  }

  findResultRow(variantId) {
    return (
      this.currentResults.find((r) => r.variantId === variantId) ||
      this.framedExtraResults.find((r) => r.variantId === variantId) ||
      this.analysisPrimaryResults.find((r) => r.variantId === variantId) ||
      this.analysisExtraResults.find((r) => r.variantId === variantId) ||
      this.showcaseResults.find((r) => r.variantId === variantId) ||
      this.promoLifestyleResults.find((r) => r.variantId === variantId) ||
      this.tallStaticResults.find((r) => r.variantId === variantId) ||
      this.gownStaticResults.find((r) => r.variantId === variantId) ||
      this.testLabCurrentResults.find((r) => r.variantId === variantId) ||
      this.testLabFramedExtraResults.find((r) => r.variantId === variantId) ||
      this.testLabAnalysisPrimaryResults.find((r) => r.variantId === variantId) ||
      this.testLabAnalysisExtraResults.find((r) => r.variantId === variantId) ||
      null
    );
  }

  async setVariantEdits(variantId, editFlags) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    const normalized = this.normalizeEditFlags(editFlags, row.editFlags);
    row.editFlags = normalized;

    const composeReady = await this.preloadStaticComposeModule();
    const pickedBase =
      composeReady && window.StaticFrameCompose?.pickStaticBaseLayer
        ? window.StaticFrameCompose.pickStaticBaseLayer(row.layers, normalized)
        : null;
    const canUseBakedLayer =
      !!pickedBase && !pickedBase.rebuild && !pickedBase.drawBadges;

    if (
      window.StaticFrameCompose?.ensureStickerPlacements &&
      (normalized.stickersAdded || normalized.fullDecorationsAdded) &&
      !canUseBakedLayer
    ) {
      if (window.StaticFrameCompose.prepareStickerComposeFrame) {
        await window.StaticFrameCompose.prepareStickerComposeFrame(
          row.layers,
          normalized,
          {
            meta: row.meta || {},
            url:
              pickedBase?.url ||
              row.layers.noBorder ||
              row.layers.productOnly ||
              row.layers.full,
          },
        );
      }
      window.StaticFrameCompose.ensureStickerPlacements(
        row.layers,
        normalized,
        row.meta || {},
      );
      if (window.StaticFrameCompose.ensureVariantPlacementMeta) {
        await window.StaticFrameCompose.ensureVariantPlacementMeta(row);
      }
      this._staticControlsVariantId = null;
    } else if (
      window.StaticFrameCompose?.ensureStickerPlacements &&
      (normalized.stickersAdded || normalized.fullDecorationsAdded)
    ) {
      window.StaticFrameCompose.ensureStickerPlacements(
        row.layers,
        normalized,
        row.meta || {},
      );
      if (window.StaticFrameCompose.ensureVariantPlacementMeta) {
        await window.StaticFrameCompose.ensureVariantPlacementMeta(row);
      }
      this._staticControlsVariantId = null;
    }

    const needsCompose =
      composeReady &&
      row.layers._staticFrame &&
      !canUseBakedLayer &&
      (row._staticAppearanceEdited ||
        row._badgesRepositioned ||
        window.StaticFrameCompose?.needsStaticCompose?.(row) ||
        !!pickedBase?.rebuild ||
        !!pickedBase?.drawBadges);

    if (needsCompose && window.StaticFrameCompose?.composeStaticPreview) {
      try {
        const url = await this.composePreviewForRow(row);
        if (url) {
          this.applyStaticPreviewToRow(row, url, variantId);
          if (this._editingVariantId === variantId) {
            this.renderVariantEditorPanel(row);
          } else {
            this.refreshVariantCard(row);
          }
          return;
        }
      } catch (e) {
        console.warn("Variant edit compose failed:", e);
      }
    }

    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.resolveDisplayUrlAsync) {
      try {
        const url = await MeeshoAPI.resolveDisplayUrlAsync(row);
        this.applyStaticPreviewToRow(row, url, variantId);
      } catch (e) {
        const url = MeeshoAPI.resolveDisplayUrl(row);
        this.applyStaticPreviewToRow(row, url, variantId);
      }
    } else if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.resolveDisplayUrl) {
      const url = MeeshoAPI.resolveDisplayUrl(row);
      this.applyStaticPreviewToRow(row, url, variantId);
    } else if (window.StaticFrameCompose?.composeStaticPreview) {
      const url = await this.composePreviewForRow(row);
      this.applyStaticPreviewToRow(row, url, variantId);
    }

    if (this._editingVariantId === variantId) {
      this.renderVariantEditorPanel(row);
    } else {
      this.refreshVariantCard(row);
    }
  }

  async setStaticPlacementSize(variantId, placementId, sizePct, options = {}) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    const p = (row.layers._badgePlacements || []).find((b) => b.id === placementId);
    if (p?.lockSize !== false && !options.force) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.updatePlacementSize) return;

    const ok = window.StaticFrameCompose.updatePlacementSize(
      row.layers,
      placementId,
      sizePct,
      options,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.refreshStaticPreview(variantId);

    if (options.autoLock && this._editingVariantId === variantId) {
      const container = document.querySelector("#variant-edit-static-badges");
      if (container) {
        this.updatePlacementSizeLockUI(container, placementId, row.layers);
      }
    }
  }

  async resetStaticVariantEdits(variantId) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    clearTimeout(this._borderThicknessTimer);
    this._borderThicknessTimer = null;
    clearTimeout(this._gownLayerTimer);
    this._gownLayerTimer = null;
    clearTimeout(this._gownPhotoZoomTimer);
    this._gownPhotoZoomTimer = null;
    clearTimeout(this._gownPhotoPanTimer);
    this._gownPhotoPanTimer = null;
    clearTimeout(this._gownPhotoMarginTimer);
    this._gownPhotoMarginTimer = null;
    this._borderComposeGen = (this._borderComposeGen || 0) + 1;

    await this.preloadStaticComposeModule();
    if (window.StaticFrameCompose?.resetStaticPlacements) {
      window.StaticFrameCompose.resetStaticPlacements(row.layers);
    }

    row.editFlags = this.normalizeEditFlags({});
    row._badgesRepositioned = false;
    row._staticAppearanceEdited = false;

    let resetUrl = "";
    try {
      resetUrl = await this.composePreviewForRow(row, { staticAppearanceEdited: true });
    } catch (e) {
      console.warn("Reset preview compose failed:", e);
    }
    if (!resetUrl) {
      const urls = row.layers._staticDefaults?.urls;
      resetUrl =
        urls?.full ||
        row.layers.full ||
        row.pricingImageUrl ||
        row.dataUrl ||
        "";
    }

    row.imageUrl = resetUrl;

    if (this._editingVariantId === variantId) {
      this._staticControlsVariantId = null;
      this.applyStaticPreviewToRow(row, resetUrl, variantId);
      this.renderVariantEditorPanel(row);
    } else {
      this.refreshVariantCard(row);
    }
  }

  hasAdvancedEditor(row) {
    if (window.StaticFrameCompose?.isEditableVariant) {
      return window.StaticFrameCompose.isEditableVariant(row);
    }
    return this.isStaticPromoRow(row) || !!(row?.layers?._badgePlacements || []).length;
  }

  variantBadgesOnlyCompose(row) {
    return !!row?._badgesRepositioned && !row?._staticAppearanceEdited;
  }

  getVariantComposeOptions(row, { preview = false } = {}) {
    const frozenKb = row?._frozenPricing?.targetKb ?? row?.meta?.targetKb ?? 0;
    const preserveKb =
      !frozenKb && row?.blob?.size
        ? Math.ceil(row.blob.size / 1024)
        : row?.meta?.actualKb || 0;
    if (preview) {
      return {
        targetKb: 0,
        preserveKb: 0,
        jpegQuality: row?.meta?.jpegQuality || 0.92,
        style: row?.layers?._staticFrame?.style,
        preview: true,
      };
    }
    return {
      targetKb: frozenKb,
      preserveKb: frozenKb ? 0 : preserveKb,
      jpegQuality: row?.meta?.jpegQuality,
      style: row?.layers?._staticFrame?.style,
      preview: false,
    };
  }

  updateVariantEditorResetButton(row) {
    const panel = document.getElementById("variant-edit-panel");
    if (!panel || !row || this._editingVariantId !== row.variantId) return;
    const resetBtn = panel.querySelector("#variant-edit-reset");
    if (!resetBtn) return;
    const hasAdvanced = this.hasAdvancedEditor(row);
    const edited =
      !!row._badgesRepositioned ||
      !!row._staticAppearanceEdited ||
      this.isVariantEdited(row.editFlags, row.layers, row) ||
      (hasAdvanced && window.StaticFrameCompose?.needsStaticCompose?.(row));
    resetBtn.style.display = edited ? "block" : "none";
  }

  async composePreviewForRow(row, options = {}) {
    if (!row?.layers || !window.StaticFrameCompose?.composeStaticPreview) return "";
    await this.ensureRowComposeReady(row);
    const fallbackUrl =
      row.pricingImageUrl ||
      row.dataUrl ||
      row.imageUrl ||
      row.layers.full ||
      row.layers.noStickers ||
      "";
    if (row.layers._staticFrame) {
      window.StaticFrameCompose.ensureStaticRebuildUrls?.(row.layers, fallbackUrl);
      if (
        row.layers._staticFrame.style === "gown_static" &&
        !row.layers._gownPhotoSource &&
        !row.layers.productOnly &&
        row.blob instanceof Blob &&
        !row.layers._composeFallbackUrl
      ) {
        row.layers._composeFallbackUrl = URL.createObjectURL(row.blob);
      }
    }
    const gen = ++this._borderComposeGen;
    const badgesOnly = this.variantBadgesOnlyCompose(row);
    const url = await window.StaticFrameCompose.composeStaticPreview(
      row.layers,
      row.editFlags || {},
      {
        ...this.getVariantComposeOptions(row, { preview: true }),
        staticAppearanceEdited: !!row._staticAppearanceEdited,
        badgesOnly,
        badgesRepositioned: !!row._badgesRepositioned,
        meta: row.meta,
        ...options,
      },
    );
    if (gen !== this._borderComposeGen) return row.imageUrl || url;
    return url;
  }

  async composeSaveForRow(row) {
    if (!row?.layers || !window.StaticFrameCompose?.composeStaticPreview) {
      return this.resolveDownloadUrl(row);
    }
    const edited = this.isVariantEdited(row.editFlags, row.layers, row);
    if (!edited) return this.resolveDownloadUrl(row);

    await this.ensureRowComposeReady(row);
    const url = await window.StaticFrameCompose.composeStaticPreview(
      row.layers,
      row.editFlags || {},
      {
        ...this.getVariantComposeOptions(row, { preview: false }),
        staticAppearanceEdited: !!row._staticAppearanceEdited,
        badgesOnly: this.variantBadgesOnlyCompose(row),
        badgesRepositioned: !!row._badgesRepositioned,
        meta: row.meta,
      },
    );
    return url || this.resolveDownloadUrl(row);
  }

  applyStaticPreviewToRow(row, url, variantId) {
    if (!url) return;
    this.ensureFrozenPricing(row);
    row.imageUrl = url;
    if (this._editingVariantId === variantId) {
      const preview = document.getElementById("variant-edit-preview");
      if (preview) {
        if (preview.src !== url) preview.src = url;
        else preview.removeAttribute("src");
        preview.src = url;
      }
    }
    this.refreshVariantCard(row);
    this.updateVariantEditorResetButton(row);
    if (this._editingVariantId === variantId) {
      this.syncPlacementSlidersFromRow(row);
      this.syncPhotoControlsFromRow(row);
    }
  }

  frameSupportsPhotoControls(frame) {
    if (!frame) return false;
    if (window.StaticFrameCompose?.frameHasProductSlot) {
      return window.StaticFrameCompose.frameHasProductSlot(frame);
    }
    return (frame.dw > 0 || frame.baseDw > 0) && (frame.dh > 0 || frame.baseDh > 0);
  }

  ensurePhotoControlDefaults(frame) {
    if (!frame) return;
    if (window.StaticFrameCompose?.ensureFramePhotoDefaults) {
      window.StaticFrameCompose.ensureFramePhotoDefaults(frame);
      return;
    }
    if (frame.photoZoomPct == null) frame.photoZoomPct = 100;
    if (frame.photoPanH == null) frame.photoPanH = 50;
    if (frame.photoPanV == null) frame.photoPanV = 50;
    if (frame.photoZoomLocked == null) frame.photoZoomLocked = true;
    if (frame.photoPanHLocked == null) frame.photoPanHLocked = true;
    if (frame.photoPanVLocked == null) frame.photoPanVLocked = true;
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      const field = `photoMargin${side}`;
      const lockField = `${field}Locked`;
      if (frame[field] == null) frame[field] = 0;
      if (frame[lockField] == null) frame[lockField] = true;
    }
  }

  photoMarginSides() {
    return [
      { side: "top", label: "Top" },
      { side: "left", label: "Left" },
      { side: "right", label: "Right" },
      { side: "bottom", label: "Bottom" },
    ];
  }

  photoMarginField(side) {
    return `photoMargin${side.charAt(0).toUpperCase()}${side.slice(1)}`;
  }

  photoMarginLockField(side) {
    return `${this.photoMarginField(side)}Locked`;
  }

  syncPlacementSlidersFromRow(row) {
    const container = document.querySelector("#variant-edit-static-badges");
    if (!container || !row?.layers?._badgePlacements) return;

    for (const p of row.layers._badgePlacements) {
      if (!p?.id || p.posH == null || p.posV == null) continue;
      const hSlider = container.querySelector(`.static-pos-h[data-badge-id="${p.id}"]`);
      const vSlider = container.querySelector(`.static-pos-v[data-badge-id="${p.id}"]`);
      const hVal = container.querySelector(`.static-h-val[data-badge-id="${p.id}"]`);
      const vVal = container.querySelector(`.static-v-val[data-badge-id="${p.id}"]`);
      const posH = Math.round(p.posH);
      const posV = Math.round(p.posV);
      if (hSlider && document.activeElement !== hSlider) {
        hSlider.value = String(posH);
        if (hVal) hVal.textContent = String(posH);
      }
      if (vSlider && document.activeElement !== vSlider) {
        vSlider.value = String(posV);
        if (vVal) vVal.textContent = String(posV);
      }
    }
  }

  syncPhotoControlsFromRow(row) {
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    const container = document.querySelector("#variant-edit-static-badges");
    if (!container) return;

    this.ensurePhotoControlDefaults(frame);
    const zoom = frame.photoZoomPct ?? 100;
    const panH = frame.photoPanH ?? 50;
    const panV = frame.photoPanV ?? 50;
    const zoomSlider = container.querySelector("#static-photo-zoom");
    const zoomVal = container.querySelector("#static-photo-zoom-val");
    const panHSlider = container.querySelector("#static-photo-pan-h");
    const panVSlider = container.querySelector("#static-photo-pan-v");
    const panHVal = container.querySelector("#static-photo-pan-h-val");
    const panVVal = container.querySelector("#static-photo-pan-v-val");

    if (zoomSlider && document.activeElement !== zoomSlider) zoomSlider.value = String(zoom);
    if (zoomVal && document.activeElement !== zoomSlider) zoomVal.textContent = String(zoom);
    if (panHSlider && document.activeElement !== panHSlider) panHSlider.value = String(panH);
    if (panVSlider && document.activeElement !== panVSlider) panVSlider.value = String(panV);
    if (panHVal && document.activeElement !== panHSlider) panHVal.textContent = String(panH);
    if (panVVal && document.activeElement !== panVSlider) panVVal.textContent = String(panV);
    for (const { side } of this.photoMarginSides()) {
      const field = this.photoMarginField(side);
      const slider = container.querySelector(`#static-photo-margin-${side}`);
      const val = container.querySelector(`#static-photo-margin-${side}-val`);
      const margin = frame[field] ?? 0;
      if (slider && document.activeElement !== slider) slider.value = String(margin);
      if (val && document.activeElement !== slider) val.textContent = String(margin);
    }
    this.updatePhotoControlsLockUI(container, frame);
  }

  async applyRowStaticPreview(variantId, row = null) {
    const target = row || this.findResultRow(variantId);
    if (!target?.layers?._staticFrame) return "";
    await this.preloadStaticComposeModule();
    try {
      const url = await this.composePreviewForRow(target);
      if (url) this.applyStaticPreviewToRow(target, url, variantId);
      return url;
    } catch (e) {
      console.warn("Static preview compose failed:", e);
      return "";
    }
  }

  async refreshStaticPreview(variantId) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    const composeReady = await this.preloadStaticComposeModule();
    if (!composeReady) {
      console.warn("Static compose module unavailable — badge preview may not update");
    }

    const composeOpts = {
      ...this.getVariantComposeOptions(row, { preview: true }),
      staticAppearanceEdited: !!row._staticAppearanceEdited,
      badgesOnly: this.variantBadgesOnlyCompose(row),
    };

    const needsCompose =
      composeReady &&
      (row._staticAppearanceEdited ||
        row._badgesRepositioned ||
        window.StaticFrameCompose?.shouldRebuildStaticFrame?.(row.layers, {
          staticAppearanceEdited: !!row._staticAppearanceEdited,
        }) ||
        window.StaticFrameCompose?.needsStaticCompose?.(row));

    if (needsCompose && window.StaticFrameCompose?.composeStaticPreview) {
      try {
        const url = await this.composePreviewForRow(row, composeOpts);
        if (url) this.applyStaticPreviewToRow(row, url, variantId);
        return;
      } catch (e) {
        console.warn("Static preview compose failed:", e);
      }
    }

    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.resolveDisplayUrlAsync) {
      try {
        row.imageUrl = await MeeshoAPI.resolveDisplayUrlAsync(row);
      } catch (e) {
        row.imageUrl = MeeshoAPI.resolveDisplayUrl(row);
      }
    } else if (window.StaticFrameCompose?.composeStaticPreview) {
      const url = await this.composePreviewForRow(row, composeOpts);
      if (url) this.applyStaticPreviewToRow(row, url, variantId);
      return;
    }

    this.applyStaticPreviewToRow(row, row.imageUrl, variantId);
  }

  async setStaticBadgeAnchor(variantId, placementId, anchor) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.updatePlacementAnchor) return;

    const ok = window.StaticFrameCompose.updatePlacementAnchor(
      row.layers,
      placementId,
      anchor,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.refreshStaticPreview(variantId);
  }

  async setStaticPlacementSliders(variantId, placementId, posH, posV) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.updatePlacementSliders) return;

    const ok = window.StaticFrameCompose.updatePlacementSliders(
      row.layers,
      placementId,
      posH,
      posV,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.refreshStaticPreview(variantId);
  }

  async setStaticPlacementSliderAxis(variantId, placementId, axis, value, options = {}) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.updatePlacementSliderAxis) return;

    const ok = window.StaticFrameCompose.updatePlacementSliderAxis(
      row.layers,
      placementId,
      axis,
      value,
      options,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.refreshStaticPreview(variantId);

    if (options.autoLock && this._editingVariantId === variantId) {
      const container = document.querySelector("#variant-edit-static-badges");
      if (container) {
        this.updatePlacementAxisLockUI(container, placementId, row.layers);
      }
    }
  }

  toggleStaticPlacementAxisLock(variantId, placementId, axis) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    const p = (row.layers._badgePlacements || []).find((b) => b.id === placementId);
    if (!p) return;

    const locked = axis === "h" ? p.lockH !== false : p.lockV !== false;
    if (window.StaticFrameCompose?.setPlacementAxisLock) {
      window.StaticFrameCompose.setPlacementAxisLock(
        row.layers,
        placementId,
        axis,
        !locked,
      );
    } else {
      if (axis === "h") p.lockH = !locked;
      else p.lockV = !locked;
    }

    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updatePlacementAxisLockUI(container, placementId, row.layers);
  }

  updatePlacementAxisLockUI(container, placementId, layers) {
    const p = (layers?._badgePlacements || []).find((b) => b.id === placementId);
    if (!p || !container) return;

    const lockH = p.lockH !== false;
    const lockV = p.lockV !== false;
    const hLockBtn = container.querySelector(
      `.static-axis-lock[data-axis="h"][data-badge-id="${placementId}"]`,
    );
    const vLockBtn = container.querySelector(
      `.static-axis-lock[data-axis="v"][data-badge-id="${placementId}"]`,
    );
    const hSlider = container.querySelector(`.static-pos-h[data-badge-id="${placementId}"]`);
    const vSlider = container.querySelector(`.static-pos-v[data-badge-id="${placementId}"]`);
    const hWrap = container.querySelector(`.static-pos-h-wrap[data-badge-id="${placementId}"]`);
    const vWrap = container.querySelector(`.static-pos-v-wrap[data-badge-id="${placementId}"]`);

    if (hLockBtn) {
      hLockBtn.textContent = lockH ? "🔒" : "🔓";
      hLockBtn.title = lockH
        ? "Unlock horizontal to adjust"
        : "Lock horizontal position";
      hLockBtn.setAttribute("aria-pressed", lockH ? "true" : "false");
    }
    if (vLockBtn) {
      vLockBtn.textContent = lockV ? "🔒" : "🔓";
      vLockBtn.title = lockV
        ? "Unlock vertical to adjust"
        : "Lock vertical position";
      vLockBtn.setAttribute("aria-pressed", lockV ? "true" : "false");
    }
    if (hSlider) hSlider.disabled = lockH;
    if (vSlider) vSlider.disabled = lockV;
    if (hWrap) hWrap.classList.toggle("static-slider-locked", lockH);
    if (vWrap) vWrap.classList.toggle("static-slider-locked", lockV);
  }

  toggleStaticPlacementSizeLock(variantId, placementId) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    const p = (row.layers._badgePlacements || []).find((b) => b.id === placementId);
    if (!p) return;

    const locked = p.lockSize !== false;
    if (window.StaticFrameCompose?.setPlacementSizeLock) {
      window.StaticFrameCompose.setPlacementSizeLock(
        row.layers,
        placementId,
        !locked,
      );
    } else {
      p.lockSize = !locked;
    }

    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updatePlacementSizeLockUI(container, placementId, row.layers);
  }

  updatePlacementSizeLockUI(container, placementId, layers) {
    const p = (layers?._badgePlacements || []).find((b) => b.id === placementId);
    if (!p || !container) return;

    const lockSize = p.lockSize !== false;
    const lockBtn = container.querySelector(
      `.static-size-lock[data-badge-id="${placementId}"]`,
    );
    const slider = container.querySelector(`.static-size-pct[data-badge-id="${placementId}"]`);
    const wrap = container.querySelector(`.static-size-wrap[data-badge-id="${placementId}"]`);

    if (lockBtn) {
      lockBtn.textContent = lockSize ? "🔒" : "🔓";
      lockBtn.title = lockSize
        ? "Unlock size to adjust"
        : "Lock badge size";
      lockBtn.setAttribute("aria-pressed", lockSize ? "true" : "false");
    }
    if (slider) slider.disabled = lockSize;
    if (wrap) wrap.classList.toggle("static-slider-locked", lockSize);
  }

  async setStaticBadgeNum(variantId, placementId, badgeNum) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.updatePlacementBadge) return;

    const ok = window.StaticFrameCompose.updatePlacementBadge(
      row.layers,
      placementId,
      badgeNum,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.applyRowStaticPreview(variantId, row);
    if (this._editingVariantId === variantId) {
      this.renderVariantEditorPanel(row);
    }
  }

  async setStaticPlacementHidden(variantId, placementId, hidden) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.setPlacementHidden) return;

    const ok = window.StaticFrameCompose.setPlacementHidden(
      row.layers,
      placementId,
      hidden,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.applyRowStaticPreview(variantId, row);
  }

  async setStaticAllStickersHidden(variantId, hidden) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.setAllPlacementsHidden) return;

    window.StaticFrameCompose.setAllPlacementsHidden(row.layers, hidden);
    row._badgesRepositioned = true;
    await this.applyRowStaticPreview(variantId, row);

    if (this._editingVariantId === variantId) {
      this.renderVariantEditorPanel(row);
    }
  }

  async setStaticFrameColors(variantId, patch) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.preloadStaticComposeModule();
    const SFC = window.StaticFrameCompose;
    if (!SFC?.updateFrameAppearance) return;

    const frame = row.layers._staticFrame;
    const hadGownGradient =
      frame.style === "gown_static" &&
      SFC.staticStyleUsesGradientColors?.(frame.style, frame);

    SFC.updateFrameAppearance(row.layers, patch);
    row._staticAppearanceEdited = true;

    const hasGownGradient =
      frame.style === "gown_static" &&
      SFC.staticStyleUsesGradientColors?.(frame.style, frame);

    await this.applyRowStaticPreview(variantId, row);

    if (hadGownGradient !== hasGownGradient && this._editingVariantId === variantId) {
      this._staticControlsVariantId = null;
      this.renderVariantEditorPanel(row);
    }
  }

  updateFillMatUI(container, frame) {
    if (!container || !frame) return;
    const enabled = frame.fillMatEnabled !== false;
    const checkbox = container.querySelector("#static-fill-mat-enabled");
    const wrap = container.querySelector(".static-fill-mat-wrap");
    if (checkbox) checkbox.checked = enabled;
    if (wrap) wrap.classList.toggle("static-fill-mat-disabled", !enabled);
    wrap?.querySelectorAll(".static-color-row button, .static-color-row input").forEach((el) => {
      el.disabled = !enabled;
    });
  }

  updatePhotoMarginFillUI(container, frame) {
    if (!container || !frame) return;
    const enabled = frame.photoMarginFillEnabled !== false;
    const checkbox = container.querySelector("#static-photo-margin-fill-enabled");
    const wrap = container.querySelector(".static-photo-margin-fill-wrap");
    if (checkbox) checkbox.checked = enabled;
    if (wrap) wrap.classList.toggle("static-photo-margin-fill-disabled", !enabled);
    wrap?.querySelectorAll(".static-color-row button, .static-color-row input").forEach((el) => {
      el.disabled = !enabled;
    });
  }

  async setStaticFillMatEnabled(variantId, enabled) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.setStaticFrameColors(variantId, { fillMatEnabled: !!enabled });

    if (this._editingVariantId === variantId) {
      const container = document.querySelector("#variant-edit-static-badges");
      if (container) this.updateFillMatUI(container, row.layers._staticFrame);
    }
  }

  updateBorderThicknessLockUI(container, frame) {
    if (!container || !frame) return;
    const locked = frame.borderThicknessLocked !== false;
    const btn = container.querySelector("#static-border-lock");
    const slider = container.querySelector("#static-border-thickness");
    const wrap = container.querySelector(".static-border-wrap");
    if (btn) {
      btn.textContent = locked ? "🔒" : "🔓";
      btn.title = locked
        ? "Unlock border thickness to adjust"
        : "Lock border thickness";
      btn.setAttribute("aria-pressed", locked ? "true" : "false");
    }
    if (slider) slider.disabled = locked;
    if (wrap) wrap.classList.toggle("static-slider-locked", locked);
  }

  toggleStaticBorderThicknessLock(variantId) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!frame) return;
    const locked = frame.borderThicknessLocked !== false;
    frame.borderThicknessLocked = !locked;
    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updateBorderThicknessLockUI(container, frame);
  }

  queueStaticBorderThickness(variantId, pct) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;
    if (row.layers._staticFrame.borderThicknessLocked !== false) return;

    const panel = document.getElementById("variant-edit-static-badges");
    const val = panel?.querySelector("#static-border-thickness-val");
    if (val) val.textContent = String(pct);

    clearTimeout(this._borderThicknessTimer);
    this._borderThicknessTimer = setTimeout(() => {
      void this.applyStaticBorderThickness(variantId, pct);
    }, 50);
  }

  async applyStaticBorderThickness(variantId, pct) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;
    if (row.layers._staticFrame.borderThicknessLocked !== false) return;

    const loaded = await this.preloadStaticComposeModule();
    if (!loaded || !window.StaticFrameCompose?.updateFrameAppearance) return;

    window.StaticFrameCompose.updateFrameAppearance(row.layers, {
      borderThicknessPct: pct,
    });
    if (window.StaticFrameCompose.reanchorPlacements) {
      window.StaticFrameCompose.reanchorPlacements(row.layers);
    }
    row._staticAppearanceEdited = true;

    try {
      await this.applyRowStaticPreview(variantId, row);
    } catch (e) {
      console.warn("Border thickness preview failed:", e);
      await this.refreshStaticPreview(variantId);
    }
  }

  async setStaticBorderThickness(variantId, pct) {
    clearTimeout(this._borderThicknessTimer);
    await this.applyStaticBorderThickness(variantId, pct);
  }

  updateGownFrameLayersLockUI(container, frame) {
    if (!container || !frame) return;
    const locked = frame.gownFrameLayersLocked !== false;
    const btn = container.querySelector("#static-gown-layers-lock");
    const wrap = container.querySelector(".static-gown-layers-wrap");
    if (btn) {
      btn.textContent = locked ? "🔒" : "🔓";
      btn.title = locked ? "Unlock frame layers to adjust" : "Lock frame layers";
      btn.setAttribute("aria-pressed", locked ? "true" : "false");
    }
    if (wrap) wrap.classList.toggle("static-slider-locked", locked);
    container.querySelectorAll(".static-gown-layer-pct").forEach((slider) => {
      slider.disabled = locked;
    });
  }

  toggleStaticGownFrameLayersLock(variantId) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!frame || frame.style !== "gown_static") return;
    frame.gownFrameLayersLocked = frame.gownFrameLayersLocked === false;
    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updateGownFrameLayersLockUI(container, frame);
  }

  queueStaticGownLayerPct(variantId, layerKey, pct) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!frame || frame.style !== "gown_static") return;
    if (frame.gownFrameLayersLocked !== false) return;

    const container = document.querySelector("#variant-edit-static-badges");
    const val = container?.querySelector(
      `.static-gown-layer-val[data-gown-layer="${layerKey}"]`,
    );
    if (val) val.textContent = String(pct);

    clearTimeout(this._gownLayerTimer);
    this._gownLayerTimer = setTimeout(() => {
      void this.applyStaticGownLayerPcts(variantId);
    }, 50);
  }

  readGownLayerPctFromUI(container) {
    const patch = {};
    container?.querySelectorAll(".static-gown-layer-pct").forEach((slider) => {
      const key = slider.dataset.gownLayer;
      if (!key) return;
      patch[key] = parseInt(slider.value, 10);
    });
    return patch;
  }

  async applyStaticGownLayerPcts(variantId) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!frame || frame.style !== "gown_static") return;
    if (frame.gownFrameLayersLocked !== false) return;

    const container = document.querySelector("#variant-edit-static-badges");
    const gownLayerPct = this.readGownLayerPctFromUI(container);
    if (!Object.keys(gownLayerPct).length) return;

    const loaded = await this.preloadStaticComposeModule();
    if (!loaded || !window.StaticFrameCompose?.updateFrameAppearance) return;

    window.StaticFrameCompose.updateFrameAppearance(row.layers, { gownLayerPct });
    if (window.StaticFrameCompose.reanchorPlacements) {
      window.StaticFrameCompose.reanchorPlacements(row.layers);
    }
    row._staticAppearanceEdited = true;

    try {
      await this.applyRowStaticPreview(variantId, row);
    } catch (e) {
      console.warn("Gown frame layer preview failed:", e);
      await this.refreshStaticPreview(variantId);
    }
  }

  async applyStaticGownLayerPct(variantId, layerKey, pct) {
    const container = document.querySelector("#variant-edit-static-badges");
    const val = container?.querySelector(
      `.static-gown-layer-val[data-gown-layer="${layerKey}"]`,
    );
    if (val) val.textContent = String(pct);
    clearTimeout(this._gownLayerTimer);
    await this.applyStaticGownLayerPcts(variantId);
  }

  async setStaticGownLayerPct(variantId, layerKey, pct) {
    clearTimeout(this._gownLayerTimer);
    await this.applyStaticGownLayerPct(variantId, layerKey, pct);
  }

  updatePhotoControlsLockUI(container, frame) {
    if (!container || !frame) return;
    const zoomLocked = frame.photoZoomLocked !== false;
    const panHLocked = frame.photoPanHLocked !== false;
    const panVLocked = frame.photoPanVLocked !== false;
    const zoomBtn = container.querySelector("#static-photo-zoom-lock");
    const zoomSlider = container.querySelector("#static-photo-zoom");
    const panHBtn = container.querySelector("#static-photo-pan-h-lock");
    const panVBtn = container.querySelector("#static-photo-pan-v-lock");
    const panHSlider = container.querySelector("#static-photo-pan-h");
    const panVSlider = container.querySelector("#static-photo-pan-v");
    const zoomWrap = container.querySelector(".static-photo-zoom-wrap");
    const panHWrap = container.querySelector(".static-photo-pan-h-wrap");
    const panVWrap = container.querySelector(".static-photo-pan-v-wrap");

    if (zoomBtn) {
      zoomBtn.textContent = zoomLocked ? "🔒" : "🔓";
      zoomBtn.title = zoomLocked ? "Unlock photo zoom to adjust" : "Lock photo zoom";
      zoomBtn.setAttribute("aria-pressed", zoomLocked ? "true" : "false");
    }
    if (panHBtn) {
      panHBtn.textContent = panHLocked ? "🔒" : "🔓";
      panHBtn.title = panHLocked ? "Unlock horizontal pan to adjust" : "Lock horizontal pan";
      panHBtn.setAttribute("aria-pressed", panHLocked ? "true" : "false");
    }
    if (panVBtn) {
      panVBtn.textContent = panVLocked ? "🔒" : "🔓";
      panVBtn.title = panVLocked ? "Unlock vertical pan to adjust" : "Lock vertical pan";
      panVBtn.setAttribute("aria-pressed", panVLocked ? "true" : "false");
    }
    if (zoomSlider) zoomSlider.disabled = zoomLocked;
    if (panHSlider) panHSlider.disabled = panHLocked;
    if (panVSlider) panVSlider.disabled = panVLocked;
    if (zoomWrap) zoomWrap.classList.toggle("static-slider-locked", zoomLocked);
    if (panHWrap) panHWrap.classList.toggle("static-slider-locked", panHLocked);
    if (panVWrap) panVWrap.classList.toggle("static-slider-locked", panVLocked);

    for (const { side, label } of this.photoMarginSides()) {
      const lockField = this.photoMarginLockField(side);
      const locked = frame[lockField] !== false;
      const btn = container.querySelector(`#static-photo-margin-${side}-lock`);
      const slider = container.querySelector(`#static-photo-margin-${side}`);
      const wrap = container.querySelector(`.static-photo-margin-${side}-wrap`);
      if (btn) {
        btn.textContent = locked ? "🔒" : "🔓";
        btn.title = locked
          ? `Unlock ${label.toLowerCase()} margin to adjust`
          : `Lock ${label.toLowerCase()} margin`;
        btn.setAttribute("aria-pressed", locked ? "true" : "false");
      }
      if (slider) slider.disabled = locked;
      if (wrap) wrap.classList.toggle("static-slider-locked", locked);
    }
  }

  toggleStaticPhotoZoomLock(variantId) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    frame.photoZoomLocked = frame.photoZoomLocked === false;
    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updatePhotoControlsLockUI(container, frame);
  }

  toggleStaticPhotoPanLock(variantId, axis) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    if (axis === "h") frame.photoPanHLocked = frame.photoPanHLocked === false;
    else if (axis === "v") frame.photoPanVLocked = frame.photoPanVLocked === false;
    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updatePhotoControlsLockUI(container, frame);
  }

  toggleStaticPhotoMarginLock(variantId, side) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    const lockField = this.photoMarginLockField(side);
    frame[lockField] = frame[lockField] === false;
    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updatePhotoControlsLockUI(container, frame);
  }

  queueStaticPhotoZoom(variantId, zoomPct) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    if (frame.photoZoomLocked !== false) return;

    const container = document.querySelector("#variant-edit-static-badges");
    const val = container?.querySelector("#static-photo-zoom-val");
    if (val) val.textContent = String(zoomPct);

    clearTimeout(this._gownPhotoZoomTimer);
    this._gownPhotoZoomTimer = setTimeout(() => {
      void this.applyStaticPhotoZoom(variantId, zoomPct);
    }, 50);
  }

  async applyStaticPhotoZoom(variantId, zoomPct) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    if (frame.photoZoomLocked !== false) return;

    const loaded = await this.preloadStaticComposeModule();
    if (!loaded || !window.StaticFrameCompose?.updateFrameAppearance) return;

    window.StaticFrameCompose.updateFrameAppearance(row.layers, { photoZoomPct: zoomPct });
    row._staticAppearanceEdited = true;

    try {
      await this.applyRowStaticPreview(variantId, row);
    } catch (e) {
      console.warn("Photo zoom preview failed:", e);
      await this.refreshStaticPreview(variantId);
    }
  }

  queueStaticPhotoPan(variantId, axis, value) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    if (axis === "h" && frame.photoPanHLocked !== false) return;
    if (axis === "v" && frame.photoPanVLocked !== false) return;

    const container = document.querySelector("#variant-edit-static-badges");
    const val = container?.querySelector(
      axis === "h" ? "#static-photo-pan-h-val" : "#static-photo-pan-v-val",
    );
    if (val) val.textContent = String(value);

    clearTimeout(this._gownPhotoPanTimer);
    this._gownPhotoPanTimer = setTimeout(() => {
      void this.applyStaticPhotoPan(variantId, axis, value);
    }, 50);
  }

  async applyStaticPhotoPan(variantId, axis, value) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    if (axis === "h" && frame.photoPanHLocked !== false) return;
    if (axis === "v" && frame.photoPanVLocked !== false) return;

    const loaded = await this.preloadStaticComposeModule();
    if (!loaded || !window.StaticFrameCompose?.updateFrameAppearance) return;

    const patch = axis === "h" ? { photoPanH: value } : { photoPanV: value };
    window.StaticFrameCompose.updateFrameAppearance(row.layers, patch);
    row._staticAppearanceEdited = true;

    try {
      await this.applyRowStaticPreview(variantId, row);
    } catch (e) {
      console.warn("Photo pan preview failed:", e);
      await this.refreshStaticPreview(variantId);
    }
  }

  async setStaticPhotoPan(variantId, axis, value) {
    clearTimeout(this._gownPhotoPanTimer);
    await this.applyStaticPhotoPan(variantId, axis, value);
  }

  queueStaticPhotoMargin(variantId, side, value) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    const lockField = this.photoMarginLockField(side);
    if (frame[lockField] !== false) return;

    const container = document.querySelector("#variant-edit-static-badges");
    const val = container?.querySelector(`#static-photo-margin-${side}-val`);
    if (val) val.textContent = String(value);

    clearTimeout(this._gownPhotoMarginTimer);
    this._gownPhotoMarginTimer = setTimeout(() => {
      void this.applyStaticPhotoMargin(variantId, side, value);
    }, 50);
  }

  async applyStaticPhotoMargin(variantId, side, value) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    const lockField = this.photoMarginLockField(side);
    if (frame[lockField] !== false) return;

    const loaded = await this.preloadStaticComposeModule();
    if (!loaded || !window.StaticFrameCompose?.updateFrameAppearance) return;

    const field = this.photoMarginField(side);
    window.StaticFrameCompose.updateFrameAppearance(row.layers, { [field]: value });
    if (window.StaticFrameCompose.reanchorPlacements) {
      window.StaticFrameCompose.reanchorPlacements(row.layers);
    }
    row._staticAppearanceEdited = true;

    try {
      await this.applyRowStaticPreview(variantId, row);
    } catch (e) {
      console.warn("Photo margin preview failed:", e);
      await this.refreshStaticPreview(variantId);
    }
  }

  async setStaticPhotoMargin(variantId, side, value) {
    clearTimeout(this._gownPhotoMarginTimer);
    await this.applyStaticPhotoMargin(variantId, side, value);
  }

  async setStaticPhotoZoom(variantId, zoomPct) {
    clearTimeout(this._gownPhotoZoomTimer);
    await this.applyStaticPhotoZoom(variantId, zoomPct);
  }

  async setStaticGradientPreset(variantId, presetId) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.preloadStaticComposeModule();
    const SFC = window.StaticFrameCompose;
    if (!SFC) return;

    if (presetId) {
      if (!SFC.applyGradientPreset) return;
      SFC.applyGradientPreset(row.layers, presetId);
    } else {
      if (!SFC.clearGradientPreset) return;
      SFC.clearGradientPreset(row.layers);
    }
    row._staticAppearanceEdited = true;
    await this.applyRowStaticPreview(variantId, row);

    if (this._editingVariantId === variantId) {
      this._staticControlsVariantId = null;
      this.renderVariantEditorPanel(row);
    }
  }

  clearUploadedImage() {
    this.resetToUploadForm({ keepImage: false });
  }

  wireClearUploadButton() {
    const btn = document.getElementById("clear-upload-btn");
    if (!btn || btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.clearUploadedImage();
    };
  }

  buildStaticColorFieldHtml(id, label, colorValue, fallback = "#000000") {
    const SFC = window.StaticFrameCompose;
    const hex = SFC?.normalizeFrameColor?.(colorValue, fallback) || fallback;
    const swatches = SFC?.FRAME_COLOR_SWATCHES || [];
    const chips = swatches
      .map((s) => {
        const chipHex = SFC?.normalizeFrameColor?.(s.hex) || s.hex;
        const active = chipHex === hex;
        return `<button type="button" class="static-color-chip" data-color-id="${id}" data-hex="${chipHex}" title="${s.label} (${chipHex})" aria-label="${s.label}" style="width:30px;height:30px;border-radius:50%;border:2px solid ${active ? "#111827" : "#e5e7eb"};background:${chipHex};padding:0;cursor:pointer;flex-shrink:0;box-shadow:${active ? "0 0 0 2px #fff inset" : "none"};"></button>`;
      })
      .join("");
    return `<div class="static-color-row" data-color-id="${id}" style="margin-bottom:10px;padding:8px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:600;min-width:72px;">${label}</span>
        <button type="button" class="static-color-swatch-btn" data-color-id="${id}" aria-label="Pick ${label} colour" title="Pick colour" style="width:40px;height:40px;border-radius:6px;border:1px solid #d1d5db;background:${hex};padding:0;cursor:pointer;flex-shrink:0;"></button>
        <label style="flex:1;font-size:10px;color:#4b5563;display:flex;flex-direction:column;gap:3px;">HEX
          <input type="text" class="static-color-hex-input" id="${id}-hex" value="${hex}" placeholder="#fff000" maxlength="7" spellcheck="false" autocomplete="off" style="width:100%;padding:8px;font-size:13px;font-family:monospace;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
        </label>
      </div>
      <div class="static-color-presets" style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
    </div>`;
  }

  hslToHex(h, s, l) {
    const SFC = window.StaticFrameCompose;
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const hex = SFC?.rgbToHex?.(
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    );
    return SFC?.normalizeFrameColor?.(hex) || hex;
  }

  hexToHsl(hex) {
    const SFC = window.StaticFrameCompose;
    const rgb = SFC?.hexToRgb?.(hex);
    if (!rgb) return { h: 0, s: 0, l: 50 };
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        default:
          h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  ensureStaticColorPickerOverlay() {
    let overlay = document.getElementById("static-color-picker-overlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "static-color-picker-overlay";
    overlay.style.cssText =
      "display:none;position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.55);align-items:center;justify-content:center;padding:16px;";
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;max-width:360px;width:100%;padding:16px;box-shadow:0 20px 40px rgba(0,0,0,.25);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <strong style="font-size:15px;">Select colour</strong>
          <button type="button" id="static-color-picker-close" style="border:none;background:#f3f4f6;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span id="static-color-picker-preview" style="width:48px;height:48px;border-radius:8px;border:1px solid #d1d5db;background:#71cbd3;flex-shrink:0;"></span>
          <label style="flex:1;font-size:11px;color:#4b5563;display:flex;flex-direction:column;gap:4px;">HEX
            <input type="text" id="static-color-picker-hex" maxlength="7" spellcheck="false" autocomplete="off" style="width:100%;padding:10px;font-size:14px;font-family:monospace;border:1px solid #d1d5db;border-radius:8px;box-sizing:border-box;">
          </label>
        </div>
        <label style="display:block;font-size:11px;color:#4b5563;margin-bottom:4px;">Hue
          <input type="range" id="static-color-picker-hue" min="0" max="360" value="180" style="width:100%;height:28px;margin-top:4px;background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);">
        </label>
        <label style="display:block;font-size:11px;color:#4b5563;margin:8px 0 4px;">Saturation
          <input type="range" id="static-color-picker-sat" min="0" max="100" value="50" style="width:100%;height:28px;margin-top:4px;">
        </label>
        <label style="display:block;font-size:11px;color:#4b5563;margin:8px 0 4px;">Brightness
          <input type="range" id="static-color-picker-val" min="0" max="100" value="50" style="width:100%;height:28px;margin-top:4px;background:linear-gradient(to right,#000,#fff);">
        </label>
        <div style="font-size:11px;color:#6b7280;margin:10px 0 6px;">Suggestions</div>
        <div id="static-color-picker-swatches" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" id="static-color-picker-cancel" style="padding:8px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer;">Cancel</button>
          <button type="button" id="static-color-picker-set" style="padding:8px 14px;border:none;border-radius:8px;background:#10b981;color:#fff;font-weight:600;cursor:pointer;">Set</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.style.display = "none";
    };
    overlay.querySelector("#static-color-picker-close").onclick = () => {
      overlay.style.display = "none";
    };
    overlay.querySelector("#static-color-picker-cancel").onclick = () => {
      overlay.style.display = "none";
    };
    return overlay;
  }

  openStaticColorPicker(container, fieldId, variantId) {
    const SFC = window.StaticFrameCompose;
    if (!SFC || !container) return;
    const overlay = this.ensureStaticColorPickerOverlay();
    const hexField = container.querySelector(`#${fieldId}-hex`);
    const startHex =
      SFC.normalizeFrameColor(hexField?.value) ||
      SFC.normalizeFrameColor(
        container.querySelector(`.static-color-swatch-btn[data-color-id="${fieldId}"]`)?.style
          .backgroundColor,
      ) ||
      "#71cbd3";
    const { h, s, l } = this.hexToHsl(startHex);
    const hue = overlay.querySelector("#static-color-picker-hue");
    const sat = overlay.querySelector("#static-color-picker-sat");
    const val = overlay.querySelector("#static-color-picker-val");
    const hexInput = overlay.querySelector("#static-color-picker-hex");
    const preview = overlay.querySelector("#static-color-picker-preview");
    const swatchWrap = overlay.querySelector("#static-color-picker-swatches");

    const updateSatBg = (hexColor) => {
      const hsl = this.hexToHsl(hexColor);
      sat.style.background = `linear-gradient(to right,#808080,hsl(${hsl.h},100%,50%))`;
    };

    const syncFromHsl = () => {
      const hex = this.hslToHex(
        parseInt(hue.value, 10),
        parseInt(sat.value, 10),
        parseInt(val.value, 10),
      );
      if (!hex) return;
      if (hexInput && document.activeElement !== hexInput) hexInput.value = hex;
      if (preview) preview.style.background = hex;
      updateSatBg(hex);
    };

    const syncFromHex = () => {
      let raw = hexInput.value.trim();
      if (!raw) return;
      if (!raw.startsWith("#")) raw = `#${raw}`;
      const hex = SFC.normalizeFrameColor(raw);
      if (!hex) return;
      const hsl = this.hexToHsl(hex);
      hue.value = String(hsl.h);
      sat.value = String(hsl.s);
      val.value = String(hsl.l);
      if (preview) preview.style.background = hex;
      updateSatBg(hex);
    };

    hue.value = String(h);
    sat.value = String(s);
    val.value = String(l);
    if (hexInput) hexInput.value = startHex;
    if (preview) preview.style.background = startHex;
    updateSatBg(startHex);

    if (swatchWrap) {
      swatchWrap.innerHTML = (SFC.FRAME_COLOR_SWATCHES || [])
        .map((sw) => {
          const chipHex = SFC.normalizeFrameColor(sw.hex) || sw.hex;
          return `<button type="button" class="static-color-picker-chip" data-hex="${chipHex}" title="${sw.label}" style="width:32px;height:32px;border-radius:50%;border:2px solid #e5e7eb;background:${chipHex};padding:0;cursor:pointer;"></button>`;
        })
        .join("");
      swatchWrap.querySelectorAll(".static-color-picker-chip").forEach((chip) => {
        chip.onclick = () => {
          const hex = SFC.normalizeFrameColor(chip.dataset.hex);
          if (!hex) return;
          hexInput.value = hex;
          syncFromHex();
        };
      });
    }

    hue.oninput = syncFromHsl;
    sat.oninput = syncFromHsl;
    val.oninput = syncFromHsl;
    hexInput.oninput = () => {
      clearTimeout(this._colorPickerHexTimer);
      this._colorPickerHexTimer = setTimeout(syncFromHex, 120);
    };
    hexInput.onchange = syncFromHex;

    overlay.querySelector("#static-color-picker-set").onclick = () => {
      const hex = SFC.normalizeFrameColor(hexInput.value);
      if (!hex) return;
      this.updateStaticColorRowDisplay(container, fieldId, hex);
      const cfg = this.getStaticColorFieldConfig(fieldId, container);
      if (cfg) {
        const patch = { [cfg.patchKey]: hex, gradientPreset: null };
        if (cfg.frameType) patch.frameType = cfg.frameType;
        void this.setStaticFrameColors(variantId, patch);
      }
      overlay.style.display = "none";
    };

    overlay.style.display = "flex";
  }

  getStaticColorFieldConfig(fieldId, container) {
    const style = container?.dataset?.editorStyle || "";
    const map = {
      "static-color-top": { patchKey: "gradientTop", frameType: "gradient" },
      "static-color-bottom": { patchKey: "gradientBottom", frameType: "gradient" },
      "static-color-border": {
        patchKey: "borderColor",
        frameType: style === "lifestyle_promo" ? "solid" : undefined,
      },
      "static-color-mat": { patchKey: "matColor" },
      "static-color-outer-mat": { patchKey: "outerMatColor" },
      "static-color-inner-accent": { patchKey: "innerStrokeColor" },
      "static-color-fill-mat": { patchKey: "fillMatColor" },
      "static-color-pad": { patchKey: "padColor" },
      "static-color-margin-fill": { patchKey: "photoMarginFillColor" },
    };
    return map[fieldId] || null;
  }

  updateStaticColorRowDisplay(container, id, hex) {
    const SFC = window.StaticFrameCompose;
    if (!SFC || !hex) return;
    const hexField = container.querySelector(`#${id}-hex`);
    const swatchBtn = container.querySelector(
      `.static-color-swatch-btn[data-color-id="${id}"]`,
    );
    if (swatchBtn) swatchBtn.style.background = hex;
    if (hexField && document.activeElement !== hexField) hexField.value = hex;
    container.querySelectorAll(`.static-color-chip[data-color-id="${id}"]`).forEach((chip) => {
      const chipHex = SFC.normalizeFrameColor(chip.dataset.hex);
      const active = chipHex === hex;
      chip.style.borderColor = active ? "#111827" : "#e5e7eb";
      chip.style.boxShadow = active ? "0 0 0 2px #fff inset" : "none";
    });
  }

  syncStaticColorRowFromHex(container, id) {
    const SFC = window.StaticFrameCompose;
    const hexField = container.querySelector(`#${id}-hex`);
    if (!hexField || !SFC) return false;
    let raw = hexField.value.trim();
    if (!raw) return false;
    if (!raw.startsWith("#")) raw = `#${raw}`;
    const hex = SFC.normalizeFrameColor(raw);
    if (!hex) return false;
    this.updateStaticColorRowDisplay(container, id, hex);
    return true;
  }

  readStaticColorField(container, id) {
    const SFC = window.StaticFrameCompose;
    if (!SFC) return null;
    const hexField = container.querySelector(`#${id}-hex`);
    if (hexField?.value?.trim()) {
      let raw = hexField.value.trim();
      if (!raw.startsWith("#")) raw = `#${raw}`;
      const fromHex = SFC.normalizeFrameColor(raw);
      if (fromHex) return fromHex;
    }
    const swatchBtn = container.querySelector(`.static-color-swatch-btn[data-color-id="${id}"]`);
    if (swatchBtn?.style?.backgroundColor) {
      return SFC.normalizeFrameColor(swatchBtn.style.backgroundColor);
    }
    return null;
  }

  syncStaticColorRowFromRgb(container, id) {
    return false;
  }

  syncStaticColorRowFromRgbText(container, id) {
    return false;
  }

  bindStaticColorFields(container, { variantId, style }) {
    container.dataset.editorStyle = style || "";
    const colorMap = {
      "static-color-top": { patchKey: "gradientTop", frameType: "gradient" },
      "static-color-bottom": { patchKey: "gradientBottom", frameType: "gradient" },
      "static-color-border": {
        patchKey: "borderColor",
        frameType: style === "lifestyle_promo" ? "solid" : undefined,
      },
      "static-color-mat": { patchKey: "matColor" },
      "static-color-outer-mat": { patchKey: "outerMatColor" },
      "static-color-inner-accent": { patchKey: "innerStrokeColor" },
      "static-color-fill-mat": { patchKey: "fillMatColor" },
      "static-color-pad": { patchKey: "padColor" },
      "static-color-margin-fill": { patchKey: "photoMarginFillColor" },
    };

    const applyOneColor = (id) => {
      const cfg = colorMap[id];
      if (!cfg || !container.querySelector(`#${id}-hex`)) return;
      const hex = this.readStaticColorField(container, id);
      if (!hex) return;
      const patch = { [cfg.patchKey]: hex, gradientPreset: null };
      if (cfg.frameType) patch.frameType = cfg.frameType;
      const presetSel = container.querySelector("#static-gradient-preset");
      if (presetSel) presetSel.value = "";
      void this.setStaticFrameColors(variantId, patch);
    };

    const timers = new Map();
    for (const id of Object.keys(colorMap)) {
      if (!container.querySelector(`#${id}-hex`)) continue;

      const swatchBtn = container.querySelector(`.static-color-swatch-btn[data-color-id="${id}"]`);
      if (swatchBtn) {
        swatchBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openStaticColorPicker(container, id, variantId);
        };
      }

      const hexField = container.querySelector(`#${id}-hex`);
      if (hexField) {
        hexField.oninput = () => {
          clearTimeout(timers.get(hexField));
          timers.set(
            hexField,
            setTimeout(() => {
              if (this.syncStaticColorRowFromHex(container, id)) applyOneColor(id);
            }, 220),
          );
        };
        hexField.onchange = () => {
          clearTimeout(timers.get(hexField));
          if (this.syncStaticColorRowFromHex(container, id)) applyOneColor(id);
        };
      }
    }

    container.querySelectorAll(".static-color-chip").forEach((chip) => {
      chip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fieldId = chip.dataset.colorId;
        const hex = window.StaticFrameCompose?.normalizeFrameColor?.(chip.dataset.hex);
        if (!fieldId || !hex) return;
        this.updateStaticColorRowDisplay(container, fieldId, hex);
        applyOneColor(fieldId);
      };
    });
  }

  renderStaticBadgePlacementControls(row, container) {
    const SFC = window.StaticFrameCompose;
    if (!SFC || !container) return;

    const frame = row.layers._staticFrame || {};
    if (window.StaticFrameCompose?.ensureFrameOuterDimensions) {
      window.StaticFrameCompose.ensureFrameOuterDimensions(row.layers, row.meta || {});
    }
    const style = frame.style || row.meta?.path || row.meta?.style || "";
    const showFrameColors = !!(frame.outerW || frame.style);
    const slots = SFC.getBadgeSlots(row);
    const placements = row.layers._badgePlacements || [];
    const presets = SFC.GRADIENT_PRESETS || [];
    const allHidden = slots.length > 0 && slots.every((s) => s.hidden);

    let html = "";
    if (showFrameColors) {
      html += `<div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:6px;">Frame colors</div>`;

      html += `<label style="display:block;font-size:11px;margin-bottom:6px;">Gradient preset
        <select id="static-gradient-preset" class="opt-select" style="width:100%;margin-top:4px;font-size:12px;padding:6px;">`;
      html += `<option value="">— Custom / solid —</option>`;
      presets.forEach((g) => {
        html += `<option value="${g.id}"${
          frame.gradientPreset === g.id ? " selected" : ""
        }>${g.label}</option>`;
      });
      html += `</select></label>`;

    const gownGradient =
      style === "gown_static" && SFC.staticStyleUsesGradientColors?.(style, frame);
    const gradientTopLabel = gownGradient ? "Border top" : "Top";
    const gradientBottomLabel = gownGradient ? "Border bottom" : "Bottom";

    if (style === "showcase" || style === "live_standard" || SFC.staticStyleUsesGradientColors?.(style, frame)) {
      html += this.buildStaticColorFieldHtml(
        "static-color-top",
        gradientTopLabel,
        frame.gradientTop,
        "#FF9800",
      );
      html += this.buildStaticColorFieldHtml(
        "static-color-bottom",
        gradientBottomLabel,
        frame.gradientBottom,
        "#4CAF50",
      );
    }

    if (style === "lifestyle_promo") {
      html += this.buildStaticColorFieldHtml(
        "static-color-border",
        "Border",
        frame.borderColor,
        "#32d74b",
      );
    }

    if (style === "gown_static") {
      if (!gownGradient) {
        html += this.buildStaticColorFieldHtml(
          "static-color-border",
          "Outer border",
          frame.borderColor,
          "#71cbd3",
        );
      }
      html += this.buildStaticColorFieldHtml(
        "static-color-outer-mat",
        "Outer mat",
        frame.outerMatColor ?? frame.matColor,
        "#ffffff",
      );
      const fillMatEnabled = frame.fillMatEnabled !== false;
      const fillMatColor =
        frame.fillMatColor ?? frame.padColor ?? frame.matColor ?? "#ffffff";
      html += `<div class="static-fill-mat-wrap${
        fillMatEnabled ? "" : " static-fill-mat-disabled"
      }" style="margin-bottom:6px;">
        <p style="font-size:9px;color:#6b7280;margin:0 0 4px;line-height:1.35;">Outer border = teal ring. Outer mat = white band outside the inner board. Fill mat = inner board around the photo (colors the whole board when enabled). Photo pad = thin edge ring — only used when fill mat is off.</p>
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px;">
          <input type="checkbox" id="static-fill-mat-enabled"${fillMatEnabled ? " checked" : ""}>
          Fill mat (inner board around photo)
        </label>`;
      html += this.buildStaticColorFieldHtml(
        "static-color-fill-mat",
        "Fill mat color",
        fillMatColor,
        "#ffffff",
      );
      html += `</div>`;
      html += this.buildStaticColorFieldHtml(
        "static-color-pad",
        "Photo pad (fill mat off)",
        frame.padColor ?? frame.matColor,
        "#ffffff",
      );
    } else if (style === "tall_static" || style === "live_framed") {
      html += this.buildStaticColorFieldHtml(
        "static-color-border",
        "Border",
        frame.borderColor,
        "#45a9e5",
      );
      html += this.buildStaticColorFieldHtml(
        "static-color-mat",
        "Mat",
        frame.matColor,
        "#ffffff",
      );
    }

    const borderPct = frame.borderThicknessPct ?? 100;
    if (style === "gown_static") {
      if (window.StaticFrameCompose?.ensureGownLayerPcts) {
        window.StaticFrameCompose.ensureGownLayerPcts(frame);
      } else if (!frame.gownLayerPct) {
        frame.gownLayerPct = window.StaticFrameCompose?.defaultGownLayerPct?.() || {
          border: 100,
          outerMat: 100,
          innerMat: 100,
        };
      }
      const lp = frame.gownLayerPct;
      if (frame.gownFrameLayersLocked == null) frame.gownFrameLayersLocked = true;
      const frameLocked = frame.gownFrameLayersLocked !== false;
      const gownLayers = [
        { key: "border", label: "Outer border (teal ring)" },
        { key: "outerMat", label: "Outer mat (white band)" },
        { key: "innerMat", label: "Photo pad (white edge)" },
      ];
      html += `<div class="static-gown-layers-wrap${
        frameLocked ? " static-slider-locked" : ""
      }" style="margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <button type="button" id="static-gown-layers-lock" aria-pressed="${
            frameLocked ? "true" : "false"
          }" title="${
        frameLocked ? "Unlock frame layers to adjust" : "Lock frame layers"
      }" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${
        frameLocked ? "🔒" : "🔓"
      }</button>
          <span style="font-size:10px;font-weight:600;">Frame layers (100 = default · photo size fixed)</span>
        </div>
        <p style="font-size:9px;color:#6b7280;margin:0 0 6px;line-height:1.35;">Teal border → outer mat → fill mat board → photo pad around the lifestyle photo. Unlock 🔓 then drag a slider — only that band changes; the photo box stays the same size.</p>`;
      for (const layer of gownLayers) {
        const v = lp[layer.key] ?? 100;
        html += `<div class="static-gown-layer-row" data-gown-layer="${
          layer.key
        }" style="margin-bottom:6px;">
          <span style="font-size:10px;">${layer.label} <span class="static-gown-layer-val" data-gown-layer="${
          layer.key
        }">${v}</span></span>
          <input type="range" class="static-gown-layer-pct" data-gown-layer="${
            layer.key
          }" min="0" max="1000" value="${v}" style="width:100%;"${
          frameLocked ? " disabled" : ""
        }>
        </div>`;
      }
      html += `</div>`;
    } else if (style !== "gown_static") {
      if (frame.borderThicknessLocked == null) frame.borderThicknessLocked = true;
      const borderLocked = frame.borderThicknessLocked !== false;
      html += `<div class="static-border-wrap${
        borderLocked ? " static-slider-locked" : ""
      }" style="margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <button type="button" id="static-border-lock" aria-pressed="${
            borderLocked ? "true" : "false"
          }" title="${
        borderLocked ? "Unlock border thickness to adjust" : "Lock border thickness"
      }" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${
        borderLocked ? "🔒" : "🔓"
      }</button>
          <span style="font-size:10px;">Border thickness <span id="static-border-thickness-val">${borderPct}</span> (100 = default)</span>
        </div>
        <input type="range" id="static-border-thickness" min="0" max="1000" value="${borderPct}" style="width:100%;"${
        borderLocked ? " disabled" : ""
      }>
      </div>`;
    }

    if (this.frameSupportsPhotoControls(frame)) {
      this.ensurePhotoControlDefaults(frame);
      const zoomLocked = frame.photoZoomLocked !== false;
      const panHLocked = frame.photoPanHLocked !== false;
      const panVLocked = frame.photoPanVLocked !== false;
      const photoZoom = frame.photoZoomPct ?? 100;
      const photoPanH = frame.photoPanH ?? 50;
      const photoPanV = frame.photoPanV ?? 50;
      const marginMax = window.StaticFrameCompose?.PHOTO_MARGIN_MAX ?? 200;
      let marginControlsHtml = `<div style="font-size:10px;font-weight:600;margin:8px 0 4px;">Photo margins (image ↔ border)</div>
        <p style="font-size:9px;color:#6b7280;margin:0 0 6px;line-height:1.35;">Unlock each side to add space between the photo and frame border. 0 px = default fit. Frame bands stay fixed.</p>`;
      for (const { side, label } of this.photoMarginSides()) {
        const field = this.photoMarginField(side);
        const locked = frame[this.photoMarginLockField(side)] !== false;
        const marginVal = frame[field] ?? 0;
        marginControlsHtml += `<div class="static-photo-margin-${side}-wrap${locked ? " static-slider-locked" : ""}" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <button type="button" id="static-photo-margin-${side}-lock" aria-pressed="${locked ? "true" : "false"}" title="${locked ? `Unlock ${label.toLowerCase()} margin to adjust` : `Lock ${label.toLowerCase()} margin`}" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${locked ? "🔒" : "🔓"}</button>
            <span style="font-size:10px;">${label} <span id="static-photo-margin-${side}-val">${marginVal}</span> px</span>
          </div>
          <input type="range" id="static-photo-margin-${side}" min="0" max="${marginMax}" value="${marginVal}" style="width:100%;"${locked ? " disabled" : ""}>
        </div>`;
      }
      const marginFillEnabled = frame.photoMarginFillEnabled !== false;
      let marginFillColor = frame.photoMarginFillColor;
      if (!marginFillColor) {
        if (style === "gown_static") {
          marginFillColor =
            frame.fillMatEnabled !== false
              ? frame.fillMatColor ?? frame.padColor ?? frame.matColor ?? "#ffffff"
              : frame.padColor ?? frame.matColor ?? "#ffffff";
        } else {
          marginFillColor = frame.matColor ?? "#ffffff";
        }
      }
      marginControlsHtml += `<div class="static-photo-margin-fill-wrap${
        marginFillEnabled ? "" : " static-photo-margin-fill-disabled"
      }" style="margin-top:8px;padding-top:6px;border-top:1px solid #e5e7eb;">
        <p style="font-size:9px;color:#6b7280;margin:0 0 6px;line-height:1.35;">Fill the gap bands created by top/left/right/bottom margins with a solid color.</p>
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:6px;">
          <input type="checkbox" id="static-photo-margin-fill-enabled"${marginFillEnabled ? " checked" : ""}>
          Fill margins
        </label>`;
      marginControlsHtml += this.buildStaticColorFieldHtml(
        "static-color-margin-fill",
        "Margin fill color",
        marginFillColor,
        "#ffffff",
      );
      marginControlsHtml += `</div>`;
      html += `<div class="static-photo-controls-wrap" style="margin-bottom:8px;">
        <div style="font-size:10px;font-weight:600;margin-bottom:4px;">Photo zoom & pan</div>
        <p style="font-size:9px;color:#6b7280;margin:0 0 6px;line-height:1.35;">Unlock each slider to adjust. Zoom scales from the center (100 = cover-fit). Pan shifts the photo when zoomed in, or within the frame when zoomed out — 50 is centered.</p>
        <div class="static-photo-zoom-wrap${
          zoomLocked ? " static-slider-locked" : ""
        }" style="margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <button type="button" id="static-photo-zoom-lock" aria-pressed="${
              zoomLocked ? "true" : "false"
            }" title="${
        zoomLocked ? "Unlock photo zoom to adjust" : "Lock photo zoom"
      }" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${
        zoomLocked ? "🔒" : "🔓"
      }</button>
            <span style="font-size:10px;">Zoom <span id="static-photo-zoom-val">${photoZoom}</span>% (100 = cover-fit)</span>
          </div>
          <input type="range" id="static-photo-zoom" min="50" max="200" value="${photoZoom}" style="width:100%;"${
        zoomLocked ? " disabled" : ""
      }>
        </div>
        <div class="static-photo-pan-h-wrap${
          panHLocked ? " static-slider-locked" : ""
        }" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <button type="button" id="static-photo-pan-h-lock" aria-pressed="${
              panHLocked ? "true" : "false"
            }" title="${
        panHLocked ? "Unlock horizontal pan to adjust" : "Lock horizontal pan"
      }" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${
        panHLocked ? "🔒" : "🔓"
      }</button>
            <span style="font-size:10px;">Pan horizontal <span id="static-photo-pan-h-val">${photoPanH}</span></span>
          </div>
          <input type="range" id="static-photo-pan-h" min="0" max="100" value="${photoPanH}" style="width:100%;"${
        panHLocked ? " disabled" : ""
      }>
        </div>
        <div class="static-photo-pan-v-wrap${
          panVLocked ? " static-slider-locked" : ""
        }">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <button type="button" id="static-photo-pan-v-lock" aria-pressed="${
              panVLocked ? "true" : "false"
            }" title="${
        panVLocked ? "Unlock vertical pan to adjust" : "Lock vertical pan"
      }" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${
        panVLocked ? "🔒" : "🔓"
      }</button>
            <span style="font-size:10px;">Pan vertical <span id="static-photo-pan-v-val">${photoPanV}</span></span>
          </div>
          <input type="range" id="static-photo-pan-v" min="0" max="100" value="${photoPanV}" style="width:100%;"${
        panVLocked ? " disabled" : ""
      }>
        </div>
        ${marginControlsHtml}
      </div>`;
    }
    }

    html += `<div style="display:flex;align-items:center;justify-content:space-between;margin:10px 0 6px;">
      <span style="font-size:11px;font-weight:600;color:#6b7280;">Stickers</span>
      <label style="font-size:10px;display:flex;align-items:center;gap:4px;cursor:pointer;">
        <input type="checkbox" id="static-hide-all-stickers"${allHidden ? " checked" : ""} style="width:14px;height:14px;">
        Hide all
      </label>
    </div>`;

    slots.forEach((slot) => {
      const p = placements.find((b) => b.id === slot.id);
      const posH = p?.posH ?? slot.posH ?? 0;
      const posV = p?.posV ?? slot.posV ?? 0;
      const sizePct = p?.sizePct ?? slot.sizePct ?? 100;
      const lockH = p?.lockH !== false;
      const lockV = p?.lockV !== false;
      const lockSize = p?.lockSize !== false;
      const freeValue =
        window.StaticFrameCompose?.FREE_SHIPPING_BADGE_VALUE || "free";
      const showFreeOption = slot.freeShippingSlot || p?._freeShippingSlot;
      const isFreeShipActive = p?.kind === "freeShipping";
      const isGownArt = p?.kind === "gownArt";
      const selectedBadge = isFreeShipActive
        ? freeValue
        : isGownArt
        ? "gown-art"
        : String(p?.num || slot.num || 1);

      html += `<div class="static-sticker-card" data-badge-id="${slot.id}" style="border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin-bottom:8px;background:#fafafa;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:600;">${slot.label}</span>
          <label style="font-size:10px;display:flex;align-items:center;gap:4px;cursor:pointer;">
            <input type="checkbox" class="static-sticker-hide" data-badge-id="${slot.id}"${
        p?.hidden ? " checked" : ""
      } style="width:14px;height:14px;">
            Hide
          </label>
        </div>`;

      html += `<label style="display:block;font-size:10px;margin-bottom:6px;">Sticker
          <select data-badge-id="${slot.id}" class="static-badge-pick opt-select" style="width:100%;margin-top:2px;font-size:11px;padding:4px;">`;
      if (showFreeOption) {
        html += `<option value="${freeValue}"${
          isFreeShipActive ? " selected" : ""
        }>Free shipping (red circle)</option>`;
      }
      if (style === "gown_static" && slot.id?.startsWith("gown-")) {
        html += `<option value="gown-art"${
          isGownArt ? " selected" : ""
        }>${slot.label} (default art)</option>`;
      }
      for (let n = 1; n <= 25; n++) {
        html += `<option value="${n}"${
          !isFreeShipActive && !isGownArt && parseInt(selectedBadge, 10) === n ? " selected" : ""
        }>Badge ${n}</option>`;
      }
      html += `</select></label>`;

      html += `<div class="static-size-wrap${lockSize ? " static-slider-locked" : ""}" data-badge-id="${slot.id}" style="margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <button type="button" class="static-size-lock" data-badge-id="${slot.id}" aria-pressed="${lockSize ? "true" : "false"}" title="${lockSize ? "Unlock size to adjust" : "Lock badge size"}" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${lockSize ? "🔒" : "🔓"}</button>
          <span style="font-size:10px;">Size <span class="static-size-val" data-badge-id="${slot.id}">${sizePct}</span>%</span>
        </div>
        <input type="range" class="static-size-pct" data-badge-id="${slot.id}" min="25" max="200" value="${sizePct}" style="width:100%;"${lockSize ? " disabled" : ""}>
      </div>`;
      html += `<div class="static-pos-h-wrap${lockH ? " static-slider-locked" : ""}" data-badge-id="${slot.id}" style="margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <button type="button" class="static-axis-lock" data-axis="h" data-badge-id="${slot.id}" aria-pressed="${lockH ? "true" : "false"}" title="${lockH ? "Unlock horizontal to adjust" : "Lock horizontal"}" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${lockH ? "🔒" : "🔓"}</button>
          <span style="font-size:10px;">Horizontal <span class="static-h-val" data-badge-id="${slot.id}">${posH}</span>%</span>
        </div>
        <input type="range" class="static-pos-h" data-badge-id="${slot.id}" min="0" max="100" value="${posH}" style="width:100%;"${lockH ? " disabled" : ""}>
      </div>`;
      html += `<div class="static-pos-v-wrap${lockV ? " static-slider-locked" : ""}" data-badge-id="${slot.id}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <button type="button" class="static-axis-lock" data-axis="v" data-badge-id="${slot.id}" aria-pressed="${lockV ? "true" : "false"}" title="${lockV ? "Unlock vertical to adjust" : "Lock vertical"}" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${lockV ? "🔒" : "🔓"}</button>
          <span style="font-size:10px;">Vertical <span class="static-v-val" data-badge-id="${slot.id}">${posV}</span>%</span>
        </div>
        <input type="range" class="static-pos-v" data-badge-id="${slot.id}" min="0" max="100" value="${posV}" style="width:100%;"${lockV ? " disabled" : ""}>
      </div>`;
      html += `</div>`;
    });

    const priceLock = (() => {
      const ship = this.getRowDisplayShipping(row);
      if (ship.amount > 0) {
        const kbNote = row._frozenPricing?.targetKb
          ? ` (${row._frozenPricing.targetKb}KB)`
          : "";
        return ship.verified
          ? `shipping ₹${ship.amount}${kbNote}`
          : `est ₹${ship.amount}${kbNote}`;
      }
      if (row._frozenPricing?.targetKb) {
        return `est ₹ at ${row._frozenPricing.targetKb}KB`;
      }
      return "original pricing";
    })();
    html += `<p style="font-size:10px;color:#6b7280;margin:0;">Edits keep ${priceLock} unchanged.</p>`;
    container.innerHTML = html;

    const vid = row.variantId;
    const presetSel = container.querySelector("#static-gradient-preset");
    if (presetSel) {
      presetSel.onchange = () => {
        void this.setStaticGradientPreset(vid, presetSel.value || null);
      };
    }

    this.bindStaticColorFields(container, { variantId: vid, style });

    const fillMatCheckbox = container.querySelector("#static-fill-mat-enabled");
    if (fillMatCheckbox) {
      fillMatCheckbox.onchange = () => {
        void this.setStaticFillMatEnabled(vid, fillMatCheckbox.checked);
      };
    }
    if (style === "gown_static") {
      this.updateFillMatUI(container, frame);
    }

    const borderThickness = container.querySelector("#static-border-thickness");
    const borderThicknessVal = container.querySelector("#static-border-thickness-val");
    const borderLock = container.querySelector("#static-border-lock");
    if (borderLock) {
      borderLock.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticBorderThicknessLock(vid);
      };
    }
    if (borderThickness) {
      const commitBorder = () => {
        if (borderThickness.disabled) return;
        const v = parseInt(borderThickness.value, 10);
        if (borderThicknessVal) borderThicknessVal.textContent = String(v);
        void this.setStaticBorderThickness(vid, v);
      };
      borderThickness.oninput = () => {
        if (borderThickness.disabled) return;
        const v = parseInt(borderThickness.value, 10);
        if (borderThicknessVal) borderThicknessVal.textContent = String(v);
        this.queueStaticBorderThickness(vid, v);
      };
      borderThickness.onchange = commitBorder;
      borderThickness.addEventListener("pointerup", commitBorder);
      borderThickness.addEventListener("touchend", commitBorder, { passive: true });
    }

    const gownLayersLock = container.querySelector("#static-gown-layers-lock");
    if (gownLayersLock) {
      gownLayersLock.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticGownFrameLayersLock(vid);
      };
    }
    container.querySelectorAll(".static-gown-layer-pct").forEach((slider) => {
      const layerKey = slider.dataset.gownLayer;
      const commitLayer = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const valSpan = container.querySelector(
          `.static-gown-layer-val[data-gown-layer="${layerKey}"]`,
        );
        if (valSpan) valSpan.textContent = String(v);
        void this.setStaticGownLayerPct(vid, layerKey, v);
      };
      slider.oninput = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const valSpan = container.querySelector(
          `.static-gown-layer-val[data-gown-layer="${layerKey}"]`,
        );
        if (valSpan) valSpan.textContent = String(v);
        this.queueStaticGownLayerPct(vid, layerKey, v);
      };
      slider.onchange = commitLayer;
      slider.addEventListener("pointerup", commitLayer);
      slider.addEventListener("touchend", commitLayer, { passive: true });
    });

    const photoZoomLock = container.querySelector("#static-photo-zoom-lock");
    if (photoZoomLock) {
      photoZoomLock.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticPhotoZoomLock(vid);
      };
    }
    const photoZoomSlider = container.querySelector("#static-photo-zoom");
    if (photoZoomSlider) {
      const commitZoom = () => {
        if (photoZoomSlider.disabled) return;
        const v = parseInt(photoZoomSlider.value, 10);
        const val = container.querySelector("#static-photo-zoom-val");
        if (val) val.textContent = String(v);
        void this.setStaticPhotoZoom(vid, v);
      };
      photoZoomSlider.oninput = () => {
        if (photoZoomSlider.disabled) return;
        const v = parseInt(photoZoomSlider.value, 10);
        const val = container.querySelector("#static-photo-zoom-val");
        if (val) val.textContent = String(v);
        this.queueStaticPhotoZoom(vid, v);
      };
      photoZoomSlider.onchange = commitZoom;
      photoZoomSlider.addEventListener("pointerup", commitZoom);
      photoZoomSlider.addEventListener("touchend", commitZoom, { passive: true });
    }

    const bindPhotoPanLock = (axis) => {
      const btn = container.querySelector(
        axis === "h" ? "#static-photo-pan-h-lock" : "#static-photo-pan-v-lock",
      );
      if (!btn) return;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticPhotoPanLock(vid, axis);
      };
    };
    bindPhotoPanLock("h");
    bindPhotoPanLock("v");

    const bindPhotoPan = (axis) => {
      const slider = container.querySelector(
        axis === "h" ? "#static-photo-pan-h" : "#static-photo-pan-v",
      );
      if (!slider) return;
      const valId = axis === "h" ? "#static-photo-pan-h-val" : "#static-photo-pan-v-val";
      const commitPan = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const val = container.querySelector(valId);
        if (val) val.textContent = String(v);
        void this.setStaticPhotoPan(vid, axis, v);
      };
      slider.oninput = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const val = container.querySelector(valId);
        if (val) val.textContent = String(v);
        this.queueStaticPhotoPan(vid, axis, v);
      };
      slider.onchange = commitPan;
      slider.addEventListener("pointerup", commitPan);
      slider.addEventListener("touchend", commitPan, { passive: true });
    };
    bindPhotoPan("h");
    bindPhotoPan("v");

    for (const { side } of this.photoMarginSides()) {
      const lockBtn = container.querySelector(`#static-photo-margin-${side}-lock`);
      if (lockBtn) {
        lockBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleStaticPhotoMarginLock(vid, side);
        };
      }
      const slider = container.querySelector(`#static-photo-margin-${side}`);
      if (!slider) continue;
      const commitMargin = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const val = container.querySelector(`#static-photo-margin-${side}-val`);
        if (val) val.textContent = String(v);
        void this.setStaticPhotoMargin(vid, side, v);
      };
      slider.oninput = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const val = container.querySelector(`#static-photo-margin-${side}-val`);
        if (val) val.textContent = String(v);
        this.queueStaticPhotoMargin(vid, side, v);
      };
      slider.onchange = commitMargin;
      slider.addEventListener("pointerup", commitMargin);
      slider.addEventListener("touchend", commitMargin, { passive: true });
    }

    const marginFillCb = container.querySelector("#static-photo-margin-fill-enabled");
    if (marginFillCb) {
      marginFillCb.onchange = () => {
        void this.setStaticFrameColors(vid, {
          photoMarginFillEnabled: marginFillCb.checked,
        });
        const row = this.findResultRow(vid);
        if (row?.layers?._staticFrame && this._editingVariantId === vid) {
          this.updatePhotoMarginFillUI(container, row.layers._staticFrame);
        }
      };
    }

    const hideAll = container.querySelector("#static-hide-all-stickers");
    if (hideAll) {
      hideAll.onchange = () => {
        void this.setStaticAllStickersHidden(vid, hideAll.checked);
      };
    }

    container.querySelectorAll(".static-sticker-hide").forEach((cb) => {
      cb.onchange = () => {
        void this.setStaticPlacementHidden(vid, cb.dataset.badgeId, cb.checked);
      };
    });

    container.querySelectorAll(".static-badge-pick").forEach((sel) => {
      sel.onchange = () => {
        void this.setStaticBadgeNum(vid, sel.dataset.badgeId, sel.value);
      };
    });

    container.querySelectorAll(".static-axis-lock").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticPlacementAxisLock(vid, btn.dataset.badgeId, btn.dataset.axis);
      };
    });

    const bindAxisSlider = (cls, axis) => {
      const timers = new Map();
      container.querySelectorAll(cls).forEach((range) => {
        range.oninput = () => {
          if (range.disabled) return;
          const id = range.dataset.badgeId;
          const valSpan = container.querySelector(
            axis === "h"
              ? `.static-h-val[data-badge-id="${id}"]`
              : `.static-v-val[data-badge-id="${id}"]`,
          );
          if (valSpan) valSpan.textContent = range.value;
          clearTimeout(timers.get(range));
          timers.set(
            range,
            setTimeout(() => {
              void this.setStaticPlacementSliderAxis(
                vid,
                id,
                axis,
                parseInt(range.value, 10),
              );
            }, 120),
          );
        };
        const commit = () => {
          if (range.disabled) return;
          clearTimeout(timers.get(range));
          const id = range.dataset.badgeId;
          void this.setStaticPlacementSliderAxis(
            vid,
            id,
            axis,
            parseInt(range.value, 10),
          );
        };
        range.onchange = commit;
        range.addEventListener("pointerup", commit);
        range.addEventListener("touchend", commit, { passive: true });
      });
    };
    bindAxisSlider(".static-pos-h", "h");
    bindAxisSlider(".static-pos-v", "v");

    container.querySelectorAll(".static-size-lock").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticPlacementSizeLock(vid, btn.dataset.badgeId);
      };
    });

    const sizeTimers = new Map();
    container.querySelectorAll(".static-size-pct").forEach((range) => {
      range.oninput = () => {
        if (range.disabled) return;
        const id = range.dataset.badgeId;
        const valSpan = container.querySelector(`.static-size-val[data-badge-id="${id}"]`);
        if (valSpan) valSpan.textContent = range.value;
        clearTimeout(sizeTimers.get(range));
        sizeTimers.set(
          range,
          setTimeout(() => {
            void this.setStaticPlacementSize(vid, id, parseInt(range.value, 10));
          }, 120),
        );
      };
      const commitSize = () => {
        if (range.disabled) return;
        clearTimeout(sizeTimers.get(range));
        void this.setStaticPlacementSize(
          vid,
          range.dataset.badgeId,
          parseInt(range.value, 10),
          { autoLock: true },
        );
      };
      range.onchange = commitSize;
      range.addEventListener("pointerup", commitSize);
      range.addEventListener("touchend", commitSize, { passive: true });
    });
  }

  refreshVariantCard(row) {
    const img = document.querySelector(
      `.result-img[data-variant-id="${row.variantId}"]`
    );
    if (img) {
      img.src =
        (typeof OptimizerUI !== "undefined" && OptimizerUI.pickResultImageSrc
          ? OptimizerUI.pickResultImageSrc(row)
          : null) || row.imageUrl || "";
    }
    const badge = document.querySelector(
      `.result-edit-badge[data-variant-id="${row.variantId}"]`
    );
    if (badge) {
      const edited = this.isVariantEdited(row.editFlags, row.layers, row);
      badge.style.display = edited ? "block" : "none";
    }
    const priceEl = document.querySelector(
      `.result-card[data-variant-id="${row.variantId}"] .result-price-label`
    );
    if (priceEl) {
      const ship = this.getRowDisplayShipping(row);
      if (ship.amount > 0) {
        priceEl.textContent = ship.verified
          ? `₹${ship.amount}`
          : `est ₹${ship.amount}`;
      }
    }
  }

  closeVariantEditor() {
    const panel = document.getElementById("variant-edit-panel");
    if (panel) panel.style.display = "none";
    clearTimeout(this._borderThicknessTimer);
    this._borderThicknessTimer = null;
    clearTimeout(this._gownLayerTimer);
    this._gownLayerTimer = null;
    clearTimeout(this._gownPhotoZoomTimer);
    this._gownPhotoZoomTimer = null;
    clearTimeout(this._gownPhotoPanTimer);
    this._gownPhotoPanTimer = null;
    this._staticControlsVariantId = null;
    this._editingVariantId = null;
  }

  renderVariantEditorPanel(row) {
    const panel = document.getElementById("variant-edit-panel");
    if (!panel || !row) return;

    const preview = panel.querySelector("#variant-edit-preview");
    const stickerCb = panel.querySelector("#variant-edit-no-stickers");
    const borderOnlyCb = panel.querySelector("#variant-edit-border-only");
    const cleanCb = panel.querySelector("#variant-edit-clean-product");
    const addStickersCb = panel.querySelector("#variant-edit-add-stickers");
    const addBorderCb = panel.querySelector("#variant-edit-add-border");
    const addBothCb = panel.querySelector("#variant-edit-add-both");
    const priceNote = panel.querySelector("#variant-edit-price-note");
    const title = panel.querySelector("#variant-edit-title");

    const flags = this.normalizeEditFlags(row.editFlags);
    const caps = this.getVariantLayerCaps(row);

    const setRow = (wrapId, cb, can) => {
      const wrap = panel.querySelector(wrapId);
      if (wrap) {
        wrap.style.display = "flex";
        wrap.style.opacity = can || cb?.checked ? "1" : "0.45";
      }
      if (cb) cb.disabled = !can && !cb.checked;
    };
    setRow("#variant-edit-remove-stickers-wrap", stickerCb, caps.canRemoveStickers);
    setRow("#variant-edit-remove-border-wrap", borderOnlyCb, caps.canRemoveBorder);
    setRow("#variant-edit-remove-both-wrap", cleanCb, caps.canRemoveBoth);
    setRow("#variant-edit-add-stickers-wrap", addStickersCb, caps.canAddStickers);
    setRow("#variant-edit-add-border-wrap", addBorderCb, caps.canAddBorder);
    setRow("#variant-edit-add-both-wrap", addBothCb, caps.canAddBoth);

    const isStatic = caps.isStaticPromo || this.isStaticPromoRow(row);
    const hasAdvanced = caps.canAdjustBadges || this.hasAdvancedEditor(row);
    const addSection = panel.querySelector("#variant-edit-add-section");
    const staticSection = panel.querySelector("#variant-edit-static-badges");
    const resetBtn = panel.querySelector("#variant-edit-reset");
    const stickerSlots = (row.layers._badgePlacements || []).length;
    const needsStickerControls =
      (flags.stickersAdded || flags.fullDecorationsAdded) && stickerSlots > 0;
    const staticControlsStale =
      needsStickerControls &&
      staticSection &&
      !staticSection.querySelector(".static-sticker-card");
    if (addSection) addSection.style.display = "block";
    if (staticSection) {
      if (hasAdvanced) {
        staticSection.style.display = "block";
        const sameVariant =
          this._staticControlsVariantId === row.variantId && !staticControlsStale;
        if (!sameVariant) {
          this._staticControlsVariantId = row.variantId;
          void this.preloadStaticComposeModule().then(() => {
            if (this._editingVariantId === row.variantId) {
              this.renderStaticBadgePlacementControls(row, staticSection);
            }
          });
        } else {
          const slider = staticSection.querySelector("#static-border-thickness");
          const val = staticSection.querySelector("#static-border-thickness-val");
          const pct = row.layers._staticFrame?.borderThicknessPct ?? 100;
          if (slider && document.activeElement !== slider) slider.value = String(pct);
          if (val && document.activeElement !== slider) val.textContent = String(pct);
          this.syncPlacementSlidersFromRow(row);
          this.syncPhotoControlsFromRow(row);
          this.updateBorderThicknessLockUI(staticSection, row.layers._staticFrame);
        }
      } else {
        staticSection.style.display = "none";
        staticSection.innerHTML = "";
        this._staticControlsVariantId = null;
      }
    }

    if (preview) preview.src = row.imageUrl;
    if (stickerCb) stickerCb.checked = !!flags.stickersRemoved;
    if (borderOnlyCb) borderOnlyCb.checked = !!flags.borderOnlyRemoved;
    if (cleanCb) cleanCb.checked = !!flags.cleanProduct;
    if (addStickersCb) addStickersCb.checked = !!flags.stickersAdded;
    if (addBorderCb) addBorderCb.checked = !!flags.borderAdded;
    if (addBothCb) addBothCb.checked = !!flags.fullDecorationsAdded;
    if (title) title.textContent = row.name || "Variant";
    if (priceNote) {
      const ship = this.getRowDisplayShipping(row);
      priceNote.textContent =
        ship.amount > 0
          ? ship.verified
            ? `Shipping ₹${ship.amount} is unchanged — preview/save only.`
            : `Est. ₹${ship.amount} is unchanged — preview/save only.`
          : "Shipping price is unchanged — this only affects the image you save.";
    }
    const footerNote = panel.querySelector("#variant-edit-footer-note");
    if (footerNote) {
      footerNote.textContent = hasAdvanced
        ? "RGB colors, gradients, badge size/position — pricing unchanged on save."
        : "6 preview options — edits update save only, not shipping ₹.";
    }
    if (resetBtn) {
      this.updateVariantEditorResetButton(row);
    }
  }

  ensureVariantEditorPanel() {
    let panel = document.getElementById("variant-edit-panel");
    if (panel && panel.querySelector("motionless")) {
      panel.remove();
      panel = null;
    }
    if (panel && !panel.querySelector("#variant-edit-reset")) {
      panel.remove();
      panel = null;
    }
    if (panel && !panel.querySelector("#variant-edit-add-stickers")) {
      panel.remove();
      panel = null;
    }
    if (panel && !panel.querySelector("#variant-edit-static-badges")) {
      panel.remove();
      panel = null;
    }
    if (panel && panel.dataset.staticEditorV !== "19") {
      panel.remove();
      panel = null;
    }
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "variant-edit-panel";
    panel.dataset.staticEditorV = "19";
    panel.style.cssText =
      "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100000;align-items:center;justify-content:center;padding:12px;";
    panel.innerHTML = `
      <style>
        #variant-edit-panel .variant-edit-sheet {
          background:#fff;border-radius:12px;max-width:440px;width:100%;max-height:94vh;
          display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.25);overflow:hidden;
        }
        #variant-edit-panel #variant-edit-scroll {
          overflow-y:auto;overflow-x:hidden;flex:1;min-height:0;-webkit-overflow-scrolling:touch;
          padding:0 16px 12px;overscroll-behavior:contain;touch-action:pan-y pinch-zoom;
        }
        #variant-edit-panel #variant-edit-preview-wrap {
          position:sticky;top:0;z-index:2;margin:0 0 10px;padding:4px 0 10px;
          background:#fff;cursor:pointer;
        }
        #variant-edit-panel #variant-edit-preview {
          width:100%;max-height:180px;height:auto;object-fit:contain;
          border-radius:8px;background:#f9fafb;display:block;
          box-shadow:0 2px 8px rgba(0,0,0,0.08);
        }
        #variant-edit-panel #variant-edit-preview-hint {
          font-size:10px;color:#6b7280;text-align:center;margin:4px 0 0;pointer-events:none;
        }
        #variant-edit-panel .static-slider-locked input[type="range"]:disabled {
          opacity:0.5;cursor:not-allowed;
        }
        #variant-edit-panel input[type="range"] {
          touch-action:none;
          width:100%;
          min-height:32px;
          margin:4px 0;
        }
        #variant-edit-panel .static-sticker-card input[type="range"],
        #variant-edit-panel #static-border-thickness,
        #variant-edit-panel .static-gown-layer-pct,
        #variant-edit-panel #static-photo-zoom,
        #variant-edit-panel #static-photo-pan-h,
        #variant-edit-panel #static-photo-margin-top,
        #variant-edit-panel #static-photo-margin-left,
        #variant-edit-panel #static-photo-margin-right,
        #variant-edit-panel #static-photo-margin-bottom,
        #variant-edit-panel #static-photo-pan-v {
          accent-color:#10b981;
        }
      </style>
      <div class="variant-edit-sheet">
        <div style="padding:14px 16px 0;flex-shrink:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong id="variant-edit-title" style="font-size:15px;">Variant</strong>
            <button type="button" id="variant-edit-close" style="border:none;background:#f3f4f6;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
          </div>
        </div>
        <div id="variant-edit-scroll">
          <div id="variant-edit-preview-wrap" title="Tap for full size">
            <img id="variant-edit-preview" alt="Preview">
            <div id="variant-edit-preview-hint">Tap image for full size</div>
          </div>
          <p id="variant-edit-price-note" style="font-size:11px;color:#047857;background:#ecfdf5;padding:8px;border-radius:6px;margin:0 0 12px;"></p>
          <div id="variant-edit-remove-section" style="margin-bottom:10px;">
            <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:6px;">Remove</div>
            <label id="variant-edit-remove-stickers-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-no-stickers" style="width:18px;height:18px;">
              Remove stickers / badges only
            </label>
            <label id="variant-edit-remove-border-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-border-only" style="width:18px;height:18px;">
              Remove border only (keep stickers)
            </label>
            <label id="variant-edit-remove-both-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-clean-product" style="width:18px;height:18px;">
              Remove border and stickers (clean product)
            </label>
          </div>
          <div id="variant-edit-static-badges" style="display:none;margin-bottom:10px;"></div>
          <div id="variant-edit-add-section" style="margin-bottom:10px;">
            <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:6px;">Add</div>
            <label id="variant-edit-add-stickers-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-add-stickers" style="width:18px;height:18px;">
              Add stickers / badges only
            </label>
            <label id="variant-edit-add-border-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-add-border" style="width:18px;height:18px;">
              Add border only (keep product)
            </label>
            <label id="variant-edit-add-both-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-add-both" style="width:18px;height:18px;">
              Add border and stickers
            </label>
          </div>
          <p id="variant-edit-footer-note" style="font-size:10px;color:#6b7280;margin:0 0 8px;">6 preview options — edits update save only, not shipping ₹.</p>
        </div>
        <div style="flex-shrink:0;padding:10px 16px 14px;border-top:1px solid #f3f4f6;background:#fff;">
          <button type="button" id="variant-edit-reset" style="display:none;width:100%;padding:10px;margin-bottom:8px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;cursor:pointer;">Reset to original</button>
          <button type="button" id="variant-edit-done" class="generate-btn" style="width:100%;padding:12px;">Done</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector("#variant-edit-close").onclick = () =>
      this.closeVariantEditor();
    panel.querySelector("#variant-edit-done").onclick = () =>
      this.closeVariantEditor();
    const resetBtn = panel.querySelector("#variant-edit-reset");
    if (resetBtn) {
      resetBtn.onclick = () => {
        const id = this._editingVariantId;
        if (id) void this.resetStaticVariantEdits(id);
      };
    }
    panel.onclick = (e) => {
      if (e.target === panel) this.closeVariantEditor();
    };

    const previewWrap = panel.querySelector("#variant-edit-preview-wrap");
    if (previewWrap) {
      previewWrap.onclick = (e) => {
        e.stopPropagation();
        const id = this._editingVariantId;
        if (!id) return;
        const row = this.findResultRow(id);
        if (row) this.openVariantFullPreview(row);
      };
    }

    const onEditChange = (ev) => {
      const id = this._editingVariantId;
      if (!id) return;

      const row = this.findResultRow(id);
      if (!row) return;
      const stickerCb = panel.querySelector("#variant-edit-no-stickers");
      const borderOnlyCb = panel.querySelector("#variant-edit-border-only");
      const cleanCb = panel.querySelector("#variant-edit-clean-product");
      const addStickersCb = panel.querySelector("#variant-edit-add-stickers");
      const addBorderCb = panel.querySelector("#variant-edit-add-border");
      const addBothCb = panel.querySelector("#variant-edit-add-both");
      const target = ev?.target;

      if (target === cleanCb && cleanCb.checked) {
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
        addStickersCb.checked = false;
        addBorderCb.checked = false;
        addBothCb.checked = false;
      } else if (target === addBothCb && addBothCb.checked) {
        cleanCb.checked = false;
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
        addStickersCb.checked = false;
        addBorderCb.checked = false;
      } else if (
        (target === stickerCb || target === borderOnlyCb) &&
        stickerCb.checked &&
        borderOnlyCb.checked
      ) {
        cleanCb.checked = true;
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
        addStickersCb.checked = false;
        addBorderCb.checked = false;
        addBothCb.checked = false;
      } else if (
        (target === addStickersCb || target === addBorderCb) &&
        addStickersCb.checked &&
        addBorderCb.checked
      ) {
        addBothCb.checked = true;
        addStickersCb.checked = false;
        addBorderCb.checked = false;
        cleanCb.checked = false;
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
      } else if (
        cleanCb.checked &&
        (target === stickerCb || target === borderOnlyCb)
      ) {
        cleanCb.checked = false;
      } else if (
        addBothCb.checked &&
        (target === addStickersCb || target === addBorderCb)
      ) {
        addBothCb.checked = false;
      }

      if (target === stickerCb && stickerCb.checked) {
        addStickersCb.checked = false;
        addBothCb.checked = false;
      }
      if (target === borderOnlyCb && borderOnlyCb.checked) {
        addBorderCb.checked = false;
        addBothCb.checked = false;
      }
      if (target === addStickersCb && addStickersCb.checked) {
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
        cleanCb.checked = false;
        addBothCb.checked = false;
      }
      if (target === addBorderCb && addBorderCb.checked) {
        borderOnlyCb.checked = false;
        stickerCb.checked = false;
        cleanCb.checked = false;
        addBothCb.checked = false;
      }

      this.setVariantEdits(id, {
        stickersRemoved: !!stickerCb?.checked,
        borderOnlyRemoved: !!borderOnlyCb?.checked,
        cleanProduct: !!cleanCb?.checked,
        stickersAdded: !!addStickersCb?.checked,
        borderAdded: !!addBorderCb?.checked,
        fullDecorationsAdded: !!addBothCb?.checked,
      });
    };
    [
      "#variant-edit-no-stickers",
      "#variant-edit-border-only",
      "#variant-edit-clean-product",
      "#variant-edit-add-stickers",
      "#variant-edit-add-border",
      "#variant-edit-add-both",
    ].forEach((sel) => {
      const el = panel.querySelector(sel);
      if (el) el.onchange = onEditChange;
    });

    return panel;
  }

  async openVariantEditor(variantId) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) {
      OptimizerUtils.showNotification(
        "Layer edit not available for this variant",
        "info"
      );
      return;
    }
    if (this.hasAdvancedEditor(row) || this.isStaticPromoRow(row)) {
      await this.preloadStaticComposeModule();
      if (window.StaticFrameCompose?.ensureVariantPlacementMeta) {
        await window.StaticFrameCompose.ensureVariantPlacementMeta(row);
      } else if (
        window.StaticFrameCompose?.ensureStaticPlacementMeta &&
        row.layers._staticFrame
      ) {
        window.StaticFrameCompose.ensureStaticPlacementMeta(
          row.layers,
          row.layers._staticFrame.style,
        );
      }
    }
    this._editingVariantId = variantId;
    this.ensureFrozenPricing(row);
    this.ensureVariantEditorPanel();
    if (this.hasAdvancedEditor(row) || this.isStaticPromoRow(row)) {
      try {
        await this.applyRowStaticPreview(variantId, row);
      } catch (e) {
        console.warn("Editor open preview compose:", e);
      }
    }
    this.renderVariantEditorPanel(row);
    document.getElementById("variant-edit-panel").style.display = "flex";
  }

  refreshResultsView() {
    const resultsArea = document.getElementById("results-area");
    if (!resultsArea) return;
    if (this.isTestLabResultsActive()) {
      if (
        !this.testLabCurrentResults.length &&
        !this.testLabAnalysisPrimaryResults.length
      ) {
        return;
      }
      resultsArea.innerHTML = OptimizerUI.getResultsHTML(
        this.testLabCurrentResults,
        this.getTestLabResultsViewOptions()
      );
    } else {
      if (
        !this.currentResults.length &&
        !this.analysisPrimaryResults.length &&
        !(
          window.WEB_OPTIMIZER_MODE && this.shouldShowStaticPromoWorkspace()
        )
      ) {
        return;
      }
      resultsArea.innerHTML = OptimizerUI.getResultsHTML(
        this.currentResults,
        this.getResultsViewOptions()
      );
    }
    this.setupResultsEvents();
  }

  setManualShipping(variantId, price) {
    const row = this.findResultRow(variantId);
    if (!row) return;
    const value = parseInt(price, 10);
    const inFramed = this.framedExtraResults.some(
      (r) => r.variantId === variantId,
    );
    if (!value || value <= 0) {
      row.shippingCost = 0;
      row.manualPrice = false;
      row.isVerified = false;
    } else {
      row.shippingCost = value;
      row.manualPrice = true;
      row.isVerified = true;
    }
    if (inFramed) {
      this.resortFramedExtrasByManualPrice();
    } else {
      this.resortResultsByManualPrice();
    }
  }

  resortFramedExtrasByManualPrice() {
    this.framedExtraResults.sort((a, b) => {
      const aPriced = a.shippingCost > 0 ? 0 : 1;
      const bPriced = b.shippingCost > 0 ? 0 : 1;
      if (aPriced !== bPriced) return aPriced - bPriced;
      if (a.shippingCost > 0 && b.shippingCost > 0) {
        return a.shippingCost - b.shippingCost;
      }
      return 0;
    });
    this.refreshResultsView();
  }

  resortResultsByManualPrice() {
    this.currentResults.sort((a, b) => {
      const aPriced = a.shippingCost > 0 ? 0 : 1;
      const bPriced = b.shippingCost > 0 ? 0 : 1;
      if (aPriced !== bPriced) return aPriced - bPriced;
      if (a.shippingCost > 0 && b.shippingCost > 0) {
        return a.shippingCost - b.shippingCost;
      }
      return 0;
    });
    this.refreshResultsView();
  }

  async importCategoriesFromJson() {
    const textarea = document.getElementById("category-json-import");
    if (!textarea || typeof MeeshoAPI === "undefined") return;
    try {
      const categories = MeeshoAPI.importCategoryTreeJson(textarea.value);
      OptimizerUtils.showNotification(
        `Imported ${categories.length} categories`,
        "success"
      );
      MeeshoAPI.cache.categories = categories;
      await this.loadCategoryDropdown();
    } catch (err) {
      OptimizerUtils.showNotification(err.message || "Invalid category JSON", "error");
    }
  }

  setupResultsEvents() {
    document.querySelectorAll(".manual-price-input").forEach((input) => {
      const apply = () => {
        this.setManualShipping(input.dataset.variantId, input.value);
      };
      input.onchange = apply;
      input.onblur = apply;
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          apply();
        }
      };
    });

    document.querySelectorAll(".result-img").forEach((img) => {
      img.onclick = () => {
        const variantId = img.dataset.variantId;
        if (!variantId) return;
        this.openVariantEditor(variantId);
      };
    });

    document.querySelectorAll(".dl-btn").forEach((btn) => {
      btn.onclick = () => {
        const row = this.findResultRow(btn.dataset.variantId);
        if (row) this.downloadImage(row);
      };
    });

    document.querySelectorAll(".apply-btn").forEach((btn) => {
      if (window.WEB_OPTIMIZER_MODE) btn.textContent = "Save";
      btn.onclick = () => {
        const row = this.findResultRow(btn.dataset.variantId);
        if (!row) return;
        if (window.WEB_OPTIMIZER_MODE) {
          this.downloadImage(row);
        } else {
          this.applyImage(row);
        }
      };
    });

    const toggleFramed = document.getElementById("toggle-framed-extras");
    if (toggleFramed) {
      toggleFramed.onclick = () => {
        if (this.isTestLabResultsActive()) {
          this.testLabShowFramedExtras = !this.testLabShowFramedExtras;
        } else {
          this.showFramedExtras = !this.showFramedExtras;
        }
        this.refreshResultsView();
      };
    }

    const toggleAnalysis = document.getElementById("toggle-analysis-extras");
    if (toggleAnalysis) {
      toggleAnalysis.onclick = () => {
        if (this.isTestLabResultsActive()) {
          this.testLabShowAnalysisExtras = !this.testLabShowAnalysisExtras;
        } else {
          this.showAnalysisExtras = !this.showAnalysisExtras;
        }
        this.refreshResultsView();
      };
    }

    const generateShowcaseBtn = document.getElementById("generate-showcase-btn");
    if (generateShowcaseBtn && !this.shouldShowStaticPromoWorkspace()) {
      generateShowcaseBtn.onclick = () => {
        void this.generateShowcaseFrames();
      };
    }

    const toggleShowcase = document.getElementById("toggle-showcase-results");
    if (toggleShowcase) {
      toggleShowcase.onclick = () => {
        this.showShowcaseResults = !this.showShowcaseResults;
        this.refreshResultsView();
      };
    }

    const generatePromoBtn = document.getElementById("generate-promo-lifestyle-btn");
    if (generatePromoBtn && !this.shouldShowStaticPromoWorkspace()) {
      generatePromoBtn.onclick = () => {
        void this.generatePromoLifestyleFrames();
      };
    }

    const togglePromo = document.getElementById("toggle-promo-lifestyle-results");
    if (togglePromo) {
      togglePromo.onclick = () => {
        this.showPromoLifestyleResults = !this.showPromoLifestyleResults;
        this.refreshResultsView();
      };
    }

    const generateTallBtn = document.getElementById("generate-tall-static-btn");
    if (generateTallBtn && !this.shouldShowStaticPromoWorkspace()) {
      generateTallBtn.onclick = () => {
        void this.generateTallStaticFrames();
      };
    }

    this.bindStaticPromoButtons();

    const toggleTall = document.getElementById("toggle-tall-static-results");
    if (toggleTall) {
      toggleTall.onclick = () => {
        this.showTallStaticResults = !this.showTallStaticResults;
        this.refreshResultsView();
      };
    }

    const toggleGown = document.getElementById("toggle-gown-static-results");
    if (toggleGown) {
      toggleGown.onclick = () => {
        this.showGownStaticResults = !this.showGownStaticResults;
        this.refreshResultsView();
      };
    }

    const dlAllBtn = document.getElementById("dl-all-btn");
    if (dlAllBtn) {
      dlAllBtn.onclick = () => {
        const list = this.getActiveResultList();
        list.forEach((r, i) => {
          setTimeout(() => this.downloadImage(r), i * 400);
        });
      };
    }

    const applyBestBtn = document.getElementById("apply-best-btn");
    if (applyBestBtn) {
      const best = this.getBestActiveResult();
      if (window.WEB_OPTIMIZER_MODE) {
        const price = best?.shippingCost || best?.estShipping || "";
        applyBestBtn.textContent = price ? `Download Best ₹${price}` : "Download Best";
        applyBestBtn.onclick = () => this.downloadImage(best);
      } else {
        applyBestBtn.onclick = () => this.applyImage(best);
      }
    }

    const createReportBtn = document.getElementById("create-report-btn");
    if (createReportBtn) {
      createReportBtn.onclick = () => {
        void this.createLiveVariantReport();
      };
    }

    const restartBtn = document.getElementById("restart-btn");
    if (restartBtn) {
      restartBtn.onclick = () => {
        this.resetToUploadForm();
      };
    }

    const localPriceSaveBtn = document.getElementById("local-price-save-btn");
    if (localPriceSaveBtn) {
      localPriceSaveBtn.onclick = () => this.saveLocalPriceSnapshot();
    }
    const localPriceViewBtn = document.getElementById("local-price-view-btn");
    if (localPriceViewBtn) {
      localPriceViewBtn.onclick = () => this.showLocalPriceReport();
    }
  }

  async downloadImage(result) {
    if (!result) {
      OptimizerUtils.showNotification("Could not find image to download", "error");
      return;
    }

    const name = (result.name || "variant").replace(/\s+/g, "-");
    const filename = "meesho-" + name + "-" + Date.now() + ".jpg";
    let url = "";
    const edited = this.isVariantEdited(
      result.editFlags,
      result.layers,
      result,
    );
    if (edited && result.layers?._staticFrame) {
      try {
        url = await this.composeSaveForRow(result);
      } catch (e) {
        console.warn("Save compose failed, using pricing image:", e);
      }
    }
    if (!url) {
      url = this.resolveDownloadUrl(result);
    }

    if (!url) {
      OptimizerUtils.showNotification(
        "No image data for " + (result.name || "variant"),
        "error"
      );
      return;
    }

    try {
      const edited = this.isVariantEdited(
        result.editFlags,
        result.layers,
        result,
      );
      let blob = !edited && result.blob instanceof Blob ? result.blob : null;
      if (!blob) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Fetch failed");
        blob = await resp.blob();
      }

      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objUrl;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(objUrl);
      }, 250);
      OptimizerUtils.showNotification("Downloaded: " + (result.name || "image"), "success");
    } catch (e) {
      console.error("Download failed:", e);
      try {
        window.open(url, "_blank", "noopener");
        OptimizerUtils.showNotification(
          "Tap and hold the image to save (mobile)",
          "info"
        );
      } catch (e2) {
        OptimizerUtils.showNotification("Download failed — try Save on the card", "error");
      }
    }
  }

  async applyImage(result) {
    try {
      OptimizerUtils.showNotification("Applying image...", "info");

      const imageInput = document.querySelector("#changeFrontImage");
      if (!imageInput) {
        OptimizerUtils.showNotification("Image input not found", "error");
        return;
      }

      // Use the SAME image that was tested (from dataUrl)
      // This ensures consistency between test and apply
      const resp = await fetch(result.imageUrl);
      const blob = await resp.blob();
      const file = new File([blob], "optimized-" + Date.now() + ".jpg", {
        type: "image/jpeg",
      });

      const dt = new DataTransfer();
      dt.items.add(file);
      imageInput.files = dt.files;
      imageInput.dispatchEvent(new Event("change", { bubbles: true }));

      this.closeModal();

      // Wait for Meesho to process the image
      await new Promise((r) => setTimeout(r, 3000));

      // Trigger price refresh multiple times
      await this.triggerPriceRefresh();
      await new Promise((r) => setTimeout(r, 1500));
      await this.triggerPriceRefresh();
      await new Promise((r) => setTimeout(r, 2000));

      // Now read the ACTUAL price from page (this is what Meesho calculated)
      const finalShipping = await this.waitForFinalShipping();

      // Update stats
      const savings = result.savings > 0 ? result.savings : 0;
      await this.updateStats(savings);

      // Show the tested price and actual page price
      const testedPrice = result.shippingCost;
      if (finalShipping) {
        if (finalShipping === testedPrice) {
          OptimizerUtils.showNotification(
            `✅ Shipping: ₹${finalShipping}`,
            "success"
          );
        } else if (finalShipping < testedPrice) {
          // Page price is LOWER - great news!
          OptimizerUtils.showNotification(
            `🎉 Shipping: ₹${finalShipping} (Better than expected!)`,
            "success"
          );
          console.log(
            `✅ Price better than expected - Page: ₹${finalShipping}, API: ₹${testedPrice}`
          );
        } else {
          // Page price is higher
          OptimizerUtils.showNotification(
            `✅ Shipping: ₹${finalShipping} (API showed ₹${testedPrice})`,
            "info"
          );
          console.log(
            `⚠️ Price higher than API - Page: ₹${finalShipping}, API: ₹${testedPrice}`
          );
        }
      } else {
        OptimizerUtils.showNotification(
          `✅ Applied! (API: ₹${testedPrice})`,
          "success"
        );
      }
    } catch (err) {
      console.error("Apply error:", err);
      OptimizerUtils.showNotification("Error applying image", "error");
    }
  }

  // Wait and get final shipping from page
  async waitForFinalShipping() {
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 500));

      // Try to find shipping on page
      const shipping = this.detectShipping();
      if (shipping && shipping > 0) {
        console.log("📦 Final shipping from page:", shipping);
        return shipping;
      }
    }
    return null;
  }

  // Update stats in storage
  async updateStats(savings) {
    try {
      const result = await chrome.storage.sync.get(["stats"]);
      const stats = result.stats || { imagesOptimized: 0, totalSavings: 0 };

      stats.imagesOptimized = (stats.imagesOptimized || 0) + 1;
      stats.totalSavings = (stats.totalSavings || 0) + savings;

      await chrome.storage.sync.set({ stats: stats });
      console.log("📊 Stats updated:", stats);
    } catch (err) {
      console.error("Stats update error:", err);
    }
  }

  stopProcessing() {
    this.shouldStop = true;
    this.isProcessing = false;

    if (this.currentResults.length > 0) {
      const processingArea = document.getElementById("processing-area");
      const resultsArea = document.getElementById("results-area");

      this.currentResults.sort((a, b) => b.savings - a.savings);

      if (processingArea) processingArea.style.display = "none";
      if (resultsArea) {
        resultsArea.style.display = "block";
        resultsArea.innerHTML = OptimizerUI.getResultsHTML(
          this.currentResults,
          this.getResultsViewOptions()
        );
        this.setupResultsEvents();
      }
    } else {
      this.closeModal();
      setTimeout(() => this.openModal(), 200);
    }
  }
}

// Initialize
if (window.WEB_OPTIMIZER_MODE) {
  window.MeeshoShippingOptimizer = MeeshoShippingOptimizer;
  if (typeof initWebOptimizerButtons === "function") initWebOptimizerButtons();
} else {
  new MeeshoShippingOptimizer();
}
