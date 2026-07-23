// Boot embedded web optimizer — upload image → existing smartSearch logic
(function () {
  function boot() {
    if (typeof MeeshoShippingOptimizer === "undefined") {
      setTimeout(boot, 50);
      return;
    }

    WebSession?.wireForm();

    const root = document.getElementById("optimizer-app");
    if (!root) return;

    const optimizer = new MeeshoShippingOptimizer();
    window.meeshoOptimizer = optimizer;
    optimizer.mountEmbedded(root);

    const meeshoLink = document.getElementById("link-meesho-login");
    if (meeshoLink) {
      meeshoLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.open("https://supplier.meesho.com/panel/v3/new/cataloging/ai/list", "_blank");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
