// Kempner Mobile service worker: caches the app itself so it opens with no signal.
// Your CRM data is NOT here — it lives in the phone's own storage, never on the web.
const CACHE = "kempner-mobile-v6";
const ASSETS = ["./", "index.html", "core.js", "views.js", "forms.js", "pdf.js", "manifest.webmanifest",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png", "jspdf.umd.min.js"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(ASSETS.map(a => c.add(new Request(a, {cache: "reload"}))))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// App files: network first (so updates arrive when online), cache when offline.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req.mode === "navigate" ? "index.html" : req, copy)); } return r; })
    .catch(() => caches.match(req.mode === "navigate" ? "index.html" : req, {ignoreSearch: true}).then(hit => hit || caches.match("index.html"))));
});
