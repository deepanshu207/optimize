/**
 * Cloudflare Worker — static assets + Meesho API proxy for web optimizer.
 */
const MEESHO_ORIGIN = "https://supplier.meesho.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Accept-Language, browser-id, client-type, client-package-version, identifier, supplier-id, x-meesho-cookie, User-Agent",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

async function proxyMeesho(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/meesho-proxy/, "") || "/";
  const target = MEESHO_ORIGIN + path + url.search;

  const headers = new Headers();
  const forward = [
    "accept",
    "content-type",
    "browser-id",
    "client-type",
    "client-package-version",
    "identifier",
    "supplier-id",
  ];

  for (const name of forward) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  headers.set("origin", MEESHO_ORIGIN);
  headers.set("referer", MEESHO_ORIGIN + "/");

  const ua = request.headers.get("user-agent");
  if (ua) headers.set("user-agent", ua);

  const lang = request.headers.get("accept-language");
  if (lang) headers.set("accept-language", lang);

  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for");
  if (clientIp) {
    headers.set("x-forwarded-for", clientIp);
    headers.set("x-real-ip", clientIp);
  }

  const cookie = request.headers.get("x-meesho-cookie");
  if (cookie) headers.set("cookie", cookie);

  const init = {
    method: request.method,
    headers,
    redirect: "follow",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const resp = await fetch(target, init);
  const out = new Headers(resp.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) out.set(k, v);

  return new Response(resp.body, { status: resp.status, headers: out });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/meesho-proxy")) {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname.startsWith("/api/meesho-proxy")) {
      try {
        return await proxyMeesho(request);
      } catch (err) {
        return json({ error: err.message || "Proxy failed" }, 502);
      }
    }

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "cloudflare-worker",
        processing: "client",
        meeshoProxy: true,
      });
    }

    // Legacy HTTrack mirror paths → site root
    if (
      url.pathname === "/app.suppliersden.com" ||
      url.pathname === "/app.suppliersden.com/" ||
      url.pathname === "/app.suppliersden.com/index.html"
    ) {
      return Response.redirect(new URL("/", url.origin), 301);
    }

    return env.ASSETS.fetch(request);
  },
};
