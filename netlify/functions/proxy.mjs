// Puente propio: consulta desde el servidor los sitios que no dejan hacerlo desde otra página.
// Nunca devuelve HTML ejecutable: todo sale como texto o JSON, con sandbox y nosniff.
import { limiter, crossSite, readText, readCapped } from "../lib/guard.mjs";
const ALLOW = new Set(["json.edhrec.com","edhrec.com","backend.commanderspellbook.com","edhtop16.com","api2.moxfield.com","archidekt.com","manabox.app","www.mtggoldfish.com","mtggoldfish.com","mtgtop8.com","tappedout.net","deckstats.net","mtgdecks.net","melee.gg"]);
// POST solo a las API que la app usa de verdad
const POST_OK = [["edhtop16.com", /^\/api\/graphql$/], ["backend.commanderspellbook.com", /^\/(find-my-combos|variants)(\/[\w-]*)*\/?$/]];
const MAX_BYTES = 6 * 1024 * 1024, MAX_BODY = 256 * 1024;
const limited = limiter(90);
const SAFE = {"x-content-type-options":"nosniff", "content-security-policy":"sandbox; default-src 'none'", "referrer-policy":"no-referrer", "vary":"Accept"};
const TIMEOUT = 12000;   // un sitio lento no deja la función colgada
const txt = (msg, status, extra) => new Response(msg, {status, headers:{"content-type":"text/plain; charset=utf-8", ...SAFE, ...(extra||{})}});

export default async (req) => {
  if (limited(req)) return txt("Demasiadas consultas seguidas. Espera un minuto.", 429, {"retry-after":"60"});
  if (crossSite(req)) return txt("Solo desde la Bóveda.", 403);
  if (req.method !== "GET" && req.method !== "POST") return txt("Método no permitido.", 405);
  let t;
  try { t = new URL(new URL(req.url).searchParams.get("url")); } catch { return txt("Falta una dirección válida.", 400); }
  const ok = u => u.protocol === "https:" && u.port === "" && !u.username && !u.password && ALLOW.has(u.hostname);
  if (!ok(t)) return txt("Sitio no permitido.", 403);
  if (req.method === "POST" && !POST_OK.some(([h, re]) => h === t.hostname && re.test(t.pathname))) return txt("Envío no permitido a esa dirección.", 403);
  const headers = { "user-agent": "BovedaEDH/1.0 (+https://boveda-edh.netlify.app)", accept: req.headers.get("accept") || "*/*" };
  const init = { method: req.method, headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT) };
  if (req.method === "POST"){ try { init.body = await readText(req, MAX_BODY); } catch { return txt("Envío demasiado grande.", 413); } headers["content-type"] = "application/json"; }
  let r;
  // las redirecciones se siguen a mano (máx. 3) y cada destino vuelve a pasar la lista permitida
  try {
    for (let hop = 0; ; hop++){
      r = await fetch(t, init);
      if (r.status < 300 || r.status >= 400 || !r.headers.get("location")) break;
      if (hop >= 3) return txt("Demasiadas redirecciones.", 508);
      t = new URL(r.headers.get("location"), t);
      if (!ok(t)) return txt("Sitio no permitido.", 403);
      if (r.status === 303 || ((r.status === 301 || r.status === 302) && init.method === "POST")){ init.method = "GET"; delete init.body; delete headers["content-type"]; }
    }
  } catch(e){ return txt(e && e.name === "TimeoutError" ? "El sitio tardó demasiado en responder." : "No se pudo contactar el sitio.", e && e.name === "TimeoutError" ? 504 : 502); }
  if ([204, 205, 304].includes(r.status)) return new Response(null, {status: r.status === 304 ? 204 : r.status, headers: SAFE});
  if (Number(r.headers.get("content-length") || 0) > MAX_BYTES) return txt("La respuesta es demasiado grande.", 413);
  let buf; try { buf = await readCapped(r, MAX_BYTES); } catch { return txt("El sitio tardó demasiado en responder.", 504); }
  if (!buf) return txt("La respuesta es demasiado grande.", 413);
  const isJSON = /json/i.test(r.headers.get("content-type") || "");
  return new Response(buf, { status: r.status, headers: {
    "content-type": isJSON ? "application/json; charset=utf-8" : "text/plain; charset=utf-8", ...SAFE,
    "cache-control": req.method === "GET" && r.ok ? "public, max-age=3600" : "no-store",
  } });
};

export const config = { path: "/api/proxy" };
