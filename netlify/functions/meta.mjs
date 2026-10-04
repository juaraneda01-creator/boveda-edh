// Meta de Pauper y Pioneer (MTGTop8 + Pauper World). Se guarda en el servidor y se renueva a diario.
import { getStore } from "@netlify/blobs";
import { limiter, crossSite } from "../lib/guard.mjs";
import { kickMeta } from "../lib/meta.mjs";
const limited = limiter(30);

const json = (o, status = 200, cache = "no-store") => new Response(JSON.stringify(o), {status, headers:{"content-type":"application/json", "cache-control":cache}});
const STALE = 30 * 3600e3;   // la tarea diaria lo renueva; si pasan 30 h, lo pide la primera visita

export default async (req) => {
  if (limited(req)) return json({error:"demasiadas consultas"}, 429);
  if (crossSite(req)) return json({error:"solo desde la Bóveda"}, 403);
  const u = new URL(req.url);
  const store = getStore({name:"boveda-meta", consistency:"strong"});
  try {
    // nunca se arma dentro de la consulta: se sirve lo guardado y, si está viejo, se pide en segundo plano
    const d = await store.get("meta", {type:"json"});
    if ((!d || Date.now() - (d.at || 0) > STALE) && u.searchParams.get("refresh") !== "0") await kickMeta(store, process.env.URL || u.origin);
    if (u.searchParams.get("q") === "status") return json({at:d ? d.at : null, pauper:d && d.pauper ? d.pauper.at : null, pioneer:d && d.pioneer ? d.pioneer.at : null, pw:d && d.pw ? d.pw.at : null, errors:d ? d.errors || [] : []});
    if (!d) return json({error:"Preparando el meta: vuelve a intentar en unos minutos.", code:"building"}, 503);
    return json(d, 200, "public, max-age=1800");
  } catch(e){ return json({error:"no se pudo leer el meta"}, 502); }
};

export const config = { path: "/api/meta" };
