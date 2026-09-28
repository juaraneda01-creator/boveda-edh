// Servidor local con la función real de grupo (almacén en memoria) para las pruebas en el navegador.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path"; import http from "node:http";
const dir = mkdtempSync(join(tmpdir(), "grps-"));
writeFileSync(join(dir, "blobs.mjs"), `const M=new Map(); let n=0; export function getStore(){ return {
  async getWithMetadata(k){ const v=M.get(k); return v?{data:JSON.parse(v.d), etag:v.e}:null; },
  async setJSON(k,val,o){ const w=M.get(k); if (o.onlyIfNew && w) return {modified:false}; if (o.onlyIfMatch && (!w || w.e!==o.onlyIfMatch)) return {modified:false}; M.set(k,{d:JSON.stringify(val), e:"e"+(++n)}); return {modified:true}; } }; }`);
writeFileSync(join(dir, "group.mjs"), readFileSync(new URL("../netlify/functions/group.mjs", import.meta.url), "utf8").replace("@netlify/blobs", "./blobs.mjs"));
const fn = (await import(join(dir, "group.mjs"))).default;
http.createServer(async (req, res) => { let body = ""; for await (const c of req) body += c;
  const r = await fn(new Request("http://x" + req.url, {method:req.method, body: req.method==="POST" ? body : undefined}));
  res.writeHead(r.status, {"content-type":"application/json"}); res.end(await r.text()); }).listen(+process.argv[2] || 8788, () => console.log("listo"));
