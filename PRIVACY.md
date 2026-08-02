# Privacy Policy — Meesho Shipping Cost Optimizer Extension

**Last updated:** August 2026

## Overview

Meesho Shipping Cost Optimizer AI ("the Extension") is a browser extension for Meesho suppliers. It helps optimize catalog product images to reduce customer shipping charges shown on Meesho.

## What the Extension does

- Runs only on **supplier.meesho.com** catalog pages when you use the optimizer.
- Generates image variants locally in your browser.
- Uploads variants to **your** Meesho supplier account using your active login session to read shipping prices from Meesho’s APIs.
- Stores preferences and learned shipping patterns in **local browser storage** (`chrome.storage` / `localStorage`).

## Data we collect

The Extension does **not** operate a separate backend that collects your personal data. Data stays on your device unless you explicitly export (e.g. CSV download) or upload to Meesho as part of normal catalog workflows.

Locally stored data may include:

- Optimizer settings (target shipping, category, text options)
- Learned shipping tier fingerprints from your live variant runs
- Imported or exported live/local price report CSVs you choose to save

## Data we do not collect

- We do not sell your data.
- We do not run analytics servers tied to your identity in this extension build.
- We do not access sites other than Meesho supplier catalog pages defined in the extension manifest.

## Third parties

- **Google Chrome** — extension distribution and updates via Chrome Web Store.
- **Meesho** — image upload and shipping price APIs when you are logged into supplier.meesho.com.

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save settings and learned price data on your device |
| `activeTab` | Access the current Meesho tab when you open the optimizer |
| `scripting` | Inject the optimizer UI on catalog pages |
| `supplier.meesho.com` | Upload images and read shipping prices in your session |

## Children

The Extension is intended for business users (Meesho suppliers), not children.

## Changes

We may update this policy. Continued use after changes means you accept the updated policy.

## Contact

For privacy questions, contact the extension author listed on the Chrome Web Store listing.

---

*Host this file on a public URL (GitHub Pages, your website) and paste that URL into the Chrome Web Store privacy policy field.*
