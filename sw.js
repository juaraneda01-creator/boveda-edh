// Bóveda EDH — funciona sin señal con la última versión y las imágenes ya vistas
const V = "boveda-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(V)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
async function trim(name, max){ const c = await caches.open(name); const ks = await c.keys(); for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]); }
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.pathname.startsWith("/api/")) return;                       // sincronización y puente: siempre en vivo
  if (r.mode === "navigate"){                                         // la página: primero la red, si no hay señal la guardada
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put("/", cp)); return res; }).catch(() => caches.match("/")));
    return;
  }
  if (u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok || res.type === "opaque"){ const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })));
    return;
  }
  if (u.hostname === "cards.scryfall.io"){                           // imágenes de cartas: se guardan las últimas 400
    e.respondWith(caches.open(V + "-img").then(c => c.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok || res.type === "opaque"){ c.put(r, res.clone()); trim(V + "-img", 400); } return res; }))));
  }
});
