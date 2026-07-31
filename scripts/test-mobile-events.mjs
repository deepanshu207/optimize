import puppeteer from "puppeteer-core";
import { resolve } from "path";

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto("http://127.0.0.1:8787/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.meeshoOptimizer);

await (await page.$("#image-input")).uploadFile(
  resolve("/workspace/app.suppliersden.com/icons/icon128.png"),
);
await page.waitForFunction(() => !document.getElementById("generate-btn").disabled);

const pre = await page.evaluate(() => ({
  files: document.getElementById("image-input").files.length,
  pending: !!window.meeshoOptimizer._pendingFile,
  webPending: !!window.__webPendingFile,
}));

await page.evaluate(() => {
  window.__rgLog = [];
  const btn = document.getElementById("generate-btn");
  const orig = btn.onclick;
  btn.onclick = function (e) {
    window.__rgLog.push("onclick");
    return orig?.call(this, e);
  };
  btn.addEventListener("touchend", () => window.__rgLog.push("touchend"), true);
  btn.addEventListener("click", () => window.__rgLog.push("click-bubble"), true);
});

const btn = await page.$("#generate-btn");
const box = await btn.boundingBox();
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await new Promise((r) => setTimeout(r, 500));

const post = await page.evaluate(() => ({
  pre: null,
  log: window.__rgLog,
  notifs: [...document.querySelectorAll(".opt-notification")].map((n) => n.textContent),
}));
post.pre = pre;
console.log(JSON.stringify(post, null, 2));
await browser.close();
