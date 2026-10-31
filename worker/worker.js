/**
 * StreamEo Universal Media Proxy — Cloudflare Worker (single file)
 *
 * Usage:  https://<your-worker>.workers.dev/?u=<URL-ENCODED-MEDIA-URL>
 * Optional token:  ...&k=<TOKEN>          (only if TOKEN secret/variable is set)
 * Optional allowlist:  ALLOW_HOSTS="cdn.a.com,cdn.b.com"
 *
 * HLS playlists are rewritten so every sub-playlist / segment also goes through this worker.
 */
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BLOCK_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal", "169.254.169.254"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = (env && env.TOKEN) || "";
    const allow = String((env && env.ALLOW_HOSTS) || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    if (url.pathname === "/" && !url.searchParams.get("u")) return info(token);
    if (url.pathname === "/health") return json({ ok: true });

    const raw = url.searchParams.get("u");
    if (!raw) return cors(new Response("Missing ?u=<encoded url>", { status: 400 }));

    let target;
    try { target = new URL(raw); } catch (e) { return cors(new Response("Bad ?u=", { status: 400 })); }
    if (target.protocol !== "http:" && target.protocol !== "https:") return cors(new Response("Only http(s)", { status: 400 }));
    const host = target.hostname.toLowerCase();
    if (BLOCK_HOSTS.includes(host)) return cors(new Response("Host blocked", { status: 403 }));
    if (allow.length && !allow.some((h) => host === h || host.endsWith("." + h))) return cors(new Response("Host not allowed", { status: 403 }));
    if (token && url.searchParams.get("k") !== token) return cors(new Response("Bad token", { status: 403 }));

    const upstreamHeaders = new Headers();
    for (const h of ["range", "if-range", "accept", "accept-language"]) {
      const v = request.headers.get(h);
      if (v) upstreamHeaders.set(h, v);
    }
    upstreamHeaders.set("user-agent", (env && env.UA) || DEFAULT_UA);
    upstreamHeaders.set("referer", target.origin + "/");
    upstreamHeaders.set("origin", target.origin);

    const isPlaylistUrl = /\.m3u8?(\?|$)/i.test(target.pathname) || /\.m3u8?(\?|$)/i.test(target.href);
    const isSegmenty = /\.(ts|m4s|mp4|m4v|m4a|aac|vtt|jpg|jpeg|png|webp|key)(\?|$)/i.test(target.pathname);
    const cache = caches.default;
    const cacheable = isPlaylistUrl; // sirf playlists cache (bade video objects avoid)
    const cacheKey = new Request(target.toString(), { method: "GET" });

    let cached = null;
    if (cacheable) { try { cached = await cache.match(cacheKey); } catch (e) {} }
    if (cached) {
      const hit = new Response(cached.body, cached);
      hit.headers.set("x-proxy-cache", "HIT");
      return withCors(hit);
    }

    let upstream;
    try {
      upstream = await fetch(target.toString(), {
        method: request.method === "HEAD" ? "HEAD" : "GET",
        headers: upstreamHeaders,
        redirect: "follow"
      });
    } catch (e) {
      return cors(new Response("Upstream fetch failed: " + (e && e.message), { status: 502 }));
    }

    const ct = (upstream.headers.get("content-type") || "").toLowerCase();
    const looksPlaylist = /mpegurl|m3u/.test(ct) || isPlaylistUrl;

    if (looksPlaylist && upstream.ok) {
      const text = await upstream.text();
      const body = rewritePlaylist(text, target, url);
      const out = new Response(body, {
        status: upstream.status,
        headers: {
          "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
          "cache-control": "public, max-age=5",
          "x-proxy": "streamEo"
        }
      });
      try { await cache.put(cacheKey, out.clone()); } catch (e) {}
      return withCors(out);
    }

    const outHeaders = new Headers();
    for (const h of ["content-type", "content-range", "accept-ranges", "etag", "last-modified", "expires"]) {
      const v = upstream.headers.get(h);
      if (v) outHeaders.set(h, v);
    }
    if (!outHeaders.has("accept-ranges")) outHeaders.set("accept-ranges", "bytes");
    if (!outHeaders.has("content-type")) outHeaders.set("content-type", isSegmenty ? "video/mp2t" : "application/octet-stream");
    if (upstream.ok && !request.headers.has("range")) outHeaders.set("cache-control", "public, max-age=3600");

    return withCors(new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: outHeaders }));
  }
};

function rewritePlaylist(text, targetUrl, proxyUrl) {
  const k = proxyUrl.searchParams.get("k");
  const tokenQ = k ? "&k=" + encodeURIComponent(k) : "";
  const px = (ref) => {
    if (!ref || /^data:/i.test(ref)) return ref;
    let abs = ref;
    try { abs = new URL(ref, targetUrl).toString(); } catch (e) {}
    return proxyUrl.origin + "/?u=" + encodeURIComponent(abs) + tokenQ;
  };
  return String(text).replace(/\r\n/g, "\n").split("\n").map((line) => {
    const t = line.trim();
    if (!t) return line;
    if (t.charAt(0) === "#") return line.replace(/URI="([^"]*)"/g, (m, u) => 'URI="' + px(u) + '"');
    return px(t);
  }).join("\n");
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
    "access-control-max-age": "86400"
  };
}
function withCors(resp) {
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders())) h.set(k, v);
  h.set("x-proxy", "streamEo");
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}
function cors(resp) { return withCors(resp); }
function json(o) { return new Response(JSON.stringify(o, null, 2), { headers: { "content-type": "application/json", "access-control-allow-origin": "*" } }); }
function info(token) {
  return new Response(
    "StreamEo Media Proxy — OK\n\nUsage:\n  /?u=<URL-encoded media url>\n" +
    (token ? "  &k=<TOKEN>   (required)\n" : "  (&k=<TOKEN> only if TOKEN secret set)\n") +
    "\nWorks for: HLS (.m3u8 playlists are rewritten), MP4/WebM with Range seeking, subtitles.\n",
    { headers: { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*" } }
  );
}
