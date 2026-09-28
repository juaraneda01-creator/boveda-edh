// Meta cEDH de torneos (TopDeck.gg). Los datos se guardan y se renuevan a diario.
import { getStore } from "@netlify/blobs";
import { buildDataset, saveDataset, deckFromTopdeck, slugName } from "../lib/cedh.mjs";

const json = (o, status = 200, cache = "no-store") => new Response(JSON.stringify(o), {status, headers:{"content-type":"application/json", "cache-control":cache}});
const HITS = new Map();
function limited(req){
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "?";
  const now = Date.now(), recent = (HITS.get(ip) || []).filter(t => now - t < 60000); recent.push(now); HITS.set(ip, recent);
  if (HITS.size > 5000) HITS.clear();
  return recent.length > 30;
}
const STALE = 20 * 3600e3;

export default async (req) => {
  if (limited(req)) return json({error:"demasiadas consultas"}, 429);
  const u = new URL(req.url), q = u.searchParams.get("q") || "data";
  const key = process.env.TOPDECK_KEY || "";
  const store = getStore({name:"boveda-cedh", consistency:"strong"});
  try {
    if (q === "status"){ const d = await store.get("data", {type:"json"}); return json({key:!!key, at:d ? d.at : null, tours:d ? d.tours.length : 0}); }
    if (q === "data"){
      let d = await store.get("data", {type:"json"});
      if ((!d || Date.now() - d.at > STALE) && key && u.searchParams.get("refresh") !== "0"){
        try { const b = await buildDataset(key); await saveDataset(store, b); d = b.data; }
        catch(e){ if (!d) throw e; }
      }
      if (!d) return json({error:key ? "sin datos todavía" : "sin_clave"}, key ? 503 : 501);
      return json(d, 200, "public, max-age=1800");
    }
    if (q === "cmd"){
      const all = await store.get("cmdCards", {type:"json"}) || {};
      const names = String(u.searchParams.get("name") || "").split(" / ").map(slugName).sort();
      const hit = Object.values(all).find(c => c.name.split(" / ").map(slugName).sort().join("|") === names.join("|"));
      return hit ? json(hit, 200, "public, max-age=1800") : json({error:"sin listas de ese comandante"}, 404);
    }
    if (q === "t"){
      const id = String(u.searchParams.get("id") || "").replace(/[^\w-]/g, "");
      const t = id && await store.get("t-" + id, {type:"json"});
      return t ? json(t, 200, "public, max-age=3600") : json({error:"torneo no encontrado"}, 404);
    }
    if (q === "deck"){
      if (!key) return json({error:"sin_clave"}, 501);
      const [tid, pid] = String(u.searchParams.get("id") || "").split("/");
      if (!/^[\w-]{1,80}$/.test(tid || "") || !/^[\w-]{1,80}$/.test(pid || "")) return json({error:"enlace inválido"}, 400);
      return json(await deckFromTopdeck(key, tid, pid), 200, "public, max-age=86400");
    }
    return json({error:"consulta no válida"}, 400);
  } catch(e){
    return json({error:e.message || "error", code:e.code || ""}, e.code === "key" ? 502 : e.code === "rate" ? 429 : 502);
  }
};

export const config = { path: "/api/cedh" };
