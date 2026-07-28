/**
 * Badge dropdown swap — no overlap / correct kind routing (gown, tall, lifestyle).
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

const {
  updatePlacementBadge,
  gownArtBadgeValue,
  isGownArtBadgeValue,
  GOWN_SLOT_LABELS,
  shouldRebuildStaticFrame,
} = SFC;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const gownLayers = {
  productOnly: "data:image/jpeg;base64,/9j/4AAQ",
  noStickers: "data:image/jpeg;base64,/9j/4AAQ",
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

const best = () => gownLayers._badgePlacements[0];

assert(isGownArtBadgeValue("gown-art:gown-best"), "detect gown art value");
assert(gownArtBadgeValue("gown-flash") === "gown-art:gown-flash", "gown art value helper");
assert(GOWN_SLOT_LABELS["gown-best"] === "Best PRICE", "gown label map");

assert(
  updatePlacementBadge(gownLayers, "gown-best", "7"),
  "gown art -> badge 7",
);
assert(best().kind === "badge" && best().num === 7, "gown converts to numbered badge");
assert(best().gownSlot === "gown-best", "gown slot preserved for restore");

assert(
  updatePlacementBadge(gownLayers, "gown-best", gownArtBadgeValue("gown-best")),
  "badge 7 -> gown default art",
);
assert(best().kind === "gownArt" && best().num == null, "restored gown art kind");

assert(
  !updatePlacementBadge(gownLayers, "gown-best", gownArtBadgeValue("gown-flash")),
  "reject wrong slot gown art",
);

assert(
  shouldRebuildStaticFrame(gownLayers, { staticAppearanceEdited: true }),
  "appearance edit rebuilds frame",
);
best().num = 12;
assert(
  shouldRebuildStaticFrame(gownLayers, {}),
  "badge num change triggers rebuild via placement diff",
);

const contentCode = readFileSync(resolve(root, "app.suppliersden.com/content.js"), "utf8");
const composeCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/staticFrameCompose.mjs"),
  "utf8",
);
assert(contentCode.includes("gownLabels[slot.id]"), "editor shows gown default art option");
assert(contentCode.includes("badgesRepositioned"), "compose passes badge reposition flag");
assert(
  composeCode.includes('p.kind === "badge" && p.num != null'),
  "numbered badges drawn before gown/tall art fallback",
);
assert(composeCode.includes("forceCleanFrame"), "compose rebuilds clean frame for stickers");

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll static badge swap checks passed");
