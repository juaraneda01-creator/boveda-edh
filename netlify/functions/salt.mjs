// Sal de EDHREC para la app (lista guardada y renovada semanalmente).
import { getStore } from "@netlify/blobs";
import { buildSalt, SALT_TTL } from "../lib/salt.mjs";
const json = (o, status = 200, cache = "no-store") => new Response(JSON.stringify(o), {status, headers:{"content-type":"application/json", "cache-control":cache}});
const getJSON = async url => { const r = await fetch(url, {headers:{accept:"application/json", "user-agent":"BovedaEDH/1.0 (+https://boveda-edh.netlify.app)"}}); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
export default async () => {
  const store = getStore({name:"boveda-salt", consistency:"strong"});
  let d = await store.get("map", {type:"json"}).catch(() => null);
  if (!d || !d.done || Date.now() - d.at > SALT_TTL){
    try { const b = await buildSalt(getJSON, {budgetMs: 8000}); if (b.n > (d ? d.n : 0) || b.done){ await store.setJSON("map", b); d = b; } } catch {}
  }
  if (!d) return json({error:"EDHREC no respondió"}, 502);
  return json(d, 200, "public, max-age=21600");
};
export const config = { path: "/api/salt" };
