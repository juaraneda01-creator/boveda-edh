// Meta cEDH de torneos (TopDeck.gg). Los datos se guardan y se renuevan a diario.
import { getStore } from "@netlify/blobs";
import { limiter, crossSite, readJSON } from "../lib/guard.mjs";
const limited = limiter(30), deckLimited = limiter(8);
import { kickRefresh, deckFromTopdeck, slugName } from "../lib/cedh.mjs";

const json = (o, status = 200, cache = "no-store") => new Response(JSON.stringify(o), {status, headers:{"content-type":"application/json", "cache-control":cache}});
const STALE = 20 * 3600e3;

export default async (req) => {
  if (limited(req)) return json({error:"demasiadas consultas"}, 429);
  if (crossSite(req)) return json({error:"solo desde la Bóveda"}, 403);
  const u = new URL(req.url), q = u.searchParams.get("q") || "data";
  const key = process.env.TOPDECK_KEY || "";
  const store = getStore({name:"boveda-cedh", consistency:"strong"});
  try {
    if (q === "status"){ const d = await store.get("data", {type:"json"}); return json({key:!!key, at:d ? d.at : null, tours:d ? d.tours.length : 0}); }
    if (q === "data"){
      // nunca se reconstruye dentro de la consulta: se sirve lo guardado y, si está viejo, se pide en segundo plano
      const d = await store.get("data", {type:"json"});
      if ((!d || Date.now() - d.at > STALE) && key && u.searchParams.get("refresh") !== "0") await kickRefresh(store, key, process.env.URL || u.origin);
      if (!d) return json({error:key ? "Preparando los datos de torneos: vuelve a intentar en unos minutos." : "sin_clave", code:key ? "building" : ""}, key ? 503 : 501);
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
      // cada lista se guarda; las de torneos que no están en los datos (enlaces pegados) tienen un tope más estricto
      const ck = "d-" + tid + "-" + pid;
      const hit = await store.get(ck, {type:"json"}).catch(() => null);
      if (hit && typeof hit.raw === "string") return hit.raw ? json(hit, 200, "public, max-age=86400") : json({error:"Ese jugador no subió su lista."}, 404);   // también se recuerdan las vacías
      const t = await store.get("t-" + tid, {type:"json"}).catch(() => null);
      const known = t && (t.std || []).find(p => p.pid === pid);
      if (!(known && known.list) && deckLimited(req)) return json({error:"Demasiadas listas seguidas: espera un minuto."}, 429);
      const dk = await deckFromTopdeck(key, tid, pid); await store.setJSON(ck, {...dk, raw: dk.raw || ""}).catch(() => {});
      return dk.raw ? json(dk, 200, "public, max-age=86400") : json({error:"Ese jugador no subió su lista."}, 404);
    }
    return json({error:"consulta no válida"}, 400);
  } catch(e){
    const msg = e.code === "key" ? "La clave de TopDeck.gg no es válida." : e.code === "rate" ? "TopDeck.gg pidió esperar un momento." : "TopDeck.gg no respondió.";
    return json({error:msg, code:e.code || ""}, e.code === "rate" ? 429 : 502);
  }
};

export const config = { path: "/api/cedh" };
