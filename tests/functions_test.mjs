// Prueba del puente y la sincronización con un almacén simulado.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "bov-"));
writeFileSync(join(dir, "blobs.mjs"), `const M=new Map(); export function getStore(){ return {
  async getWithMetadata(id){ const v=M.get(id); return v?{data:v.data,metadata:v.metadata}:null; },
  async getMetadata(id){ const v=M.get(id); return v?{metadata:v.metadata}:null; },
  async set(id,data,{metadata}){ M.set(id,{data,metadata}); }, async delete(id){ M.delete(id); } }; }`);
const root = new URL("../netlify/functions/", import.meta.url);
writeFileSync(join(dir, "sync.mjs"), readFileSync(new URL("sync.mjs", root), "utf8").replace("@netlify/blobs", "./blobs.mjs"));
writeFileSync(join(dir, "proxy.mjs"), readFileSync(new URL("proxy.mjs", root), "utf8"));
const sync = (await import(join(dir, "sync.mjs"))).default, proxy = (await import(join(dir, "proxy.mjs"))).default;
const id = "a".repeat(64), U = q => "https://x/api/sync?id=" + q;
const put = (at, base, force) => sync(new Request(U(id), { method: "PUT", headers: { "x-at": String(at), "x-base-at": String(base), ...(force ? { "x-force": "1" } : {}) }, body: new Uint8Array([1, 2, 3]) }));
const expect = (name, got, want) => { if (got !== want){ console.error(`FALLA ${name}: ${got} (esperado ${want})`); process.exit(1); } };
expect("id inválido", (await sync(new Request(U("zz")))).status, 400);
expect("sin datos", (await sync(new Request(U(id)))).status, 404);
expect("primera escritura", (await put(100, 0)).status, 200);
expect("escritura atrasada", (await put(200, 50)).status, 409);
expect("escritura al día", (await put(300, 100)).status, 200);
expect("lectura", (await sync(new Request(U(id)))).headers.get("x-at"), "300");
expect("sitio no permitido", (await proxy(new Request("https://x/api/proxy?url=" + encodeURIComponent("https://evil.example/x")))).status, 403);
expect("sin dirección", (await proxy(new Request("https://x/api/proxy"))).status, 400);
console.log("Funciones OK: sincronización y puente responden como se espera.");
