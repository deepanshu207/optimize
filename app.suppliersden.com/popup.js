// Popup script for Meesho Shipping Optimizer v6.0.0

document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("status-badge");
  const licenseInfo = document.getElementById("license-info");
  const activationSection = document.getElementById("activation-section");
  // const statsSection = document.getElementById("stats-section");
  const activateBtn = document.getElementById("activate-btn");
  const licenseInput = document.getElementById("license-input");
  const openMeeshoBtn = document.getElementById("open-meesho");

  // Load license status
  async function loadLicenseStatus() {
    try {
      const result = await chrome.storage.sync.get([
        "licenseKey",
        "licenseStatus",
        "licenseInfo",
        "stats",
      ]);

      if (result.licenseStatus === "active" && result.licenseKey) {
        statusBadge.textContent = "Active";
        statusBadge.className = "status-badge active";

        const info = result.licenseInfo || {};
        let infoHTML = `<div class="license-key">${maskKey(
          result.licenseKey
        )}</div>`;

        if (info.expiresAt) {
          const expiresAt = new Date(info.expiresAt);
          const now = new Date();
          const diffMs = expiresAt - now;

          if (diffMs <= 0) {
            // Expired
            statusBadge.textContent = "Expired";
            statusBadge.className = "status-badge inactive";
            infoHTML += `<div class="expiry-warning"><span>❌</span><span>License expired</span></div>`;
          } else {
            // Calculate time left
            const diffMins = Math.floor(diffMs / (60 * 1000));
            const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
            const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

            let expiryText = "";
            if (diffMins < 60) {
              expiryText = `${diffMins} minute${diffMins !== 1 ? "s" : ""}`;
            } else if (diffHours < 24) {
              expiryText = `${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
            } else {
              expiryText = `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
            }

            // Show warning if less than 7 days
            if (diffDays < 7) {
              infoHTML += `<div class="expiry-warning"><span>⚠️</span><span>Expires in ${expiryText}</span></div>`;
            }
          }
        }

        licenseInfo.innerHTML = infoHTML;
        activationSection.classList.add("hidden");
        // statsSection.classList.remove("hidden");
        loadStats(result.stats);
      } else {
        statusBadge.textContent = "Inactive";
        statusBadge.className = "status-badge inactive";
        licenseInfo.innerHTML =
          '<p style="font-size:12px;color:#9ca3af;">Activate a license to use the optimizer</p>';
        activationSection.classList.remove("hidden");
        // statsSection.classList.add("hidden");
      }
    } catch (error) {
      console.error("Error loading license:", error);
      statusBadge.textContent = "Error";
      statusBadge.className = "status-badge inactive";
    }
  }

  function maskKey(key) {
    if (!key || key.length < 8) return key;
    return key.substring(0, 6) + "••••" + key.substring(key.length - 4);
  }

  function loadStats(stats) {
    const imagesCount = document.getElementById("images-count");
    const savingsAmount = document.getElementById("savings-amount");
    if (stats) {
      if (imagesCount) imagesCount.textContent = stats.imagesOptimized || 0;
      if (savingsAmount)
        savingsAmount.textContent = "₹" + (stats.totalSavings || 0);
    }
  }

  // Get or create machine ID
  async function getMachineId() {
    try {
      let stored = await chrome.storage.local.get(["machineId"]);

      if (stored.machineId) {
        return stored.machineId;
      }

      // Generate fingerprint
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 0,
        Date.now(),
      ].join("|");

      let hash = 0;
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }

      const machineId =
        "M" + Math.abs(hash).toString(36).toUpperCase().substring(0, 12);
      await chrome.storage.local.set({ machineId: machineId });
      console.log("Generated machine ID:", machineId);

      return machineId;
    } catch (e) {
      console.error("Error getting machine ID:", e);
      return "M" + Date.now().toString(36).toUpperCase();
    }
  }

  // Demo keys fetched from server
  let demoKeys = null;

  async function fetchDemoKeys() {
    if (demoKeys) return demoKeys;
    demoKeys = await CONFIG.getDemoKeys();
    return demoKeys;
  }

  // Subscription plans
  const plans = {
    monthly: {
      price: 599,
      days: 30,
      name: "Monthly",
      features: [
        "All Features",
        "Image Optimization",
        "Shipping Detection",
        "Priority Support",
        "Advanced Analytics",
        "Beta Updates",
        "Upcoming Features",
        "Premium Badge Designs",
      ],
    },
    quarterly: {
      price: 1399,
      days: 90,
      name: "3 Months",
      features: [
        "All Features",
        "Image Optimization",
        "Shipping Detection",
        "Priority Support",
        "Advanced Analytics",
        "Beta Updates",
        "Upcoming Features",
        "Premium Badge Designs",
      ],
    },
    halfYearly: {
      price: 2299,
      days: 180,
      name: "6 Months",
      features: [
        "All Features",
        "Image Optimization",
        "Shipping Detection",
        "Priority Support",
        "Advanced Analytics",
        "Beta Updates",
        "Upcoming Features",
        "Premium Badge Designs",
      ],
    },
    yearly: {
      price: 3099,
      days: 365,
      name: "Yearly",
      features: [
        "All Features",
        "Image Optimization",
        "Shipping Detection",
        "Priority Support",
        "Advanced Analytics",
        "Beta Updates",
        "Upcoming Features",
        "Premium Badge Designs",
      ],
    },
  };

  // Server URLs from CONFIG
  const serverUrls = [CONFIG.SERVER_URL, CONFIG.SERVER_URL_FALLBACK];

  // Verify license with server
  async function verifyLicenseWithServer(key) {
    const trimmedKey = key.trim().toUpperCase();
    console.log("🔑 Verifying key:", trimmedKey);

    // Fetch demo keys from server
    const serverDemoKeys = await fetchDemoKeys();
    console.log("🔑 Available demo keys:", Object.keys(serverDemoKeys));

    // Check demo keys first (case-insensitive)
    const demoKeyMatch = Object.keys(serverDemoKeys).find(
      (k) => k.toUpperCase() === trimmedKey
    );

    if (demoKeyMatch) {
      const demoInfo = serverDemoKeys[demoKeyMatch];
      const expiresAt = new Date(
        Date.now() + demoInfo.days * 24 * 60 * 60 * 1000
      );

      console.log("✅ Demo key found:", demoKeyMatch, demoInfo);

      try {
        await chrome.storage.sync.set({
          licenseKey: trimmedKey,
          licenseStatus: "active",
          licenseInfo: {
            key: trimmedKey,
            planType: "demo",
            expiresAt: expiresAt.toISOString(),
            activatedAt: new Date().toISOString(),
          },
          lastVerified: Date.now(),
        });

        console.log("✅ Demo key activated successfully:", trimmedKey);
        return { success: true };
      } catch (storageError) {
        console.error("❌ Storage error:", storageError);
        return {
          success: false,
          message: "Failed to save license: " + storageError.message,
        };
      }
    }

    console.log("🔍 Not a demo key, checking server...");

    const machineId = await getMachineId();
    console.log("Machine ID:", machineId);

    let lastError = "Could not connect to server";

    for (const url of serverUrls) {
      try {
        console.log("Trying server:", url);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url + "/verify-license", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            licenseKey: trimmedKey,
            machineId: machineId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log("Response status:", response.status);

        const result = await response.json();
        console.log("Server response:", result);

        if (result.valid === true) {
          // Success - save to storage
          await chrome.storage.sync.set({
            licenseKey: trimmedKey,
            licenseStatus: "active",
            licenseInfo: result.license || {
              key: trimmedKey,
              planType: "premium",
              activatedAt: new Date().toISOString(),
            },
            lastVerified: Date.now(),
          });
          return { success: true };
        } else {
          // Server returned valid: false
          lastError =
            result.reason || result.message || "License verification failed";
          console.log("Server rejected:", lastError);
          // Don't try other servers if we got a definitive response
          return { success: false, message: lastError };
        }
      } catch (e) {
        console.error("Server error:", url, e.message);
        lastError = e.name === "AbortError" ? "Connection timeout" : e.message;
        continue;
      }
    }

    return { success: false, message: lastError };
  }

  // Activate license button
  activateBtn.addEventListener("click", async () => {
    const key = licenseInput.value.trim();

    if (!key) {
      showMessage("Please enter a license key", "error");
      return;
    }

    if (key.length < 10) {
      showMessage("License key is too short", "error");
      return;
    }

    activateBtn.disabled = true;
    activateBtn.innerHTML =
      '<span style="display:inline-flex;align-items:center;gap:8px;"><span class="spinner"></span>Verifying...</span>';

    try {
      const result = await verifyLicenseWithServer(key);

      if (result.success) {
        showMessage("License activated successfully!", "success");
        await loadLicenseStatus();
      } else {
        showMessage(result.message, "error");
      }
    } catch (error) {
      console.error("Activation error:", error);
      showMessage("Error: " + error.message, "error");
    }

    activateBtn.disabled = false;
    activateBtn.textContent = "Activate License";
  });

  function showMessage(text, type) {
    const existing = document.querySelector(".popup-message");
    if (existing) existing.remove();

    const msg = document.createElement("div");
    msg.className = "popup-message";
    msg.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            z-index: 1000;
            max-width: 90%;
            text-align: center;
            ${
              type === "success"
                ? "background: #10b981; color: white;"
                : "background: #ef4444; color: white;"
            }
        `;
    msg.textContent = text;
    document.body.appendChild(msg);

    setTimeout(() => msg.remove(), 4000);
  }

  // Open Meesho
  openMeeshoBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://supplier.meesho.com" });
  });

  // Open Catalog/Image Optimizer
  const openCatalogBtn = document.getElementById("open-catalog");
  if (openCatalogBtn) {
    openCatalogBtn.addEventListener("click", async () => {
      // First check if there's already a Meesho tab open
      chrome.tabs.query(
        { url: "*://supplier.meesho.com/*" },
        async (meeshoTabs) => {
          if (meeshoTabs && meeshoTabs.length > 0) {
            // Find a catalog tab or use the first Meesho tab
            const catalogTab =
              meeshoTabs.find(
                (tab) =>
                  tab.url &&
                  (tab.url.includes("/catalogs/single") ||
                    tab.url.includes("/cataloging/") ||
                    tab.url.includes("/catalog") ||
                    tab.url.includes("/product"))
              ) || meeshoTabs[0];

            // Focus the tab
            chrome.tabs.update(catalogTab.id, { active: true });
            chrome.windows.update(catalogTab.windowId, { focused: true });

            // Inject scripts only when the user clicks (avoids auto-injection on login/session pages)
            try {
              await chrome.scripting.insertCSS({
                target: { tabId: catalogTab.id },
                files: ["styles.css"],
              });

              await chrome.scripting.executeScript({
                target: { tabId: catalogTab.id },
                files: [
                  "config.js",
                  "js/utils.js",
                  "js/license.js",
                  "js/meeshoApi.js",
                  "js/imageGenerator.js",
                  "js/ui.js",
                  "content.js",
                ],
              });
            } catch (e) {
              console.log("Script injection failed:", e);
            }

            // Send message to content script to open the optimizer modal
            try {
              await chrome.tabs.sendMessage(catalogTab.id, {
                action: "openOptimizer",
              });
            } catch (e) {
              console.log("Could not send message to tab:", e);
            }

            window.close();
          } else {
            // No Meesho tab open, create new one
            chrome.tabs.create({ url: "https://supplier.meesho.com/catalog" });
            window.close();
          }
        }
      );
    });
  }

  // Plan buttons - redirect to WhatsApp with specific plan message
  const planBtns = document.querySelectorAll(".plan-btn");
  planBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const plan = btn.dataset.plan;
      const price = btn.dataset.price;
      const duration = btn.dataset.duration;

      try {
        let whatsappNumber = CONFIG.DEFAULT_WHATSAPP;

        for (const url of serverUrls) {
          try {
            const response = await fetch(`${url}/settings?t=${Date.now()}`, {
              method: "GET",
            });
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.settings) {
                whatsappNumber =
                  result.settings.whatsapp_number || whatsappNumber;
              }
              break;
            }
          } catch (e) {
            continue;
          }
        }

        const message = `Hi! I want to purchase Meesho Shipping Cost AI Optimizer.

📦 *Plan Selected:* ${duration}
💰 *Price:* ₹${price}

Please share payment details and license key.`;

        chrome.tabs.create({
          url: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
            message
          )}`,
        });
      } catch (error) {
        const message = `Hi! I want to purchase Meesho Shipping Cost AI Optimizer - ${duration} plan (₹${price})`;
        chrome.tabs.create({
          url: `https://wa.me/${
            CONFIG.DEFAULT_WHATSAPP
          }?text=${encodeURIComponent(message)}`,
        });
      }
    });

    // Hover effect
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "scale(1.02)";
      btn.style.boxShadow = "0 4px 15px rgba(102,126,234,0.3)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
      btn.style.boxShadow = "none";
    });
  });

  // WhatsApp button (for license purchase)
  const whatsappBtn = document.getElementById("whatsapp-btn");
  if (whatsappBtn) {
    whatsappBtn.addEventListener("click", async () => {
      const originalText = whatsappBtn.innerHTML;
      whatsappBtn.innerHTML =
        '<span style="display:flex;align-items:center;justify-content:center;gap:8px;"><span class="spinner"></span>Connecting...</span>';
      whatsappBtn.disabled = true;

      try {
        let whatsappNumber = CONFIG.DEFAULT_WHATSAPP;
        let message = CONFIG.DEFAULT_WHATSAPP_MESSAGE;

        for (const url of serverUrls) {
          try {
            const response = await fetch(`${url}/settings?t=${Date.now()}`, {
              method: "GET",
            });
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.settings) {
                whatsappNumber =
                  result.settings.whatsapp_number || whatsappNumber;
                message = result.settings.whatsapp_message || message;
              }
              break;
            }
          } catch (e) {
            continue;
          }
        }

        chrome.tabs.create({
          url: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
            message
          )}`,
        });
      } catch (error) {
        chrome.tabs.create({
          url: `https://wa.me/${
            CONFIG.DEFAULT_WHATSAPP
          }?text=${encodeURIComponent(CONFIG.DEFAULT_WHATSAPP_MESSAGE)}`,
        });
      } finally {
        setTimeout(() => {
          whatsappBtn.innerHTML = originalText;
          whatsappBtn.disabled = false;
        }, 1500);
      }
    });
  }

  // WhatsApp Support button (footer)
  const supportWhatsappBtn = document.getElementById("support-whatsapp");
  if (supportWhatsappBtn) {
    supportWhatsappBtn.addEventListener("click", async () => {
      try {
        let whatsappNumber = CONFIG.DEFAULT_WHATSAPP;
        let message =
          "Hi! I need support for Meesho Shipping Cost AI Optimizer.";

        for (const url of serverUrls) {
          try {
            const response = await fetch(`${url}/settings?t=${Date.now()}`, {
              method: "GET",
            });
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.settings) {
                whatsappNumber =
                  result.settings.whatsapp_number || whatsappNumber;
              }
              break;
            }
          } catch (e) {
            continue;
          }
        }

        chrome.tabs.create({
          url: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
            message
          )}`,
        });
      } catch (error) {
        chrome.tabs.create({
          url: `https://wa.me/${
            CONFIG.DEFAULT_WHATSAPP
          }?text=${encodeURIComponent(
            "Hi! I need support for Meesho Shipping Cost AI Optimizer."
          )}`,
        });
      }
    });
  }

  // Enter key
  if (licenseInput) {
    licenseInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") activateBtn.click();
    });
  }

  // Add spinner style
  const style = document.createElement("style");
  style.textContent = `.spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top:2px solid white;border-radius:50%;animation:spin 0.8s linear infinite;}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`;
  document.head.appendChild(style);

  // Initial load
  await loadLicenseStatus();
});
