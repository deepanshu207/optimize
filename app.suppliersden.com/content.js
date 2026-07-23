// Meesho Shipping Optimizer v6.0.0 - Main Entry Point

class MeeshoShippingOptimizer {
  constructor() {
    this.currentShippingCost = null;
    this.lastDetectedCost = null;
    this.isProcessing = false;
    this.shouldStop = false;
    this.currentResults = [];
    this.framedExtraResults = [];
    this.showFramedExtras = false;
    // Test Lab state — isolated from Live mode (currentResults / framedExtraResults)
    this.testLabResults = [];
    this.testLabAnalysis = null;
    this.testLabPhase2Meta = null;
    this.activeOptimizerTab = "live";
    this.variationCount = 6;
    this.isLicensed = false;
    this.originalImageUrl = null;
    this.modal = null;
    this.autoPopupShown = false;
    this.init();
  }

  init() {
    console.log("Initializing optimizer...");

    if (!window.WEB_OPTIMIZER_MODE) {
      // Listen for messages from popup
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Message received:", message);
        if (message.action === "openOptimizer") {
          this.checkLicense().then(() => {
            this.openModal();
          });
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
    await this.checkLicense();
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
    fab.style.cssText = `
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483647;
      background: linear-gradient(135deg, #FFD700, #C9A227);
      color: #fff;
      border: none;
      padding: 12px 16px;
      border-radius: 999px;
      font-weight: 700;
      font-family: 'Segoe UI', sans-serif;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      cursor: pointer;
    `;

    fab.onclick = () => this.openModal();

    document.documentElement.appendChild(fab);
  }

  async checkLicense() {
    if (window.WEB_OPTIMIZER_MODE) {
      this.isLicensed = true;
      return true;
    }

    try {
      // First check storage directly
      const result = await chrome.storage.sync.get([
        "licenseKey",
        "licenseStatus",
        "licenseInfo",
      ]);
      console.log("📋 License storage:", result);

      if (result.licenseStatus === "active" && result.licenseKey) {
        // Check expiry
        if (result.licenseInfo && result.licenseInfo.expiresAt) {
          const expiresAt = new Date(result.licenseInfo.expiresAt);
          if (new Date() > expiresAt) {
            console.log("⚠️ License expired");
            this.isLicensed = false;
            return false;
          }
        }

        this.isLicensed = true;
        console.log("✅ License active from storage");
        return true;
      }

      // Fallback to LicenseManager
      this.isLicensed = await LicenseManager.checkLicense();
      console.log("License status from LicenseManager:", this.isLicensed);
      return this.isLicensed;
    } catch (error) {
      console.error("License check error:", error);
      this.isLicensed = false;
      return false;
    }
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
                    <div style="font-size:11px;opacity:0.9;">${
                      this.isLicensed
                        ? "Click to optimize images"
                        : "Activate license to start"
                    }</div>
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
    const selectors = [
      "p.MuiTypography-root.MuiTypography-body1.css-v40lxd",
      '[class*="css-v40lxd"]',
      '[class*="shipping"] span',
      '[class*="Shipping"] span',
      'div[class*="shipping"]',
      'p[class*="shipping"]',
      'span[class*="shipping"]',
      ".MuiTypography-body1",
      ".MuiTypography-root",
    ];

    for (const sel of selectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const txt = el.textContent || "";
          if (
            (txt.toLowerCase().includes("shipping") ||
              txt.toLowerCase().includes("delivery") ||
              txt.toLowerCase().includes("charge")) &&
            txt.includes("₹")
          ) {
            const m = txt.match(/₹\s*(\d+)/);
            if (m) {
              const cost = parseInt(m[1]);
              if (cost > 0 && cost < 2000) {
                console.log("Shipping found:", cost);
                this.currentShippingCost = cost;
                return cost;
              }
            }
          }
        }
      } catch (e) {}
    }

    // Fallback search
    try {
      const allElements = document.querySelectorAll("p, span, div");
      for (const el of allElements) {
        const txt = el.textContent || "";
        if (txt.length < 100 && txt.includes("₹")) {
          const parent = el.parentElement;
          const parentText = parent ? parent.textContent.toLowerCase() : "";

          if (
            parentText.includes("shipping") ||
            parentText.includes("delivery")
          ) {
            const m = txt.match(/₹\s*(\d+)/);
            if (m) {
              const cost = parseInt(m[1]);
              if (cost > 0 && cost < 500) {
                this.currentShippingCost = cost;
                return cost;
              }
            }
          }
        }
      }
    } catch (e) {}

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
    this.testLabResults = [];
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
    document.querySelectorAll(".opt-section").forEach((s) => {
      s.style.display = "block";
    });

    this.setupMainEvents();

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

    // Always re-check license before opening modal
    if (!window.WEB_OPTIMIZER_MODE) {
      chrome.runtime.sendMessage({ type: "FORCE_LICENSE_CHECK" });
    }
    await this.checkLicense();
    console.log("Opening modal, license status:", this.isLicensed);

    if (window.WEB_OPTIMIZER_MODE && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.init();
    }

    const existing = document.getElementById("opt-modal");
    if (existing) existing.remove();

    this.modal = document.createElement("div");
    this.modal.id = "opt-modal";
    this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        `;

    const content = document.createElement("div");
    content.style.cssText =
      "max-width:480px;width:95%;max-height:90vh;overflow-y:auto;";
    content.innerHTML = OptimizerUI.createModalHTML(this.isLicensed);

    this.modal.appendChild(content);
    document.body.appendChild(this.modal);

    if (this.isLicensed) {
      this.setupMainEvents();
    } else {
      this.setupLicenseEvents();
    }

    this.modal.onclick = (e) => {
      if (e.target === this.modal) this.closeModal();
    };

    setTimeout(() => {
      this.detectShipping();
      const el = document.getElementById("current-shipping");
      if (el && this.currentShippingCost) {
        el.textContent = "₹" + this.currentShippingCost;
      }
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
    const webGenerateMode = window.WEB_OPTIMIZER_MODE && generateBtn;

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
      this._pendingFile = file;
      window.__webPendingFile = file;
      showFilePreview(file);

      const bootMsg = document.getElementById("boot-msg");
      const testGenBtn = document.getElementById("test-generate-btn");
      if (webGenerateMode) {
        generateBtn.disabled = false;
        if (testGenBtn) testGenBtn.disabled = false;
        if (bootMsg) {
          bootMsg.textContent =
            this.getActiveOptimizerTab() === "test"
              ? "Image ready — tap Run Test Lab"
              : "Image ready — tap Generate Variants";
        }
        this.setupOptimizerTabs();
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
    if (pending && webGenerateMode) {
      onFilePicked(pending);
    } else if (pending) {
      this._pendingFile = pending;
    }

    if (webGenerateMode) {
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

    // Web-only: Live vs Test Lab tabs (Test Lab must not alter Live handlers)
    if (window.WEB_OPTIMIZER_MODE) {
      this.setupOptimizerTabs();
      const phase2Cb = document.getElementById("test-lab-live-verify");
      if (phase2Cb && !phase2Cb.__wired) {
        phase2Cb.__wired = true;
        phase2Cb.addEventListener("change", () => this.refreshTestLabSessionHint());
      }
    }

    const categorySelect = document.getElementById("category-select");
    if (categorySelect) {
      categorySelect.onchange = () => {
        const categoryId = parseInt(categorySelect.value);
        if (categoryId && typeof MeeshoAPI !== "undefined") {
          MeeshoAPI.setCategory(categoryId);
          console.log("📁 Category:", categoryId);
        }
      };
    }
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
    categorySearch.placeholder = embedded
      ? `🔍 Search ${categories.length} categories…`
      : "🔍 Type to search category…";
    if (refreshBtn) refreshBtn.style.display = embedded ? "none" : "block";
    if (categoryError) categoryError.style.display = "none";

    categorySearch.onfocus = () => {
      this.renderCategoryDropdown(this.allCategories.slice(0, 50));
      categoryDropdown.style.display = "block";
    };

    categorySearch.oninput = () => {
      const query = categorySearch.value.toLowerCase().trim();
      if (categoryClear) categoryClear.style.display = query ? "block" : "none";

      if (query.length === 0) {
        this.renderCategoryDropdown(this.allCategories.slice(0, 50));
      } else {
        const filtered = this.allCategories
          .filter(
            (cat) =>
              cat.name.toLowerCase().includes(query) ||
              (cat.parentName || "").toLowerCase().includes(query)
          )
          .slice(0, 30);
        this.renderCategoryDropdown(filtered);
      }
      categoryDropdown.style.display = "block";
    };

    if (categoryClear) {
      categoryClear.onclick = () => {
        categorySearch.value = "";
        categoryClear.style.display = "none";
        if (categorySelect) categorySelect.value = "";
        if (selectedCategory) selectedCategory.style.display = "none";
        if (typeof MeeshoAPI !== "undefined") MeeshoAPI.setCategory(null);
        this.renderCategoryDropdown(this.allCategories.slice(0, 50));
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
    }
    return true;
  }

  renderCategoryDropdown(categories) {
    const dropdown = document.getElementById("category-dropdown");
    if (!dropdown) return;

    if (!categories?.length) {
      dropdown.innerHTML =
        '<div style="padding:12px;color:#2c2c2f;font-size:12px;">No matching categories</div>';
      return;
    }

    let html = "";
    categories.forEach((cat) => {
      const parent = cat.parentName || "";
      html += `
                <div class="cat-item" data-id="${cat.id}" data-name="${cat.name}" data-parent="${parent}" 
                     style="padding:10px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;transition:background 0.2s;">
                    <div style="color:#2c2c2f;">${cat.name}</div>
                    <div style="font-size:10px;color:#131415;">${parent}</div>
                </div>
            `;
    });
    dropdown.innerHTML = html;

    dropdown.querySelectorAll(".cat-item").forEach((item) => {
      item.onmouseenter = () =>
        (item.style.background = "rgba(102,126,234,0.2)");
      item.onmouseleave = () => (item.style.background = "transparent");
      item.onclick = () => {
        const id = item.dataset.id;
        const name = item.dataset.name;
        const parent = item.dataset.parent;

        const categorySelect = document.getElementById("category-select");
        const categorySearch = document.getElementById("category-search");
        const selectedCategory = document.getElementById("selected-category");
        const selectedCategoryName = document.getElementById(
          "selected-category-name"
        );
        const categoryClear = document.getElementById("category-clear");
        const categoryDropdown = document.getElementById("category-dropdown");

        if (categorySelect) categorySelect.value = id;
        if (categorySearch) categorySearch.value = name;
        if (selectedCategory) selectedCategory.style.display = "block";
        if (selectedCategoryName) {
          selectedCategoryName.textContent = parent
            ? `${name} (${parent})`
            : name;
        }
        if (categoryDropdown) categoryDropdown.style.display = "none";
        if (categoryClear) categoryClear.style.display = "block";

        if (typeof MeeshoAPI !== "undefined") {
          MeeshoAPI.setCategory(parseInt(id, 10));
        }
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
        await this.loadCategoryDropdown();
        refreshBtn.textContent = "🔄 Refresh";
      };
    }

    categorySearch.placeholder = "Loading categories...";

    if (typeof MeeshoAPI !== "undefined") {
      const instant = this.safeEnsureEmbeddedCategories();
      if (instant?.length && this.bindCategoryUI(instant)) return;
    }

    try {
      const categories = await MeeshoAPI.fetchCategories();

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

  applyDefaultCategoryIfNeeded() {
    const categorySelect = document.getElementById("category-select");
    if (!categorySelect || categorySelect.value || !this.allCategories?.length) return;

    const defId =
      typeof MeeshoCategories !== "undefined"
        ? MeeshoCategories.getDefaultCategoryId()
        : 10004;
    const def =
      this.allCategories.find((c) => c.id === defId) || this.allCategories[0];
    if (!def) return;

    categorySelect.value = String(def.id);
    const categorySearch = document.getElementById("category-search");
    const selectedCategory = document.getElementById("selected-category");
    const selectedCategoryName = document.getElementById(
      "selected-category-name"
    );
    if (categorySearch) categorySearch.value = def.name;
    if (selectedCategory) selectedCategory.style.display = "block";
    if (selectedCategoryName) {
      selectedCategoryName.textContent = `${def.name} (${def.parentName})`;
    }
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(def.id);
    }
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
      ImageGenerator.preloadBadges();
    }

    // Set category in MeeshoAPI
    const categorySelect = document.getElementById("category-select");
    if (
      categorySelect &&
      categorySelect.value &&
      typeof MeeshoAPI !== "undefined"
    ) {
      MeeshoAPI.setCategory(parseInt(categorySelect.value));
    }
  }

  // ─── Optimizer tabs (WEB only) ───────────────────────────────────────────
  // Live tab → processImage() — production path, unchanged below.
  // Test Lab tab → processImageTestLab() — isolated experiments only.

  getActiveOptimizerTab() {
    if (!window.WEB_OPTIMIZER_MODE) return "live";
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
        this.preloadTestLabModule();
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
    const phase2On = !!document.getElementById("test-lab-live-verify")?.checked;
    const sessionReady =
      typeof MeeshoAPI !== "undefined" && MeeshoAPI.isReady?.();
    let msg = "";
    if (window.TestLabOptimizer?.getSessionGuidance) {
      msg = window.TestLabOptimizer.getSessionGuidance(sessionReady, phase2On);
    } else if (phase2On && !sessionReady) {
      msg =
        "Add Supplier ID + Browser ID on Live tab to unlock Phase 2 live ₹ hunt.";
    } else if (sessionReady && phase2On) {
      msg = "Session ready — Phase 2 will live-check Meesho prices.";
    }
    if (msg) {
      el.textContent = msg;
      el.style.display = "block";
      el.className = sessionReady
        ? "session-hint session-status ok"
        : "session-hint session-status warn";
    } else {
      el.style.display = "none";
    }
  }

  async preloadTestLabModule() {
    if (window.TestLabOptimizer?.runTestLab) return true;
    if (!window.__testLabModulePromise) {
      window.__testLabModulePromise = (async () => {
        try {
          await import("/js/testLabBridge.mjs?v=23");
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

    if (this.activeOptimizerTab === "test" && this.testLabResults.length) {
      resultsArea.style.display = "block";
      resultsArea.dataset.view = "test";
      resultsArea.innerHTML = OptimizerUI.getTestLabResultsHTML(
        this.testLabResults,
        {
          analysis: this.testLabAnalysis,
          baselineShipping: this.getBaselineShipping(),
          phase2: this.testLabPhase2Meta,
        }
      );
      this.setupResultsEvents();
      this.wireTestLabImageFallbacks();
      return;
    }

    if (this.activeOptimizerTab === "live" && this.currentResults.length) {
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
    this.setTestLabChromeVisible(true);
    const resultsArea = document.getElementById("results-area");
    if (resultsArea) {
      resultsArea.style.display = "none";
      resultsArea.innerHTML = "";
      delete resultsArea.dataset.view;
    }
    const testResultsArea = document.getElementById("test-results-area");
    if (testResultsArea) {
      testResultsArea.style.display = "none";
      testResultsArea.innerHTML = "";
    }
    const previewBox = document.getElementById("preview-box");
    const previewImg = document.getElementById("preview-img");
    const uploadArea = document.getElementById("upload-area");
    const generateBtn = document.getElementById("generate-btn");
    const testGenBtn = document.getElementById("test-generate-btn");
    const hasFile =
      this._pendingFile ||
      window.__webPendingFile ||
      document.getElementById("image-input")?.files?.[0];

    if (uploadArea) {
      uploadArea.style.display = hasFile ? "none" : "block";
    }
    if (previewBox && previewImg && this.originalImageUrl) {
      previewImg.src = this.originalImageUrl;
      previewBox.style.display = "block";
    }
    document.querySelectorAll(".opt-section").forEach((s) => {
      s.style.display = "block";
    });
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
  }

  getTestLabOptions() {
    const mode =
      document.getElementById("test-lab-mode")?.value || "smart";
    const category =
      document.getElementById("test-lab-category")?.value || "auto";
    const targetRaw = document.getElementById("test-lab-target")?.value;
    const borderColor =
      document.getElementById("test-lab-border")?.value || "#ff7900";
    const categoryName =
      document.getElementById("selected-category-name")?.textContent?.trim() ||
      "";
    const sscatId = parseInt(
      document.getElementById("category-select")?.value,
      10
    );
    const sessionReady =
      typeof MeeshoAPI !== "undefined" && MeeshoAPI.isReady?.();
    const liveCheckbox = document.getElementById("test-lab-live-verify");

    return {
      mode,
      category,
      categoryName,
      sscatId: Number.isFinite(sscatId) ? sscatId : null,
      targetInr: targetRaw ? parseInt(targetRaw, 10) : null,
      borderColor,
      liveVerify: liveCheckbox ? !!liveCheckbox.checked : !!sessionReady,
      phase2Live: liveCheckbox ? !!liveCheckbox.checked : !!sessionReady,
      maxLiveVerify: 16,
    };
  }

  /**
   * TEST LAB ONLY — does not call processImage or MeeshoAPI.generateLocalVariations.
   */
  async processImageTestLab(file) {
    if (!file) {
      OptimizerUtils.showNotification("Choose an image first", "error");
      return;
    }
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.shouldStop = false;
    this.testLabResults = [];
    this.testLabAnalysis = null;
    this.testLabPhase2Meta = null;

    try {
      await this.ensureOriginalImageUrl(file);
    } catch (e) {
      console.warn("Test Lab preview:", e);
    }

    const uploadArea = document.getElementById("upload-area");
    const sections = document.querySelectorAll(".opt-section");
    const processingArea = document.getElementById("processing-area");
    const resultsArea = document.getElementById("results-area");
    const testResultsArea = document.getElementById("test-results-area");
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
      delete resultsArea.dataset.view;
    }
    if (testResultsArea) {
      testResultsArea.style.display = "none";
      testResultsArea.innerHTML = "";
    }

    if (processingArea) {
      processingArea.style.display = "block";
      processingArea.innerHTML = `
        <div style="text-align:center;padding:20px;">
          <div style="font-size:40px;margin-bottom:8px;">🧪</div>
          <h3 style="margin:0 0 8px;color:#047857;">Test Lab running…</h3>
          <p id="test-lab-progress" style="font-size:12px;color:#666;">Loading strategy module…</p>
        </div>`;
    }

    const setProgress = (msg) => {
      const el = document.getElementById("test-lab-progress");
      if (el) el.textContent = msg;
    };

    try {
      const ready = await this.waitForTestLabReady();
      if (!ready || !window.TestLabOptimizer?.runTestLab) {
        const detail =
          window.__testLabLoadError?.message ||
          (window.__testLabReady
            ? "module loaded without runTestLab"
            : "timed out waiting for module");
        throw new Error(
          `Test Lab module failed to load (${detail}) — hard refresh (Ctrl+Shift+R)`
        );
      }

      this.gatherSettings();
      const opts = this.getTestLabOptions();

      const result = await window.TestLabOptimizer.runTestLab(file, {
        ...opts,
        // Keep full candidate pool when Phase 2 will live-verify (est filter can hide winners)
        targetInr: opts.phase2Live ? null : opts.targetInr,
        onProgress: (msg) => {
          if (!this.shouldStop) setProgress(msg);
        },
      });

      if (this.shouldStop) {
        OptimizerUtils.showNotification("Test Lab stopped", "info");
        this.restoreTestLabFormUi();
        this.isProcessing = false;
        return;
      }

      let rawResults = result.results || [];

      if ((opts.liveVerify || opts.phase2Live) && rawResults.length) {
        if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.isReady?.()) {
          if (window.TestLabOptimizer.runPhase2LiveHunt) {
            setProgress("Phase 2: hunting lowest live ₹ on Meesho…");
            const phase2 = await window.TestLabOptimizer.runPhase2LiveHunt(
              file,
              rawResults,
              {
                sscatId: opts.sscatId,
                targetInr: opts.targetInr,
                maxVerify: opts.maxLiveVerify || 16,
                onProgress: (msg) => {
                  if (!this.shouldStop) setProgress(msg);
                },
              }
            );
            rawResults = phase2.results || rawResults;
            this.testLabPhase2Meta = {
              framedCount: phase2.framedCount || 0,
              verifiedCount: phase2.verifiedCount || 0,
              bestLive: phase2.bestLive,
              errors: phase2.errors || [],
            };
            if (phase2.bestLive?.shippingCost) {
              OptimizerUtils.showNotification(
                `Phase 2 best live: ₹${phase2.bestLive.shippingCost} (${phase2.bestLive.name})${
                  phase2.targetReached ? " — target hit!" : ""
                }`,
                "success"
              );
            } else if (phase2.errors?.length) {
              OptimizerUtils.showNotification(
                "Live hunt partial — " + phase2.errors[0],
                "info"
              );
            }
          } else {
            setProgress("Live Meesho check…");
            await window.TestLabOptimizer.verifyTestLabLive(
              rawResults,
              opts.maxLiveVerify || 10,
              setProgress,
              { sscatId: opts.sscatId }
            );
            rawResults.sort(
              (a, b) =>
                (a.shippingCost || a.estShipping || 999) -
                (b.shippingCost || b.estShipping || 999)
            );
          }
        } else {
          OptimizerUtils.showNotification(
            "Phase 2 skipped — add Meesho session (Supplier ID + Browser ID)",
            "info"
          );
        }
      }

      this.testLabResults = rawResults.map((r, i) =>
        this.mapResultFromApi(r, i)
      );
      this.testLabAnalysis = result.analysis || null;

      const analysisEl = document.getElementById("test-lab-analysis");
      if (analysisEl && this.testLabAnalysis) {
        const a = this.testLabAnalysis;
        const tips = (a.smartPlan?.tips || a.smartTips || []).slice(0, 2);
        analysisEl.style.display = "block";
        analysisEl.innerHTML = `
          <strong>Smart Auto plan:</strong> ${a.smartPlan?.summary || a.suggested || "studio compress"}<br>
          <span style="font-size:10px;color:#666;">${a.width}×${a.height}px · ${
          a.studioBg ? "studio bg" : "busy bg"
        } · ${a.tall ? "tall" : "standard"} · <strong>${
          a.resolvedCategory || a.category
        }</strong></span>
          ${
            tips.length
              ? `<br><span style="font-size:10px;color:#047857;">${tips.join(" ")}</span>`
              : ""
          }`;
      }
      this.refreshTestLabSessionHint();

      if (this.testLabResults.length) {
        const liveCount = this.testLabResults.filter(
          (r) => r.shippingCost > 0
        ).length;
        const best = this.testLabResults[0];
        const bestLabel =
          best.shippingCost > 0
            ? `₹${best.shippingCost} live`
            : `est ₹${best.estShipping || best.meta?.estInr || "?"}`;
        OptimizerUtils.showNotification(
          `Test Lab: ${this.testLabResults.length} variants · best ${bestLabel}${
            liveCount ? ` · ${liveCount} live checked` : ""
          }`,
          "success"
        );
      } else {
        OptimizerUtils.showNotification(
          "No Test Lab variants — try another mode or category",
          "error"
        );
      }
    } catch (err) {
      console.error("Test Lab error:", err);
      OptimizerUtils.showNotification("Test Lab: " + err.message, "error");
    }

    if (processingArea) processingArea.style.display = "none";

    if (this.testLabResults.length && resultsArea) {
      if (testResultsArea) {
        testResultsArea.style.display = "none";
        testResultsArea.innerHTML = "";
      }
      resultsArea.style.display = "block";
      resultsArea.dataset.view = "test";
      resultsArea.innerHTML = OptimizerUI.getTestLabResultsHTML(
        this.testLabResults,
        {
          analysis: this.testLabAnalysis,
          baselineShipping: this.getBaselineShipping(),
          phase2: this.testLabPhase2Meta,
        }
      );
      this.setupResultsEvents();
      this.wireTestLabImageFallbacks();
    } else {
      this.restoreTestLabFormUi();
    }

    this.isProcessing = false;
  }

  // LIVE MODE ONLY — production generate path. Test Lab uses processImageTestLab().
  async processImage(file) {
    if (!file) {
      OptimizerUtils.showNotification("Choose an image first", "error");
      return;
    }

    if (window.WEB_OPTIMIZER_MODE) {
      this.isLicensed = true;
    } else if (!this.isLicensed) {
      OptimizerUtils.showNotification("License required", "error");
      return;
    }

    if (this.isProcessing) return;

    // Sync session + category before generation
    if (window.WEB_OPTIMIZER_MODE && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.syncFromSession?.();
    }

    const categorySelect = document.getElementById("category-select");
    const manualMode = this.isManualShippingMode();
    const needsCategoryForLiveApi =
      !window.WEB_OPTIMIZER_MODE && !manualMode && typeof MeeshoAPI !== "undefined";

    if (categorySelect?.value && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(parseInt(categorySelect.value, 10));
    } else if (needsCategoryForLiveApi) {
      const defId =
        typeof MeeshoCategories !== "undefined"
          ? MeeshoCategories.getDefaultCategoryId()
          : 10004;
      if (defId) {
        MeeshoAPI.setCategory(defId);
      } else {
        OptimizerUtils.showNotification(
          "Select a category for live Meesho shipping checks",
          "error"
        );
        return;
      }
    }

    this.isProcessing = true;
    this.shouldStop = false;
    this.currentResults = [];
    this.framedExtraResults = [];
    this.showFramedExtras = false;

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
            `Stopped. Best: ₹${result.bestResult.shippingCost}`,
            "info"
          );
        } else {
          OptimizerUtils.showNotification(
            `✅ Best: ₹${result.bestResult.shippingCost} (${result.verifiedCount} verified)`,
            "info"
          );
        }
      } else if (!window.WEB_OPTIMIZER_MODE) {
        OptimizerUtils.showNotification(
          `⚠️ No verified prices found. Try different image.`,
          "error"
        );
      }
    } catch (err) {
      console.error("❌ Error:", err);
      OptimizerUtils.showNotification("Error: " + err.message, "error");
    }

    // Show results
    const resultsArea = document.getElementById("results-area");
    if (processingArea) processingArea.style.display = "none";

    if (this.currentResults.length > 0) {
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

  // Smart Mode HTML - Enhanced
  getSmartModeHTML(
    attempt,
    maxAttempts,
    target,
    bestSoFar,
    noPidCount = 0,
    elapsedTime = 0
  ) {
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
                <h3 style="margin:0 0 5px 0;color:#10b981;font-size:18px;">AI Is Finding Best Shipping</h3>
                <p style="color:##0f0f10;font-size:14px;margin-bottom:3px;">Target: ≤ ₹${target}</p>
                <p style="color:#9ca3af;font-size:11px;margin-bottom:5px;">${attempt} / ${maxAttempts}${
      noPidCount > 0 ? ` • ${noPidCount} skipped` : ""
    }</p>
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
                            : '<div style="font-size:10px;color:#10b981;margin-top:3px;font-weight:300;">✅ Accurate Price</div>'
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
    return parseInt(el?.value, 10) || 0;
  }

  getResultsViewOptions() {
    return {
      manualMode: this.isManualShippingMode(),
      baselineShipping: this.getBaselineShipping(),
      framedExtras: this.framedExtraResults,
      showFramedExtras: this.showFramedExtras,
    };
  }

  isVariantEdited(editFlags) {
    if (!editFlags) return false;
    return !!(
      editFlags.stickersRemoved ||
      editFlags.borderOnlyRemoved ||
      editFlags.cleanProduct ||
      editFlags.borderRemoved
    );
  }

  normalizeEditFlags(editFlags) {
    const flags = editFlags || {};
    const cleanProduct = !!(flags.cleanProduct || flags.borderRemoved);
    return {
      stickersRemoved: cleanProduct ? false : !!flags.stickersRemoved,
      borderOnlyRemoved: cleanProduct ? false : !!flags.borderOnlyRemoved,
      cleanProduct,
    };
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
      testLab: !!r.testLab,
    };
    row.imageUrl =
      typeof MeeshoAPI !== "undefined" && MeeshoAPI.resolveDisplayUrl
        ? MeeshoAPI.resolveDisplayUrl(row) || pricingImageUrl
        : pricingImageUrl;
    return row;
  }

  isTestLabResultsActive() {
    const resultsArea = document.getElementById("results-area");
    return !!(
      this.testLabResults.length &&
      resultsArea?.style.display === "block" &&
      resultsArea?.dataset?.view === "test"
    );
  }

  getActiveResultList() {
    if (this.isTestLabResultsActive()) return this.testLabResults;
    return this.currentResults;
  }

  getBestActiveResult() {
    const list = this.getActiveResultList();
    return list[0] || null;
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
      this.testLabResults.find((r) => r.variantId === variantId) ||
      null
    );
  }

  setVariantEdits(variantId, editFlags) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    row.editFlags = this.normalizeEditFlags(editFlags);
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.resolveDisplayUrl) {
      row.imageUrl = MeeshoAPI.resolveDisplayUrl(row);
    }

    if (this._editingVariantId === variantId) {
      this.renderVariantEditorPanel(row);
    } else {
      this.refreshVariantCard(row);
    }
  }

  refreshVariantCard(row) {
    const img = document.querySelector(
      `.result-img[data-variant-id="${row.variantId}"]`
    );
    if (img) img.src = row.imageUrl;
    const badge = document.querySelector(
      `.result-edit-badge[data-variant-id="${row.variantId}"]`
    );
    if (badge) {
      const edited = this.isVariantEdited(row.editFlags);
      badge.style.display = edited ? "block" : "none";
    }
  }

  closeVariantEditor() {
    const panel = document.getElementById("variant-edit-panel");
    if (panel) panel.style.display = "none";
    this._editingVariantId = null;
  }

  renderVariantEditorPanel(row) {
    const panel = document.getElementById("variant-edit-panel");
    if (!panel || !row) return;

    const preview = panel.querySelector("#variant-edit-preview");
    const stickerCb = panel.querySelector("#variant-edit-no-stickers");
    const borderOnlyCb = panel.querySelector("#variant-edit-border-only");
    const cleanCb = panel.querySelector("#variant-edit-clean-product");
    const borderOnlyNote = panel.querySelector("#variant-edit-border-only-note");
    const priceNote = panel.querySelector("#variant-edit-price-note");
    const title = panel.querySelector("#variant-edit-title");

    const flags = this.normalizeEditFlags(row.editFlags);
    const hasNoBorder = !!row.layers?.noBorder;

    if (preview) preview.src = row.imageUrl;
    if (stickerCb) stickerCb.checked = !!flags.stickersRemoved;
    if (borderOnlyCb) {
      borderOnlyCb.checked = !!flags.borderOnlyRemoved;
      borderOnlyCb.disabled = !hasNoBorder;
    }
    if (cleanCb) cleanCb.checked = !!flags.cleanProduct;
    if (borderOnlyNote) {
      borderOnlyNote.style.display = hasNoBorder ? "none" : "block";
    }
    if (title) title.textContent = row.name || "Variant";
    if (priceNote) {
      priceNote.textContent =
        row.shippingCost > 0
          ? `Shipping ₹${row.shippingCost} is unchanged — you tested the bordered version on Meesho.`
          : "Shipping price is unchanged — this only affects the image you download.";
    }
  }

  ensureVariantEditorPanel() {
    let panel = document.getElementById("variant-edit-panel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "variant-edit-panel";
    panel.style.cssText =
      "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100000;align-items:center;justify-content:center;padding:16px;";
    panel.innerHTML = `
      <div style="background:#fff;border-radius:12px;max-width:360px;width:100%;padding:16px;box-shadow:0 20px 40px rgba(0,0,0,0.25);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <strong id="variant-edit-title" style="font-size:15px;">Variant</strong>
          <button type="button" id="variant-edit-close" style="border:none;background:#f3f4f6;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
        </div>
        <img id="variant-edit-preview" alt="Preview" style="width:100%;max-height:220px;object-fit:contain;border-radius:8px;background:#f9fafb;margin-bottom:12px;">
        <p id="variant-edit-price-note" style="font-size:11px;color:#047857;background:#ecfdf5;padding:8px;border-radius:6px;margin-bottom:12px;"></p>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer;">
          <input type="checkbox" id="variant-edit-no-stickers" style="width:18px;height:18px;">
          Remove stickers / badges only
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px;cursor:pointer;">
          <input type="checkbox" id="variant-edit-border-only" style="width:18px;height:18px;">
          Remove border only (keep stickers)
        </label>
        <p id="variant-edit-border-only-note" style="display:none;font-size:10px;color:#b45309;background:#fffbeb;padding:6px 8px;border-radius:6px;margin-bottom:8px;">Regenerate variants to use border-only removal.</p>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px;cursor:pointer;">
          <input type="checkbox" id="variant-edit-clean-product" style="width:18px;height:18px;">
          Remove border and stickers (clean product)
        </label>
        <p style="font-size:10px;color:#6b7280;margin-bottom:12px;">Tip: Test shipping on Meesho using the original bordered image. These options only change the image you download — your entered ₹ stays the same.</p>
        <button type="button" id="variant-edit-done" class="generate-btn" style="width:100%;padding:12px;">Done</button>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector("#variant-edit-close").onclick = () =>
      this.closeVariantEditor();
    panel.querySelector("#variant-edit-done").onclick = () =>
      this.closeVariantEditor();
    panel.onclick = (e) => {
      if (e.target === panel) this.closeVariantEditor();
    };

    const onEditChange = (ev) => {
      const id = this._editingVariantId;
      if (!id) return;

      const stickerCb = panel.querySelector("#variant-edit-no-stickers");
      const borderOnlyCb = panel.querySelector("#variant-edit-border-only");
      const cleanCb = panel.querySelector("#variant-edit-clean-product");
      const target = ev?.target;

      if (target === cleanCb && cleanCb.checked) {
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
      } else if (
        (target === stickerCb || target === borderOnlyCb) &&
        stickerCb.checked &&
        borderOnlyCb.checked
      ) {
        cleanCb.checked = true;
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
      } else if (
        cleanCb.checked &&
        (target === stickerCb || target === borderOnlyCb)
      ) {
        cleanCb.checked = false;
      }

      this.setVariantEdits(id, {
        stickersRemoved: stickerCb.checked,
        borderOnlyRemoved: borderOnlyCb.checked,
        cleanProduct: cleanCb.checked,
      });
    };
    panel.querySelector("#variant-edit-no-stickers").onchange = onEditChange;
    panel.querySelector("#variant-edit-border-only").onchange = onEditChange;
    panel.querySelector("#variant-edit-clean-product").onchange = onEditChange;

    return panel;
  }

  openVariantEditor(variantId) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) {
      OptimizerUtils.showNotification(
        "Layer edit not available for this variant",
        "info"
      );
      return;
    }
    this._editingVariantId = variantId;
    this.ensureVariantEditorPanel();
    this.renderVariantEditorPanel(row);
    document.getElementById("variant-edit-panel").style.display = "flex";
  }

  refreshResultsView() {
    const resultsArea = document.getElementById("results-area");
    if (!resultsArea || !this.currentResults.length) return;
    resultsArea.innerHTML = OptimizerUI.getResultsHTML(
      this.currentResults,
      this.getResultsViewOptions()
    );
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
        if (this.isTestLabResultsActive()) {
          const row = this.findResultRow(variantId);
          if (row) this.openTestLabImagePreview(row);
          return;
        }
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
        this.showFramedExtras = !this.showFramedExtras;
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

    const restartBtn = document.getElementById("restart-btn");
    if (restartBtn) {
      restartBtn.onclick = () => {
        if (this.isTestLabResultsActive()) {
          this.testLabResults = [];
          this.restoreTestLabFormUi();
          return;
        }
        if (window.WEB_OPTIMIZER_MODE && this.embeddedRoot) {
          this.mountEmbedded(this.embeddedRoot);
        } else {
          this.closeModal();
          setTimeout(() => this.openModal(), 200);
        }
      };
    }
  }

  async downloadImage(result) {
    if (!result) {
      OptimizerUtils.showNotification("Could not find image to download", "error");
      return;
    }

    const name = (result.name || "variant").replace(/\s+/g, "-");
    const filename = "meesho-" + name + "-" + Date.now() + ".jpg";
    const url = this.resolveDownloadUrl(result);

    if (!url) {
      OptimizerUtils.showNotification(
        "No image data for " + (result.name || "variant"),
        "error"
      );
      return;
    }

    try {
      let blob = result.blob instanceof Blob ? result.blob : null;
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
