/**
 * TEST LAB ONLY — isolated from Live mode (MeeshoAPI.generateLocalVariations / smartSearch).
 * Restores category-aware strategies from the removed shipping reducer module.
 */
import { optimizeImage, analyzeImage } from "./lib/strategies.js";
import { loadImage } from "./lib/canvas-utils.js";
import { blobToDataUrl } from "./lib/encoder.js";
import {
  CATEGORIES,
  MODES,
  TARGET_SHIPPING,
  formatInr,
  estimateImageShipping,
} from "./lib/shipping.js";

const APPAREL_RE =
  /kurti|saree|dress|suit|gown|babydoll|jumpsuit|western gown/i;
const TOPS_RE = /tshirt|shirt|jean|jegging|top wear/i;
const JEWELLERY_RE =
  /jewel|ring|necklace|pendant|anklet|bracelet|bangle|locket/i;
const FOOTWEAR_RE =
  /shoe|sandal|boot|slipper|bellies|flip.?flop|slider|jutti/i;
const HOME_RE = /bed|bath|towel|rug|bean bag|bedding/i;
const LINGERIE_RE = /babydoll|nightdress|nightsuit|bra|lingerie/i;

/** Map Meesho sscat id/name → strategy category id used by strategies.js */
export function categoryGroupFromSelection(sscatId, categoryName) {
  const name = String(categoryName || "");
  if (JEWELLERY_RE.test(name)) return "jewellery";
  if (FOOTWEAR_RE.test(name)) return "footwear";
  if (HOME_RE.test(name)) return "home";
  if (LINGERIE_RE.test(name)) return "lingerie";
  if (APPAREL_RE.test(name)) return "apparel";
  if (TOPS_RE.test(name)) return "apparel";
  return "general";
}

function variantToResult(v, index) {
  const kb = v.kb || Math.ceil((v.bytes || 0) / 1024);
  return {
    variantId: `test-${v.path}-${kb}-${index}`,
    name: v.label || v.mode || `Test-${index + 1}`,
    dataUrl: v.dataUrl,
    pricingImageUrl: v.dataUrl,
    imageUrl: v.dataUrl,
    variantStyle: "testlab",
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
    },
    shippingCost: 0,
    estShipping: v.estInr,
    isVerified: false,
    localOnly: true,
    testLab: true,
  };
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

  let resolvedCategory = category;
  if (category === "auto") {
    resolvedCategory = categoryGroupFromSelection(sscatId, categoryName);
    if (resolvedCategory === "general" && analysis.tall) {
      resolvedCategory = "apparel";
    }
    if (resolvedCategory === "general" && analysis.collage) {
      resolvedCategory = "lingerie";
    }
  }

  onProgress("Analyzing image…");
  const ranked = await optimizeImage(img, {
    mode,
    category: resolvedCategory,
    borderColor,
    targetInr: targetInr ? Number(targetInr) : null,
    onProgress,
  });

  onProgress("Encoding previews…");
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
    },
    localOnly: true,
    testLab: true,
  };
}

/** Optional: verify top N variants via live Meesho API (uses MeeshoAPI global). */
export async function verifyTestLabLive(results, maxCount = 5, onProgress = () => {}) {
  if (typeof MeeshoAPI === "undefined" || !MeeshoAPI.uploadImage) {
    return { verified: [], error: "MeeshoAPI not available" };
  }
  const slice = results.slice(0, maxCount);
  const verified = [];
  for (let i = 0; i < slice.length; i++) {
    const row = slice[i];
    onProgress(`Live check ${i + 1}/${slice.length}…`);
    try {
      const resp = await fetch(row.pricingImageUrl);
      const blob = await resp.blob();
      const imageUrl = await MeeshoAPI.uploadImage(blob, `testlab-${i}.jpg`);
      const priceData = await MeeshoAPI.getShippingCharges(imageUrl);
      row.shippingCost = priceData.shippingCharges || 0;
      row.duplicatePid = priceData.duplicatePid;
      row.isVerified = !!priceData.duplicatePid;
      row.uploadedUrl = imageUrl;
      verified.push(row);
    } catch (e) {
      console.warn("Test lab live verify failed:", e);
    }
  }
  verified.sort((a, b) => (a.shippingCost || 999) - (b.shippingCost || 999));
  return { verified };
}

window.TestLabOptimizer = {
  ready: true,
  runTestLab,
  verifyTestLabLive,
  analyzeImage,
  categoryGroupFromSelection,
  CATEGORIES,
  MODES,
  TARGET_SHIPPING,
  formatInr,
  estimateImageShipping,
};

window.dispatchEvent(new Event("testlab-ready"));
