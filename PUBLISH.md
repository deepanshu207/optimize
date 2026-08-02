# Chrome Web Store publishing

Step-by-step for this extension.

## Before first upload

1. **Developer account** — [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) ($5 one-time fee).
2. **Privacy policy** — host `PRIVACY.md` (or a web page) and use that URL in the listing. Required because the extension uses `storage` and runs on Meesho.
3. **Screenshots** — 1280×800 or 640×400 showing the optimizer on a Meesho catalog page with live variant results.
4. **Manifest** — this repo’s `manifest.json` has **no `update_url`** (Chrome Web Store manages updates). Bump `version` for every release.

## Build upload package

```bash
npm run build
```

Upload:

`release/Meesho_Shipping_Cost_Optimizer_AI_-_Unlimited.zip`

Rules:

- `manifest.json` at the **root** of the zip (the build script does this).
- Do not include `release/`, `.git`, or `node_modules`.

## Dashboard steps

1. **New item** → upload zip.
2. **Store listing** — name, description, icon 128×128, screenshots, category (Productivity).
3. **Privacy practices** — explain:
   - **Host permission** `supplier.meesho.com` — upload catalog images and read shipping prices while you are logged in.
   - **storage** — learned shipping tiers, category picks, local price history (on device).
   - **activeTab / scripting** — inject optimizer UI on the supplier catalog page.
4. **Distribution** — start **Unlisted** to test with a link before going public.
5. **Submit for review** — typically 1–3 business days.

## Updates

1. Fix code, bump `version` in `manifest.json` (e.g. `1.6.37` → `1.6.38`).
2. `npm run build`
3. Upload new zip to the same store item → submit for review.

## Local testing vs store

| | Load unpacked | Chrome Web Store |
|--|---------------|------------------|
| Install | `chrome://extensions` | Install from store |
| Updates | Reload extension | Upload new zip |

## Permissions justification (copy for store form)

> This extension helps Meesho suppliers reduce customer shipping by generating and testing catalog image variants. It only runs on supplier.meesho.com when you open a catalog product page. Images are uploaded to your Meesho account using your existing login session to read real shipping prices. Settings and learned price data are stored locally in the browser.
