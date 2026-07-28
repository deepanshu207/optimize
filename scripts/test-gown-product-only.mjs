/**
 * Gown static layers: productOnly must stay badge-free for compose rebuild.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const gownCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/liveGownStatic.mjs"),
  "utf8",
);
const composeCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/staticFrameCompose.mjs"),
  "utf8",
);

assert(
  gownCode.includes("noStickersCanvas.getContext"),
  "gown captures noStickers before badges",
);
assert(
  gownCode.includes("drawImage(noStickersCanvas, px, py, dw, dh"),
  "productOnly crops noStickersCanvas (badge-free)",
);
assert(
  !gownCode.includes("nbCtx.drawImage(canvas, px, py, dw, dh"),
  "noBorder base is badge-free before sticker pass",
);
assert(
  composeCode.includes('raw === "gown-art"'),
  "compose supports restoring gown default art",
);
assert(
  composeCode.includes('p.kind === "freeShipping" || p.kind === "gownArt"'),
  "numbered badge swap converts gownArt to badge kind",
);
assert(
  composeCode.includes("squareBadgeBox(w, h)"),
  "gown numbered badges use square box like tall static",
);
assert(
  composeCode.includes("slotW: p.w"),
  "gown slot dimensions snapshotted for art restore",
);
assert(
  /const\s*\{[^}]*\binnerStroke\b[^}]*\}\s*=\s*built/.test(gownCode),
  "buildGownStaticLayers destructures innerStroke from built",
);
assert(
  gownCode.includes("baseInnerStroke: innerStroke"),
  "_staticFrame baseInnerStroke uses destructured innerStroke",
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll gown productOnly checks passed");
