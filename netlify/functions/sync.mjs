// Sincronización por código: cada código (guardado como su huella SHA-256) tiene sus propios datos.
import { getStore } from "@netlify/blobs";

const MAX = 5 * 1024 * 1024;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// límite por persona: 40 lecturas o escrituras por minuto en cada instancia
const HITS = new Map();
function limited(req){
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "?";
  const now = Date.now(), recent = (HITS.get(ip) || []).filter(t => now - t < 60000); recent.push(now); HITS.set(ip, recent);
  if (HITS.size > 5000) HITS.clear();
  return recent.length > 40;
}

export default async (req) => {
  if (limited(req)) return json({ error: "demasiadas solicitudes" }, 429);
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[a-f0-9]{64}$/.test(id)) return json({ error: "id inválido" }, 400);
  const store = getStore({ name: "boveda-sync", consistency: "strong" });

  if (req.method === "GET"){
    const r = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!r) return json({ error: "sin datos" }, 404);
    return new Response(r.data, { headers: { "content-type": "application/octet-stream", "x-at": String((r.metadata && r.metadata.at) || 0), "cache-control": "no-store" } });
  }
  if (req.method === "PUT"){
    // la versión la asigna el servidor: no depende del reloj de cada teléfono
    const base = Number(req.headers.get("x-base-at")) || 0;
    const force = req.headers.get("x-force") === "1";
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX) return json({ error: "demasiado grande" }, 413);
    const cur = await store.getMetadata(id);
    const prev = cur && cur.metadata ? Number(cur.metadata.at) || 0 : 0;
    if (!force && prev !== base) return json({ conflict: true, at: prev }, 409);
    const at = Math.max(Date.now(), prev + 1);
    // escritura condicional: si otro dispositivo guardó entre la lectura y ahora, se avisa el conflicto
    const cond = cur && cur.etag ? { onlyIfMatch: cur.etag } : (cur ? {} : { onlyIfNew: true });
    const res = await store.set(id, buf, { metadata: { at }, ...(force ? {} : cond) });
    if (res && res.modified === false){
      const now = await store.getMetadata(id);
      return json({ conflict: true, at: now && now.metadata ? Number(now.metadata.at) || 0 : 0 }, 409);
    }
    return json({ ok: true, at });
  }
  if (req.method === "DELETE"){ await store.delete(id); return json({ ok: true }); }
  return json({ error: "método no permitido" }, 405);
};

export const config = { path: "/api/sync" };
