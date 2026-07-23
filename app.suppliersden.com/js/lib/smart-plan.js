/**
 * Smart Auto plan — Meesho-aligned strategy selection.
 *
 * Meesho guidelines (apparel / soft goods):
 * - Shipping slab is inferred from the product bounding box in the primary image.
 * - Use compact product on white square (65–70% coverage), min ~1200×1200 px.
 * - Avoid spread flat-lay for kurtis/sarees — it inflates perceived volume.
 * - Always verify live ₹ in Supplier Panel (Phase 2).
 *
 * Hard goods (home / electronics):
 * - Meesho bills from declared package dimensions (L×B×H÷5000), not the photo.
 */

export const TALL_ASPECT = 1.2;
export const WIDE_COLLAGE_ASPECT = 1.35;

export const CATEGORY_GROUP_LABELS = {
  apparel: "Apparel / Kurti",
  lingerie: "Lingerie / Bra",
  footwear: "Footwear",
  home: "Home & Kitchen",
  electronics: "Electronics",
  jewellery: "Jewellery",
  general: "General",
};

/** Meesho sscat name/parent → strategy group (order matters — first match wins). */
const CATEGORY_DETECT_RULES = [
  {
    id: "jewellery",
    re: /jewel|ring|necklace|pendant|anklet|bracelet|bangle|locket|earring|mangalsutra|nose pin|toe ring|brooch/i,
  },
  {
    id: "footwear",
    re: /shoe|sandal|boot|slipper|bellies|flip.?flop|slider|jutti|footwear|sneaker|floaters|loafer|heel|jutti/i,
  },
  {
    id: "electronics",
    re: /phone|mobile|charger|cable|earphone|electronic|gadget|usb|power.?bank|adapter|bluetooth|speaker|trimmer|headphone|data cable|smartwatch|watch strap/i,
  },
  {
    id: "home",
    re: /bed|bath|towel|rug|bean bag|bedding|kitchen|cookware|container|curtain|pillow|cushion|mattress|bedsheet|home decor|storage|dinnerware|utensil/i,
  },
  {
    id: "lingerie",
    re: /babydoll|nightdress|nightsuit|night.?suit|bra|lingerie|panty|brief|innerwear|camisole|nighty|shapewear|maternity/i,
  },
  {
    id: "apparel",
    re: /kurti|kurta|saree|sari|dress|suit|gown|lehenga|dupatta|sharara|palazzo|ethnic|jumpsuit|top wear|bottomwear|tshirt|t.?shirt|shirt|jean|jegging|blouse|petticoat|fabric|sherwani|dhoti|salwar|churidar|legging|skirt|shorts|jacket|hoodie|sweater|cardigan|kurta set|co.?ord|western gown/i,
  },
];

/**
 * Detect strategy category group from Meesho category + optional image hints.
 */
export function detectCategoryGroup({
  categoryName = "",
  parentName = "",
  imageAnalysis = null,
} = {}) {
  const combined = `${categoryName} ${parentName}`.trim();
  let matchedId = null;

  if (combined) {
    for (const rule of CATEGORY_DETECT_RULES) {
      if (rule.re.test(combined)) {
        matchedId = rule.id;
        break;
      }
    }
  }

  if (matchedId) {
    const label = categoryName
      ? `“${categoryName}”${parentName ? ` (${parentName})` : ""}`
      : parentName;
    return {
      groupId: matchedId,
      groupName: CATEGORY_GROUP_LABELS[matchedId],
      confidence: "high",
      source: "meesho_category",
      meeshoCategory: categoryName || null,
      meeshoParent: parentName || null,
      reason: `Matched Meesho category ${label}`,
    };
  }

  if (imageAnalysis?.collage) {
    return {
      groupId: "lingerie",
      groupName: CATEGORY_GROUP_LABELS.lingerie,
      confidence: "medium",
      source: "image_wide",
      meeshoCategory: categoryName || null,
      meeshoParent: parentName || null,
      reason: categoryName
        ? `Wide image — guessed Lingerie (Meesho “${categoryName}” not mapped)`
        : "Wide image — guessed Lingerie / Bra",
    };
  }

  if (imageAnalysis?.tall) {
    return {
      groupId: "apparel",
      groupName: CATEGORY_GROUP_LABELS.apparel,
      confidence: "medium",
      source: "image_tall",
      meeshoCategory: categoryName || null,
      meeshoParent: parentName || null,
      reason: categoryName
        ? `Tall portrait — guessed Apparel (Meesho “${categoryName}” not mapped)`
        : "Tall portrait — guessed Apparel / Kurti",
    };
  }

  return {
    groupId: "general",
    groupName: CATEGORY_GROUP_LABELS.general,
    confidence: combined ? "low" : "low",
    source: "default",
    meeshoCategory: categoryName || null,
    meeshoParent: parentName || null,
    reason: categoryName
      ? `Could not map Meesho “${categoryName}” — pick category group below if wrong`
      : "No Meesho category selected — pick category group below",
  };
}

export function categoryGroupLabel(groupId) {
  return CATEGORY_GROUP_LABELS[groupId] || CATEGORY_GROUP_LABELS.general;
}

/** Category → preferred strategy keys (order = priority). */
const CATEGORY_STRATEGIES = {
  jewellery: ["studio_ultra", "studio", "flatlay"],
  footwear: ["studio_ultra", "flatlay", "studio"],
  lingerie: ["collage", "studio_ultra", "flatlay", "tall"],
  apparel: ["studio_ultra", "tall", "studio"],
  home: ["studio_ultra", "studio"],
  electronics: ["studio_ultra", "studio"],
  general: ["studio_ultra", "studio", "flatlay"],
};

/** Lower = better when est ₹ is tied. */
export const PATH_PRIORITY = {
  studio_ultra: 0,
  studio: 1,
  tall: 2,
  flatlay: 4,
  framed_live: 3,
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

  if (cat === "home" || cat === "electronics") {
    tips.push(
      "Meesho bills home/electronics from declared package size (L×B×H÷5000) — use a smaller box in catalog."
    );
    tips.push("Photo still needs white background + ≥1200×1200 px for listing QC.");
  } else {
    tips.push(
      "Meesho reads your primary image bounding box for shipping — compact product (~65–70% of square), pure white background."
    );
    tips.push("Avoid spread flat-lay on kurtis/sarees; use studio or tall frame instead.");
  }

  const base = [...(CATEGORY_STRATEGIES[cat] || CATEGORY_STRATEGIES.general)];
  for (const s of base) strategies.push(s);

  if (tall && cat !== "home" && cat !== "electronics" && !strategies.includes("tall")) {
    strategies.push("tall");
    tips.push("Tall portrait → 703×1024 frame often lands ~₹50 on Meesho.");
  }
  if (collage && cat !== "lingerie" && cat !== "home" && cat !== "electronics" && !strategies.includes("collage")) {
    strategies.push("collage");
    tips.push("Wide image → collage split shrinks each panel's bounding box.");
  }
  if (!studioBg && cat !== "home" && cat !== "electronics") {
    if (!strategies.includes("framed_low")) strategies.push("framed_low");
    tips.push("Busy background → white studio + Phase 2 ₹49 frame live-check.");
  } else if (cat !== "home" && cat !== "electronics") {
    tips.push("Clean background → studio compress is usually best; Phase 2 adds ₹49 frames.");
  }

  tips.push("Always confirm lowest live ₹ in Supplier Panel before switching primary image.");

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
    return "Session ready — Phase 2 live-checks Meesho ₹ on top candidates (recommended).";
  }
  if (phase2Enabled) {
    return "Add Supplier ID + Browser ID on Live tab to unlock Phase 2 live ₹ hunt.";
  }
  return "Enable Phase 2 to verify live Meesho shipping — estimates alone are not enough.";
}
