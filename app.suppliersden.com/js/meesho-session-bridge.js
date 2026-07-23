/**
 * Bridge live Meesho session from supplier.meesho.com → web optimizer.
 * Iframe login is blocked by Meesho (X-Frame-Options). Use popup + bookmarklet instead.
 */
(function () {
  const MESSAGE_TYPE = "meesho-optimizer-session";

  function allowedOrigin(origin) {
    if (!origin) return false;
    if (origin === window.location.origin) return true;
    if (origin === "https://supplier.meesho.com") return true;
    return false;
  }

  function applySession(payload) {
    if (!payload || typeof WebSession === "undefined") return false;
    const fields = {
      supplierId: payload.supplierId ? String(payload.supplierId) : "",
      browserId: payload.browserId ? String(payload.browserId) : "",
      cookie: WebSession.normalizeCookie(payload.cookie || ""),
      identifier: payload.identifier ? String(payload.identifier) : "",
    };
    if (payload.price) fields.price = parseInt(payload.price, 10) || 100;
    WebSession.save(fields);
    WebSession.applyToForm();
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.syncFromSession();
      MeeshoAPI.detectAllValues();
    }
    return !!(fields.supplierId && fields.browserId && fields.cookie);
  }

  window.MeeshoSessionBridge = {
    MESSAGE_TYPE,

    /** Script to run on supplier.meesho.com (bookmarklet or DevTools console). */
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
    identifier: tag && tag !== "catalogs" ? tag : "",
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
    alert("Session sent to optimizer tab. Return to the optimizer and click Test live connection.");
    return payload;
  }
  const text = JSON.stringify(payload, null, 2);
  navigator.clipboard?.writeText(text);
  prompt("Copy this session JSON and paste in the optimizer Import box:", text);
  return payload;
})();`;
    },

    buildBookmarkletHref() {
      const script = this.buildCaptureScript().replace(/\s+/g, " ").trim();
      return `javascript:${encodeURIComponent(script)}`;
    },

    openMeeshoLogin() {
      const s = typeof WebSession !== "undefined" ? WebSession.get() : {};
      const tag = s.identifier || "catalog";
      const url = tag && tag !== "catalog"
        ? `https://supplier.meesho.com/panel/v3/new/cataloging/${encodeURIComponent(tag)}/catalogs/single/add`
        : "https://supplier.meesho.com/panel/v3/new/cataloging/catalogs/single/add";
      const features = "width=1280,height=900,menubar=no,toolbar=no,location=yes,status=yes";
      const win = window.open(url, "meesho_supplier_login", features);
      if (!win) {
        OptimizerUtils?.showNotification(
          "Popup blocked — allow popups for this site, or open supplier.meesho.com manually",
          "warning"
        );
        return null;
      }
      window._meeshoLoginPopup = win;
      OptimizerUtils?.showNotification(
        "Meesho opened — log in, then run the capture bookmarklet on that tab",
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
      if (data.type && data.type !== MESSAGE_TYPE) {
        throw new Error("Not a Meesho session payload");
      }
      const ok = applySession(data);
      if (!ok) throw new Error("Missing supplier ID, browser ID, or cookie");
      return data;
    },

    wire() {
      if (this._wired) return;
      this._wired = true;

      window.addEventListener("message", (event) => {
        if (!allowedOrigin(event.origin)) return;
        const data = event.data;
        if (!data || data.type !== MESSAGE_TYPE) return;
        try {
          const ok = applySession(data);
          OptimizerUtils?.showNotification(
            ok
              ? "Meesho session imported from supplier tab"
              : "Session received but incomplete — add cookie manually",
            ok ? "success" : "warning"
          );
          const status = document.getElementById("session-status");
          if (status && typeof WebSession !== "undefined") WebSession.updateStatus();
        } catch (e) {
          console.warn("Session import failed:", e);
        }
      });

      const openBtn = document.getElementById("open-meesho-login");
      if (openBtn) {
        openBtn.addEventListener("click", () => this.openMeeshoLogin());
      }

      const copyBtn = document.getElementById("copy-meesho-capture-script");
      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          const script = this.buildCaptureScript();
          try {
            await navigator.clipboard.writeText(script);
            OptimizerUtils?.showNotification("Capture script copied — paste in Meesho DevTools console", "success");
          } catch (e) {
            prompt("Copy this script and run on supplier.meesho.com:", script);
          }
        });
      }

      const importBtn = document.getElementById("import-meesho-session");
      if (importBtn) {
        importBtn.addEventListener("click", () => {
          const box = document.getElementById("import-session-json");
          try {
            this.importFromJson(box?.value || "");
            OptimizerUtils?.showNotification("Session imported", "success");
            if (box) box.value = "";
          } catch (e) {
            OptimizerUtils?.showNotification(e.message || "Import failed", "error");
          }
        });
      }

      const bookmarklet = document.getElementById("meesho-capture-bookmarklet");
      if (bookmarklet) {
        bookmarklet.href = this.buildBookmarkletHref();
      }
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => MeeshoSessionBridge.wire());
  } else {
    MeeshoSessionBridge.wire();
  }
})();
