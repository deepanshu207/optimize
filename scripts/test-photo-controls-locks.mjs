/**
 * Photo zoom/pan locks and cross-variant editor wiring.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { frameHasProductSlot } from "../app.suppliersden.com/js/lib/productPhotoFit.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const contentCode = readFileSync(resolve(root, "app.suppliersden.com/content.js"), "utf8");
const composeCode = readFileSync(
  resolve(root, "app.suppliersden.com/js/staticFrameCompose.mjs"),
  "utf8",
);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

assert(contentCode.includes("static-photo-zoom-lock"), "zoom lock button in editor");
assert(contentCode.includes("static-photo-pan-h-lock"), "pan H lock button in editor");
assert(contentCode.includes("static-photo-pan-v-lock"), "pan V lock button in editor");
assert(contentCode.includes("photoPanHLocked"), "pan H lock state stored on frame");
assert(contentCode.includes("photoPanVLocked"), "pan V lock state stored on frame");
assert(contentCode.includes("frameSupportsPhotoControls"), "photo controls helper in content.js");
assert(contentCode.includes("toggleStaticPhotoPanLock"), "pan lock toggle handler");
assert(composeCode.includes("frameHasProductSlot"), "frameHasProductSlot exported from compose");
assert(composeCode.includes("drawProductPhotoCoverFit"), "generic photo draw in compose rebuild");

assert(frameHasProductSlot({ px: 10, py: 20, dw: 100, dh: 200 }), "lifestyle-like frame has product slot");
assert(frameHasProductSlot({ px: 5, py: 5, dw: 400, dh: 600, style: "live_standard" }), "live frame has product slot");
assert(!frameHasProductSlot({ outerW: 100, outerH: 100 }), "frame without dw/dh has no product slot");

if (failed) process.exit(1);
console.log("test-photo-controls-locks.mjs: all passed");
