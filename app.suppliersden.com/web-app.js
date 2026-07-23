// Standalone web app — no content.js required
(function () {
  let selectedFile = null;
  let currentResults = [];
  let isProcessing = false;
  let shouldStop = false;

  function $(id) {
    return document.getElementById(id);
  }

  function notify(msg, type) {
    if (typeof OptimizerUtils !== "undefined") {
      OptimizerUtils.showNotification(msg, type || "info");
    } else {
      alert(msg);
    }
  }

  function setStatus(text) {
    const el = $("boot-msg");
    if (el) {
      el.textContent = text || "";
      el.style.display = text ? "block" : "none";
    }
  }

  function updateGenerateBtn() {
    const btn = $("generate-btn");
    if (btn) {
      btn.disabled = !selectedFile || isProcessing;
      btn.textContent = isProcessing ? "Generating…" : "🚀 Generate Variants";
    }
  }

  function showPreview(file) {
    const previewBox = $("preview-box");
    const previewImg = $("preview-img");
    if (!previewBox || !previewImg) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewBox.style.display = "block";
      const label = previewBox.querySelector(".preview-label");
      if (label) label.textContent = file.name;
    };
    reader.onerror = () => notify("Could not read image file", "error");
    reader.readAsDataURL(file);
  }

  function onFileSelected(file) {
    if (!file || !file.type.startsWith("image/")) {
      notify("Please choose a JPG, PNG, or WebP image", "error");
      return;
    }
    selectedFile = file;
    showPreview(file);
    updateGenerateBtn();
    setStatus("Image ready — tap Generate Variants");
  }

  function getSmartModeHTML(attempt, max, target, best, elapsed) {
    const pct = max ? Math.round((attempt / max) * 100) : 0;
    return `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:40px;margin-bottom:8px;">🎯</div>
        <h3 style="margin:0 0 8px;color:#047857;font-size:16px;">Generating variants…</h3>
        <p style="font-size:13px;color:#666;margin-bottom:4px;">${attempt} / ${max}</p>
        <p style="font-size:12px;color:#888;margin-bottom:12px;">Target ≤ ₹${target} · ${elapsed}s</p>
        ${
          best
            ? `<p style="font-size:18px;font-weight:700;color:#10b981;margin-bottom:12px;">Best: ₹${best}</p>`
            : ""
        }
        <div style="background:#eee;border-radius:8px;height:8px;margin-bottom:12px;overflow:hidden;">
          <div style="width:${pct}%;background:linear-gradient(135deg,#FFD700,#C9A227);height:100%;"></div>
        </div>
        <button type="button" id="stop-btn" style="padding:10px 20px;border:none;border-radius:8px;background:#ef4444;color:#fff;font-weight:600;">Stop</button>
      </div>`;
  }

  function wireResults() {
    document.querySelectorAll(".dl-btn").forEach((btn) => {
      btn.onclick = () => {
        const i = parseInt(btn.dataset.i, 10);
        downloadImage(currentResults[i]);
      };
    });
    document.querySelectorAll(".apply-btn").forEach((btn) => {
      btn.onclick = () => {
        const i = parseInt(btn.dataset.i, 10);
        downloadImage(currentResults[i]);
      };
    });
    const bestBtn = $("apply-best-btn");
    if (bestBtn && currentResults[0]) {
      bestBtn.textContent =
        currentResults[0].shippingCost > 0
          ? `Download Best ₹${currentResults[0].shippingCost}`
          : "Download Best Variant";
      bestBtn.onclick = () => downloadImage(currentResults[0]);
    }
    const restartBtn = $("restart-btn");
    if (restartBtn) {
      restartBtn.onclick = () => {
        $("results-area").style.display = "none";
        $("upload-area").style.display = "block";
        document.querySelectorAll(".opt-section").forEach((s) => {
          s.style.display = "block";
        });
        $("generate-btn").style.display = "block";
        setStatus(selectedFile ? "Image ready — tap Generate Variants" : "");
        updateGenerateBtn();
      };
    }
  }

  function downloadImage(result) {
    if (!result?.imageUrl) return;
    const link = document.createElement("a");
    link.download =
      "meesho-" + (result.name || "variant").replace(/\s+/g, "-") + ".jpg";
    link.href = result.imageUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    notify("Downloaded " + (result.name || "image"), "success");
  }

  async function fileToBlob(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        fetch(e.target.result)
          .then((r) => r.blob())
          .then(resolve)
          .catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function generate() {
    if (!selectedFile || isProcessing) return;
    if (typeof MeeshoAPI === "undefined") {
      notify("Engine not loaded — refresh the page", "error");
      return;
    }

    isProcessing = true;
    shouldStop = false;
    currentResults = [];
    updateGenerateBtn();

    const targetShipping = parseInt($("target-shipping")?.value, 10) || 80;
    const maxAttempts = parseInt($("max-attempts")?.value, 10) || 50;
    const customText = $("custom-text")?.value || "";

    if (typeof ImageGenerator !== "undefined") {
      ImageGenerator.updateSettings({ customText });
    }
    MeeshoAPI.setCategory(18044);

    const uploadArea = $("upload-area");
    const sections = document.querySelectorAll(".opt-section");
    const processingArea = $("processing-area");
    const resultsArea = $("results-area");
    const generateBtn = $("generate-btn");

    if (uploadArea) uploadArea.style.display = "none";
    if (generateBtn) generateBtn.style.display = "none";
    sections.forEach((s) => (s.style.display = "none"));
    if (resultsArea) resultsArea.style.display = "none";
    if (processingArea) {
      processingArea.style.display = "block";
      processingArea.innerHTML = getSmartModeHTML(0, maxAttempts, targetShipping, null, 0);
    }
    setStatus("");

    const startTime = Date.now();

    const onProgress = (attempt, max, bestSoFar) => {
      if (!processingArea || shouldStop) return;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      processingArea.innerHTML = getSmartModeHTML(
        attempt,
        max,
        targetShipping,
        bestSoFar,
        elapsed
      );
      const stopBtn = $("stop-btn");
      if (stopBtn) stopBtn.onclick = () => { shouldStop = true; };
    };

    try {
      const blob = await fileToBlob(selectedFile);
      const useLiveApi =
        typeof MeeshoAPI.isReady === "function" && MeeshoAPI.isReady();

      let result = { success: false, results: [] };

      if (useLiveApi) {
        result = await MeeshoAPI.smartSearch(
          blob,
          targetShipping,
          maxAttempts,
          (attempt, max, bestSoFar) => onProgress(attempt, max, bestSoFar),
          (found) => notify(`Found ₹${found.shippingCost}!`, "success"),
          () => shouldStop
        );
      }

      if (!result.success || !result.results.length) {
        if (useLiveApi) {
          notify("Live API unavailable — generating local variants…", "info");
        }
        result = await MeeshoAPI.generateLocalVariations(
          blob,
          maxAttempts,
          (attempt, max) => onProgress(attempt, max, null),
          () => shouldStop
        );
      }

      if (result.success && result.results.length) {
        currentResults = result.results.map((r) => ({
          name: r.name,
          imageUrl: r.dataUrl,
          shippingCost: r.shippingCost || 0,
        }));
        currentResults.sort((a, b) => {
          if (a.shippingCost && b.shippingCost) return a.shippingCost - b.shippingCost;
          return 0;
        });

        if (result.localOnly) {
          notify(`${currentResults.length} variants ready — tap Save to download`, "success");
        } else {
          notify(`Best: ₹${currentResults[0].shippingCost}`, "success");
        }
      } else {
        notify("No variants generated — try another image", "error");
      }
    } catch (err) {
      console.error(err);
      notify("Error: " + err.message, "error");
    }

    if (processingArea) processingArea.style.display = "none";
    if (resultsArea && currentResults.length) {
      resultsArea.style.display = "block";
      resultsArea.innerHTML = OptimizerUI.getResultsHTML(currentResults);
      wireResults();
    } else if (uploadArea) {
      uploadArea.style.display = "block";
      sections.forEach((s) => (s.style.display = "block"));
      if (generateBtn) generateBtn.style.display = "block";
    }

    isProcessing = false;
    updateGenerateBtn();
  }

  function init() {
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.init) {
      MeeshoAPI.init();
    }

    const fileInput = $("image-input");
    if (fileInput?.files?.[0]) {
      selectedFile = fileInput.files[0];
      setStatus("Image ready — tap Generate Variants");
    } else if ($("preview-img")?.src) {
      setStatus("Image ready — tap Generate Variants");
    } else {
      setStatus("Ready — choose an image");
    }

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) onFileSelected(file);
      });
    }

    const generateBtn = $("generate-btn");
    if (generateBtn) {
      generateBtn.addEventListener("click", generate);
    }

    const uploadArea = $("upload-area");
    if (uploadArea) {
      uploadArea.addEventListener("dragover", (e) => e.preventDefault());
      uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) onFileSelected(file);
      });
    }

    updateGenerateBtn();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
