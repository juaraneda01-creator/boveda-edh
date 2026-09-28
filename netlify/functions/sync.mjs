// Sincronización por código: cada código (guardado como su huella SHA-256) tiene sus propios datos.
import { getStore } from "@netlify/blobs";

const MAX = 5 * 1024 * 1024;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[a-f0-9]{64}$/.test(id)) return json({ error: "id inválido" }, 400);
  const store = getStore({ name: "boveda-sync", consistency: "strong" });

  if (req.method === "GET"){
    const r = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!r) return json({ error: "sin datos" }, 404);
    return new Response(r.data, { headers: { "content-type": "application/octet-stream", "x-at": String((r.metadata && r.metadata.at) || 0), "cache-control": "no-store" } });
  }
  if (req.method === "PUT"){
    const at = Number(req.headers.get("x-at")) || Date.now();
    const base = Number(req.headers.get("x-base-at")) || 0;
    const force = req.headers.get("x-force") === "1";
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX) return json({ error: "demasiado grande" }, 413);
    if (!force){
      const m = await store.getMetadata(id);
      const prev = m && m.metadata ? Number(m.metadata.at) || 0 : 0;
      if (prev > base) return json({ conflict: true, at: prev }, 409);
    }
    await store.set(id, buf, { metadata: { at } });
    return json({ ok: true, at });
  }
  if (req.method === "DELETE"){ await store.delete(id); return json({ ok: true }); }
  return json({ error: "método no permitido" }, 405);
};

export const config = { path: "/api/sync" };
