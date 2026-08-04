// ============================================
// MEESHO SHIPPING OPTIMIZER - CONFIGURATION
// ============================================

const CONFIG = {
  // Server URLs
  SERVER_URL: "https://darkviolet-ostrich-615182.hostingersite.com/api",
  SERVER_URL_FALLBACK:
    "https://darkviolet-ostrich-615182.hostingersite.com/api",

  // Default WhatsApp (Fallback)
  DEFAULT_WHATSAPP: "918905811996",
  DEFAULT_WHATSAPP_MESSAGE:
    "Hi! I want to purchase Meesho AI Shipping Optimizer Cost license.",

  // Extension Settings
  EXTENSION_NAME: "Meesho Shipping Cost Optimizer",
  VERSION: "1.1.3",
  LICENSE_CHECK_INTERVAL: 24 * 60 * 60 * 1000,

  // Built-in demo / promo keys (always honored; merged with server list)
  BUILTIN_DEMO_KEYS: {
    "MEESHO-DEMOFREE": { days: 30 },
    "MEESHO-DEMOFREE-PROMO": { days: 30 },
    "MEESHO-DEMO-PROMO": { days: 30 },
    "MEESHO-DEMO999": { days: 7 },
  },

  // Cache for server demo keys
  _demoKeysCache: null,
  _demoKeysCacheTime: 0,

  normalizeLicenseKey: function (key) {
    return String(key || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-");
  },

  mergeDemoKeys: function (serverKeys) {
    const merged = { ...this.BUILTIN_DEMO_KEYS };
    if (
      serverKeys &&
      typeof serverKeys === "object" &&
      !Array.isArray(serverKeys)
    ) {
      Object.assign(merged, serverKeys);
    }
    return merged;
  },

  // Fetch demo keys from server (built-ins always included)
  getDemoKeys: async function () {
    if (this._demoKeysCache && Date.now() - this._demoKeysCacheTime < 300000) {
      return this._demoKeysCache;
    }

    const urls = [this.SERVER_URL, this.SERVER_URL_FALLBACK];
    for (const url of urls) {
      try {
        const res = await fetch(`${url}/demo-keys`, {
          method: "GET",
          headers: { "Cache-Control": "no-cache" },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            this._demoKeysCache = this.mergeDemoKeys(data.demoKeys);
            this._demoKeysCacheTime = Date.now();
            console.log(
              "✅ Demo keys ready:",
              Object.keys(this._demoKeysCache)
            );
            return this._demoKeysCache;
          }
        }
      } catch (e) {
        console.log("Demo keys fetch failed:", url);
      }
    }

    this._demoKeysCache = { ...this.BUILTIN_DEMO_KEYS };
    this._demoKeysCacheTime = Date.now();
    console.log("⚠️ Using built-in demo keys only");
    return this._demoKeysCache;
  },

  getServerUrls: function () {
    return [this.SERVER_URL, this.SERVER_URL_FALLBACK];
  },
  getEndpoint: function (path) {
    return {
      primary: this.SERVER_URL + path,
      fallback: this.SERVER_URL_FALLBACK + path,
    };
  },
};

window.CONFIG = CONFIG;
console.log("📋 Config loaded - Server:", CONFIG.SERVER_URL);
