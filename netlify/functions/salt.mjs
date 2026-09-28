// Sal de EDHREC para la app: se sirve la lista guardada; si aún no está completa, se avanza un tramo corto.
import { getStore } from "@netlify/blobs";
import { saltStep } from "../lib/salt.mjs";
import { limiter, crossSite } from "../lib/guard.mjs";
const limited = limiter(30);
const json = (o, status = 200, cache = "no-store") => new Response(JSON.stringify(o), {status, headers:{"content-type":"application/json", "cache-control":cache}});
const getJSON = async url => { const r = await fetch(url, {headers:{accept:"application/json", "user-agent":"BovedaEDH/1.0 (+https://boveda-edh.netlify.app)"}}); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
export default async (req) => {
  try {
    if (crossSite(req)) return json({error:"solo desde la Bóveda"}, 403);
    const store = getStore({name:"boveda-salt", consistency:"strong"});
    let d = await store.get("map", {type:"json"}).catch(() => null);
    if (!d || !d.done){ if (limited(req)) return d ? json(d) : json({error:"demasiadas consultas"}, 429); d = await saltStep(store, getJSON, 6000).catch(() => d); }
    if (!d) return json({error:"EDHREC no respondió"}, 502);
    return json(d, 200, d.done ? "public, max-age=21600" : "no-store");
  } catch { return json({error:"error del servidor"}, 500); }
};
export const config = { path: "/api/salt" };
