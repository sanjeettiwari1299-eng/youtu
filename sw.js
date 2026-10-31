/* StreamEo service worker — offline shell + instant repeat loads, but NEVER stale builds.
   Strategy:
     - HTML  : network-first (no abort, cache:"no-cache" so GitHub Pages revalidates) -> cache only when offline
     - static: stale-while-revalidate
     - version.json & sw.js: always network
     - cross-origin (TMDB, mirrors, HLS CDNs, proxies): untouched */
const VER = "se-v16-1";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VER)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VER).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHTML(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") !== -1;
}

async function networkFirst(req) {
  const c = await caches.open(VER);
  try {
    // no AbortController: slow networks must still get the NEW build, not a stale cache hit
    const res = await fetch(req, { cache: "no-cache" });
    if (res && res.ok) c.put(req, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    const hit = (await c.match(req)) || (await c.match("./index.html")) || (await c.match("./"));
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(VER);
  const hit = await c.match(req);
  const net = fetch(req).then((res) => {
    if (res && res.ok) c.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  return hit || (await net) || new Response("", { status: 504 });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                    // CDNs / APIs / embeds: untouched
  if (url.pathname.endsWith("/sw.js")) return;                        // never cache the SW itself
  if (url.pathname.endsWith("/version.json")) return;                 // build watcher: always live
  if (isHTML(req)) { e.respondWith(networkFirst(req)); return; }
  if (/\.(?:json|js|css|svg|png|jpe?g|webp|woff2?)$/i.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(req));
  }
});
