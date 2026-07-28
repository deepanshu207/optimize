/**
 * Border thickness must not shift product layout (px/py/dw/dh) on any static promo style.
 */
import { applyBorderThickness, ensureFrameBases } from "../app.suppliersden.com/js/staticFrameCompose.mjs";
import { computeGownFrameGeometry } from "../app.suppliersden.com/js/liveGownStatic.mjs";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

function assertProductStable(frame, label) {
  assert(frame.px === frame.basePx, `${label}: px unchanged at ${frame.borderThicknessPct}%`);
  assert(frame.py === frame.basePy, `${label}: py unchanged at ${frame.borderThicknessPct}%`);
  assert(frame.dw === frame.baseDw, `${label}: dw unchanged at ${frame.borderThicknessPct}%`);
  assert(frame.dh === frame.baseDh, `${label}: dh unchanged at ${frame.borderThicknessPct}%`);
}

const gownBase = computeGownFrameGeometry(773, 1094);
const gown = {
  style: "gown_static",
  frameType: "tall",
  outerW: 773,
  outerH: 1094,
  ...gownBase,
  baseBorder: gownBase.border,
  baseOuterMatPad: gownBase.outerMatPad,
  baseInnerMatPad: gownBase.innerMatPad,
  baseInnerStroke: gownBase.innerStroke,
  baseWhitePad: gownBase.whitePad,
  basePx: gownBase.px,
  basePy: gownBase.py,
  baseDw: gownBase.dw,
  baseDh: gownBase.dh,
  baseWhiteX: gownBase.whiteX,
  baseWhiteY: gownBase.whiteY,
  baseWhiteW: gownBase.whiteW,
  baseWhiteH: gownBase.whiteH,
  baseInnerFrameX: gownBase.innerFrameX,
  baseInnerFrameY: gownBase.innerFrameY,
  baseInnerFrameW: gownBase.innerFrameW,
  baseInnerFrameH: gownBase.innerFrameH,
  borderThicknessPct: 100,
};

for (const pct of [50, 100, 150, 500, 1000]) {
  const f = JSON.parse(JSON.stringify(gown));
  f.borderThicknessPct = pct;
  applyBorderThickness(f);
  assertProductStable(f, "gown");
  assert(f.whiteX === f.border, `gown: border band visible at ${f.borderThicknessPct}%`);
  assert(f.border > 0, `gown: border width > 0 at ${f.borderThicknessPct}%`);
}

const showcase = {
  style: "showcase",
  frameType: "gradient",
  outerW: 400,
  outerH: 500,
  px: 30,
  py: 30,
  dw: 340,
  dh: 440,
  border: 30,
  basePx: 30,
  basePy: 30,
  baseDw: 340,
  baseDh: 440,
  baseBorder: 30,
  borderThicknessPct: 100,
};
ensureFrameBases(showcase);

for (const pct of [0, 50, 100, 200, 1000]) {
  const f = JSON.parse(JSON.stringify(showcase));
  f.borderThicknessPct = pct;
  applyBorderThickness(f);
  assertProductStable(f, "showcase");
}

const tall = {
  style: "tall_static",
  frameType: "tall",
  outerW: 703,
  outerH: 1024,
  px: 80,
  py: 120,
  dw: 500,
  dh: 750,
  border: 40,
  whitePad: 20,
  whiteX: 40,
  whiteY: 40,
  whiteW: 623,
  whiteH: 944,
  basePx: 80,
  basePy: 120,
  baseDw: 500,
  baseDh: 750,
  baseBorder: 40,
  baseWhitePad: 20,
  borderThicknessPct: 100,
};
ensureFrameBases(tall);

for (const pct of [50, 100, 150, 500]) {
  const f = JSON.parse(JSON.stringify(tall));
  f.borderThicknessPct = pct;
  applyBorderThickness(f);
  assertProductStable(f, "tall");
}

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\ntest-border-thickness-stable.mjs: all passed");
