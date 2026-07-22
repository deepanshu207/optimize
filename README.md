# Swag Stree — Meesho Image Optimizer

Browser-based Meesho product photo optimizer — Auto, Framed, Collage, Flat-Lay, Lingerie, SupplierDen, and more. Powered by [mozjpeg](https://github.com/mozilla/mozjpeg) entirely in the browser.

## Live URLs

| Host | Status | URL |
| ---- | ------ | --- |
| **Cloudflare Workers** | Active (production) | Set in repo variable `CLOUDFLARE_DEPLOY_URL` or see deploy output |
| **Netlify** | Active | Connect repo on [netlify.com](https://netlify.com) — `netlify.toml` is configured |

Production worker name: `optimize` → typically `https://optimize.<your-subdomain>.workers.dev`

## Deploy to Cloudflare Workers (auto on push to main)

Add these secrets in GitHub **Settings → Secrets and variables → Actions**:

| Secret | Value |
| ------ | ----- |
| `CLOUDFLARE_API_TOKEN` | Workers Edit permission token from [Cloudflare dashboard](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID |

Optional repo **variable** (not secret):
- `CLOUDFLARE_DEPLOY_URL` = your production workers.dev URL (for post-deploy verify on `main`)

After secrets are set, every push to `main` auto-deploys. Every PR gets a **preview link** posted as a comment.

## Deploy to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**
2. Connect this GitHub repo (`deepanshu207/optimize`)
3. Build settings are auto-detected from `netlify.toml` (publish dir: `.`, functions: `netlify/functions`)
4. Deploy — Netlify will publish and give you a `*.netlify.app` URL

## Local Development

```bash
npm ci
python3 server.py       # http://127.0.0.1:8000
# or
npx wrangler dev        # http://127.0.0.1:8787
```

## Manual Deploy

```bash
npx wrangler login
npm run deploy
node scripts/verify-deploy.mjs https://optimize.<subdomain>.workers.dev
```

## Supplier Modes

- **Auto Lowest Shipping** — All products, studio first then framed
- **Tall ₹50** — Full-length kaftan/dress, exact 703×1024 purple frame
- **Collage** — Front+back collage, lingerie multi-scenario
- **Flat-Lay** — Tops/tees on white background
- And more (Framed, Studio, Full-Length, Gown…)
