// Prueba del puente y la sincronización con un almacén simulado.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
const LIB = new URL("../netlify/lib/", import.meta.url).href; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "bov-"));
writeFileSync(join(dir, "blobs.mjs"), `const M=new Map(); export function getStore(){ return {
  async getWithMetadata(id){ const v=M.get(id); return v?{data:v.data,metadata:v.metadata}:null; },
  async getMetadata(id){ const v=M.get(id); return v?{metadata:v.metadata,etag:v.etag}:null; },
  async set(id,data,o){ const v=M.get(id); if (o.onlyIfNew && v) return {modified:false}; if (o.onlyIfMatch && (!v || v.etag!==o.onlyIfMatch)) return {modified:false};
    const etag=String(Math.random()); M.set(id,{data,metadata:o.metadata,etag}); return {modified:true,etag}; },
  async delete(id){ M.delete(id); } }; }`);
const root = new URL("../netlify/functions/", import.meta.url);
writeFileSync(join(dir, "sync.mjs"), readFileSync(new URL("sync.mjs", root), "utf8").replace("@netlify/blobs", "./blobs.mjs").replace(/\.\.\/lib\//g, LIB));
writeFileSync(join(dir, "proxy.mjs"), readFileSync(new URL("proxy.mjs", root), "utf8").replace(/\.\.\/lib\//g, LIB));
const sync = (await import(join(dir, "sync.mjs"))).default, proxy = (await import(join(dir, "proxy.mjs"))).default;
const id = "a".repeat(64), U = q => "https://x/api/sync?id=" + q;
const put = (base, force) => sync(new Request(U(id), { method: "PUT", headers: { "x-base-at": String(base), ...(force ? { "x-force": "1" } : {}) }, body: new Uint8Array([1, 2, 3]) }));
const expect = (name, got, want) => { if (got !== want){ console.error(`FALLA ${name}: ${got} (esperado ${want})`); process.exit(1); } };
expect("id inválido", (await sync(new Request(U("zz")))).status, 400);
expect("sin datos", (await sync(new Request(U(id)))).status, 404);
const r1 = await put(0); expect("primera escritura", r1.status, 200); const at1 = (await r1.json()).at;
expect("escritura con base vieja", (await put(at1 - 1)).status, 409);
expect("reloj adelantado no gana", (await put(9e15)).status, 409);
const r2 = await put(at1); expect("escritura al día", r2.status, 200); const at2 = (await r2.json()).at;
expect("versión creciente", at2 > at1, true);
expect("lectura", (await sync(new Request(U(id)))).headers.get("x-at"), String(at2));
expect("forzada", (await put(0, true)).status, 200);
expect("sitio no permitido", (await proxy(new Request("https://x/api/proxy?url=" + encodeURIComponent("https://evil.example/x")))).status, 403);
expect("sin dirección", (await proxy(new Request("https://x/api/proxy"))).status, 400);
expect("puerto no permitido", (await proxy(new Request("https://x/api/proxy?url=" + encodeURIComponent("https://edhrec.com:8443/x")))).status, 403);
// puente: nunca devuelve HTML ejecutable, rechaza otros sitios, POST solo a API conocidas, 204 sin caerse
const realFetch = globalThis.fetch;
globalThis.fetch = async (u) => String(u).includes("vacio") ? new Response(null, {status:204}) : new Response("<script>alert(1)</script>", {status:200, headers:{"content-type":"text/html"}});
const P = (url, init) => proxy(new Request("https://boveda-edh.netlify.app/api/proxy?url=" + encodeURIComponent(url), init));
const h = await P("https://edhrec.com/x");
expect("html sale como texto", h.headers.get("content-type").startsWith("text/plain"), true);
expect("sandbox", /sandbox/.test(h.headers.get("content-security-policy")), true);
expect("nosniff", h.headers.get("x-content-type-options"), "nosniff");
expect("otro sitio rechazado", (await P("https://edhrec.com/x", {headers:{"sec-fetch-site":"cross-site"}})).status, 403);
expect("POST a ruta no permitida", (await P("https://edhrec.com/x", {method:"POST", body:"{}"})).status, 403);
expect("POST a graphql permitido", (await P("https://edhtop16.com/api/graphql", {method:"POST", body:"{}"})).status, 200);
expect("204 no se cae", (await P("https://edhrec.com/vacio")).status, 204);
globalThis.fetch = realFetch;
console.log("Funciones OK: sincronización y puente responden como se espera.");
