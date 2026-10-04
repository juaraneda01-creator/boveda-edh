// Arma el meta en segundo plano (hasta 15 minutos, con pausas entre páginas): lo piden la tarea diaria o la app cuando está viejo.
import { getStore } from "@netlify/blobs";
import { refreshMetaLocked, metaSig } from "../lib/meta.mjs";

export default async (req) => {
  const store = getStore({name:"boveda-meta", consistency:"strong"});
  const sig = await metaSig(store), got = req.headers.get("x-boveda-refresh") || "";
  if (!sig || got !== sig) return;
  const r = await refreshMetaLocked(store); if (r !== "ok") console.log("meta:", r);
};
