import { parseReportCsv, pickRecommendedVariants } from "./liveVariantReport.mjs";

const STORAGE_KEY = "meesho_local_price_reports_v1";

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return new Set(norm(value).split(" ").filter(Boolean));
}

function overlapScore(a, b) {
  const aa = tokens(a);
  const bb = tokens(b);
  if (!aa.size || !bb.size) return 0;
  let hit = 0;
  aa.forEach((t) => {
    if (bb.has(t)) hit++;
  });
  return hit / Math.max(aa.size, bb.size);
}

function variantFeatures(row = {}, context = {}) {
  const meta = row.meta || {};
  return {
    categoryId: String(context.categoryId || row.categoryId || ""),
    name: row.name || "",
    style: row.variantStyle || meta.style || "",
    path: meta.path || row.path || meta.mode || "",
    mode: meta.mode || "",
    kb: num(meta.kb || meta.actualKb || meta.targetKb || row.kb, 0),
    width: num(meta.width || meta.canvasW || meta.productW || row.width, 0),
    height: num(meta.height || meta.canvasH || meta.productH || row.height, 0),
    borderPx: num(meta.borderPx ?? row.borderPx, 0),
    badgeCount: num(meta.badgeCount ?? row.badgeCount, 0),
  };
}

export function samplesFromReportCsv(csvText) {
  const parsed = parseReportCsv(csvText);
  const meta = parsed.meta || {};
  return (parsed.variants || [])
    .filter((row) => num(row.shippingCost) > 0)
    .map((row) => ({
      shippingCost: num(row.shippingCost),
      categoryId: String(meta.category_id || meta.categoryId || ""),
      generatedAt: meta.generated_at || "",
      source: "report_csv",
      features: variantFeatures(row, {
        categoryId: meta.category_id || meta.categoryId || "",
      }),
    }));
}

export function samplesFromAnalysis(analysis) {
  const ctx = analysis?.context || {};
  return (analysis?.variantRows || [])
    .filter((row) => num(row.shippingCost) > 0)
    .map((row) => ({
      shippingCost: num(row.shippingCost),
      categoryId: String(ctx.categoryId || ""),
      generatedAt: analysis.generatedAt || "",
      source: "live_report",
      features: variantFeatures(row, { categoryId: ctx.categoryId || "" }),
    }));
}

export function loadStoredSamples(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? rows.filter((r) => num(r.shippingCost) > 0) : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredSamples(samples, storage = globalThis.localStorage) {
  const clean = (samples || [])
    .filter((r) => num(r.shippingCost) > 0)
    .slice(-2500);
  try {
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(clean));
  } catch (e) {}
  return clean;
}

export function addStoredSamples(samples, storage = globalThis.localStorage) {
  const merged = [...loadStoredSamples(storage), ...(samples || [])];
  return saveStoredSamples(merged, storage);
}

function similarity(sample, rowFeatures, context = {}) {
  const s = sample.features || {};
  let score = 1;
  if (context.categoryId && sample.categoryId && String(context.categoryId) === String(sample.categoryId)) {
    score += 30;
  }
  if (s.style && rowFeatures.style && norm(s.style) === norm(rowFeatures.style)) score += 14;
  score += overlapScore(s.path, rowFeatures.path) * 18;
  score += overlapScore(s.name, rowFeatures.name) * 8;
  if (s.mode && rowFeatures.mode && norm(s.mode) === norm(rowFeatures.mode)) score += 6;
  if (s.kb && rowFeatures.kb) score += Math.max(0, 18 - Math.abs(s.kb - rowFeatures.kb) * 0.45);
  if (s.width && rowFeatures.width) score += Math.max(0, 5 - Math.abs(s.width - rowFeatures.width) / 260);
  if (s.height && rowFeatures.height) score += Math.max(0, 5 - Math.abs(s.height - rowFeatures.height) / 260);
  if (s.borderPx || rowFeatures.borderPx) score += Math.max(0, 4 - Math.abs((s.borderPx || 0) - (rowFeatures.borderPx || 0)) / 20);
  if (s.badgeCount === rowFeatures.badgeCount) score += 3;
  return Math.max(0.1, score);
}

function fallbackEstimate(row) {
  const f = variantFeatures(row);
  const existing = num(row.estShipping || row.meta?.estInr, 0);
  if (existing > 0) return existing;
  const kb = f.kb || 48;
  if (kb <= 18) return 50;
  if (kb <= 28) return 60;
  if (kb <= 42) return 70;
  if (kb <= 60) return 80;
  if (kb <= 90) return 100;
  return 120;
}

export function estimateVariantShipping(row, samples = [], context = {}) {
  const live = num(row.shippingCost, 0);
  if (live > 0 && (row.isVerified || row.liveVerified)) {
    return { price: live, confidence: 1, source: "live", neighbors: 0 };
  }

  const f = variantFeatures(row, context);
  const ranked = (samples || [])
    .filter((s) => num(s.shippingCost) > 0)
    .map((sample) => ({
      sample,
      score: similarity(sample, f, context),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);

  if (!ranked.length) {
    return {
      price: fallbackEstimate(row),
      confidence: 0.2,
      source: "fallback_kb",
      neighbors: 0,
    };
  }

  const total = ranked.reduce((sum, r) => sum + r.score, 0) || 1;
  const weighted = ranked.reduce(
    (sum, r) => sum + num(r.sample.shippingCost) * r.score,
    0,
  ) / total;
  const price = Math.max(1, Math.round(weighted));
  const confidence = Math.min(0.95, Math.max(0.25, ranked[0].score / 55));
  return {
    price,
    confidence,
    source: "report_model",
    neighbors: ranked.length,
  };
}

export function applyLocalPriceEstimates(variants, samples = [], context = {}) {
  const rows = (variants || []).map((row, index) => {
    const est = estimateVariantShipping(row, samples, context);
    return {
      ...row,
      variantId: row.variantId || `local-${index + 1}`,
      shippingCost: est.price,
      estShipping: est.price,
      isVerified: false,
      liveVerified: false,
      localOnly: true,
      localPrice: true,
      localPriceConfidence: est.confidence,
      localPriceSource: est.source,
      localPriceNeighbors: est.neighbors,
      _frozenPricing: {
        shippingCost: est.price,
        estShipping: est.price,
        metaEstInr: est.price,
      },
      meta: {
        ...(row.meta || {}),
        estInr: est.price,
        localPriceConfidence: est.confidence,
        localPriceSource: est.source,
      },
    };
  });
  rows.sort((a, b) => (a.shippingCost || 999) - (b.shippingCost || 999));
  return {
    results: rows,
    recommendation: pickRecommendedVariants(rows),
    samplesUsed: (samples || []).length,
  };
}

export { STORAGE_KEY };

const LocalPriceModel = {
  STORAGE_KEY,
  samplesFromReportCsv,
  samplesFromAnalysis,
  loadStoredSamples,
  saveStoredSamples,
  addStoredSamples,
  estimateVariantShipping,
  applyLocalPriceEstimates,
};

if (typeof window !== "undefined") {
  window.LocalPriceModel = LocalPriceModel;
}

export default LocalPriceModel;
