// Renueva la lista de sal de EDHREC una vez por semana (o termina de armarla si quedó a medias).
import { getStore } from "@netlify/blobs";
import { buildSalt, SALT_TTL } from "../lib/salt.mjs";
const getJSON = async url => { const r = await fetch(url, {headers:{accept:"application/json", "user-agent":"BovedaEDH/1.0 (+https://boveda-edh.netlify.app)"}}); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
export default async () => {
  const store = getStore({name:"boveda-salt", consistency:"strong"});
  const d = await store.get("map", {type:"json"}).catch(() => null);
  if (d && d.done && Date.now() - d.at < SALT_TTL) return;
  try { const b = await buildSalt(getJSON, {budgetMs: 25000}); if (b.n) await store.setJSON("map", b); } catch(e){ console.error("sal:", e.message); }
};
export const config = { schedule: "@daily" };
