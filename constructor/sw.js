// Archivo de servicio del Constructor. Regla única: primero la red; lo guardado solo se usa sin conexión.
// Así una versión nueva se ve apenas se publica y la app igual abre sin internet.
const CACHE = "constructor-d6b7ae2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("constructor-") && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  // solo los archivos propios de la app; las consultas a /api y a otros sitios pasan sin tocar
  if (e.request.method !== "GET" || u.origin !== location.origin || !u.pathname.startsWith(new URL("./", location.href).pathname)) return;
  e.respondWith((async () => {
    try { const r = await fetch(e.request, { cache: "no-store" }); if (r.ok) { const c = await caches.open(CACHE); c.put(e.request, r.clone()); } return r; }
    catch { return (await caches.match(e.request, { ignoreSearch: true })) || (await caches.match("./")) || Response.error(); }
  })());
});
