// Protecciones comunes de las funciones: límite por IP, solo peticiones desde la propia app, cuerpos con tope.
export function limiter(perMin){
  const hits = new Map();
  return req => {
    const ip = req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "?").split(",")[0].trim();
    const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < 60000); recent.push(now);
    hits.delete(ip); hits.set(ip, recent);   // el más reciente queda al final
    if (hits.size > 5000){ for (const [k, v] of hits){ if (hits.size <= 4000) break; if (!v.length || now - v[v.length-1] >= 60000 || hits.size > 4500) hits.delete(k); } }   // se descartan los más antiguos, no todos
    return recent.length > perMin;
  };
}
// el navegador marca si la petición viene de otro sitio: esas se rechazan (evita usar las funciones desde páginas ajenas)
export function crossSite(req){
  const sfs = req.headers.get("sec-fetch-site");
  if (sfs && sfs !== "same-origin" && sfs !== "none") return true;
  const origin = req.headers.get("origin");
  if (origin){ try { const o = new URL(origin), h = new URL(req.url); if (o.host !== h.host && !/(^|\.)boveda-edh\.netlify\.app$/.test(o.hostname) && !/^(localhost|127\.0\.0\.1)$/.test(o.hostname)) return true; } catch { return true; } }
  return false;
}
// lee el cuerpo con tope de bytes (no carga en memoria un cuerpo gigante)
export async function readText(req, max){
  if (!req.body) return "";
  const reader = req.body.getReader(); let size = 0; const parts = [];
  for (;;){ const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > max){ try { reader.cancel(); } catch {} throw Object.assign(new Error("demasiado grande"), {status:413}); } parts.push(value); }
  return new TextDecoder().decode(parts.length === 1 ? parts[0] : Buffer.concat(parts.map(p => Buffer.from(p))));
}
export async function readJSON(req, max){
  const t = await readText(req, max);
  let j; try { j = JSON.parse(t); } catch { throw Object.assign(new Error("cuerpo inválido"), {status:400}); }
  if (!j || typeof j !== "object" || Array.isArray(j)) throw Object.assign(new Error("cuerpo inválido"), {status:400});
  return j;
}
// lee una respuesta con tope de bytes
export async function readCapped(res, max){
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader(); let size = 0; const parts = [];
  for (;;){ const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > max){ try { reader.cancel(); } catch {} return null; } parts.push(value); }
  const out = new Uint8Array(size); let o = 0; for (const p of parts){ out.set(p, o); o += p.byteLength; } return out;
}
// cuota diaria por conexión para crear cosas nuevas (códigos de sincronización, grupos):
// frena a un programa que cree miles de ids; una persona normal no llega nunca al tope
export function clientIp(req){ return req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "?").split(",")[0].trim(); }
export async function overDailyQuota(store, req, kind, max){
  const { createHash } = await import("node:crypto");
  const day = new Date().toISOString().slice(0, 10);
  const key = `q/${kind}/${day}/` + createHash("sha256").update("boveda-quota:" + clientIp(req)).digest("hex").slice(0, 32);
  try {
    const cur = await store.get(key, {type:"json"}); const n = (cur && cur.n) || 0;
    if (n >= max) return true;
    await store.setJSON(key, {n: n + 1});
  } catch {}   // si la cuota no se puede leer, no se bloquea a nadie
  return false;
}
