// Tarea diaria: pide armar de nuevo el meta de Pauper y Pioneer (MTGTop8 y Pauper World) en segundo plano.
import { getStore } from "@netlify/blobs";
import { kickMeta } from "../lib/meta.mjs";

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || "https://boveda-edh.netlify.app";
  const store = getStore({name:"boveda-meta", consistency:"strong"});
  try { await kickMeta(store, base); } catch(e){ console.error("meta:", e.message); }
};

export const config = { schedule: "@daily" };
