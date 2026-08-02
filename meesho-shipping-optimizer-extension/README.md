# Meesho Shipping Cost Optimizer — Chrome Extension

Chrome extension for **Meesho suppliers** (`supplier.meesho.com`). Generates many catalog image variants, uploads each to Meesho, reads real customer shipping from the `getTransferPrice` API, and recommends the lowest verified winners.

**This repo is extension-only** (no web app). Use it to develop, test, and publish on the Chrome Web Store.

Current version: **1.6.37** (see `manifest.json`).

---

## Quick start (local)

### Load unpacked

1. Open `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder (must contain `manifest.json` at root)
3. Log in to [supplier.meesho.com](https://supplier.meesho.com)
4. Open a catalog product page → use the **AI Optimizer** panel

### Build store zip

```bash
npm run build
# → release/Meesho_Shipping_Cost_Optimizer_AI_-_Unlimited.zip
```

Upload that zip to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

See **[PUBLISH.md](./PUBLISH.md)** for the full Chrome Web Store checklist.

---

## Live variants (main product flow)

```
Upload photo on Meesho catalog page
  → Generate Variants (Live)
  → Loop: canvas variant → upload → getTransferPrice
  → Sort by customer shipping ₹
  → Live report (CSV / recommendations)
  → Optional: Generate Local picks (floor band, no live API)
```

### Key files

| File | Role |
|------|------|
| `content.js` | Optimizer UI, `processImage()`, local price DB, live learn |
| `js/meeshoApi.js` | `smartSearch`, `generateVariationFull`, upload + pricing |
| `js/liveVariantReport.mjs` | Pick rules, CSV report export/import, rupee-pair logic |
| `js/imageGenerator.js` | Canvas layers (border, badges, JPEG) |
| `js/ui.js` | Result cards, live/local mode display |
| `js/staticFrameCompose.mjs` | Edit preview (badges, colors, pan) |
| `data/seed-reports/` | Public seed CSVs (e.g. kurti ₹59+60) |

### Live report pick rules (`js/liveVariantReport.mjs`)

1. Sort unique live prices ascending.
2. If the **floor** has a ₹1 gap (e.g. 59 & 60) → recommend **both** (`rupee_pair`).
3. Otherwise → recommend **only the lowest** price (`single_lowest`).
4. Higher-tier pairs (64+65) are ignored when floor single/pair exists.

### Local price mode

After a live run, **Generate Local Variants** builds a small pool using learned KB/border patterns:

- **Pink kurti** (only ₹59 winners) → session `single_lowest`, all picks target ₹59
- **Lavender** (mostly ₹68, few ₹59/60 floor winners) → category floor band ₹59+₹60 with `lowBias`

---

## Tests

```bash
npm run test:live-report    # liveVariantReport.mjs pick + CSV round-trip
npm run test:local-picks    # local price tier strategy (pink / lavender)
```

---

## Repo layout

```
manifest.json          ← Chrome extension entry (root = zip root)
content.js             ← Main optimizer logic
background.js
popup.html / popup.js
js/                    ← API, UI, live modules
data/                  ← Categories + seed reports
Badge/                 ← Sticker PNGs
icons/
scripts/               ← build + tests
release/               ← built zip (gitignored)
```

---

## Sync from monorepo

If you also use the `optimize` repo (`app.suppliersden.com`):

```bash
# From optimize repo root
cp -a app.suppliersden.com/. /path/to/meesho-shipping-optimizer-extension/
rm -f /path/to/meesho-shipping-optimizer-extension/index.html \
      /path/to/meesho-shipping-optimizer-extension/web-*.js
# Restore store-ready manifest (no update_url) from this repo's manifest.json backup
```

Keep `manifest.json` **without** `update_url` for Chrome Web Store uploads.

---

## License / author

Author: Veer Hanuman (see `manifest.json`).
