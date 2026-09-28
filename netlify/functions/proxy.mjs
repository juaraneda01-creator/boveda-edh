// Puente propio: consulta desde el servidor los sitios que no dejan hacerlo desde otra página.
const ALLOW = new Set(["json.edhrec.com","edhrec.com","backend.commanderspellbook.com","edhtop16.com","api2.moxfield.com","archidekt.com","manabox.app","www.mtggoldfish.com","mtggoldfish.com","mtgtop8.com","tappedout.net","deckstats.net","mtgdecks.net","melee.gg"]);

// límite por persona: 90 consultas por minuto en cada instancia, respuestas de hasta 6 MB
const HITS = new Map(); const PER_MIN = 90; const MAX_BYTES = 6 * 1024 * 1024;
function limited(req){
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "?";
  const now = Date.now(), w = HITS.get(ip) || [];
  const recent = w.filter(t => now - t < 60000); recent.push(now); HITS.set(ip, recent);
  if (HITS.size > 5000) HITS.clear();
  return recent.length > PER_MIN;
}

export default async (req) => {
  if (limited(req)) return new Response("Demasiadas consultas seguidas. Espera un minuto.", { status: 429, headers: { "retry-after": "60" } });
  const target = new URL(req.url).searchParams.get("url");
  let t;
  try { t = new URL(target); } catch { return new Response("Falta una dirección válida.", { status: 400 }); }
  if (t.protocol !== "https:" || !ALLOW.has(t.hostname)) return new Response("Sitio no permitido.", { status: 403 });
  if (req.method !== "GET" && req.method !== "POST") return new Response("Método no permitido.", { status: 405 });
  const headers = { "user-agent": "BovedaEDH/1.0 (+https://boveda-edh.netlify.app)", accept: req.headers.get("accept") || "*/*" };
  const init = { method: req.method, headers, redirect: "follow" };
  if (req.method === "POST"){ init.body = await req.text(); headers["content-type"] = req.headers.get("content-type") || "application/json"; }
  let r;
  try { r = await fetch(t, init); } catch { return new Response("No se pudo contactar el sitio.", { status: 502 }); }
  const len = Number(r.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return new Response("La respuesta es demasiado grande.", { status: 413 });
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return new Response("La respuesta es demasiado grande.", { status: 413 });
  return new Response(buf, { status: r.status, headers: {
    "content-type": r.headers.get("content-type") || "text/plain; charset=utf-8",
    "cache-control": req.method === "GET" && r.ok ? "public, max-age=3600" : "no-store",
  } });
};

export const config = { path: "/api/proxy" };
