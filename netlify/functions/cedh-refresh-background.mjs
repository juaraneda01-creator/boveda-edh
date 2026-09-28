// Reconstrucción de los datos cEDH en segundo plano (hasta 15 minutos): la piden la tarea diaria o la app cuando están viejos.
import { getStore } from "@netlify/blobs";
import { refreshDataset, refreshSig } from "../lib/cedh.mjs";

export default async (req) => {
  const key = process.env.TOPDECK_KEY; if (!key) return;
  if ((req.headers.get("x-boveda-refresh") || "") !== await refreshSig(key)) return;
  const store = getStore({name:"boveda-cedh", consistency:"strong"});
  const r = await refreshDataset(store, key); if (r !== "ok") console.log("cEDH:", r);
};
