// Renueva la lista de sal de EDHREC una vez por semana; si quedó a medias, sigue desde la página donde iba.
import { getStore } from "@netlify/blobs";
import { saltStep } from "../lib/salt.mjs";
const getJSON = async url => { const r = await fetch(url, {headers:{accept:"application/json", "user-agent":"BovedaEDH/1.0 (+https://boveda-edh.netlify.app)"}}); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
export default async () => {
  const store = getStore({name:"boveda-salt", consistency:"strong"});
  try { await saltStep(store, getJSON, 24000); } catch(e){ console.error("sal:", e.message); }
};
export const config = { schedule: "@daily" };
