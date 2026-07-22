# Meesho Shipping Reducer

Free browser-based Meesho shipping price reducer — no login, no credits.

## Features

- **Smart Auto** — tries studio, framed, tall, flat-lay strategies; ranks by estimated ₹ shipping
- **8 optimization modes** — Studio White, Studio Ultra, Framed, Framed Low, Tall ₹50, Flat-Lay, Collage Split
- **Weight slab calculator** — dead weight vs volumetric weight, savings tips
- **Target shipping filter** — ≤₹30 / ₹40 / ₹50 / ₹70 / ₹93
- **Category-aware** — apparel, lingerie, footwear, home, electronics
- **100% client-side** — mozjpeg WASM, nothing uploaded

Inspired by Supplier's Den, MeeShip, and EcomSarthi — but free and open.

## Routes

- `/` — main app
- `/meesho-image-generator/` — redirects to `/`

## Deploy

```bash
npm ci
npm run deploy
```

Cloudflare auto-deploys on push to `main`.

## Local dev

```bash
npx wrangler dev
# or
python3 server.py
```
