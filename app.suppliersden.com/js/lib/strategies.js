/**
 * Meesho shipping reducer — optimization strategies.
 * Runs in browser; ranks variants by estimated shipping ₹.
 */

import { compressStudioToKb, compressFramedToKb } from "./encoder.js";
import {
  imageToWhiteCanvas,
  trimMargins,
  fitSquare,
  addFrame,
  tallFrame,
  isWideCollage,
  splitCollagePanel,
  isStudioBackground,
  isTallPortrait,
  measureNearWhiteRatio,
  measureWhiteRatio,
} from "./canvas-utils.js";
import { estimateImageShipping } from "./shipping.js";

const STUDIO_ULTRA = [16, 18, 20, 22];
const STUDIO_BALANCED = [20, 24, 28, 32, 36, 40];
const FRAMED_SLABS = [91, 92, 93];
const FRAMED_LOW = [64, 66, 68, 71];
const TALL_SLABS = [44, 46, 48, 50, 52];
const FLATLAY_SLABS = [38, 40, 42, 44];

function yieldMain() {
  return new Promise((r) => setTimeout(r, 0));
}

async function variantFrom(canvas, blob, meta) {
  const v = {
    blob,
    bytes: blob.size,
    width: meta.width ?? canvas.width,
    height: meta.height ?? canvas.height,
    path: meta.path,
    mode: meta.mode,
    label: meta.label,
    recommended: !!meta.recommended,
    lowest: !!meta.lowest,
  };
  v.estInr = estimateImageShipping(v);
  v.kb = Math.ceil(blob.size / 1024);
  return v;
}

async function studioVariants(img, tiers, path, modeName, onProgress) {
  const out = [];
  let canvas = trimMargins(imageToWhiteCanvas(img), 0.02);
  const wr = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
  for (let i = 0; i < tiers.length; i++) {
    const kb = tiers[i];
    if (onProgress) onProgress(`Studio · ${kb}KB`);
    const blob = await compressStudioToKb(canvas, kb, wr);
    out.push(
      await variantFrom(canvas, blob, {
        path,
        mode: modeName,
        label: `${modeName} · ${kb}KB · ${canvas.width}×${canvas.height}`,
        recommended: kb === tiers[1] || kb === tiers[Math.floor(tiers.length / 2)],
        lowest: i === 0,
        width: canvas.width,
        height: canvas.height,
      })
    );
    await yieldMain();
  }
  return out;
}

async function framedVariants(img, tiers, path, modeName, frameOpts, onProgress) {
  const out = [];
  const base = trimMargins(imageToWhiteCanvas(img), 0.02);
  const framed = addFrame(base, frameOpts);
  for (let i = 0; i < tiers.length; i++) {
    const kb = tiers[i];
    if (onProgress) onProgress(`Framed · ${kb}KB`);
    const blob = await compressFramedToKb(framed, kb);
    out.push(
      await variantFrom(framed, blob, {
        path,
        mode: modeName,
        label: `${modeName} · ${kb}KB · ${framed.width}×${framed.height}`,
        recommended: kb === 93 || kb === 66,
        lowest: i === 0,
        width: framed.width,
        height: framed.height,
      })
    );
    await yieldMain();
  }
  return out;
}

async function tallVariants(img, onProgress) {
  const out = [];
  const framed = tallFrame(img);
  for (const kb of TALL_SLABS) {
    if (onProgress) onProgress(`Tall ₹50 · ${kb}KB`);
    const blob = await compressFramedToKb(framed, kb);
    out.push(
      await variantFrom(framed, blob, {
        path: "tall",
        mode: "Tall ₹50",
        label: `Tall ₹50 · ${kb}KB · 703×1024`,
        recommended: kb === 48 || kb === 50,
        lowest: kb === TALL_SLABS[0],
        width: 703,
        height: 1024,
      })
    );
    await yieldMain();
  }
  return out;
}

async function flatlayVariants(img, onProgress) {
  const out = [];
  const sq = fitSquare(trimMargins(imageToWhiteCanvas(img), 0.02), 1024, 0.84);
  const wr = Math.max(measureNearWhiteRatio(sq), measureWhiteRatio(sq));
  for (const kb of FLATLAY_SLABS) {
    if (onProgress) onProgress(`Flat-Lay · ${kb}KB`);
    const blob = await compressStudioToKb(sq, kb, wr);
    out.push(
      await variantFrom(sq, blob, {
        path: "flatlay",
        mode: "Flat-Lay",
        label: `Flat-Lay · ${kb}KB · 1024×1024`,
        recommended: kb === 40,
        lowest: kb === FLATLAY_SLABS[0],
        width: 1024,
        height: 1024,
      })
    );
    await yieldMain();
  }
  return out;
}

async function collageVariants(img, onProgress) {
  const out = [];
  const left = splitCollagePanel(img, "left");
  const right = splitCollagePanel(img, "right");
  const panels = [
    { canvas: fitSquare(left, 1200, 0.68), path: "collage_front", name: "Collage front" },
    { canvas: fitSquare(right, 1200, 0.86), path: "collage_back", name: "Collage back" },
  ];
  const tiers = [44, 48, 55, 58];
  for (const panel of panels) {
    const wr = measureNearWhiteRatio(panel.canvas);
    for (const kb of tiers) {
      if (onProgress) onProgress(`${panel.name} · ${kb}KB`);
      const blob = await compressStudioToKb(panel.canvas, kb, wr);
      out.push(
        await variantFrom(panel.canvas, blob, {
          path: panel.path,
          mode: "Collage",
          label: `${panel.name} · ${kb}KB`,
          recommended: panel.path === "collage_back" && kb === 55,
          lowest: false,
          width: panel.canvas.width,
          height: panel.canvas.height,
        })
      );
      await yieldMain();
    }
  }
  return out;
}

function dedupeAndRank(variants, max = 16) {
  const seen = new Set();
  const unique = [];
  for (const v of variants) {
    const key = `${v.path}-${v.kb}-${v.width}x${v.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(v);
  }
  unique.sort((a, b) => a.estInr - b.estInr || a.kb - b.kb);
  if (unique.length) unique[0].best = true;
  return unique.slice(0, max);
}

function strategiesForImage(img, mode, category) {
  const list = [];
  const studio = isStudioBackground(img);
  const tall = isTallPortrait(img);
  const collage = isWideCollage(img);

  if (mode === "smart") {
    list.push("studio_ultra", "studio");
    if (tall || category === "apparel") list.push("tall");
    if (!studio) list.push("framed_low", "framed");
    list.push("flatlay");
    if (collage || category === "lingerie") list.push("collage");
    return [...new Set(list)];
  }

  const map = {
    studio: ["studio"],
    studio_ultra: ["studio_ultra"],
    tall: ["tall"],
    flatlay: ["flatlay"],
    framed: ["framed"],
    framed_low: ["framed_low"],
    collage: ["collage"],
  };
  return map[mode] || ["studio"];
}

export async function optimizeImage(img, options = {}) {
  const {
    mode = "smart",
    category = "auto",
    borderColor = "#ff7900",
    targetInr = null,
    onProgress = () => {},
  } = options;

  const strategies = strategiesForImage(img, mode, category);
  const all = [];
  const frameOpts = { borderColor, stickers: true };

  for (const s of strategies) {
    onProgress(`Running ${s}…`);
    if (s === "studio_ultra") {
      all.push(...(await studioVariants(img, STUDIO_ULTRA, "studio_ultra", "Studio Ultra", onProgress)));
    } else if (s === "studio") {
      all.push(...(await studioVariants(img, STUDIO_BALANCED, "studio", "Studio White", onProgress)));
    } else if (s === "tall") {
      all.push(...(await tallVariants(img, onProgress)));
    } else if (s === "flatlay") {
      all.push(...(await flatlayVariants(img, onProgress)));
    } else if (s === "framed") {
      all.push(...(await framedVariants(img, FRAMED_SLABS, "framed", "Framed", frameOpts, onProgress)));
    } else if (s === "framed_low") {
      all.push(
        ...(await framedVariants(img, FRAMED_LOW, "framed_low", "Framed Low", frameOpts, onProgress))
      );
    } else if (s === "collage") {
      all.push(...(await collageVariants(img, onProgress)));
    }
  }

  let ranked = dedupeAndRank(all);
  if (targetInr) {
    const filtered = ranked.filter((v) => v.estInr <= targetInr);
    if (filtered.length) ranked = filtered;
  }
  return ranked;
}

export function analyzeImage(img) {
  return {
    width: img.width,
    height: img.height,
    aspect: (img.width / img.height).toFixed(2),
    studioBg: isStudioBackground(img),
    tall: isTallPortrait(img),
    collage: isWideCollage(img),
    suggested: isWideCollage(img)
      ? "Collage split + Flat-Lay"
      : isTallPortrait(img)
        ? "Tall ₹50 frame"
        : isStudioBackground(img)
          ? "Studio White compress"
          : "Smart Auto (studio + framed)",
  };
}
