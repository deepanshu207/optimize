/**
 * Smart Auto plan — Meesho-aligned strategy selection.
 * Meesho uses primary image metadata (size, bulk, background) for shipping tiers.
 * Compact white-studio crops + low KB generally score lowest.
 */

export const TALL_ASPECT = 1.2;
export const WIDE_COLLAGE_ASPECT = 1.35;

/** Category → preferred strategy keys (order = priority). */
const CATEGORY_STRATEGIES = {
  jewellery: ["studio_ultra", "flatlay", "studio"],
  footwear: ["studio_ultra", "flatlay", "studio"],
  lingerie: ["collage", "flatlay", "tall", "studio_ultra"],
  apparel: ["studio_ultra", "tall", "flatlay", "studio"],
  home: ["studio_ultra", "studio", "flatlay"],
  general: ["studio_ultra", "studio", "flatlay"],
};

/** Lower = better when est ₹ is tied. */
export const PATH_PRIORITY = {
  studio_ultra: 0,
  studio: 1,
  flatlay: 2,
  tall: 3,
  framed_live: 4,
  framed_low: 5,
  collage_back: 6,
  collage_front: 7,
  framed: 9,
};

/**
 * Build strategy list for Smart Auto from image analysis + category group.
 */
export function buildSmartPlan(category, analysis) {
  const studioBg = !!analysis.studioBg;
  const tall = !!analysis.tall;
  const collage = !!analysis.collage;
  const cat = category || "general";

  const strategies = [];
  const tips = [];

  tips.push(
    "Meesho reads your primary image for shipping — use compact product, minimal empty background."
  );

  const base = [...(CATEGORY_STRATEGIES[cat] || CATEGORY_STRATEGIES.general)];
  for (const s of base) strategies.push(s);

  if (tall && !strategies.includes("tall")) {
    strategies.push("tall");
    tips.push("Tall portrait detected → 703×1024 frame often lands ~₹50.");
  }
  if (collage && cat !== "lingerie" && !strategies.includes("collage")) {
    strategies.push("collage");
    tips.push("Wide image → collage split can reduce perceived bulk.");
  }
  if (!studioBg) {
    if (!strategies.includes("framed_low")) strategies.push("framed_low");
    tips.push("Busy background → white studio + Phase 2 ₹49 frames recommended.");
  } else {
    tips.push("Clean background → studio compress usually best; Phase 2 adds ₹49 frames.");
  }

  // Orange promo frame (₹93) is never in Smart Auto — low ROI vs Phase 2 blue frames
  const unique = [...new Set(strategies)].filter((s) => s !== "framed");

  return {
    strategies: unique,
    category: cat,
    tips,
    summary: unique.map((s) => strategyLabel(s)).join(" → "),
  };
}

export function strategyLabel(key) {
  const labels = {
    studio_ultra: "Studio Ultra",
    studio: "Studio White",
    tall: "Tall ₹50",
    flatlay: "Flat-Lay",
    framed_low: "Framed Low",
    framed: "Framed Promo",
    collage: "Collage",
    framed_live: "₹49 frame",
  };
  return labels[key] || key;
}

export function compareVariants(a, b) {
  const estDiff = a.estInr - b.estInr;
  if (estDiff !== 0) return estDiff;
  const pa = PATH_PRIORITY[a.path] ?? 50;
  const pb = PATH_PRIORITY[b.path] ?? 50;
  if (pa !== pb) return pa - pb;
  if (a.recommended && !b.recommended) return -1;
  if (!a.recommended && b.recommended) return 1;
  return a.kb - b.kb;
}

export function getSessionGuidance(sessionReady, phase2Enabled) {
  if (sessionReady && phase2Enabled) {
    return "Session ready — Phase 2 will live-check Meesho prices on top candidates.";
  }
  if (phase2Enabled) {
    return "Add Supplier ID + Browser ID on Live tab to unlock Phase 2 live ₹ hunt.";
  }
  return "Enable Phase 2 to verify live Meesho shipping (needs session).";
}
