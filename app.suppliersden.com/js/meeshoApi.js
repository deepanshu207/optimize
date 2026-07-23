// Meesho API Integration v7.0.0 - Enhanced Variation & Shipping Logic

const MeeshoAPI = {
  MAX_RESULT_VARIANTS: 200,
  // Borders outward around full-size product — profiles tuned toward ₹49 (38–48KB slabs)
  LOW_SHIPPING_FRAMED_PROFILES: [
    // Original set (often lands ₹63–65 — kept for comparison)
    { id: "framed_48a", bluePct: 0.12, whitePct: 0.04, targetKb: 48, maxSide: 1200 },
    { id: "framed_48b", bluePct: 0.14, whitePct: 0.05, targetKb: 48, maxSide: 1200 },
    { id: "framed_50a", bluePct: 0.11, whitePct: 0.035, targetKb: 50, maxSide: 1200 },
    { id: "framed_50b", bluePct: 0.13, whitePct: 0.045, targetKb: 50, maxSide: 1200 },
    { id: "framed_46a", bluePct: 0.15, whitePct: 0.05, targetKb: 46, maxSide: 1200 },
    { id: "framed_46b", bluePct: 0.1, whitePct: 0.03, targetKb: 46, maxSide: 1200 },
    // ₹49-tier candidates: thick blue outer (screenshot), lower KB, maxSide 1024
    { id: "low_44_thick", bluePct: 0.18, whitePct: 0.05, targetKb: 44, maxSide: 1024 },
    { id: "low_42_thick", bluePct: 0.2, whitePct: 0.05, targetKb: 42, maxSide: 1024 },
    { id: "low_40_thick", bluePct: 0.17, whitePct: 0.045, targetKb: 40, maxSide: 1024 },
    { id: "low_38_thick", bluePct: 0.19, whitePct: 0.05, targetKb: 38, maxSide: 1024 },
    { id: "low_46_med", bluePct: 0.15, whitePct: 0.04, targetKb: 46, maxSide: 1024 },
    { id: "low_44_med", bluePct: 0.14, whitePct: 0.035, targetKb: 44, maxSide: 1024 },
    { id: "low_48_tall", layout: "tall", bluePct: 0.16, whitePct: 0.05, targetKb: 48, maxSide: 1024 },
    { id: "low_46_tall", layout: "tall", bluePct: 0.18, whitePct: 0.05, targetKb: 46, maxSide: 1024 },
    { id: "low_44_tall", layout: "tall", bluePct: 0.2, whitePct: 0.045, targetKb: 44, maxSide: 1024 },
    { id: "low_42_tall", layout: "tall", bluePct: 0.17, whitePct: 0.04, targetKb: 42, maxSide: 1024 },
  ],
  _initialized: false,
  endpoints: {
    // Meesho routes are in flux: prefer /api/cataloging/* and fallback to older /catalogingapi/api/*
    uploadImage:
      "https://supplier.meesho.com/api/cataloging/singleCatalogUpload/uploadSingleCatalogImages",
    uploadImageFallback:
      "https://supplier.meesho.com/catalogingapi/api/singleCatalogUpload/uploadSingleCatalogImages",
    fetchDuplicatePid:
      "https://supplier.meesho.com/api/cataloging/priceRecommendation/fetchDuplicatePid",
    getTransferPrice:
      "https://supplier.meesho.com/api/cataloging/singleCatalogUpload/getTransferPrice",
    // Meesho currently serves this endpoint under /api/cataloging (the /catalogingapi/* path often returns 463)
    fetchCategories:
      "https://supplier.meesho.com/api/cataloging/bulkCatalogUpload/fetchCategoryTreeOld",
  },

  cache: {
    supplierId: null,
    supplierTag: null,
    categoryId: null,
    browserId: null,
    price: 100,
    categories: null,
  },

  syncFromSession: function () {
    if (!window.WEB_OPTIMIZER_MODE) return;
    let s = {};
    try {
      if (window.WebSession) s = WebSession.get();
      else s = JSON.parse(localStorage.getItem("meesho_web_session_v1") || "{}");
    } catch (e) {}
    if (s.supplierId) this.cache.supplierId = parseInt(s.supplierId, 10) || s.supplierId;
    if (s.browserId) {
      try {
        this.cache.browserId = decodeURIComponent(s.browserId);
      } catch (e) {
        this.cache.browserId = s.browserId;
      }
    }
    if (s.identifier) this.cache.supplierTag = s.identifier;
    if (s.price) this.cache.price = parseInt(s.price, 10) || 100;
  },

  apiUrl: function (path) {
    if (window.WEB_OPTIMIZER_MODE) {
      return "/api/meesho-proxy" + path;
    }
    return "https://supplier.meesho.com" + path;
  },

  requestHeaders: function (extra) {
    this.syncFromSession();
    const headers = { ...this.getHeaders(), ...(extra || {}) };
    if (window.WEB_OPTIMIZER_MODE) {
      let cookie = "";
      try {
        if (window.WebSession) cookie = WebSession.get().cookie || "";
        else {
          cookie =
            JSON.parse(localStorage.getItem("meesho_web_session_v1") || "{}")
              .cookie || "";
        }
        if (cookie && window.WebSession?.normalizeCookie) {
          cookie = WebSession.normalizeCookie(cookie);
        }
      } catch (e) {}
      if (cookie) headers["x-meesho-cookie"] = cookie;
    }
    return headers;
  },

  assetUrl: function (path) {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(path);
    }
    return "/" + String(path).replace(/^\//, "");
  },

  badgeCache: {},

  // Track shipping results
  shippingHistory: new Map(),

  // Keep generateVariation for fallback but use minimal by default
  generateVariation: async function (originalBlob, seed, strategy, bestParams) {
    return this.generateVariationFull(originalBlob, seed);
  },

  init: function () {
    if (this._initialized) return;
    this._initialized = true;
    this.syncFromSession();
    this.detectAllValues();
    // Avoid API calls when user is not authenticated yet.
    if (this.cache.supplierId) this.fetchCategories();
    console.log("fetchCategories endpoint:", this.endpoints.fetchCategories);
    console.log("📦 MeeshoAPI v7.0 initialized");
  },

  detectAllValues: function () {
    const cookieBrowser = this.getCookie("browser_id") || "";
    if (cookieBrowser) {
      this.cache.browserId = cookieBrowser;
    } else if (window.WEB_OPTIMIZER_MODE) {
      this.syncFromSession();
    }

    const urlMatch = window.location.href.match(/\/cataloging\/([^\/]+)/);
    if (urlMatch) {
      this.cache.supplierTag = urlMatch[1];
    } else if (window.WEB_OPTIMIZER_MODE) {
      this.syncFromSession();
    }

    const detectedSupplier = this.detectSupplierId();
    if (detectedSupplier) this.cache.supplierId = detectedSupplier;

    if (!window.WEB_OPTIMIZER_MODE || !this.cache.price) {
      const detectedPrice = this.detectPrice();
      if (detectedPrice) this.cache.price = detectedPrice;
    }

    if (!this.cache.categoryId) {
      this.cache.categoryId = this.detectCategoryId();
    }

    console.log("🔍 Auto-detected:", this.cache);
  },

  getCookie: function (name) {
    const match = document.cookie.match(
      new RegExp("(^| )" + name + "=([^;]+)"),
    );
    return match ? decodeURIComponent(match[2]) : "";
  },

  detectSupplierId: function () {
    if (window.WEB_OPTIMIZER_MODE && window.WebSession) {
      const s = WebSession.get();
      if (s.supplierId) return parseInt(s.supplierId, 10) || s.supplierId;
    }
    try {
      const mpCookie = this.getCookie(
        "mp_a66867feba42257f4b46689d52d48f86_mixpanel",
      );
      if (mpCookie) {
        const decoded = JSON.parse(mpCookie);
        if (decoded.Supplier_id) {
          console.log("✅ Supplier ID from cookie:", decoded.Supplier_id);
          return decoded.Supplier_id;
        }
      }
    } catch (e) {}
    return null;
  },

  detectCategoryId: function () {
    return this.cache.categoryId;
  },

  detectPrice: function () {
    const inputs = document.querySelectorAll("input");
    for (const inp of inputs) {
      const name = (inp.name || "").toLowerCase();
      if (
        (name.includes("price") || name === "mrp") &&
        inp.value &&
        parseInt(inp.value) > 0
      ) {
        return parseInt(inp.value);
      }
    }
    return 100;
  },

  setCategory: function (id) {
    this.cache.categoryId = parseInt(id);
    console.log("📁 Category set to:", id);
  },

  getHeaders: function () {
    return {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json;charset=UTF-8",
      "client-type": "d-web",
      "client-package-version": "1.0.1",
      "browser-id": this.cache.browserId || "",
      identifier: this.cache.supplierTag || "",
      "supplier-id": this.cache.supplierId ? String(this.cache.supplierId) : "",
    };
  },

  fetchCategories: async function (forceLive) {
    if (this.cache.categories && !forceLive) return this.cache.categories;
    this._lastCategoryFetchWasFallback = false;
    this._lastCategoryFetchWasEmbedded = false;

    const embedded = this.getEmbeddedCategories();

    // Web app: use built-in Meesho category tree (no API / JSON upload needed)
    if (window.WEB_OPTIMIZER_MODE && embedded?.length && !forceLive) {
      this.cache.categories = embedded;
      this._lastCategoryFetchWasEmbedded = true;
      console.log("✅ Using embedded categories:", embedded.length);
      return embedded;
    }

    const imported = this.getImportedCategories();
    if (imported?.length && !forceLive) {
      this.cache.categories = imported;
      return imported;
    }

    if (!window.WEB_OPTIMIZER_MODE || forceLive) {
      try {
        const resp = await fetch(
          this.apiUrl(
            "/api/cataloging/bulkCatalogUpload/fetchCategoryTreeOld",
          ),
          {
          method: "POST",
          headers: this.requestHeaders(),
          body: JSON.stringify({
            bulk_upload_enabled: false,
            supplier_id: this.cache.supplierId,
            identifier: this.cache.supplierTag,
          }),
          credentials: window.WEB_OPTIMIZER_MODE ? "same-origin" : "include",
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          console.warn(
            "⚠️ fetchCategories failed:",
            resp.status,
            resp.statusText,
            errText.slice(0, 200),
          );
        } else {
          const result = await resp.json();
          if (result.items?.length > 0) {
            const subCat = result.items.find((i) => i.type === "sub-sub-category");
            if (subCat?.data) {
              this.cache.categories = subCat.data.map((c) => ({
                id: parseInt(c.id),
                name: c.name,
                parentName: c.parent_name,
              }));
              console.log("✅ Categories loaded:", this.cache.categories.length);
              return this.cache.categories;
            }
          }
        }
      } catch (e) {
        console.error("Categories error:", e);
      }
    }

    if (embedded?.length) {
      this.cache.categories = embedded;
      this._lastCategoryFetchWasEmbedded = true;
      return this.cache.categories;
    }

    if (window.WEB_OPTIMIZER_MODE) {
      const fromJson = await this.loadEmbeddedCategoriesFromJson();
      if (fromJson?.length) return fromJson;
    }

    return null;
  },

  getEmbeddedCategories: function () {
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.getList) {
      const list = MeeshoCategories.getList();
      if (list.length) return list;
    }
    if (window.MEESHO_EMBEDDED_CATEGORIES?.length) {
      return window.MEESHO_EMBEDDED_CATEGORIES;
    }
    if (window.FALLBACK_CATEGORIES?.length) {
      return window.FALLBACK_CATEGORIES;
    }
    return null;
  },

  ensureEmbeddedCategories: function () {
    const embedded = this.getEmbeddedCategories();
    if (embedded?.length) {
      this.cache.categories = embedded;
      this._lastCategoryFetchWasEmbedded = true;
      this._lastCategoryFetchWasFallback = false;
      return embedded;
    }
    return null;
  },

  loadEmbeddedCategoriesFromJson: async function () {
    if (!window.WEB_OPTIMIZER_MODE) return null;
    try {
      const resp = await fetch("/data/meesho-category-tree.json", {
        cache: "force-cache",
      });
      if (!resp.ok) return null;
      const tree = await resp.json();
      const list =
        typeof MeeshoCategories !== "undefined"
          ? MeeshoCategories.parseTree(tree)
          : [];
      if (list.length) {
        this.cache.categories = list;
        this._lastCategoryFetchWasEmbedded = true;
        return list;
      }
    } catch (e) {
      console.warn("Could not load /data/meesho-category-tree.json", e);
    }
    return null;
  },

  getCategories: function () {
    return this.cache.categories || [];
  },

  getImportedCategories: function () {
    if (!window.WEB_OPTIMIZER_MODE) return null;
    try {
      const raw = localStorage.getItem("meesho_imported_categories_v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch (e) {
      return null;
    }
  },

  importCategoryTreeJson: function (raw) {
    let data = raw;
    if (typeof raw === "string") {
      const text = raw.trim();
      if (!text) throw new Error("Paste Meesho category JSON first");
      data = JSON.parse(text);
    }

    const categories =
      typeof MeeshoCategories !== "undefined"
        ? MeeshoCategories.parseTree(data)
        : [];

    if (!categories.length) {
      throw new Error("Could not find sub-sub-category list in JSON");
    }

    localStorage.setItem(
      "meesho_imported_categories_v1",
      JSON.stringify(categories),
    );
    this.cache.categories = categories;
    this._lastCategoryFetchWasFallback = false;
    this._lastCategoryFetchWasEmbedded = false;
    return categories;
  },

  uploadImage: async function (blob, filename) {
    const formData = new FormData();
    formData.append("file", blob, filename || "img-" + Date.now() + ".jpg");
    formData.append("data", "undefined");
    try {
      const resp = await fetch(
        this.apiUrl(
          "/api/cataloging/singleCatalogUpload/uploadSingleCatalogImages",
        ),
        {
        method: "POST",
        headers: {
          accept: "application/json, text/plain, */*",
          "browser-id": this.cache.browserId || "",
          "client-type": "d-web",
          "client-package-version": "1.0.1",
          identifier: this.cache.supplierTag || "",
          "supplier-id": this.cache.supplierId
            ? String(this.cache.supplierId)
            : "",
          ...(window.WEB_OPTIMIZER_MODE &&
          (() => {
            try {
              let c = window.WebSession
                ? WebSession.get().cookie
                : JSON.parse(localStorage.getItem("meesho_web_session_v1") || "{}").cookie;
              if (c && window.WebSession?.normalizeCookie) {
                c = WebSession.normalizeCookie(c);
              }
              return c ? { "x-meesho-cookie": c } : {};
            } catch (e) {
              return {};
            }
          })()),
        },
        body: formData,
        credentials: window.WEB_OPTIMIZER_MODE ? "same-origin" : "include",
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) {
        const fallback = await fetch(
          this.apiUrl(
            "/catalogingapi/api/singleCatalogUpload/uploadSingleCatalogImages",
          ),
          {
            method: "POST",
            headers: {
              accept: "application/json, text/plain, */*",
              "browser-id": this.cache.browserId || "",
              "client-type": "d-web",
              "client-package-version": "1.0.1",
              identifier: this.cache.supplierTag || "",
              "supplier-id": this.cache.supplierId
                ? String(this.cache.supplierId)
                : "",
              ...(window.WEB_OPTIMIZER_MODE &&
              (() => {
                try {
                  let c = window.WebSession
                    ? WebSession.get().cookie
                    : JSON.parse(
                        localStorage.getItem("meesho_web_session_v1") || "{}"
                      ).cookie;
                  if (c && window.WebSession?.normalizeCookie) {
                    c = WebSession.normalizeCookie(c);
                  }
                  return c ? { "x-meesho-cookie": c } : {};
                } catch (e) {
                  return {};
                }
              })()),
            },
            body: formData,
            credentials: window.WEB_OPTIMIZER_MODE ? "same-origin" : "include",
            signal: AbortSignal.timeout(20000),
          }
        );
        if (!fallback.ok) return null;
        const fb = await fallback.json();
        return fb.image || null;
      }
      const result = await resp.json();
      console.log("📤 Image uploaded:", result.image);
      return result.image;
    } catch (e) {
      console.error("Upload error:", e);
      return null;
    }
  },

  fetchDuplicatePid: async function (imageUrl, categoryId) {
    const sscatId = categoryId || this.cache.categoryId || 18044;
    try {
      const resp = await fetch(
        this.apiUrl(
          "/api/cataloging/priceRecommendation/fetchDuplicatePid",
        ),
        {
        method: "POST",
        headers: this.requestHeaders(),
        body: JSON.stringify({
          is_old_image_match_enabled: true,
          sscat_id: sscatId,
          image_url: imageUrl,
        }),
        credentials: window.WEB_OPTIMIZER_MODE ? "same-origin" : "include",
      });
      if (!resp.ok) return null;
      const result = await resp.json();
      console.log("🔍 Duplicate PID:", result.data?.duplicate_pid);
      return result.data?.duplicate_pid || null;
    } catch (e) {
      return null;
    }
  },

  getShippingCharges: async function (imageUrl) {
    const sscatId = this.cache.categoryId || 18044;
    const supplierId = this.cache.supplierId;
    const price = this.cache.price || 100;

    let duplicatePid = null;
    if (imageUrl)
      duplicatePid = await this.fetchDuplicatePid(imageUrl, sscatId);

    try {
      const body = {
        sscat_id: sscatId,
        gst_percentage: 0,
        price: price,
        supplier_id: supplierId,
        gst_type: "GSTIN",
        image_url: imageUrl,
      };
      if (duplicatePid) body.duplicate_pid = duplicatePid;

      console.log(
        "� g etTransferPrice:",
        duplicatePid ? `pid=${duplicatePid}` : "no pid",
      );

      const resp = await fetch(
        this.apiUrl("/api/cataloging/singleCatalogUpload/getTransferPrice"),
        {
        method: "POST",
        headers: this.requestHeaders(),
        body: JSON.stringify(body),
        credentials: window.WEB_OPTIMIZER_MODE ? "same-origin" : "include",
      });
      if (!resp.ok) return null;
      const result = await resp.json();
      console.log(
        "🚚 Shipping:",
        result.shipping_charges,
        duplicatePid ? `(pid: ${duplicatePid})` : "(no pid)",
      );
      return { shippingCharges: result.shipping_charges, duplicatePid };
    } catch (e) {
      return null;
    }
  },

  // FAST Smart Search - Only show verified PID results
  smartSearch: async function (
    originalBlob,
    targetShipping,
    maxAttempts,
    onProgress,
    onFound,
    shouldStopFn,
  ) {
    console.log(
      `🎯 Smart Search: Target ≤ ₹${targetShipping}, Max: ${maxAttempts}`,
    );
    this.detectAllValues();

    const results = [];
    let bestResult = null;
    let attempt = 0;
    let noPidCount = 0;
    let uploadFailures = 0;
    const liveReady = this.isReady();
    const noSessionFailLimit = 5;

    while (attempt < maxAttempts) {
      if (shouldStopFn && shouldStopFn()) {
        console.log("⏹️ Stopped");
        break;
      }
      attempt++;
      if (onProgress)
        onProgress(attempt, maxAttempts, bestResult?.shippingCost, noPidCount);

      try {
        const variation = await this.generateVariation(originalBlob, attempt);
        const imageUrl = await this.uploadImage(
          variation.blob,
          `v${attempt}.jpg`,
        );
        if (!imageUrl) {
          uploadFailures++;
          if (!liveReady && uploadFailures >= noSessionFailLimit) {
            console.log(
              `⚠️ No Meesho session — stopping live API after ${noSessionFailLimit} failed uploads`,
            );
            break;
          }
          continue;
        }
        uploadFailures = 0;

        const priceData = await this.getShippingCharges(imageUrl);
        if (!priceData) continue;

        const pid = priceData.duplicatePid;
        const shipping = priceData.shippingCharges;

        // ONLY accept results WITH PID
        if (pid) {
          const result = {
            name: `Var-${attempt}`,
            dataUrl: variation.dataUrl,
            layers: variation.layers,
            pricingImageUrl: variation.pricingImageUrl || variation.dataUrl,
            shippingCost: shipping,
            duplicatePid: pid,
            isVerified: true,
          };
          results.push(result);
          console.log(`✅ [${attempt}] ₹${shipping} PID:${pid}`);

          if (!bestResult || shipping < bestResult.shippingCost) {
            bestResult = result;
            console.log(`⭐ Best: ₹${shipping}`);
          }

          if (shipping <= targetShipping) {
            console.log(`🎉 TARGET! ₹${shipping}`);
            if (onFound) onFound(result);
            break;
          }
        } else {
          noPidCount++;
          console.log(`⚠️ [${attempt}] No PID - skipped`);
        }

        await new Promise((r) => setTimeout(r, 20)); // Fast!
      } catch (e) {
        console.error(`[${attempt}]`, e.message);
      }
    }

    results.sort((a, b) => a.shippingCost - b.shippingCost);

    const resultLimit = Math.min(
      Math.max(parseInt(maxAttempts, 10) || this.MAX_RESULT_VARIANTS, 1),
      this.MAX_RESULT_VARIANTS,
    );

    return {
      success: results.length > 0,
      results: results.slice(0, resultLimit),
      bestResult,
      targetReached: bestResult?.shippingCost <= targetShipping,
      attempts: attempt,
      noPidCount,
      verifiedCount: results.length,
    };
  },

  // Generate variation with random border 20-80px and badges 50-200px
  generateVariationFull: async function (originalBlob, seed) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(originalBlob);
      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const w = img.width;
          const h = img.height;
          const quality = 0.75 + Math.random() * 0.15;

          const productCanvas = document.createElement("canvas");
          productCanvas.width = w;
          productCanvas.height = h;
          const productCtx = productCanvas.getContext("2d");
          productCtx.drawImage(img, 0, 0);
          const productOnly = productCanvas.toDataURL("image/jpeg", quality);

          const border = 20 + Math.floor(Math.random() * 60);
          const finalW = w + border * 2;
          const finalH = h + border * 2;

          const canvas = document.createElement("canvas");
          canvas.width = finalW;
          canvas.height = finalH;
          const ctx = canvas.getContext("2d");

          const colors = [
            "#e74c3c",
            "#3498db",
            "#2ecc71",
            "#f39c12",
            "#9b59b6",
            "#1abc9c",
            "#e67e22",
            "#16a085",
            "#ff5722",
            "#673ab7",
            "#4caf50",
            "#03a9f4",
            "#e91e63",
            "#8bc34a",
            "#ff9800",
            "#00bcd4",
          ];
          const c1 = colors[Math.floor(Math.random() * colors.length)];
          const c2 = colors[Math.floor(Math.random() * colors.length)];
          const gradType = Math.floor(Math.random() * 4);

          if (gradType === 0) {
            ctx.fillStyle = c1;
          } else {
            let grad;
            if (gradType === 1) grad = ctx.createLinearGradient(0, 0, finalW, 0);
            else if (gradType === 2)
              grad = ctx.createLinearGradient(0, 0, 0, finalH);
            else grad = ctx.createLinearGradient(0, 0, finalW, finalH);
            grad.addColorStop(0, c1);
            grad.addColorStop(1, c2);
            ctx.fillStyle = grad;
          }
          ctx.fillRect(0, 0, finalW, finalH);
          ctx.drawImage(img, border, border, w, h);

          const noStickersCanvas = document.createElement("canvas");
          noStickersCanvas.width = finalW;
          noStickersCanvas.height = finalH;
          const noStickersCtx = noStickersCanvas.getContext("2d");
          noStickersCtx.drawImage(canvas, 0, 0);

          if (typeof ImageGenerator !== "undefined" && ImageGenerator.drawText) {
            ImageGenerator.drawText(noStickersCtx, finalW, finalH, border);
          }
          this.addNoise(noStickersCtx, finalW, finalH, seed);
          const noStickers = noStickersCanvas.toDataURL("image/jpeg", quality);

          const badgeCount = 2 + Math.floor(Math.random() * 2);
          const badgePlacements = await this.addBadges(
            ctx,
            finalW,
            finalH,
            border,
            badgeCount,
          );

          if (typeof ImageGenerator !== "undefined" && ImageGenerator.drawText) {
            ImageGenerator.drawText(ctx, finalW, finalH, border);
          }
          this.addNoise(ctx, finalW, finalH, seed);
          const full = canvas.toDataURL("image/jpeg", quality);

          const noBorderCanvas = document.createElement("canvas");
          noBorderCanvas.width = w;
          noBorderCanvas.height = h;
          const noBorderCtx = noBorderCanvas.getContext("2d");
          noBorderCtx.drawImage(img, 0, 0);
          if (badgePlacements.length) {
            const shiftedPlacements = badgePlacements.map((p) => ({
              num: p.num,
              size: p.size,
              x: Math.max(0, p.x - border),
              y: Math.max(0, p.y - border),
            }));
            await this.addBadges(noBorderCtx, w, h, 0, 0, shiftedPlacements);
          }
          if (typeof ImageGenerator !== "undefined" && ImageGenerator.drawText) {
            ImageGenerator.drawText(noBorderCtx, w, h, 0);
          }
          this.addNoise(noBorderCtx, w, h, seed + 1);
          const noBorder = noBorderCanvas.toDataURL("image/jpeg", quality);

          canvas.toBlob(
            (blob) =>
              resolve({
                blob,
                dataUrl: full,
                pricingImageUrl: full,
                variantStyle: "standard",
                meta: { borderPx: border, badgeCount, style: "standard" },
                layers: {
                  full,
                  noStickers,
                  noBorder,
                  productOnly,
                },
              }),
            "image/jpeg",
            quality,
          );
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Load failed"));
      };
      img.src = objectUrl;
    });
  },

  // Low-shipping framed: thick blue outer + white mat + full-size product (screenshot style)
  compressCanvasToKb: async function (canvas, targetKb) {
    const targetBytes = targetKb * 1024;

    const encodeAt = (q) =>
      new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", q);
      });

    let lo = 0.18;
    let hi = 0.9;
    let best = null;
    for (let i = 0; i < 18; i++) {
      const q = (lo + hi) / 2;
      const blob = await encodeAt(q);
      if (!blob) break;
      if (blob.size <= targetBytes) {
        best = { blob, q };
        lo = q;
      } else {
        hi = q;
      }
    }

    if (!best || best.blob.size > targetBytes) {
      let q = best ? best.q : 0.45;
      for (; q >= 0.12; q -= 0.025) {
        const blob = await encodeAt(q);
        if (!blob) break;
        if (!best || blob.size < best.blob.size) best = { blob, q };
        if (blob.size <= targetBytes) break;
      }
    }

    if (!best) {
      const blob = await encodeAt(0.35);
      best = { blob, q: 0.35 };
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(best.blob);
    });
    return {
      blob: best.blob,
      dataUrl,
      quality: best.q,
      kb: Math.ceil(best.blob.size / 1024),
    };
  },

  isTallPortrait: function (img) {
    return img.height / img.width >= 1.2;
  },

  dataUrlFromCanvas: function (canvas, quality) {
    return canvas.toDataURL("image/jpeg", quality ?? 0.82);
  },

  normalizeProductSize: function (img, maxSide) {
    let w = img.width;
    let h = img.height;
    const cap = maxSide || 1200;
    if (Math.max(w, h) > cap) {
      const s = cap / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    return { w, h };
  },

  drawBlueProductFrame: function (ctx, px, py, dw, dh, lineRef) {
    const blues = ["#9ec5e8", "#add8e6", "#b8d4e8", "#a8cce8", "#7ec8e3"];
    ctx.strokeStyle = blues[Math.floor(Math.random() * blues.length)];
    ctx.lineWidth = Math.max(2, Math.round((lineRef || Math.min(dw, dh)) * 0.006));
    ctx.strokeRect(px - 1, py - 1, dw + 2, dh + 2);
  },

  addLowShippingBadges: async function (ctx, px, py, dw, dh, seed) {
    const badgeNums = [3, 7, 12, 15, 18, 22];
    const size = Math.max(56, Math.round(Math.min(dw, dh) * 0.14));
    const inset = Math.max(6, Math.round(size * 0.06));
    const slots = [
      { x: px + inset, y: py + inset },
      { x: px + dw - size - inset, y: py + inset },
      { x: px + inset, y: py + dh - size - inset },
    ];
    const placements = [];
    const used = new Set();
    for (let i = 0; i < 3; i++) {
      let num = badgeNums[(seed + i * 2) % badgeNums.length];
      while (used.has(num)) num = badgeNums[(num + 1) % badgeNums.length];
      used.add(num);
      const p = { num, size, x: slots[i].x, y: slots[i].y };
      placements.push(p);
      try {
        const badge = await this.loadBadge(num);
        if (badge) ctx.drawImage(badge, p.x, p.y, size, size);
      } catch (e) {}
    }
    return placements;
  },

  // Screenshot layout: [thick blue outer] → [white mat] → [full-size product + stickers]
  buildScreenshotFramedCanvas: function (img, profile, seed) {
    const isTallProfile =
      profile.layout === "tall" && this.isTallPortrait(img);
    let bluePct = profile.bluePct || 0.12;
    let whitePct = profile.whitePct || 0.04;
    if (isTallProfile) {
      bluePct = Math.min(0.22, bluePct * 1.06);
    }

    const { w, h } = this.normalizeProductSize(img, profile.maxSide || 1200);
    const minDim = Math.min(w, h);
    const blueOuter = Math.max(24, Math.round(minDim * bluePct));
    const whitePad = Math.max(10, Math.round(minDim * whitePct));
    const inset = blueOuter + whitePad;

    const finalW = w + inset * 2;
    const finalH = h + inset * 2;
    const canvas = document.createElement("canvas");
    canvas.width = finalW;
    canvas.height = finalH;
    const ctx = canvas.getContext("2d");

    const blues = ["#9ec5e8", "#add8e6", "#b8d4e8", "#a8cce8", "#7ec8e3"];
    ctx.fillStyle = blues[Math.abs(seed || 0) % blues.length];
    ctx.fillRect(0, 0, finalW, finalH);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(blueOuter, blueOuter, finalW - blueOuter * 2, finalH - blueOuter * 2);

    const px = inset;
    const py = inset;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, img.width, img.height, px, py, w, h);
    this.drawBlueProductFrame(ctx, px, py, w, h, minDim);

    return {
      canvas,
      px,
      py,
      dw: w,
      dh: h,
      layout: isTallProfile ? "tall" : "screenshot",
      blueOuter,
      whitePad,
    };
  },

  buildLowShippingFramedLayers: async function (img, profile, seed) {
    const built = this.buildScreenshotFramedCanvas(img, profile, seed);

    const { canvas, px, py, dw, dh } = built;
    const noStickersCanvas = document.createElement("canvas");
    noStickersCanvas.width = canvas.width;
    noStickersCanvas.height = canvas.height;
    noStickersCanvas.getContext("2d").drawImage(canvas, 0, 0);
    const noStickers = this.dataUrlFromCanvas(noStickersCanvas);

    const fullCtx = canvas.getContext("2d");
    const badgePlacements = await this.addLowShippingBadges(
      fullCtx,
      px,
      py,
      dw,
      dh,
      seed,
    );
    const full = this.dataUrlFromCanvas(canvas);

    const productOnlyCanvas = document.createElement("canvas");
    productOnlyCanvas.width = dw;
    productOnlyCanvas.height = dh;
    const pCtx = productOnlyCanvas.getContext("2d");
    pCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, dw, dh);
    const productOnly = this.dataUrlFromCanvas(productOnlyCanvas);

    const noBorderCanvas = document.createElement("canvas");
    noBorderCanvas.width = dw;
    noBorderCanvas.height = dh;
    const nbCtx = noBorderCanvas.getContext("2d");
    nbCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, dw, dh);
    if (badgePlacements.length) {
      const shifted = badgePlacements.map((p) => ({
        num: p.num,
        size: p.size,
        x: p.x - px,
        y: p.y - py,
      }));
      await this.addBadges(nbCtx, dw, dh, 0, 0, shifted);
    }
    const noBorder = this.dataUrlFromCanvas(noBorderCanvas);

    return {
      canvas,
      layers: { full, noStickers, noBorder, productOnly },
      meta: {
        layout: built.layout,
        profileId: profile.id,
        targetKb: profile.targetKb,
        bluePct: profile.bluePct,
        whitePct: profile.whitePct,
        maxSide: profile.maxSide,
        canvasW: canvas.width,
        canvasH: canvas.height,
        productW: dw,
        productH: dh,
        style: "framed_low",
      },
    };
  },

  generateFramedVariation: async function (originalBlob, seed, profile) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(originalBlob);
      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const profiles = this.LOW_SHIPPING_FRAMED_PROFILES;
          const chosen =
            profile ||
            profiles[Math.abs(seed) % profiles.length] ||
            profiles[0];

          const built = await this.buildLowShippingFramedLayers(
            img,
            chosen,
            seed,
          );
          const compressed = await this.compressCanvasToKb(
            built.canvas,
            chosen.targetKb,
          );
          built.layers.full = compressed.dataUrl;

          resolve({
            blob: compressed.blob,
            dataUrl: compressed.dataUrl,
            pricingImageUrl: compressed.dataUrl,
            variantStyle: "framed",
            meta: {
              ...built.meta,
              actualKb: compressed.kb,
              jpegQuality: compressed.quality,
            },
            layers: built.layers,
          });
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Load failed"));
      };
      img.src = objectUrl;
    });
  },

  resolveDisplayUrl: function (result) {
    if (!result) return "";
    const layers = result.layers;
    const flags = result.editFlags || {};
    if (!layers) {
      return (
        result.imageUrl ||
        result.dataUrl ||
        result.pricingImageUrl ||
        result.uploadedUrl ||
        ""
      );
    }

    const cleanProduct = !!(flags.cleanProduct || flags.borderRemoved);
    const borderOnlyRemoved = !!flags.borderOnlyRemoved;
    const stickersRemoved = !!flags.stickersRemoved;

    if (cleanProduct || (borderOnlyRemoved && stickersRemoved)) {
      return layers.productOnly || layers.full || result.pricingImageUrl || "";
    }
    if (borderOnlyRemoved && layers.noBorder) return layers.noBorder;
    if (stickersRemoved && layers.noStickers) return layers.noStickers;
    return layers.full || result.pricingImageUrl || result.imageUrl || "";
  },

  // Add badges 50-200px; pass placements to replay the same badges on another canvas
  addBadges: async function (ctx, w, h, border, count, placements) {
    if (placements?.length) {
      for (const p of placements) {
        try {
          const badge = await this.loadBadge(p.num);
          if (badge) ctx.drawImage(badge, p.x, p.y, p.size, p.size);
        } catch (e) {}
      }
      return placements;
    }

    const positions = [
      { x: border + 5, y: border + 5 },
      { x: w - border - 150, y: border + 5 },
      { x: border + 5, y: h - border - 150 },
      { x: w - border - 150, y: h - border - 150 },
    ];

    const drawn = [];
    const used = new Set();
    for (let i = 0; i < count && i < positions.length; i++) {
      let num;
      do {
        num = 1 + Math.floor(Math.random() * 25);
      } while (used.has(num));
      used.add(num);

      const size = 50 + Math.floor(Math.random() * 150);
      const x = positions[i].x;
      const y = positions[i].y;
      drawn.push({ num, size, x, y });
      try {
        const badge = await this.loadBadge(num);
        if (badge) ctx.drawImage(badge, x, y, size, size);
      } catch (e) {}
    }
    return drawn;
  },

  // Add noise
  addNoise: function (ctx, w, h, seed) {
    const data = ctx.getImageData(0, 0, w, h);
    const d = data.data;
    for (let i = 0; i < 50; i++) {
      const px = Math.floor(Math.random() * (d.length / 4)) * 4;
      d[px] = Math.min(
        255,
        Math.max(0, d[px] + Math.floor(Math.random() * 6) - 3),
      );
    }
    d[((Date.now() + seed) % (d.length / 4)) * 4] = seed % 256;
    ctx.putImageData(data, 0, 0);
  },

  loadBadge: async function (num) {
    if (this.badgeCache[num]) return this.badgeCache[num];
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        this.badgeCache[num] = img;
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = this.assetUrl("Badge/badge" + num + ".png");
    });
  },

  isReady: function () {
    this.detectAllValues();
    return this.cache.supplierId !== null;
  },

  // Web fallback: generate variants locally (no live API) using same canvas logic
  generateLocalVariations: async function (
    originalBlob,
    maxCount,
    onProgress,
    shouldStopFn,
  ) {
    const count = Math.min(
      Math.max(parseInt(maxCount, 10) || 20, 1),
      this.MAX_RESULT_VARIANTS,
    );

    if (typeof ImageGenerator !== "undefined" && ImageGenerator.preloadBadges) {
      await ImageGenerator.preloadBadges();
    }

    const results = [];

    for (let i = 1; i <= count; i++) {
      if (shouldStopFn && shouldStopFn()) break;
      if (onProgress) onProgress(i, count, null, 0);

      try {
        const variation = await this.generateVariation(originalBlob, i);
        if (!variation?.dataUrl) continue;
        results.push({
          name: "Var-" + i,
          dataUrl: variation.dataUrl,
          layers: variation.layers,
          pricingImageUrl: variation.pricingImageUrl || variation.dataUrl,
          variantStyle: variation.variantStyle || "standard",
          meta: variation.meta || null,
          shippingCost: 0,
          isVerified: false,
          localOnly: true,
        });
      } catch (e) {
        console.error("Variation", i, "failed:", e);
      }
    }

    const framedExtras = [];
    if (typeof window !== "undefined" && window.WEB_OPTIMIZER_MODE) {
      const profiles = this.LOW_SHIPPING_FRAMED_PROFILES;
      for (let i = 0; i < profiles.length; i++) {
        if (shouldStopFn && shouldStopFn()) break;
        try {
          const profile = profiles[i];
          const variation = await this.generateFramedVariation(
            originalBlob,
            30000 + i,
            profile,
          );
          if (!variation?.dataUrl) continue;
          framedExtras.push({
            name: profile.id.replace(/_/g, "-"),
            dataUrl: variation.dataUrl,
            layers: variation.layers,
            pricingImageUrl: variation.pricingImageUrl || variation.dataUrl,
            variantStyle: "framed",
            meta: variation.meta || null,
            shippingCost: 0,
            isVerified: false,
            localOnly: true,
          });
        } catch (e) {
          console.error("Framed variation", profiles[i]?.id, "failed:", e);
        }
      }
    }

    if (
      !results.length &&
      typeof ImageGenerator !== "undefined" &&
      ImageGenerator.generateVariations
    ) {
      try {
        const file = new File([originalBlob], "upload.jpg", {
          type: originalBlob.type || "image/jpeg",
        });
        const vars = await ImageGenerator.generateVariations(file, count);
        vars.forEach((v, idx) => {
          if (v?.dataUrl) {
            results.push({
              name: v.name || "Var-" + (idx + 1),
              dataUrl: v.dataUrl,
              shippingCost: 0,
              isVerified: false,
              localOnly: true,
            });
          }
        });
      } catch (e) {
        console.error("ImageGenerator fallback failed:", e);
      }
    }

    return {
      success: results.length > 0,
      results: results.slice(0, count),
      framedExtras,
      bestResult: results[0] || null,
      targetReached: false,
      attempts: results.length,
      verifiedCount: 0,
      localOnly: true,
    };
  },

  isValidCatalogPage: function () {
    return (
      window.location.href.includes("supplier.meesho.com") &&
      window.location.href.includes("/cataloging/")
    );
  },
};

window.MeeshoAPI = MeeshoAPI;

if (typeof MeeshoAPI.ensureEmbeddedCategories !== "function") {
  MeeshoAPI.ensureEmbeddedCategories = function () {
    const embedded = this.getEmbeddedCategories
      ? this.getEmbeddedCategories()
      : null;
    if (embedded?.length) {
      this.cache.categories = embedded;
      this._lastCategoryFetchWasEmbedded = true;
      return embedded;
    }
    return null;
  };
}
