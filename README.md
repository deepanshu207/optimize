# Optimize — Supplier's Den Image Tools

Cloudflare Worker serving the Supplier's Den React SPA.

## What's deployed

```
app.suppliersden.com/          ← assets root
  index.html                   ← SPA shell
  assets/index-BcgV3y7C.js    ← compiled React bundle (Meesho optimizer inside)
  assets/index-DZe6jyga.css   ← styles
  favicon.ico / icon.png / apple-icon.png
worker.mjs                     ← Cloudflare Worker (SPA fallback)
wrangler.jsonc                 ← assets directory: ./app.suppliersden.com
```

## Routes (handled by React Router)

- `/` — Supplier's Den dashboard
- `/meesho-image-generator/` — Meesho Image Generator
- `/shipping-label-export/` — Shipping Label Export

## Deploy

Cloudflare auto-deploys on every push to `main` via the native GitHub integration.

Live: [Cloudflare dashboard → Workers → optimize](https://dash.cloudflare.com/16fbb7aa94db364df99f9d70d4a85915/workers/services/view/optimize/production)
