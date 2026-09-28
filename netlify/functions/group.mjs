// Mesa compartida: un documento por grupo (su id es la huella SHA-256 del código).
// Cambios por operación y con escritura condicional: dos personas pueden anotar a la vez sin pisarse.
// Cada miembro tiene una clave secreta propia (se guarda solo su huella): nadie puede actuar en nombre de otro.
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { limiter, crossSite, readJSON, overDailyQuota } from "../lib/guard.mjs";
const limited = limiter(60);

const json = (o, status = 200) => new Response(JSON.stringify(o), {status, headers:{"content-type":"application/json", "cache-control":"no-store", "x-content-type-options":"nosniff"}});
const MAX_MEMBERS = 16, MAX_DECKS = 25, MAX_GAMES = 3000, MAX_LIST = 9000, MAX_DOC = 1_500_000;
const NEW_PER_DAY = 10;                                   // grupos nuevos por conexión y día
// miembros de antes de las claves: pueden reclamar su lugar hasta esta fecha; después deben volver a unirse
const LEGACY_UNTIL = Date.parse("2026-11-01T00:00:00Z");
const RESERVED = new Set(["__proto__", "constructor", "prototype", "hasOwnProperty", "toString", "valueOf"]);
const str = (v, n = 120) => String(v == null ? "" : v).slice(0, n);
const idOk = v => /^[\w-]{4,40}$/.test(String(v || "")) && !RESERVED.has(String(v));
const has = (o, k) => !!o && Object.hasOwn(o, k);
const hash = t => createHash("sha256").update("boveda-member:" + t).digest("hex");
// corta en el último salto de línea (nunca deja una carta a medias)
const cutLines = (v, n) => { const s = String(v == null ? "" : v); if (s.length <= n) return s; const c = s.slice(0, n); const i = c.lastIndexOf("\n"); return i > 0 ? c.slice(0, i) : c; };
const fail = (msg, status) => Object.assign(new Error(msg), {status});
function cleanDeck(d, mid){
  return {mid, id: str(d.id, 40), name: str(d.name, 80), commanders: (Array.isArray(d.commanders) ? d.commanders : []).slice(0, 2).map(x => str(x, 80)),
    format: ["commander","pauper","pioneer"].includes(d.format) ? d.format : "commander", power: Math.max(0, Math.min(10, +d.power || 0)),
    br: (Array.isArray(d.br) ? d.br : []).slice(0, 2).map(x => Math.max(1, Math.min(5, parseInt(x, 10) || 1))), salt: Math.max(0, Math.min(100, +d.salt || 0)),
    list: cutLines(d.list, MAX_LIST), upd: Math.max(0, +d.upd || 0), at: Date.now()};
}
function cleanGame(g, mid, doc){
  const players = (Array.isArray(g.players) ? g.players : []).slice(0, 6).map(p => ({mid: str(p && p.mid, 40), deck: str(p && p.deck, 90), seat: [1,2,3,4,5,6].includes(+(p && p.seat)) ? +p.seat : null, res: ["win","loss","draw"].includes(p && p.res) ? p.res : "loss"}));
  // cada jugador debe ser miembro, con un mazo suyo publicado, y sin repetirse
  const seen = new Set();
  for (const p of players){
    if (!has(doc.members, p.mid) || seen.has(p.mid)) throw fail("jugador inválido", 400); seen.add(p.mid);
    if (!has(doc.decks, p.deck) || doc.decks[p.deck].mid !== p.mid) throw fail("mazo inválido", 400);
  }
  if (players.filter(p => p.res === "win").length > 1) throw fail("solo puede ganar uno", 400);
  return {id: str(g.id, 40), at: Math.min(Date.now() + 60000, +g.at || Date.now()), by: mid, players, turn: Math.max(0, Math.min(30, parseInt(g.turn, 10) || 0)), how: str(g.how, 20), note: str(g.note, 200)};
}
function apply(doc, op, b){
  const mid = str(b.mid, 40), tok = str(b.tok, 80);
  if (!idOk(mid)) throw fail("miembro inválido", 400);
  if (tok.length < 16) throw fail("falta la clave del miembro", 400);
  const th = hash(tok);
  const isMember = has(doc.members, mid);
  doc.left = doc.left && typeof doc.left === "object" ? doc.left : {};
  // miembros anteriores a las claves: la primera clave que llega queda como la suya (solo durante la transición)
  if (isMember && doc.members[mid].th && doc.members[mid].th !== th) throw fail("clave de miembro incorrecta", 403);
  if (isMember && !doc.members[mid].th && Date.now() > LEGACY_UNTIL) throw fail("vuelve a unirte al grupo con tu nombre", 403);
  // el id de alguien que salió o fue expulsado no se reutiliza
  if (!isMember && has(doc.left, mid)) throw fail("ese miembro ya salió del grupo: vuelve a unirte", 403);
  if (!doc.owner || !has(doc.members, doc.owner)) doc.owner = Object.keys(doc.members)[0] || null;   // grupos antiguos: el primero en llegar
  if (op === "create" || op === "join"){
    if (!isMember && Object.keys(doc.members).length >= MAX_MEMBERS) throw fail("el grupo está lleno", 409);
    doc.members[mid] = {name: str(b.name, 40) || "Jugador", at: Date.now(), th};
    if (op === "create"){ if (b.group) doc.name = str(b.group, 60); doc.owner = mid; }
    if (!doc.owner) doc.owner = mid;
  } else {
    if (!isMember) throw fail("primero únete al grupo", 403);
    Object.assign(doc.members[mid], {at: Date.now(), th});
    if (op === "decks"){
      // lo borrado queda anotado (con su hora): un dispositivo atrasado no lo puede revivir
      doc.gone = doc.gone && typeof doc.gone === "object" ? doc.gone : {};
      for (const id of (Array.isArray(b.del) ? b.del : []).slice(0, 200)){ if (!idOk(id)) continue; const k = mid + ":" + id; if (has(doc.decks, k)) delete doc.decks[k]; doc.gone[k] = Date.now(); }
      const gk = Object.keys(doc.gone); if (gk.length > 500) for (const k of gk.sort((a, b) => doc.gone[a] - doc.gone[b]).slice(0, gk.length - 500)) delete doc.gone[k];
      for (const d of (Array.isArray(b.decks) ? b.decks : []).slice(0, MAX_DECKS)){
        if (!d || !idOk(d.id)) continue; const k = mid + ":" + d.id;
        if (has(doc.gone, k) && doc.gone[k] >= (+d.upd || 0)) continue;   // se borró después de esta versión
        if (has(doc.decks, k) && (doc.decks[k].upd || 0) > (+d.upd || 0)) continue;   // otro dispositivo ya publicó una versión más nueva
        doc.decks[k] = cleanDeck(d, mid);
      }
      const mine = Object.keys(doc.decks).filter(k => doc.decks[k].mid === mid);
      if (mine.length > MAX_DECKS) throw fail(`máximo ${MAX_DECKS} mazos por persona en el grupo`, 413);
    } else if (op === "game"){
      const g = cleanGame(b.game || {}, mid, doc); if (!idOk(g.id) || g.players.length < 2) throw fail("partida inválida", 400);
      const old = doc.games.find(x => x.id === g.id);
      if (old && old.by !== mid) throw fail("esa partida la anotó otra persona", 409);
      doc.games = doc.games.filter(x => x.id !== g.id); doc.games.push(g); if (doc.games.length > MAX_GAMES) doc.games = doc.games.slice(-MAX_GAMES);
    } else if (op === "delgame"){
      const gid = str(b.gid, 40), n = doc.games.length;
      doc.games = doc.games.filter(x => !(x.id === gid && (x.by === mid || (x.players || []).some(p => p.mid === mid))));
      if (doc.games.length === n) throw fail("no puedes borrar esa partida", 403);
    } else if (op === "leave"){
      removeMember(doc, mid);
    } else if (op === "kick"){
      const who = str(b.who, 40);
      if (doc.owner !== mid) throw fail("solo quien administra el grupo puede quitar miembros", 403);
      if (who === mid || !has(doc.members, who)) throw fail("miembro inválido", 400);
      removeMember(doc, who);
    } else if (op === "owner"){
      const who = str(b.who, 40);
      if (doc.owner !== mid) throw fail("solo quien administra el grupo puede traspasarlo", 403);
      if (!has(doc.members, who)) throw fail("miembro inválido", 400);
      doc.owner = who;
    } else throw fail("operación no válida", 400);
  }
  doc.at = Date.now(); return doc;
}
function removeMember(doc, who){
  delete doc.members[who]; doc.left[who] = Date.now();
  for (const k of Object.keys(doc.decks)) if (doc.decks[k].mid === who) delete doc.decks[k];
  const lk = Object.keys(doc.left); if (lk.length > 200) for (const k of lk.sort((a, b) => doc.left[a] - doc.left[b]).slice(0, lk.length - 200)) delete doc.left[k];
  if (doc.owner === who) doc.owner = Object.keys(doc.members)[0] || null;
}
// lo que sale nunca lleva las huellas de las claves
function pub(doc){
  const members = {}; for (const [k, m] of Object.entries(doc.members || {})){ const {th, ...rest} = m; members[k] = rest; }
  const {left, ...rest} = doc;
  return {...rest, members};
}

async function handle(req){
  if (crossSite(req)) return json({error:"origen no permitido"}, 403);
  if (limited(req)) return json({error:"demasiadas consultas"}, 429);
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[a-f0-9]{64}$/.test(id)) return json({error:"código inválido"}, 400);
  const store = getStore({name:"boveda-group", consistency:"strong"});
  if (req.method === "GET"){
    const r = await store.getWithMetadata(id, {type:"json"});
    if (r && r.data && r.data.moved) return json({error:"el grupo cambió de código: pide la nueva invitación", moved:true}, 410);
    return r && r.data ? json(pub(r.data)) : json({error:"no existe"}, 404);
  }
  if (req.method !== "POST") return json({error:"método no permitido"}, 405);
  let b; try { b = await readJSON(req, 256 * 1024); } catch(e){ return json({error:e.message}, e.status || 400); }
  if (b.op === "create" && await overDailyQuota(getStore({name:"boveda-quota"}), req, "group", NEW_PER_DAY)) return json({error:"demasiados grupos nuevos hoy desde esta conexión"}, 429);
  if (b.op === "rotate") return rotate(store, id, b);
  for (let tries = 0; tries < 4; tries++){
    const cur = await store.getWithMetadata(id, {type:"json"});
    if (b.op === "create" && cur) return json({error:"ese código ya está en uso"}, 409);
    if (b.op !== "create" && !cur) return json({error:"no existe"}, 404);
    if (cur && cur.data && cur.data.moved) return json({error:"el grupo cambió de código: pide la nueva invitación", moved:true}, 410);
    const doc = cur && cur.data ? cur.data : {v:1, name:"", members:{}, decks:{}, games:[], at:0};
    doc.members = doc.members || {}; doc.decks = doc.decks || {}; doc.games = Array.isArray(doc.games) ? doc.games : [];
    try { apply(doc, b.op, b); } catch(e){ return json({error:e.message}, e.status || 400); }
    if (JSON.stringify(doc).length > MAX_DOC) return json({error:"el grupo llegó a su tamaño máximo: borren partidas o mazos viejos"}, 413);
    const res = await store.setJSON(id, doc, {metadata: {at: doc.at}, ...(cur && cur.etag ? {onlyIfMatch: cur.etag} : {onlyIfNew: true})});
    if (!res || res.modified !== false) return json(pub(doc));
  }
  return json({error:"muchos cambios a la vez, intenta de nuevo"}, 409);
}
// código nuevo: el grupo se copia a su nuevo id y el antiguo queda como aviso (sin datos) por 30 días
async function rotate(store, id, b){
  const to = String(b.to || "");
  if (!/^[a-f0-9]{64}$/.test(to) || to === id) return json({error:"código nuevo inválido"}, 400);
  const cur = await store.getWithMetadata(id, {type:"json"});
  if (!cur || !cur.data || cur.data.moved) return json({error:"no existe"}, 404);
  const doc = cur.data; doc.members = doc.members || {}; doc.decks = doc.decks || {}; doc.games = Array.isArray(doc.games) ? doc.games : [];
  try { apply(doc, "noop-check", {...b, op:"noop-check"}); } catch(e){ if (e.status !== 400 || e.message !== "operación no válida") return json({error:e.message}, e.status || 400); }
  if (doc.owner !== str(b.mid, 40)) return json({error:"solo quien administra el grupo puede cambiar el código"}, 403);
  doc.at = Date.now();
  const made = await store.setJSON(to, doc, {metadata:{at:doc.at}, onlyIfNew:true});
  if (made && made.modified === false) return json({error:"ese código ya está en uso"}, 409);
  const res = await store.setJSON(id, {moved:true, at:Date.now()}, {metadata:{at:Date.now()}, onlyIfMatch: cur.etag});
  if (res && res.modified === false){ await store.delete(to); return json({error:"muchos cambios a la vez, intenta de nuevo"}, 409); }
  return json(pub(doc));
}
export default async (req) => { try { return await handle(req); } catch { return json({error:"error del servidor"}, 500); } };
export const config = { path: "/api/group" };
