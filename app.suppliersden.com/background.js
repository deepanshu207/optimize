// Background service worker for Meesho Shipping Optimizer

class BackgroundService {
  constructor() {
    // expose instance for auto checker
    self.backgroundInstance = this;
    this.initializeListeners();
  }

  initializeListeners() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.onInstall();
      } else if (details.reason === "update") {
        this.onUpdate();
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  onInstall() {
    console.log("Meesho Shipping Optimizer installed");

    chrome.storage.sync.set({
      settings: {
        autoOptimize: false,
        maxVariations: 5,
        preferredImageFormat: "png",
        compressionLevel: 0.8,
      },
    });
  }

  onUpdate() {
    console.log("Meesho Shipping Optimizer updated");
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case "VERIFY_LICENSE":
          const isValid = await this.verifyLicenseKey(message.licenseKey);
          sendResponse({ success: true, valid: isValid });
          break;

        case "PROCESS_IMAGE":
          const result = await this.processImageVariations(message.imageData);
          sendResponse({ success: true, data: result });
          break;

        case "CHECK_SHIPPING":
          const shippingCost = await this.checkShippingCost(message.imageData);
          sendResponse({ success: true, cost: shippingCost });
          break;

        case "SAVE_SETTINGS":
          await this.saveSettings(message.settings);
          sendResponse({ success: true });
          break;

        case "GET_SETTINGS":
          const settings = await this.getSettings();
          sendResponse({ success: true, settings });
          break;

        case "GET_LICENSE_STATUS":
          const licenseStatus = await this.getLicenseStatus();
          sendResponse({ success: true, status: licenseStatus });
          break;

        case "FORCE_LICENSE_CHECK":
          await autoLicenseCheck();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async processImageVariations(imageData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { name: "Original", data: imageData, modifications: [] },
          {
            name: "Brightness Enhanced",
            data: imageData,
            modifications: ["brightness +20%"],
          },
          {
            name: "Contrast Optimized",
            data: imageData,
            modifications: ["contrast +30%"],
          },
          {
            name: "Color Saturated",
            data: imageData,
            modifications: ["saturation +40%"],
          },
          {
            name: "Cropped Focus",
            data: imageData,
            modifications: ["center crop 80%"],
          },
        ]);
      }, 1000);
    });
  }

  async checkShippingCost(imageData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const baseCost = 20;
        const imageSize = imageData.length;
        const sizeFactor = Math.min(imageSize / 100000, 1) * 10;
        const randomFactor = Math.random() * 15;
        resolve(Math.round(baseCost + sizeFactor + randomFactor));
      }, 500);
    });
  }

  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ settings }, resolve);
    });
  }

  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["settings"], (r) => resolve(r.settings || {}));
    });
  }

  async verifyLicenseKey(licenseKey) {
    const trimmedKey = licenseKey.trim().toUpperCase();
    const serverUrls = [
      "https://darkviolet-ostrich-615182.hostingersite.com/api",
    ];

    let demoKeys = { "MEESHO-DEMO999": { days: 7 } };

    for (const serverUrl of serverUrls) {
      try {
        const res = await fetch(`${serverUrl}/demo-keys`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.demoKeys) {
            demoKeys = data.demoKeys;
            break;
          }
        }
      } catch {}
    }

    const demoKeyMatch = Object.keys(demoKeys).find(
      (k) => k.toUpperCase() === trimmedKey
    );

    if (demoKeyMatch) {
      const demoInfo = demoKeys[demoKeyMatch];
      await chrome.storage.sync.set({
        licenseKey: trimmedKey,
        licenseStatus: "active",
        licenseInfo: {
          key: trimmedKey,
          planType: "demo",
          expiresAt: new Date(
            Date.now() + demoInfo.days * 86400000
          ).toISOString(),
        },
        lastVerified: Date.now(),
      });
      return true;
    }

    try {
      const machineId = await this.getMachineId();

      for (const serverUrl of serverUrls) {
        try {
          const response = await fetch(`${serverUrl}/verify-license`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ licenseKey, machineId }),
          });

          if (!response.ok) continue;

          const result = await response.json();

          if (result.valid) {
            await chrome.storage.sync.set({
              licenseKey,
              licenseStatus: "active",
              licenseInfo: result.license,
              lastVerified: Date.now(),
            });
            return true;
          } else {
            return false;
          }
        } catch {}
      }
      return false;
    } catch {
      return false;
    }
  }

  async getMachineId() {
    const r = await chrome.storage.local.get(["machineId"]);
    if (!r.machineId) {
      const machineId = "machine-" + Math.random().toString(36).slice(2);
      await chrome.storage.local.set({ machineId });
      return machineId;
    }
    return r.machineId;
  }

  async getLicenseStatus() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["licenseKey", "licenseStatus"], (r) => {
        resolve({
          key: r.licenseKey,
          status: r.licenseStatus || "inactive",
        });
      });
    });
  }
}
function safeNotify(msg) {
  try {
    chrome.runtime.sendMessage(msg, () => {
      // ignore if nobody is listening
      if (chrome.runtime.lastError) {
        // silently ignore
      }
    });
  } catch (e) {}
}

// -------- AUTO LICENSE CHECKER --------

async function autoLicenseCheck() {
  try {
    const data = await chrome.storage.sync.get(["licenseKey"]);
    if (!data.licenseKey) return;

    console.log("🔄 Auto re-checking license...");

    const bg = self.backgroundInstance;
    if (!bg) return;

    const valid = await bg.verifyLicenseKey(data.licenseKey);

    if (!valid) {
      // License is no longer valid → deactivate extension
      await chrome.storage.sync.set({
        licenseStatus: "inactive",
        licenseInfo: null,
      });

      // Optional: remove stored key
      // await chrome.storage.sync.remove(["licenseKey"]);

      console.log("❌ License invalid. Extension locked.");
    }

    safeNotify({
      type: "LICENSE_UPDATED",
      valid,
    });
  } catch (e) {
    console.error("License auto-check failed:", e);
  }
}

// run once after startup
setTimeout(autoLicenseCheck, 3000);

// run every 5 minutes
setInterval(autoLicenseCheck, 5 * 60 * 1000);

// Initialize background service
new BackgroundService();
