// Prueba del puente y la sincronización con un almacén simulado.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "bov-"));
writeFileSync(join(dir, "blobs.mjs"), `const M=new Map(); export function getStore(){ return {
  async getWithMetadata(id){ const v=M.get(id); return v?{data:v.data,metadata:v.metadata}:null; },
  async getMetadata(id){ const v=M.get(id); return v?{metadata:v.metadata,etag:v.etag}:null; },
  async set(id,data,o){ const v=M.get(id); if (o.onlyIfNew && v) return {modified:false}; if (o.onlyIfMatch && (!v || v.etag!==o.onlyIfMatch)) return {modified:false};
    const etag=String(Math.random()); M.set(id,{data,metadata:o.metadata,etag}); return {modified:true,etag}; },
  async delete(id){ M.delete(id); } }; }`);
const root = new URL("../netlify/functions/", import.meta.url);
writeFileSync(join(dir, "sync.mjs"), readFileSync(new URL("sync.mjs", root), "utf8").replace("@netlify/blobs", "./blobs.mjs"));
writeFileSync(join(dir, "proxy.mjs"), readFileSync(new URL("proxy.mjs", root), "utf8"));
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
console.log("Funciones OK: sincronización y puente responden como se espera.");
