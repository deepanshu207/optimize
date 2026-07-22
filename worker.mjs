/**
 * Cloudflare Worker — serves the Supplier's Den SPA (Meesho Image Generator).
 * All routes fall back to index.html for SPA routing.
 * Set PROCESSOR_URL (e.g. https://your-railway-app.up.railway.app) for server-side image processing.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const processor = env.PROCESSOR_URL || "";

    // Health check / API proxy
    if (url.pathname === "/api/health" && !processor) {
      return new Response(
        JSON.stringify({ ok: true, service: "cloudflare-worker", spa: "suppliersden" }),
        { headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    if (processor && (url.pathname.startsWith("/api/meesho/") || url.pathname === "/api/health")) {
      const target = new URL(url.pathname + url.search, processor.replace(/\/$/, ""));
      const headers = new Headers(request.headers);
      headers.delete("host");
      return fetch(
        new Request(target.toString(), {
          method: request.method,
          headers,
          body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
          redirect: "follow",
        })
      );
    }

    // Try serving the static asset
    const assetResponse = await env.ASSETS.fetch(request).catch(() => null);
    if (assetResponse && assetResponse.status !== 404) {
      return assetResponse;
    }

    // SPA fallback — serve index.html for all unmatched routes (handles /meesho-image-generator/, etc.)
    const indexRequest = new Request(new URL("/index.html", request.url).toString(), request);
    return env.ASSETS.fetch(indexRequest);
  },
};
