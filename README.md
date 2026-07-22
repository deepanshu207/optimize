# Optimize — Meesho Image Optimizer

Browser-based Meesho product photo optimizer — no login required. Runs entirely in the browser using [mozjpeg](https://github.com/mozilla/mozjpeg).

## Live

Production: `https://optimize.amazing-deepanshu14.workers.dev`

## What's deployed

```
index.html              ← standalone optimizer UI
own-api.js              ← client-side image processing
vendor/                 ← mozjpeg / jsquash WASM
data/product-types.json ← product mode definitions
worker.mjs              ← Cloudflare Worker (static assets + optional API proxy)
wrangler.jsonc          ← assets directory: . (repo root)
```

## Routes

- `/` — Meesho Image Optimizer (main app)
- `/meesho-image-generator/` — redirects to `/` (legacy SPA URL)

## Deploy

Cloudflare auto-deploys on every push to `main` via the native GitHub integration.

Manual deploy:

```bash
npm ci
npm run deploy
```

## Local development

```bash
npm ci
python3 server.py       # http://127.0.0.1:8000
# or
npx wrangler dev        # http://127.0.0.1:8787
```

## Modes

- **Auto Lowest Shipping** — studio first, then framed
- **Tall ₹50** — full-length kaftan/dress, 703×1024 purple frame
- **Collage** — front+back collage, lingerie multi-scenario
- **Flat-Lay** — tops/tees on white background
- And more: Framed, Studio, Full-Length, Gown…
