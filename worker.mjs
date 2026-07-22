/**
 * Cloudflare Worker — serves the Supplier's Den SPA.
 * Assets directory: ./app.suppliersden.com
 * SPA fallback: all unmatched routes return index.html so React Router handles them.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Try the static asset first
    const assetRes = await env.ASSETS.fetch(request).catch(() => null);
    if (assetRes && assetRes.status !== 404) {
      return assetRes;
    }

    // SPA fallback — serve index.html for client-side routes
    // (/meesho-image-generator/, /shipping-label-export/, etc.)
    return env.ASSETS.fetch(new Request(new URL("/index.html", url).toString(), request));
  },
};
