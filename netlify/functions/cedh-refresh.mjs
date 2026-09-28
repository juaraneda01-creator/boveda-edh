// Renueva a diario los datos de torneos cEDH (TopDeck.gg, 24+ jugadores, últimos 180 días).
import { getStore } from "@netlify/blobs";
import { buildDataset, saveDataset } from "../lib/cedh.mjs";

export default async () => {
  const key = process.env.TOPDECK_KEY; if (!key) return;
  const store = getStore({name:"boveda-cedh", consistency:"strong"});
  try { await saveDataset(store, await buildDataset(key)); } catch(e){ console.error("cEDH:", e.message); }
};

export const config = { schedule: "@daily" };
