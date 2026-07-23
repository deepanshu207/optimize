// Meesho Shipping Optimizer v6.0.0 - Main Entry Point

class MeeshoShippingOptimizer {
  constructor() {
    this.currentShippingCost = null;
    this.lastDetectedCost = null;
    this.isProcessing = false;
    this.shouldStop = false;
    this.currentResults = [];
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
    const generateBtn = document.getElementById("generate-btn");
    const uploadArea = document.getElementById("upload-area");
    if (processingArea) processingArea.style.display = "none";
    if (resultsArea) resultsArea.style.display = "none";
    if (uploadArea) uploadArea.style.display = "block";
    if (generateBtn) generateBtn.style.display = "block";
    document.querySelectorAll(".opt-section").forEach((s) => {
      s.style.display = "block";
    });

    this.setupMainEvents();

    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.init();
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

    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.syncFromSession();
    }
    if (window.WEB_OPTIMIZER_MODE && typeof WebSession !== "undefined") {
      WebSession.wireForm();
    }
    this.loadCategoryDropdown();

    // Category selection
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

    // Badge positions - simplified (always random)

    // File input
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
      };
      reader.readAsDataURL(file);
    };

    const getUploadFile = () => {
      if (fileInput?.files?.[0]) return fileInput.files[0];
      return this._pendingFile || null;
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
      showFilePreview(file);

      const bootMsg = document.getElementById("boot-msg");
      if (webGenerateMode) {
        generateBtn.disabled = false;
        if (bootMsg) bootMsg.textContent = "Image ready — tap Generate Variants";
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
        this.processImage(file);
      };

      generateBtn.disabled = !getUploadFile();
      generateBtn.onclick = runGenerate;
      generateBtn.addEventListener(
        "touchend",
        (e) => {
          e.preventDefault();
          runGenerate(e);
        },
        { passive: false }
      );
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
  }

  // Load categories into dropdown
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

    try {
      const categories = await MeeshoAPI.fetchCategories();

      if (categories && categories.length > 0) {
        this.allCategories = categories;
        categorySearch.placeholder = "🔍 Type to search category...";
        if (refreshBtn) refreshBtn.style.display = "none";
        if (categoryError) categoryError.style.display = "none";

        // Show dropdown on focus
        categorySearch.onfocus = () => {
          this.renderCategoryDropdown(this.allCategories.slice(0, 50));
          categoryDropdown.style.display = "block";
        };

        // Search on input
        categorySearch.oninput = () => {
          const query = categorySearch.value.toLowerCase().trim();
          categoryClear.style.display = query ? "block" : "none";

          if (query.length === 0) {
            this.renderCategoryDropdown(this.allCategories.slice(0, 50));
          } else {
            const filtered = this.allCategories
              .filter(
                (cat) =>
                  cat.name.toLowerCase().includes(query) ||
                  cat.parentName.toLowerCase().includes(query)
              )
              .slice(0, 30);
            this.renderCategoryDropdown(filtered);
          }
          categoryDropdown.style.display = "block";
        };

        // Clear button
        if (categoryClear) {
          categoryClear.onclick = () => {
            categorySearch.value = "";
            categoryClear.style.display = "none";
            categorySelect.value = "";
            selectedCategory.style.display = "none";
            this.renderCategoryDropdown(this.allCategories.slice(0, 50));
          };
        }

        // Hide dropdown on click outside
        document.addEventListener("click", (e) => {
          if (
            !e.target.closest("#category-search") &&
            !e.target.closest("#category-dropdown")
          ) {
            categoryDropdown.style.display = "none";
          }
        });

        console.log("✅ Loaded", categories.length, "categories");
        this.applyDefaultCategoryIfNeeded();
      } else {
        categorySearch.placeholder = "Not loaded (login/session) - Click Refresh";
        if (refreshBtn) refreshBtn.style.display = "block";
        if (categoryError) categoryError.style.display = "block";
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
      categorySearch.placeholder = "Failed - Click Refresh";
      if (refreshBtn) refreshBtn.style.display = "block";
      if (categoryError) categoryError.style.display = "block";
    }
  }

  // Render category dropdown
  renderCategoryDropdown(categories) {
    const dropdown = document.getElementById("category-dropdown");
    if (!dropdown) return;

    if (categories.length === 0) {
      dropdown.innerHTML =
        '<div style="padding:12px;color:#2c2c2f;font-size:12px;">No matching categories</div>';
      return;
    }

    let html = "";
    categories.forEach((cat) => {
      html += `
                <div class="cat-item" data-id="${cat.id}" data-name="${cat.name}" data-parent="${cat.parentName}" 
                     style="padding:10px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;transition:background 0.2s;">
                    <div style="color:#2c2c2f;">${cat.name}</div>
                    <div style="font-size:10px;color:#131415;">${cat.parentName}</div>
                </div>
            `;
    });
    dropdown.innerHTML = html;

    // Add click handlers
    dropdown.querySelectorAll(".cat-item").forEach((item) => {
      item.onmouseenter = () =>
        (item.style.background = "rgba(102,126,234,0.2)");
      item.onmouseleave = () => (item.style.background = "transparent");
      item.onclick = () => {
        const id = item.dataset.id;
        const name = item.dataset.name;
        const parent = item.dataset.parent;

        document.getElementById("category-select").value = id;
        document.getElementById("category-search").value = name;
        document.getElementById("selected-category").style.display = "block";
        document.getElementById(
          "selected-category-name"
        ).textContent = `${name} (${parent})`;
        document.getElementById("category-dropdown").style.display = "none";
        document.getElementById("category-clear").style.display = "block";

        if (typeof MeeshoAPI !== "undefined") {
          MeeshoAPI.setCategory(parseInt(id));
        }
      };
    });
  }

  applyDefaultCategoryIfNeeded() {
    const categorySelect = document.getElementById("category-select");
    if (!categorySelect || categorySelect.value || !this.allCategories?.length) return;

    const def =
      this.allCategories.find((c) => c.id === 18044) || this.allCategories[0];
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

  async processImage(file) {
    if (!this.isLicensed) {
      OptimizerUtils.showNotification("License required", "error");
      return;
    }

    // Sync session + category before generation
    if (window.WEB_OPTIMIZER_MODE && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.syncFromSession?.();
    }

    const categorySelect = document.getElementById("category-select");
    if (!categorySelect || !categorySelect.value) {
      OptimizerUtils.showNotification("Select category first!", "error");
      return;
    }

    this.isProcessing = true;
    this.shouldStop = false;
    this.currentResults = [];

    // Set category in API
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(parseInt(categorySelect.value));
    }

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

      if (window.WEB_OPTIMIZER_MODE && typeof MeeshoAPI.isReady === "function") {
        OptimizerUtils.showNotification(
          MeeshoAPI.isReady()
            ? "Checking live Meesho shipping…"
            : "Trying live API… save a Meesho session for real prices",
          "info"
        );
      }

      if (typeof MeeshoAPI.smartSearch === "function") {
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
        (!result.success || !result.results.length)
      ) {
        OptimizerUtils.showNotification(
          "Generating image variants locally…",
          "info"
        );
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
        this.currentResults = result.results.map((r) => ({
          name: r.name,
          imageUrl: r.dataUrl,
          shippingCost: r.shippingCost || 0,
          isVerified: !r.localOnly,
          duplicatePid: r.duplicatePid,
        }));

        if (result.localOnly) {
          OptimizerUtils.showNotification(
            `✅ ${result.results.length} variants ready — download & test on Meesho`,
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
        resultsArea.innerHTML = OptimizerUI.getResultsHTML(this.currentResults);
        this.setupResultsEvents();
      }
    } else {
      if (resultsArea) resultsArea.style.display = "none";
      if (uploadArea) uploadArea.style.display = "block";
      sections.forEach((s) => (s.style.display = "block"));
      if (generateBtn) {
        generateBtn.style.display = "block";
        generateBtn.disabled = !this._pendingFile && !document.getElementById("image-input")?.files?.[0];
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
      resultsArea.innerHTML = OptimizerUI.getResultsHTML(this.currentResults);
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

  setupResultsEvents() {
    document.querySelectorAll(".dl-btn").forEach((btn) => {
      btn.onclick = () => {
        const i = parseInt(btn.dataset.i);
        this.downloadImage(this.currentResults[i]);
      };
    });

    document.querySelectorAll(".apply-btn").forEach((btn) => {
      if (window.WEB_OPTIMIZER_MODE) btn.textContent = "Save";
      btn.onclick = () => {
        const i = parseInt(btn.dataset.i);
        if (window.WEB_OPTIMIZER_MODE) {
          this.downloadImage(this.currentResults[i]);
        } else {
          this.applyImage(this.currentResults[i]);
        }
      };
    });

    const dlAllBtn = document.getElementById("dl-all-btn");
    if (dlAllBtn) {
      dlAllBtn.onclick = () => {
        this.currentResults.forEach((r, i) => {
          setTimeout(() => this.downloadImage(r), i * 400);
        });
      };
    }

    const applyBestBtn = document.getElementById("apply-best-btn");
    if (applyBestBtn) {
      if (window.WEB_OPTIMIZER_MODE) {
        applyBestBtn.textContent = `Download Best ₹${this.currentResults[0]?.shippingCost || ""}`;
        applyBestBtn.onclick = () => this.downloadImage(this.currentResults[0]);
      } else {
        applyBestBtn.onclick = () => this.applyImage(this.currentResults[0]);
      }
    }

    const restartBtn = document.getElementById("restart-btn");
    if (restartBtn) {
      restartBtn.onclick = () => {
        if (window.WEB_OPTIMIZER_MODE && this.embeddedRoot) {
          this.mountEmbedded(this.embeddedRoot);
        } else {
          this.closeModal();
          setTimeout(() => this.openModal(), 200);
        }
      };
    }
  }

  downloadImage(result) {
    const link = document.createElement("a");
    link.download =
      "meesho-" + result.name.replace(/\s+/g, "-") + "-" + Date.now() + ".jpg";
    link.href = result.imageUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    OptimizerUtils.showNotification("Downloaded: " + result.name, "success");
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
        resultsArea.innerHTML = OptimizerUI.getResultsHTML(this.currentResults);
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
