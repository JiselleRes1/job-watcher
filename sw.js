/* Service worker: app shell cached on install; data files network-first so the
   latest data loads online and the last-loaded copy is shown offline. */
const VERSION = "v1";
const SHELL = ["./", "index.html", "browse.html", "market.html", "style.css", "app.js", "charts.js",
  "today.js", "browse.js", "market.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
const DATA = ["data/history.csv", "data/status.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.concat(DATA)).catch(() => c.addAll(SHELL))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isData = url.pathname.includes("/data/");
  e.respondWith(isData ? networkFirst(req) : staleWhileRevalidate(req));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req, { cache: "no-cache" });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || (req.mode === "navigate" ? cache.match("index.html") : Response.error());
}
