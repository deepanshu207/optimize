import { initEncoder } from "./lib/encoder.js";
import { loadImage } from "./lib/canvas-utils.js";
import { CATEGORIES, MODES, TARGET_SHIPPING, calcWeightShipping, formatInr } from "./lib/shipping.js";
import { optimizeImage, analyzeImage } from "./lib/strategies.js";

const state = { img: null, mode: "smart", targetInr: null, borderColor: "#ff7900", running: false };
const $ = (sel) => document.querySelector(sel);

function renderModes() {
  const el = $("#modes");
  el.innerHTML = MODES.map(
    (m) => `<button type="button" class="mode-btn ${m.featured ? "featured" : ""} ${state.mode === m.id ? "selected" : ""}" data-mode="${m.id}">
      <strong>${m.name}</strong><span>${m.desc}</span></button>`
  ).join("");
  el.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => { state.mode = btn.dataset.mode; renderModes(); });
  });
}

function renderCategories() {
  $("#categories").innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join("");
}

function renderTargetPills() {
  const el = $("#targetPills");
  const items = [{ v: null, label: "Any" }, ...TARGET_SHIPPING.map((n) => ({ v: n, label: `≤${formatInr(n)}` }))];
  el.innerHTML = items.map((t) =>
    `<button type="button" class="target-pill ${state.targetInr === t.v ? "active" : ""}" data-target="${t.v ?? ""}">${t.label}</button>`
  ).join("");
  el.querySelectorAll("[data-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.targetInr = btn.dataset.target === "" ? null : Number(btn.dataset.target);
      renderTargetPills();
    });
  });
}

function setProgress(text, pct = null) {
  $("#progressText").textContent = text || "";
  if (pct != null) $("#progressBar").style.width = `${pct}%`;
}

function showInsight(html, warn = false) {
  const el = $("#insight");
  el.innerHTML = html;
  el.classList.toggle("hidden", !html);
  el.classList.toggle("warn", warn);
}

function updateCalc() {
  const dead = Number($("#deadWeight").value) || 0;
  const l = Number($("#dimL").value) || 0;
  const b = Number($("#dimB").value) || 0;
  const h = Number($("#dimH").value) || 0;
  const out = $("#calcOut");
  if (!dead && !l) {
    out.innerHTML = "<span style='color:var(--muted)'>Enter weight and box size to see your slab.</span>";
    return;
  }
  const r = calcWeightShipping({ deadGrams: dead, length: l, breadth: b, height: h });
  let html = `<div>Chargeable: <strong>${r.chargeableGrams}g</strong> (${r.drivenBy})</div>`;
  html += `<div>Current slab: <strong>${r.slab.label}</strong> · est. forward ${formatInr(r.slab.forward)}</div>`;
  if (r.cheaper) {
    html += `<div class="savings">Drop to ${r.cheaper.label} → save ${formatInr(r.savingsPerOrder)}/order</div>`;
    html += `<div>${r.tip}</div>`;
  } else {
    html += "<div>You're already in the lowest slab for these inputs.</div>";
  }
  out.innerHTML = html;
}

async function onFile(file) {
  if (!file?.type?.startsWith("image/")) return;
  $("#preview").src = URL.createObjectURL(file);
  $("#preview").classList.remove("hidden");
  $("#dropHint").classList.add("hidden");
  state.img = await loadImage(file);
  const a = analyzeImage(state.img);
  showInsight(`<strong>Image analysis:</strong> ${a.width}×${a.height} · ${a.studioBg ? "white studio" : "busy/indoor"} · ${a.collage ? "collage" : a.tall ? "tall portrait" : "standard"}.<br><strong>Suggested:</strong> ${a.suggested}`);
  $("#results").innerHTML = "";
  $("#resultsCard").classList.add("hidden");
}

async function runOptimize() {
  if (!state.img || state.running) return;
  state.running = true;
  $("#runBtn").disabled = true;
  $("#resultsCard").classList.remove("hidden");
  const resultsEl = $("#results");
  resultsEl.innerHTML = "";
  let step = 0;
  try {
    await initEncoder();
    setProgress("Starting…", 5);
    const variants = await optimizeImage(state.img, {
      mode: state.mode,
      category: $("#categories").value || "auto",
      borderColor: state.borderColor,
      targetInr: state.targetInr,
      onProgress: (label) => { step++; setProgress(label, Math.min(95, 5 + (step / 24) * 90)); },
    });
    if (!variants.length) {
      resultsEl.innerHTML = "<p>No variants. Try another mode.</p>";
      setProgress("Done", 100);
      return;
    }
    const best = variants[0];
    showInsight(`<strong>Best pick:</strong> ${best.mode} · est. ${formatInr(best.estInr)} · ${best.kb}KB · ${best.width}×${best.height}. Verify on Meesho Supplier panel.`);
    resultsEl.innerHTML = variants.map((v, i) => {
      const url = URL.createObjectURL(v.blob);
      return `<div class="result ${v.best ? "best" : ""}">
        ${v.best ? '<span class="tag">LOWEST</span>' : ""}
        <img src="${url}" alt="${v.label}" loading="lazy" />
        <div class="meta">
          <div class="price">${formatInr(v.estInr)}</div>
          <div>${v.mode}</div>
          <div>${v.kb}KB · ${v.width}×${v.height}</div>
          <button type="button" class="btn btn-sm" data-dl="${i}" style="margin-top:0.35rem;width:100%">Download</button>
        </div>
      </div>`;
    }).join("");
    resultsEl.querySelectorAll("[data-dl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = variants[Number(btn.dataset.dl)];
        const a = document.createElement("a");
        a.href = URL.createObjectURL(v.blob);
        a.download = `meesho-${v.path}-${v.kb}kb.jpg`;
        a.click();
      });
    });
    setProgress(`Done — ${variants.length} variants ranked`, 100);
  } catch (e) {
    console.error(e);
    showInsight(`Error: ${e.message}`, true);
    setProgress("Failed");
  } finally {
    state.running = false;
    $("#runBtn").disabled = false;
  }
}

function bindUi() {
  renderModes(); renderCategories(); renderTargetPills();
  const dz = $("#dropzone");
  dz.addEventListener("click", () => $("#fileInput").click());
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
  dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("dragover"); onFile(e.dataTransfer.files[0]); });
  $("#fileInput").addEventListener("change", (e) => onFile(e.target.files[0]));
  $("#borderColor").addEventListener("input", (e) => { state.borderColor = e.target.value; });
  $("#runBtn").addEventListener("click", runOptimize);
  ["deadWeight", "dimL", "dimB", "dimH"].forEach((id) => $("#" + id).addEventListener("input", updateCalc));
  updateCalc();
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      $("#panel-optimize").classList.toggle("hidden", tab.dataset.panel !== "optimize");
      $("#panel-calc").classList.toggle("hidden", tab.dataset.panel !== "calc");
    });
  });
}
bindUi();
