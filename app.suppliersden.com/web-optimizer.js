// Boot embedded optimizer — show UI immediately, upload → variants → live API if available
(function () {
  const MAX_BOOT_MS = 15000;
  const start = Date.now();

  function showError(msg) {
    const root = document.getElementById("optimizer-app");
    if (!root) return;
    root.innerHTML =
      "<" + "motion".replace("motion","div") + ' style="padding:24px;text-align:center;color:#b45309;font-size:14px;">' +
      msg +
      "</" + "motion".replace("motion","motion").replace("motion","div") + ">";
  }

  function boot() {
    const root = document.getElementById("optimizer-app");
    if (!root) return;

    if (typeof MeeshoShippingOptimizer === "undefined") {
      if (Date.now() - start < MAX_BOOT_MS) {
        setTimeout(boot, 80);
        return;
      }
      showError("Failed to load optimizer. Please refresh the page.");
      return;
    }

    try {
      const optimizer = new MeeshoShippingOptimizer();
      window.meeshoOptimizer = optimizer;
      optimizer.mountEmbedded(root);
    } catch (err) {
      console.error(err);
      showError("Optimizer error: " + err.message);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
