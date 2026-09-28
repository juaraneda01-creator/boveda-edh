// Tarea diaria: pide la reconstrucción de los datos cEDH (TopDeck.gg, 24+ jugadores, últimos 180 días) en segundo plano.
import { getStore } from "@netlify/blobs";
import { kickRefresh } from "../lib/cedh.mjs";

export default async () => {
  const key = process.env.TOPDECK_KEY; if (!key) return;
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || "https://boveda-edh.netlify.app";
  const store = getStore({name:"boveda-cedh", consistency:"strong"});
  try { await kickRefresh(store, key, base); } catch(e){ console.error("cEDH:", e.message); }
};

export const config = { schedule: "@daily" };
