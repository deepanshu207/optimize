/**
 * Unit tests for remove/add edit-flag capability logic (no browser).
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

await import(
  pathToFileURL(resolve(root, "app.suppliersden.com/js/staticFrameCompose.mjs")).href
);

const meeshoApiCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/meeshoApi.js"),
  "utf8",
);
const window = { StaticFrameCompose: globalThis.window?.StaticFrameCompose };
// eslint-disable-next-line no-eval
eval(meeshoApiCode);
const MeeshoAPI = window.MeeshoAPI;

const tallLayers = {
  full: "full",
  noStickers: "noStickers",
  noBorder: "noBorder",
  productOnly: "productOnly",
  _stickersRendered: true,
  _badgePlacements: [{ id: "tall-sale" }],
  _staticFrame: { style: "tall_static", outerW: 703, outerH: 1024 },
};

const liveLayers = {
  full: "full",
  noStickers: "noStickers",
  noBorder: "noBorder",
  productOnly: "productOnly",
  _stickersRendered: true,
  _badgePlacements: [{ id: "b0" }],
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

const removedStatic = MeeshoAPI.getEffectiveLayerCapabilities(tallLayers, {
  stickersRemoved: true,
});
assert(removedStatic.canAddStickers, "static promo: add stickers after remove");
assert(removedStatic.canRemoveStickers, "static promo: can uncheck remove stickers");
assert(
  MeeshoAPI.resolveDisplayUrl({
    layers: tallLayers,
    editFlags: { stickersRemoved: true },
    pricingImageUrl: "full",
  }) === "noStickers",
  "static promo: remove stickers preview",
);
assert(
  MeeshoAPI.resolveDisplayUrl({
    layers: tallLayers,
    editFlags: { stickersAdded: true },
    imageUrl: "noStickers",
    pricingImageUrl: "full",
  }) === "full",
  "static promo: add stickers uses full layer",
);
assert(
  MeeshoAPI.resolveDisplayUrl({
    layers: tallLayers,
    editFlags: { stickersRemoved: true },
    imageUrl: "full",
    pricingImageUrl: "full",
  }) === "noStickers",
  "static promo: remove stickers does not keep stale full imageUrl",
);

const removedLive = MeeshoAPI.getEffectiveLayerCapabilities(liveLayers, {
  stickersRemoved: true,
});
assert(removedLive.canAddStickers, "live: add stickers after remove");
assert(removedLive.canRemoveStickers, "live: can uncheck remove stickers");

const cleanLive = MeeshoAPI.getEffectiveLayerCapabilities(liveLayers, {
  cleanProduct: true,
});
assert(cleanLive.canAddStickers, "live: add stickers after clean product");
assert(cleanLive.canAddBoth, "live: add both after clean product");

const liveWithFrame = {
  ...liveLayers,
  _staticFrame: { style: "live_standard", outerW: 800, outerH: 800, px: 40, py: 40, dw: 720, dh: 720 },
};
assert(
  MeeshoAPI.resolveDisplayUrl({
    layers: liveWithFrame,
    editFlags: { borderAdded: true },
    pricingImageUrl: "full",
  }) === "noStickers",
  "live frame: borderAdded sync URL is noStickers",
);
assert(
  MeeshoAPI.resolveDisplayUrl({
    layers: liveWithFrame,
    editFlags: { stickersAdded: true },
    pricingImageUrl: "full",
  }) === "full",
  "live frame: stickersAdded on bordered variant uses full",
);
assert(
  MeeshoAPI.resolveDisplayUrl({
    layers: liveWithFrame,
    editFlags: { cleanProduct: true, stickersAdded: true },
    pricingImageUrl: "full",
  }) === "noBorder",
  "live frame: stripped product + stickersAdded uses product canvas",
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll edit-flag capability tests passed");
