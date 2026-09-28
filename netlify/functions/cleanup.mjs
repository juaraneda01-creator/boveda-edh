// Tarea semanal de limpieza del almacenamiento (ver netlify/lib/cleanup.mjs).
import { getStore } from "@netlify/blobs";
import { cleanup } from "../lib/cleanup.mjs";
export default async () => {
  try {
    const r = await cleanup({sync: getStore({name:"boveda-sync"}), group: getStore({name:"boveda-group"}), quota: getStore({name:"boveda-quota"})});
    console.log("limpieza:", JSON.stringify(r));
  } catch(e){ console.error("limpieza:", e.message); }
};
export const config = { schedule: "@weekly" };
