/**
 * Test Lab only — Meesho live session connect (popup + capture).
 * Does not wire Live tab session fields. Shares WebSession storage for MeeshoAPI.
 */
(function () {
  const MESSAGE_TYPE = "meesho-testlab-session";
  const DEFAULT_IDENTIFIER = "ytnlz";

  const FIELD_IDS = {
    supplierId: "test-lab-session-supplier-id",
    browserId: "test-lab-session-browser-id",
    identifier: "test-lab-session-identifier",
    price: "test-lab-session-price",
    cookie: "test-lab-session-cookie",
  };

  function allowedOrigin(origin) {
    if (!origin) return false;
    if (origin === window.location.origin) return true;
    if (origin === "https://supplier.meesho.com") return true;
    return false;
  }

  function notifySessionChange(ok) {
    window.dispatchEvent(
      new CustomEvent("testlab-session-ready", { detail: { ok: !!ok } })
    );
    if (window.meeshoOptimizer?.refreshTestLabSessionHint) {
      window.meeshoOptimizer.refreshTestLabSessionHint();
    }
  }

  function applySession(payload) {
    if (!payload || typeof WebSession === "undefined") return false;
    const fields = {
      supplierId: payload.supplierId ? String(payload.supplierId) : "",
      browserId: payload.browserId ? String(payload.browserId) : "",
      cookie: WebSession.normalizeCookie(payload.cookie || ""),
      identifier: payload.identifier
        ? String(payload.identifier)
        : DEFAULT_IDENTIFIER,
    };
    if (payload.price) fields.price = parseInt(payload.price, 10) || 100;
    WebSession.save(fields);
    TestLabSession.applyToForm();
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.syncFromSession();
      MeeshoAPI.detectAllValues();
    }
    TestLabSession.updateStatus();
    notifySessionChange(TestLabSession.isReady());
    return TestLabSession.isReady();
  }

  window.TestLabSession = {
    MESSAGE_TYPE,
    FIELD_IDS,

    get() {
      return typeof WebSession !== "undefined" ? WebSession.get() : {};
    },

    isReady() {
      const s = this.get();
      return !!(s.supplierId && s.browserId && s.cookie);
    },

    applyToForm() {
      const s = this.get();
      const map = {
        [FIELD_IDS.supplierId]: s.supplierId,
        [FIELD_IDS.browserId]: s.browserId,
        [FIELD_IDS.identifier]: s.identifier || DEFAULT_IDENTIFIER,
        [FIELD_IDS.price]: s.price,
        [FIELD_IDS.cookie]: s.cookie,
      };
      Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el && value != null && value !== "") el.value = value;
      });
      this.updateStatus();
    },

    readFromForm() {
      const val = (id) => document.getElementById(id)?.value?.trim() || "";
      const fields = {
        supplierId: val(FIELD_IDS.supplierId),
        browserId: val(FIELD_IDS.browserId),
        identifier: val(FIELD_IDS.identifier) || DEFAULT_IDENTIFIER,
        price: parseInt(val(FIELD_IDS.price), 10) || 100,
        cookie: WebSession.normalizeCookie(val(FIELD_IDS.cookie)),
      };
      WebSession.save(fields);
      if (typeof MeeshoAPI !== "undefined") MeeshoAPI.syncFromSession();
      this.updateStatus();
      notifySessionChange(this.isReady());
      return fields;
    },

    updateStatus() {
      const el = document.getElementById("test-lab-session-status");
      if (!el) return;
      const s = this.get();
      const cookieLen = s.cookie ? s.cookie.length : 0;
      if (s.supplierId && s.browserId && cookieLen > 0) {
        el.textContent = `✅ Live session ready — Supplier ${s.supplierId}`;
        el.className = "session-status ok";
        return;
      }
      if (s.supplierId && s.browserId) {
        el.textContent =
          "⚠️ Partial — run Capture session on Meesho tab for cookie";
        el.className = "session-status warn";
        return;
      }
      el.textContent =
        "Connect Meesho below to unlock Phase 2 live ₹ checks";
      el.className = "session-status warn";
    },

    buildCaptureScript() {
      return `(() => {
  const get = (n) => {
    const m = document.cookie.match(new RegExp("(^| )" + n + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : "";
  };
  let supplierId = "";
  try {
    const mp = JSON.parse(get("mp_a66867feba42257f4b46689d52d48f86_mixpanel") || "{}");
    supplierId = mp.Supplier_id || "";
  } catch (e) {}
  const browserId = get("browser_id") || get("browser_uid") || "";
  const tag = (location.href.match(/\\/cataloging\\/([^/]+)/) || [])[1] || "";
  const payload = {
    type: "${MESSAGE_TYPE}",
    supplierId: String(supplierId || ""),
    browserId,
    cookie: document.cookie,
    identifier: tag && tag !== "catalogs" ? tag : "${DEFAULT_IDENTIFIER}",
    price: 100,
  };
  const targets = [
    "https://app.suppliersden.com",
    window.location.origin,
    "http://localhost:8787",
    "http://127.0.0.1:8791",
  ];
  let sent = false;
  if (window.opener && !window.opener.closed) {
    for (const o of targets) {
      try { window.opener.postMessage(payload, o); sent = true; } catch (e) {}
    }
  }
  if (sent) {
    alert("Session sent to Test Lab. Switch back to the optimizer tab.");
    return payload;
  }
  const text = JSON.stringify(payload, null, 2);
  navigator.clipboard?.writeText(text);
  prompt("Copy session JSON and paste in Test Lab Import box:", text);
  return payload;
})();`;
    },

    buildBookmarkletHref() {
      const script = this.buildCaptureScript().replace(/\s+/g, " ").trim();
      return `javascript:${encodeURIComponent(script)}`;
    },

    openMeeshoLogin() {
      const s = this.get();
      const tag = s.identifier || DEFAULT_IDENTIFIER;
      const url = `https://supplier.meesho.com/panel/v3/new/cataloging/${encodeURIComponent(tag)}/catalogs/single/add`;
      const features =
        "width=1280,height=900,menubar=no,toolbar=no,location=yes,status=yes";
      const win = window.open(url, "meesho_testlab_login", features);
      if (!win) {
        OptimizerUtils?.showNotification(
          "Popup blocked — allow popups, then try again",
          "warning"
        );
        return null;
      }
      window._testLabMeeshoPopup = win;
      OptimizerUtils?.showNotification(
        "Meesho opened — log in, then click Capture session on that tab",
        "info"
      );
      return win;
    },

    importFromJson(text) {
      let data = text;
      if (typeof text === "string") {
        const trimmed = text.trim();
        if (!trimmed) throw new Error("Paste session JSON first");
        data = JSON.parse(trimmed);
      }
      if (
        data.type &&
        data.type !== MESSAGE_TYPE &&
        data.type !== "meesho-optimizer-session"
      ) {
        throw new Error("Not a Meesho session payload");
      }
      const ok = applySession(data);
      if (!ok) throw new Error("Missing supplier ID, browser ID, or cookie");
      return data;
    },

    async testConnection() {
      if (typeof MeeshoAPI === "undefined") {
        return { ok: false, message: "API not loaded" };
      }
      this.readFromForm();
      if (!this.isReady()) {
        return {
          ok: false,
          message: "Connect Meesho session first (Open login → Capture)",
        };
      }
      MeeshoAPI.cache.categories = null;
      const categories = await MeeshoAPI.fetchCategories(true);
      const live =
        categories &&
        categories.length > 0 &&
        !MeeshoAPI._lastCategoryFetchWasFallback;
      if (live) {
        return {
          ok: true,
          message: `Live API OK — ${categories.length} categories`,
        };
      }
      return {
        ok: false,
        message:
          "Meesho blocked the request (403). Try Chrome extension on supplier.meesho.com, or continue with Phase 1 estimates.",
      };
    },

    wire() {
      if (this._wired) {
        this.applyToForm();
        return;
      }
      this._wired = true;

      window.addEventListener("message", (event) => {
        if (!allowedOrigin(event.origin)) return;
        const data = event.data;
        if (
          !data ||
          (data.type !== MESSAGE_TYPE &&
            data.type !== "meesho-optimizer-session")
        ) {
          return;
        }
        try {
          const ok = applySession(data);
          OptimizerUtils?.showNotification(
            ok
              ? "Test Lab session connected — fields auto-filled"
              : "Session received but incomplete",
            ok ? "success" : "warning"
          );
        } catch (e) {
          console.warn("Test Lab session import failed:", e);
        }
      });

      document
        .getElementById("test-lab-open-meesho-login")
        ?.addEventListener("click", () => this.openMeeshoLogin());

      document
        .getElementById("test-lab-copy-capture-script")
        ?.addEventListener("click", async () => {
          const script = this.buildCaptureScript();
          try {
            await navigator.clipboard.writeText(script);
            OptimizerUtils?.showNotification(
              "Script copied — paste in Meesho DevTools console",
              "success"
            );
          } catch (e) {
            prompt("Copy and run on supplier.meesho.com:", script);
          }
        });

      document
        .getElementById("test-lab-import-session")
        ?.addEventListener("click", () => {
          const box = document.getElementById("test-lab-import-json");
          try {
            this.importFromJson(box?.value || "");
            OptimizerUtils?.showNotification("Session imported", "success");
            if (box) box.value = "";
          } catch (e) {
            OptimizerUtils?.showNotification(e.message || "Import failed", "error");
          }
        });

      document
        .getElementById("test-lab-save-session")
        ?.addEventListener("click", () => {
          this.readFromForm();
          OptimizerUtils?.showNotification("Test Lab session saved", "success");
        });

      document
        .getElementById("test-lab-test-session")
        ?.addEventListener("click", async () => {
          const btn = document.getElementById("test-lab-test-session");
          if (btn) {
            btn.disabled = true;
            btn.textContent = "Testing…";
          }
          const result = await this.testConnection();
          const status = document.getElementById("test-lab-session-status");
          if (status) {
            status.textContent = (result.ok ? "✅ " : "⚠️ ") + result.message;
            status.className = result.ok
              ? "session-status ok"
              : "session-status warn";
          }
          OptimizerUtils?.showNotification(
            result.message,
            result.ok ? "success" : "info"
          );
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Test live connection";
          }
        });

      const bookmarklet = document.getElementById("test-lab-capture-bookmarklet");
      if (bookmarklet) bookmarklet.href = this.buildBookmarkletHref();

      const toggle = document.getElementById("test-lab-toggle-session");
      const panel = document.getElementById("test-lab-session-panel");
      if (toggle && panel) {
        toggle.addEventListener("click", () => {
          panel.classList.toggle("collapsed");
          toggle.textContent = panel.classList.contains("collapsed")
            ? "Show Meesho session"
            : "Hide Meesho session";
        });
      }

      this.applyToForm();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => TestLabSession.wire());
  } else {
    TestLabSession.wire();
  }
})();
