# Swag Stree — Meesho Image Optimizer

Browser-based Meesho product photo optimizer — Auto, Framed, Collage, Flat-Lay, Lingerie, SupplierDen, and more. Powered by [mozjpeg](https://github.com/mozilla/mozjpeg) entirely in the browser — no server upload required.

## Live URL

Deployed via **Cloudflare Workers** (native GitHub integration — auto-deploys on every push to `main`).

Your live URL: `https://optimize.<your-subdomain>.workers.dev`
→ Find it in your [Cloudflare dashboard → Workers → optimize → Deployments](https://dash.cloudflare.com/16fbb7aa94db364df99f9d70d4a85915/workers/services/view/optimize/production)

## How deploys work

| Trigger | What happens |
| ------- | ------------ |
| Push to `main` | Cloudflare GitHub App auto-deploys to production |
| Open a PR | Cloudflare GitHub App deploys a preview (if configured) |

No GitHub Actions secrets needed — Cloudflare's native integration handles it automatically.

## Optional: PR Previews via GitHub Actions

If you want GitHub Actions to also post preview links on PRs, add these in GitHub **Settings → Secrets → Actions**, then set repo variable `CLOUDFLARE_DEPLOY_ENABLED = true`:

| Secret | Value |
| ------ | ----- |
| `CLOUDFLARE_API_TOKEN` | Workers Edit token from [Cloudflare dashboard](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID |

## Netlify (optional alternative)

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**
2. Connect this GitHub repo (`deepanshu207/optimize`)
3. `netlify.toml` pre-configures build settings — just deploy
4. Get a `*.netlify.app` URL

## Local Development

```bash
npm ci
python3 server.py       # http://127.0.0.1:8000
# or
npx wrangler dev        # http://127.0.0.1:8787
```

## Optimizer Modes

- **Auto Lowest Shipping** — All products, studio first then framed
- **Tall ₹50** — Full-length kaftan/dress, exact 703×1024 purple frame (SupplierDen match)
- **Collage** — Front+back collage, lingerie multi-scenario
- **Flat-Lay** — Tops/tees on white background
- **Framed Compress, Studio Compress, Studio Ultra, Full-Length, Gown…**
