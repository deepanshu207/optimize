// Web landing page — wire buttons immediately (no license gates)
(function () {
  if (window.__webAppWired) return;
  window.__webAppWired = true;

  let optimizer = null;

  function getOptimizer() {
    if (!optimizer && typeof MeeshoShippingOptimizer !== "undefined") {
      optimizer = new MeeshoShippingOptimizer();
      window.meeshoOptimizer = optimizer;
    }
    return optimizer;
  }

  function flashButton(btn) {
    if (!btn) return;
    btn.style.transform = "scale(0.98)";
    setTimeout(() => {
      btn.style.transform = "";
    }, 120);
  }

  function wireButtons() {
    const openCatalogBtn = document.getElementById("open-catalog");
    if (openCatalogBtn && !openCatalogBtn.dataset.wired) {
      openCatalogBtn.dataset.wired = "1";
      openCatalogBtn.addEventListener("click", (e) => {
        e.preventDefault();
        flashButton(openCatalogBtn);
        const instance = getOptimizer();
        if (instance) {
          instance.openModal();
          return;
        }
        alert(
          "Optimizer is still loading. Wait a moment and try again, or refresh the page."
        );
      });
    }

    const openMeeshoBtn = document.getElementById("open-meesho");
    if (openMeeshoBtn && !openMeeshoBtn.dataset.wired) {
      openMeeshoBtn.dataset.wired = "1";
      openMeeshoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        flashButton(openMeeshoBtn);
        window.location.href = "https://supplier.meesho.com/catalog";
      });
    }

    const supportBtn = document.getElementById("support-whatsapp");
    if (supportBtn && !supportBtn.dataset.wired) {
      supportBtn.dataset.wired = "1";
      supportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        flashButton(supportBtn);
        const number =
          (window.CONFIG && CONFIG.DEFAULT_WHATSAPP) || "918905811996";
        const message = "Hi! I need help with Meesho Shipping Cost Optimizer.";
        window.location.href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
      });
    }
  }

  window.initWebOptimizerButtons = wireButtons;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireButtons);
  }
  wireButtons();
})();
