/**
 * TEST LAB ONLY — isolated from Live mode (MeeshoAPI.generateLocalVariations / smartSearch).
 * Phase 1: local strategies ranked by est ₹.
 * Phase 2: ₹49 framed candidates + live Meesho verify when session is ready.
 */
import { optimizeImage, analyzeImage, getSmartPlan } from "./lib/strategies.js?v=25";
import { loadImage } from "./lib/canvas-utils.js?v=25";
import { blobToDataUrl } from "./lib/encoder.js?v=25";
import {
  CATEGORIES,
  MODES,
  TARGET_SHIPPING,
  formatInr,
  estimateImageShipping,
} from "./lib/shipping.js?v=25";
import { getSessionGuidance, detectCategoryGroup, categoryGroupLabel } from "./lib/smart-plan.js?v=25";

const PHASE2_PROFILE_LIMIT = 16;
const LIVE_VERIFY_DELAY_MS = 150;
const DEFAULT_MAX_VERIFY = 16;

/** @deprecated Use detectCategoryGroup — kept for callers that only need the id */
export function categoryGroupFromSelection(
  sscatId,
  categoryName,
  parentName = "",
  imageAnalysis = null
) {
  return detectCategoryGroup({
    categoryName,
    parentName,
    imageAnalysis,
  }).groupId;
}

/** Preview category detection (sync; pass imageAnalysis when image is loaded). */
export function previewCategoryDetection(options = {}) {
  return detectCategoryGroup(options);
}

/** Load image file and run detection with image shape hints. */
export async function previewCategoryDetectionWithFile(file, options = {}) {
  const img = await loadImage(file);
  const analysis = analyzeImage(img);
  return detectCategoryGroup({
    ...options,
    imageAnalysis: analysis,
  });
}

function variantToResult(v, index) {
  const kb = v.kb || Math.ceil((v.bytes || 0) / 1024);
  return {
    variantId: `test-${v.path}-${kb}-${index}`,
    name: v.label || v.mode || `Test-${index + 1}`,
    blob: v.blob || null,
    dataUrl: v.dataUrl,
    pricingImageUrl: v.dataUrl,
    imageUrl: v.dataUrl,
    layers: v.layers || null,
    variantStyle: v.variantStyle || "testlab",
    meta: {
      path: v.path,
      mode: v.mode,
      estInr: v.estInr,
      kb,
      width: v.width,
      height: v.height,
      recommended: !!v.recommended,
      best: !!v.best,
      lowest: !!v.lowest,
      profileId: v.profileId,
    },
    shippingCost: 0,
    estShipping: v.estInr,
    isVerified: false,
    localOnly: true,
    testLab: true,
    phase2: !!v.phase2,
  };
}

function sortByBestPrice(results) {
  return [...results].sort((a, b) => {
    const aLive = a.shippingCost > 0 ? a.shippingCost : null;
    const bLive = b.shippingCost > 0 ? b.shippingCost : null;
    if (aLive != null && bLive != null) return aLive - bLive;
    if (aLive != null) return -1;
    if (bLive != null) return 1;
    return (
      (a.estShipping ?? a.meta?.estInr ?? 999) -
      (b.estShipping ?? b.meta?.estInr ?? 999)
    );
  });
}

function syncMeeshoSession(sscatId) {
  if (typeof MeeshoAPI === "undefined") return false;
  MeeshoAPI.syncFromSession?.();
  if (sscatId) MeeshoAPI.setCategory(sscatId);
  return !!MeeshoAPI.isReady?.();
}

export function pickLiveVerifyCandidates(results, maxCount = DEFAULT_MAX_VERIFY) {
  const phase2 = results.filter((r) => r.phase2 || r.meta?.path === "framed_live");
  const phase1 = results.filter((r) => !r.phase2 && r.meta?.path !== "framed_live");

  const picked = [];
  const seen = new Set();
  const add = (row) => {
    if (!row || seen.has(row.variantId)) return;
    seen.add(row.variantId);
    picked.push(row);
  };

  // ₹49 framed profiles are highest priority for live check
  for (const row of phase2) add(row);
  // Then best estimated from Phase 1
  for (const row of phase1.slice(0, 8)) add(row);
  // Fill remaining slots with next-best estimates
  for (const row of phase1.slice(8)) {
    if (picked.length >= maxCount) break;
    add(row);
  }

  return picked.slice(0, maxCount);
}

function phase2Profiles() {
  if (typeof MeeshoAPI === "undefined" || !MeeshoAPI.LOW_SHIPPING_FRAMED_PROFILES) {
    return [];
  }
  const all = MeeshoAPI.LOW_SHIPPING_FRAMED_PROFILES;
  const lowTier = all.filter(
    (p) => p.id.startsWith("low_") || (p.targetKb && p.targetKb <= 50)
  );
  const picked = lowTier.length ? lowTier : all;
  return picked.slice(0, PHASE2_PROFILE_LIMIT);
}

/**
 * Generate ranked test-lab variants. Does not call MeeshoAPI.
 */
export async function runTestLab(file, options = {}) {
  const {
    mode = "smart",
    category = "auto",
    categoryName = "",
    sscatId = null,
    targetInr = null,
    borderColor = "#ff7900",
    onProgress = () => {},
  } = options;

  const img = await loadImage(file);
  const analysis = analyzeImage(img);

  const manualCategory = category !== "auto" ? category : null;
  const detection = manualCategory
    ? {
        groupId: manualCategory,
        groupName: categoryGroupLabel(manualCategory),
        confidence: "manual",
        source: "manual",
        meeshoCategory: categoryName || null,
        meeshoParent: options.parentName || null,
        reason: "You selected this category group",
      }
    : detectCategoryGroup({
        categoryName,
        parentName: options.parentName || "",
        imageAnalysis: analysis,
      });

  const resolvedCategory = detection.groupId;

  onProgress("Phase 1: analyzing image…");
  const smartPlan = mode === "smart" ? getSmartPlan(img, resolvedCategory) : null;
  if (smartPlan?.summary) {
    onProgress(`Smart Auto: ${smartPlan.summary}`);
  }

  const ranked = await optimizeImage(img, {
    mode,
    category: resolvedCategory,
    borderColor,
    targetInr: targetInr ? Number(targetInr) : null,
    onProgress,
  });

  onProgress("Phase 1: encoding previews…");
  const results = [];
  for (let i = 0; i < ranked.length; i++) {
    const v = ranked[i];
    v.dataUrl = await blobToDataUrl(v.blob);
    results.push(variantToResult(v, i));
  }

  return {
    success: results.length > 0,
    results,
    analysis: {
      ...analysis,
      resolvedCategory,
      category,
      categoryDetection: detection,
      smartPlan,
    },
    localOnly: true,
    testLab: true,
  };
}

/** Build Live-mode ₹49 framed candidates for Phase 2. */
export async function generatePhase2Framed(file, onProgress = () => {}) {
  if (typeof MeeshoAPI === "undefined" || !MeeshoAPI.generateFramedVariation) {
    return [];
  }

  const blob = file instanceof Blob ? file : file;
  const profiles = phase2Profiles();
  const out = [];

  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    onProgress(`Phase 2: ${profile.id} (${profile.targetKb}KB)…`);
    try {
      const variation = await MeeshoAPI.generateFramedVariation(
        blob,
        50000 + i,
        profile
      );
      if (!variation?.dataUrl) continue;

      const kb =
        variation.meta?.actualKb ||
        Math.max(1, Math.ceil((variation.blob?.size || 0) / 1024));
      const estInr = estimateImageShipping({
        bytes: (variation.blob?.size || kb * 1024),
        width: variation.meta?.canvasW,
        height: variation.meta?.canvasH,
        path: "framed_live",
      });

      out.push(
        variantToResult(
          {
            blob: variation.blob,
            dataUrl: variation.dataUrl,
            path: "framed_live",
            mode: "Low ₹49 frame",
            label: `${profile.id} · ${kb}KB`,
            estInr,
            kb,
            width: variation.meta?.canvasW,
            height: variation.meta?.canvasH,
            layers: variation.layers,
            variantStyle: "framed",
            profileId: profile.id,
            phase2: true,
          },
          1000 + i
        )
      );
    } catch (e) {
      console.warn("Phase 2 framed failed:", profile.id, e);
    }
  }

  return out;
}

/** Live Meesho upload + getTransferPrice for top candidates. */
export async function verifyTestLabLive(
  results,
  maxCount = 10,
  onProgress = () => {},
  options = {}
) {
  if (typeof MeeshoAPI === "undefined" || !MeeshoAPI.uploadImage) {
    return { verified: [], errors: ["MeeshoAPI not available"] };
  }

  if (!syncMeeshoSession(options.sscatId)) {
    return { verified: [], errors: ["Meesho session not ready"] };
  }

  const targetInr = options.targetInr ? Number(options.targetInr) : null;
  const slice = options.pickDiverse
    ? pickLiveVerifyCandidates(results, maxCount)
    : results.slice(0, maxCount);
  const verified = [];
  const errors = [];
  let bestLive = Infinity;

  for (let i = 0; i < slice.length; i++) {
    const row = slice[i];
    const label = row.name || row.meta?.path || `variant ${i + 1}`;
    onProgress(`Live ₹ check ${i + 1}/${slice.length}: ${label}…`);

    try {
      let blob = row.blob instanceof Blob ? row.blob : null;
      if (!blob) {
        const url = row.pricingImageUrl || row.dataUrl || row.imageUrl;
        if (!url) {
          errors.push(`${label}: no image data`);
          continue;
        }
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("fetch failed");
        blob = await resp.blob();
      }

      const imageUrl = await MeeshoAPI.uploadImage(
        blob,
        `testlab-p2-${Date.now()}-${i}.jpg`
      );
      let uploaded = imageUrl;
      if (!uploaded) {
        await new Promise((r) => setTimeout(r, 300));
        uploaded = await MeeshoAPI.uploadImage(
          blob,
          `testlab-retry-${Date.now()}-${i}.jpg`
        );
      }
      if (!uploaded) {
        errors.push(`${label}: upload failed`);
        continue;
      }

      const priceData = await MeeshoAPI.getShippingCharges(uploaded);
      if (!priceData || priceData.shippingCharges == null) {
        errors.push(`${label}: price API failed`);
        continue;
      }

      row.shippingCost = priceData.shippingCharges || 0;
      row.duplicatePid = priceData.duplicatePid;
      row.isVerified = !!priceData.duplicatePid;
      row.uploadedUrl = uploaded;
      row.liveChecked = true;
      if (!row.dataUrl && row.pricingImageUrl) row.dataUrl = row.pricingImageUrl;
      verified.push(row);

      if (row.shippingCost > 0 && row.shippingCost < bestLive) {
        bestLive = row.shippingCost;
      }

      // Stop early when we hit target band (saves API calls)
      if (targetInr && row.shippingCost > 0 && row.shippingCost <= targetInr) {
        onProgress(`Target ≤₹${targetInr} found (₹${row.shippingCost}) — stopping hunt`);
        break;
      }
    } catch (e) {
      console.warn("Test lab live verify failed:", e);
      errors.push(`${label}: ${e.message || "error"}`);
    }

    if (i < slice.length - 1) {
      await new Promise((r) => setTimeout(r, LIVE_VERIFY_DELAY_MS));
    }
  }

  verified.sort((a, b) => (a.shippingCost || 999) - (b.shippingCost || 999));
  return { verified, errors, bestLive: bestLive < Infinity ? bestLive : null };
}

/**
 * Phase 2 — add ₹49 framed variants + live Meesho hunt for lowest ₹.
 * Returns merged, re-ranked results (raw rows, not mapResultFromApi).
 */
export async function runPhase2LiveHunt(file, phase1Results, options = {}) {
  const {
    sscatId = null,
    onProgress = () => {},
    maxVerify = DEFAULT_MAX_VERIFY,
    targetInr = null,
  } = options;

  if (!syncMeeshoSession(sscatId)) {
    return {
      results: phase1Results,
      phase2: false,
      error: "Meesho session not ready — add Supplier ID + Browser ID",
    };
  }

  onProgress("Phase 2: building ₹49 framed candidates…");
  const framed = await generatePhase2Framed(file, onProgress);

  const merged = [...phase1Results];
  const seen = new Set(merged.map((r) => r.variantId));
  for (const row of framed) {
    if (!seen.has(row.variantId)) {
      merged.push(row);
      seen.add(row.variantId);
    }
  }

  const candidates = pickLiveVerifyCandidates(merged, maxVerify);
  onProgress(
    `Phase 2: live Meesho hunt (${candidates.length} candidates, ₹49 frames first)…`
  );
  const verify = await verifyTestLabLive(merged, maxVerify, onProgress, {
    sscatId,
    targetInr,
    pickDiverse: true,
  });

  const sorted = sortByBestPrice(merged);
  const bestLive = sorted.find((r) => r.shippingCost > 0);

  return {
    results: sorted,
    phase2: true,
    framedCount: framed.length,
    verifiedCount: verify.verified.length,
    errors: verify.errors,
    bestLive: bestLive
      ? { name: bestLive.name, shippingCost: bestLive.shippingCost }
      : null,
    targetReached:
      targetInr && verify.bestLive != null && verify.bestLive <= targetInr,
  };
}

if (typeof window !== "undefined") {
  window.TestLabOptimizer = {
    ready: true,
    runTestLab,
    runPhase2LiveHunt,
    generatePhase2Framed,
    verifyTestLabLive,
    pickLiveVerifyCandidates,
    getSessionGuidance,
    getSmartPlan,
    analyzeImage,
    detectCategoryGroup,
    previewCategoryDetection,
    previewCategoryDetectionWithFile,
    categoryGroupFromSelection,
    categoryGroupLabel,
    CATEGORIES,
    MODES,
    TARGET_SHIPPING,
    formatInr,
    estimateImageShipping,
  };

  window.__testLabReady = true;
  window.__testLabLoadError = null;
  window.dispatchEvent(new Event("testlab-ready"));
}
