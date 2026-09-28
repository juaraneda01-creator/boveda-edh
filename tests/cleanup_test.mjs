// Limpieza semanal: borra lo abandonado y deja lo que se usa.
import { cleanup } from "../netlify/lib/cleanup.mjs";
const expect = (name, ok, got) => { if (!ok){ console.error(`FALLA ${name}: ${JSON.stringify(got)}`); process.exit(1); } };
const mk = entries => { const M = new Map(Object.entries(entries)); return { M,
  async list(){ return {blobs:[...M.keys()].map(key=>({key}))}; },
  async getMetadata(k){ const v = M.get(k); return v ? {metadata:{at:v.at}} : null; },
  async get(k){ const v = M.get(k); return v ? v.data : null; },
  async delete(k){ M.delete(k); } }; };
const now = Date.parse("2026-10-01T12:00:00Z"), D = 86400e3;
const sync = mk({viejo:{at:now-500*D}, nuevo:{at:now-10*D}});
const group = mk({abandonado:{at:now-450*D, data:{}}, movido:{at:now-40*D, data:{moved:true}}, activo:{at:now-40*D, data:{}}, sinmarca:{data:{}}});
const quota = mk({"q/sync/2026-09-30/aa":{}, "q/sync/2026-10-01/bb":{}});
const r = await cleanup({sync, group, quota}, now);
expect("sincronización", [...sync.M.keys()].join() === "nuevo", [...sync.M.keys()]);
expect("grupos", [...group.M.keys()].sort().join() === "activo,sinmarca", [...group.M.keys()]);
expect("cuotas de días anteriores", [...quota.M.keys()].join() === "q/sync/2026-10-01/bb", [...quota.M.keys()]);
expect("resumen", r.sync === 1 && r.group === 2 && r.quota === 1, r);
console.log("Limpieza OK: códigos y grupos abandonados, avisos de código viejo y cuotas pasadas.");
