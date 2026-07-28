/**
 * Badge dropdown swap — no stacked stickers on static promos.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const SFC = await import(
  pathToFileURL(resolve(root, "app.suppliersden.com/js/staticFrameCompose.mjs")).href
);

const { updatePlacementBadge, shouldRebuildStaticFrame } = SFC;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const layers = {
  productOnly: "data:image/jpeg;base64,/9j/4AAQ",
  noStickers: "data:image/jpeg;base64,/9j/4AAQ",
  full: "data:image/jpeg;base64,/9j/4BBQ",
  _staticFrame: {
    style: "gown_static",
    outerW: 773,
    outerH: 1094,
    px: 56,
    py: 56,
    dw: 661,
    dh: 982,
    border: 19,
    whitePad: 37,
    borderThicknessPct: 100,
  },
  _badgePlacements: [
    {
      id: "gown-best",
      kind: "gownArt",
      gownSlot: "gown-best",
      w: 120,
      h: 84,
      x: 60,
      y: 60,
      drawn: true,
    },
  ],
  _staticDefaults: {
    frame: { borderThicknessPct: 100 },
    placements: {
      "gown-best": { kind: "gownArt", hidden: false, posH: 5, posV: 5, sizePct: 100 },
    },
  },
};

const p = () => layers._badgePlacements[0];

assert(updatePlacementBadge(layers, "gown-best", "7"), "gown art -> badge 7");
assert(p().kind === "badge" && p().num === 7, "numbered badge kind");

assert(updatePlacementBadge(layers, "gown-best", "gown-art"), "badge 7 -> gown art");
assert(p().kind === "gownArt" && p().num == null, "restored gown art");

assert(
  shouldRebuildStaticFrame(layers, { staticAppearanceEdited: true }),
  "appearance edit rebuilds",
);

const composeCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/staticFrameCompose.mjs"),
  "utf8",
);
const contentCode = readFileSync(resolve(root, "app.suppliersden.com/content.js"), "utf8");

assert(
  composeCode.includes('p.kind === "badge" && p.num != null'),
  "numbered badges drawn before gown slot art",
);
assert(
  composeCode.includes("url: layers.noStickers || layers.productOnly, drawBadges: true"),
  "sticker compose base uses noStickers not full",
);
assert(contentCode.includes('value="gown-art"'), "gown default art dropdown option");
assert(
  contentCode.includes('if (preview && row.imageUrl) preview.src = row.imageUrl'),
  "badge swap updates preview only",
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll static badge swap checks passed");
