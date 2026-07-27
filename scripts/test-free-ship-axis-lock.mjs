/**
 * Unit tests: free-shipping badge swap + axis lock behavior.
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
  updatePlacementSliderAxis,
  setPlacementAxisLock,
  setPlacementSizeLock,
  updatePlacementSize,
  FREE_SHIPPING_BADGE_VALUE,
  placementChangedFromDefault,
} = SFC;

const layers = {
  _staticFrame: { style: "lifestyle_promo", outerW: 800, outerH: 1000, px: 40, py: 40, dw: 720, dh: 920 },
  _badgePlacements: [
    {
      id: "lifestyle-ship",
      kind: "freeShipping",
      _freeShippingSlot: true,
      size: 120,
      x: 200,
      y: 500,
      posH: 40,
      posV: 60,
      lockH: true,
      lockV: true,
    },
  ],
  _staticDefaults: {
    frame: {},
    placements: {
      "lifestyle-ship": {
        kind: "freeShipping",
        freeShippingSlot: true,
        posH: 40,
        posV: 60,
        sizePct: 100,
        hidden: false,
      },
    },
  },
};

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const ship = () => layers._badgePlacements[0];

assert(
  updatePlacementBadge(layers, "lifestyle-ship", "7"),
  "free shipping -> badge 7",
);
assert(ship().kind === "badge" && ship().num === 7, "converted to badge num 7");

assert(
  updatePlacementBadge(layers, "lifestyle-ship", FREE_SHIPPING_BADGE_VALUE),
  "badge -> free shipping restore",
);
assert(ship().kind === "freeShipping" && ship().num == null, "restored free shipping");

assert(setPlacementAxisLock(layers, "lifestyle-ship", "h", false), "unlock H");
assert(
  !updatePlacementSliderAxis(layers, "lifestyle-ship", "v", 80),
  "locked V ignores vertical update",
);
assert(
  updatePlacementSliderAxis(layers, "lifestyle-ship", "h", 55, { autoLock: true }),
  "unlocked H updates",
);
assert(ship().posH === 55 && ship().lockH === true, "H auto-locks after change");
assert(ship().posV === 60, "V unchanged when only H moved");

assert(
  !updatePlacementSize(layers, "lifestyle-ship", 150),
  "locked size ignores update",
);
assert(setPlacementSizeLock(layers, "lifestyle-ship", false), "unlock size");
assert(
  updatePlacementSize(layers, "lifestyle-ship", 150, { autoLock: true }),
  "unlocked size updates",
);
assert(ship().sizePct === 150 && ship().lockSize === true, "size auto-locks after change");

assert(
  placementChangedFromDefault(ship(), layers._staticDefaults.placements["lifestyle-ship"]),
  "H move marks placement edited",
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll free-shipping / axis-lock tests passed");
