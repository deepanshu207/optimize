#!/usr/bin/env node
/** Smoke-test deployment. Usage: node scripts/verify-deploy.mjs <url> */
const BASE = (process.argv[2] || process.env.DEPLOY_URL || "").replace(/\/$/, "");
if (!BASE) { console.error("Usage: node scripts/verify-deploy.mjs <url>"); process.exit(1); }

const checks = [];
async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { res, text: await res.text() };
}

async function run() {
  console.log(`Deploy verification @ ${BASE}\n`);
  try {
    const { res, text } = await get("/");
    checks.push(["GET /", res.ok && text.includes("Meesho Shipping Reducer") && text.includes("Find Lowest Shipping"), "landing page"]);
  } catch (e) { checks.push(["GET /", false, e.message]); }
  try {
    const { res, text } = await get("/js/app.js");
    checks.push(["GET /js/app.js", res.ok && text.includes("optimizeImage"), "app module"]);
  } catch (e) { checks.push(["GET /js/app.js", false, e.message]); }
  try {
    const { res } = await get("/vendor/mozjpeg.mjs");
    checks.push(["GET /vendor/mozjpeg.mjs", res.ok, "mozjpeg"]);
  } catch (e) { checks.push(["GET /vendor/mozjpeg.mjs", false, e.message]); }
  try {
    const { res, text } = await get("/js/lib/shipping.js");
    checks.push(["GET /js/lib/shipping.js", res.ok && text.includes("WEIGHT_SLABS"), "shipping module"]);
  } catch (e) { checks.push(["GET /js/lib/shipping.js", false, e.message]); }
  try {
    const { res, text } = await get("/css/app.css");
    checks.push(["GET /css/app.css", res.ok && text.includes("--brand"), "styles"]);
  } catch (e) { checks.push(["GET /css/app.css", false, e.message]); }

  let pass = 0;
  for (const [name, ok, detail] of checks) {
    console.log(`  ${ok ? "OK" : "FAIL"}  ${name} — ${detail}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${checks.length} checks passed`);
  process.exit(pass === checks.length ? 0 : 1);
}
run();
