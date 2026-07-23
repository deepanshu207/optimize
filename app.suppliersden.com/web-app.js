// Web landing page — no license gates, opens optimizer modal directly
document.addEventListener("DOMContentLoaded", () => {
  let optimizer = null;

  function getOptimizer() {
    if (!optimizer && typeof MeeshoShippingOptimizer !== "undefined") {
      optimizer = new MeeshoShippingOptimizer();
    }
    return optimizer;
  }

  const openCatalogBtn = document.getElementById("open-catalog");
  if (openCatalogBtn) {
    openCatalogBtn.addEventListener("click", () => {
      const instance = getOptimizer();
      if (instance) instance.openModal();
    });
  }

  const openMeeshoBtn = document.getElementById("open-meesho");
  if (openMeeshoBtn) {
    openMeeshoBtn.addEventListener("click", () => {
      window.open("https://supplier.meesho.com/catalog", "_blank", "noopener,noreferrer");
    });
  }

  const supportBtn = document.getElementById("support-whatsapp");
  if (supportBtn) {
    supportBtn.addEventListener("click", () => {
      const number = (window.CONFIG && CONFIG.DEFAULT_WHATSAPP) || "918905811996";
      const message = "Hi! I need help with Meesho Shipping Cost Optimizer.";
      window.open(
        `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
      );
    });
  }
});
