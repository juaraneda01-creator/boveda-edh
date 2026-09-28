// Puente propio: consulta desde el servidor los sitios que no dejan hacerlo desde otra página.
const ALLOW = new Set(["json.edhrec.com","edhrec.com","backend.commanderspellbook.com","edhtop16.com","api2.moxfield.com","archidekt.com","manabox.app","www.mtggoldfish.com","mtggoldfish.com","mtgtop8.com","tappedout.net","deckstats.net","mtgdecks.net","melee.gg"]);

export default async (req) => {
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
  return new Response(r.body, { status: r.status, headers: {
    "content-type": r.headers.get("content-type") || "text/plain; charset=utf-8",
    "cache-control": req.method === "GET" && r.ok ? "public, max-age=3600" : "no-store",
  } });
};

export const config = { path: "/api/proxy" };
