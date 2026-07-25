# Meesho Shipping Cost Optimizer

Chrome extension (and optional web UI) that hunts for **lower customer shipping** on Meesho by generating many catalog image variants, **uploading each to Meesho**, reading the real `getTransferPrice` API response, and keeping the cheapest verified result.

---

## Production flow (Live tab)

This is the real product logic. Use **Live** on the Meesho supplier catalog page.

```
User uploads product photo
    → processImage() in content.js
    → MeeshoAPI.smartSearch()
    → show results sorted by lowest live shipping ₹
```

**Test Lab** is a separate experimental path (`processImageTestLab()` → `testLabBridge.mjs`). It is **not** used by Live generate and exists only for isolated strategy experiments.

---

## End-to-end timeline (one Generate click)

1. User is on **supplier.meesho.com** catalog page (logged in).
2. Extension reads **baseline shipping** from the Meesho panel (`detectShipping()`).
3. User chooses image → **Generate Variants**.
4. `syncCatalogPricing()` reads **Meesho Price**, category, supplier context from the open form.
5. **Loop** (attempt 1 … Max Tries, default 50 extension / 100 web):
   - Generate image locally (`generateVariationFull`)
   - Upload to Meesho (`uploadSingleCatalogImages`)
   - Price the image (`fetchDuplicatePid` + `getTransferPrice`)
   - If `duplicate_pid` exists → store result, update best-so-far
6. **Re-confirm** all kept results with a fresh `getTransferPrice` (`confirmLiveShippingForResults`).
7. Sort by `shippingCost` ascending — **BEST** = lowest ₹.
8. User **Save** / edit layers / **New Search**.

---

## Image generation (local — no Meesho session needed)

Each attempt calls:

`generateVariation(blob, attemptNumber)` → **`generateVariationFull()`**

Canvas work runs entirely in the browser. Meesho is not involved in drawing.

### What each variant contains

From the original product photo, four **layers** are pre-rendered:

| Layer | Contents | Used when |
|-------|----------|-----------|
| `productOnly` | Plain product | Save/edit: clean product |
| `noStickers` | Colored border + product + text/noise, **no badges** | Save/edit: remove stickers |
| `noBorder` | Product size + badges, **no colored border** | Save/edit: remove border, keep stickers |
| `full` | Border + product + badges + text + noise | **Uploaded to Meesho and priced** |

### What is randomized per attempt

| Parameter | Range / behavior |
|-----------|------------------|
| Border width | 20–80 px |
| Border color | Solid or gradient (16 colors) |
| Gradient direction | Horizontal, vertical, or diagonal |
| JPEG quality | 0.75–0.90 |
| Badges | 2–3 from 25 badge PNGs |
| Badge size | 50–200 px |
| Badge position | Corner slots |
| Noise | 50 pixel tweaks + seed from attempt number |
| Optional text | From “Text (Optional)” field → `ImageGenerator.drawText()` |

### User-controlled settings (before generate)

| Setting | Effect |
|---------|--------|
| **Target shipping** | Goal for notifications (e.g. ≤ ₹80). Does **not** change how images are drawn. |
| **Max tries** | How many generate → upload → price loops (default **50** extension, **100** web; up to **200** optional). |
| **Optional text** | Burned onto the image if provided. |
| **Category** | `sscat_id` sent to Meesho when pricing. |

### Live generation strategy (summary)

**Brute-force random search:** many random bordered + badged versions of the same product until Meesho returns a low shipping quote. There is no per-attempt learning (e.g. “border 40 worked, try 35 next”).

### Not used in Live `smartSearch`

- `LOW_SHIPPING_FRAMED_PROFILES` (blue frame, KB targeting) — only in **web local fallback** as optional `framedExtras`, not in the live hunt loop.
- Test Lab strategies (`strategies.js`: studio, tall, flatlay, etc.).

---

## Meesho comparison — when, what, how

Meesho is **not** used to generate pixels. It is used to **price** uploaded images and to read your **current listing context**.

### A. Before / during setup (context, not variant ranking)

**Functions:** `detectAllValues()`, `syncCatalogPricing()`, `gatherSettings()`

**Read from the open Meesho catalog page:**

| Value | Purpose |
|-------|---------|
| Supplier ID | API authentication |
| Browser ID | API headers |
| Category (`sscat_id`) | `getTransferPrice` request body |
| Meesho Price | Selling price in API + shipping math |
| Panel customer shipping | Baseline “your current shipping” in UI |

### B. Every attempt (live pricing — core comparison)

**Inside `smartSearch()` loop, per successful upload:**

| Step | API | Purpose |
|------|-----|---------|
| 1 | `uploadSingleCatalogImages` | Upload JPEG → `image_url` |
| 2 | `fetchDuplicatePid` | Image fingerprint → `duplicate_pid` |
| 3 | `getTransferPrice` | Quote for `image_url` + category + Meesho Price |

**Customer shipping resolution** (`resolveLiveShippingCost`):

- **Preferred:** `total_price − selling_price` (matches Meesho panel in practice)
- **Fallback:** raw `shipping_charges` (often under-reports vs panel)

**Cross-check:** If `total_price` is missing or API fields disagree by more than ₹3, re-probe at up to 2 alternate selling prices (`buildShippingProbePrices`: catalog price, 100, 200). `consensusCustomerShipping()` picks the consistent value.

**Acceptance rule:** Only variants with a **`duplicate_pid`** are kept. No PID → attempt skipped (`noPidCount`).

**Running best:** After each accepted result, update best if `shipping < previous best`. If `shipping ≤ targetShipping`, show a “found” notification (loop continues until max tries or Stop).

### C. After all attempts (re-confirmation)

**Function:** `confirmLiveShippingForResults()`

Re-calls `getShippingCharges()` for every kept result using the stored `uploadedUrl`, then re-sorts ascending by `shippingCost`. Ensures displayed ₹ matches the latest API at your current catalog Meesho Price.

### D. UI baseline (savings display only)

**Functions:** `getBaselineShipping()`, `detectShipping()`, `detectCatalogPricing()`

Reads **current customer shipping on the Meesho panel** for your **existing** catalog image (not per variant).

```
savings on card = panel baseline shipping − variant live API shipping
```

Does **not** affect generation or ranking. Ranking is **lowest variant ₹ only**.

### E. Actions that do **not** call Meesho again

| Action | Behavior |
|--------|----------|
| **Save** on a card | Downloads a layer JPEG (may differ from priced `full` if edited) |
| Sticker/border add/remove in editor | Swaps pre-rendered layer URLs locally |
| **Apply Best** (extension) / **Download Best** (web) | Apply best to catalog or download file |
| Manual ₹ input (web manual mode) | User-typed, not from API |

The ₹ on each card is whatever Meesho returned when **that variant was uploaded during the hunt**. Layer edits change the **saved file**, not the displayed shipping.

---

## Session requirement

| Step | Meesho session required? |
|------|--------------------------|
| Draw image on canvas | **No** |
| Upload + `getTransferPrice` | **Yes** (supplier ID, cookies, `browser-id`) |
| Scrape panel baseline | **Yes** (must be on Meesho catalog page) |

`isReady()` = `supplierId` detected.

**Extension without session:** `smartSearch` still runs but uploads fail; after ~5 failures the loop stops. No verified ₹ results.

**Web without session:** Falls back to `generateLocalVariations()` — images generated locally with `shippingCost: 0` (`localOnly: true`). User must test on Meesho manually or save a session.

---

## Ranking and result rules

| Rule | Effect |
|------|--------|
| Must have `duplicate_pid` | Unverified uploads excluded from results |
| Sort by `shippingCost` ascending | Cheapest live ₹ first (BEST card) |
| Target shipping | Alert when ≤ target; does not stop the loop by default |
| Stop button | Ends loop; shows best found so far |
| `MAX_RESULT_VARIANTS` (200) | Upper cap on stored results |

---

## Architecture diagram

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR BROWSER (local)                                       │
│  generateVariationFull() → JPEG blob + layers                │
└──────────────────────────┬──────────────────────────────────┘
                           │ upload
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  MEESHO APIs (session required)                             │
│  uploadSingleCatalogImages → image_url                      │
│  fetchDuplicatePid         → duplicate_pid                  │
│  getTransferPrice          → total_price, shipping_charges  │
└──────────────────────────┬──────────────────────────────────┘
                           │ resolveLiveShippingCost()
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  RESULTS UI                                                 │
│  Sort by lowest ₹ · BEST = [0] · savings vs panel baseline  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key source files

| File | Role |
|------|------|
| `app.suppliersden.com/content.js` | Live tab UI, `processImage()`, baseline shipping, Save/edit, New Search |
| `app.suppliersden.com/js/meeshoApi.js` | `smartSearch`, `generateVariationFull`, upload, `getShippingCharges`, layer `resolveDisplayUrl` |
| `app.suppliersden.com/js/ui.js` | Result cards, Max Tries, Target Shipping UI |
| `app.suppliersden.com/js/imageGenerator.js` | Optional text + badge helpers |
| `app.suppliersden.com/js/testLabBridge.mjs` | **Test Lab only** — not Live generate |
| `app.suppliersden.com/js/lib/strategies.js` | **Test Lab only** — category strategies |

---

## Meesho API endpoints (Live)

| Endpoint | Use |
|----------|-----|
| `POST .../uploadSingleCatalogImages` | Upload variant image |
| `POST .../fetchDuplicatePid` | Image fingerprint |
| `POST .../getTransferPrice` | Customer shipping quote |

All require authenticated supplier context (cookies + `supplier-id` + `browser-id` headers on extension; saved session on web).

---

## Version

See `app.suppliersden.com/manifest.json` for the current extension version.
