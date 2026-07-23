// Meesho session storage for standalone web app
const WebSession = {
  KEY: "meesho_web_session_v1",

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || "{}");
    } catch {
      return {};
    }
  },

  save(fields) {
    const next = { ...this.get(), ...fields };
    localStorage.setItem(this.KEY, JSON.stringify(next));
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.syncFromSession) {
      MeeshoAPI.syncFromSession();
    }
    this.updateStatus();
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.cache.categories = null;
      MeeshoAPI.syncFromSession();
    }
    if (window.meeshoOptimizer?.loadCategoryDropdown) {
      window.meeshoOptimizer.loadCategoryDropdown();
    }
    return next;
  },

  applyToForm() {
    const s = this.get();
    const map = {
      "session-supplier-id": s.supplierId,
      "session-browser-id": s.browserId,
      "session-identifier": s.identifier,
      "session-price": s.price,
      "session-cookie": s.cookie,
    };
    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && value != null) el.value = value;
    });
    this.updateStatus();
  },

  readFromForm() {
    const val = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : "";
    };
    return this.save({
      supplierId: val("session-supplier-id"),
      browserId: val("session-browser-id"),
      identifier: val("session-identifier"),
      price: parseInt(val("session-price"), 10) || 100,
      cookie: val("session-cookie"),
    });
  },

  updateStatus() {
    const el = document.getElementById("session-status");
    if (!el) return;
    const s = this.get();
    const ok = s.supplierId && s.browserId;
    el.textContent = ok
      ? "✅ Session saved — ready for live shipping checks"
      : "⚠️ Add Supplier ID + Browser ID (login to supplier.meesho.com first)";
    el.className = ok ? "session-status ok" : "session-status warn";
  },

  wireForm() {
    if (this._wired) {
      this.applyToForm();
      return;
    }
    this._wired = true;

    const saveBtn = document.getElementById("save-session");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        this.readFromForm();
        OptimizerUtils?.showNotification("Meesho session saved", "success");
      });
    }
    const toggle = document.getElementById("toggle-session");
    const panel = document.getElementById("session-panel");
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

window.WebSession = WebSession;

// Common Meesho categories when live API is unavailable
window.FALLBACK_CATEGORIES = [
  { id: 18044, name: "Women Kurtis", parentName: "Women Ethnic Wear" },
  { id: 18045, name: "Women Sarees", parentName: "Women Ethnic Wear" },
  { id: 10001, name: "Men T-Shirts", parentName: "Men Topwear" },
  { id: 10002, name: "Men Shirts", parentName: "Men Topwear" },
  { id: 12001, name: "Kids Clothing", parentName: "Kids" },
  { id: 15001, name: "Home Decor", parentName: "Home & Kitchen" },
  { id: 15002, name: "Kitchen Tools", parentName: "Home & Kitchen" },
  { id: 20001, name: "Women Leggings", parentName: "Women Bottomwear" },
  { id: 20002, name: "Women Jeans", parentName: "Women Bottomwear" },
  { id: 30001, name: "Jewellery Sets", parentName: "Fashion Jewellery" },
];
