// Mesa compartida: un documento por grupo (su id es la huella SHA-256 del código).
// Cambios por operación y con escritura condicional: dos personas pueden anotar a la vez sin pisarse.
import { getStore } from "@netlify/blobs";

const json = (o, status = 200) => new Response(JSON.stringify(o), {status, headers:{"content-type":"application/json", "cache-control":"no-store"}});
const HITS = new Map();
function limited(req){
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "?";
  const now = Date.now(), recent = (HITS.get(ip) || []).filter(t => now - t < 60000); recent.push(now); HITS.set(ip, recent);
  if (HITS.size > 5000) HITS.clear();
  return recent.length > 60;
}
const MAX_MEMBERS = 16, MAX_DECKS = 40, MAX_GAMES = 3000, MAX_LIST = 12000;
const str = (v, n = 120) => String(v == null ? "" : v).slice(0, n);
const idOk = v => /^[\w-]{4,40}$/.test(String(v || ""));
function cleanDeck(d, mid){
  return {mid, id: str(d.id, 40), name: str(d.name, 80), commanders: (Array.isArray(d.commanders) ? d.commanders : []).slice(0, 2).map(x => str(x, 80)),
    format: ["commander","pauper","pioneer"].includes(d.format) ? d.format : "commander", power: Math.max(0, Math.min(10, +d.power || 0)),
    br: (Array.isArray(d.br) ? d.br : []).slice(0, 2).map(x => Math.max(1, Math.min(5, parseInt(x, 10) || 1))), salt: Math.max(0, Math.min(100, +d.salt || 0)),
    list: str(d.list, MAX_LIST), at: Date.now()};
}
function cleanGame(g, mid){
  const players = (Array.isArray(g.players) ? g.players : []).slice(0, 6).map(p => ({mid: str(p.mid, 40), deck: str(p.deck, 90), name: str(p.name, 80), seat: [1,2,3,4,5,6].includes(+p.seat) ? +p.seat : null, res: ["win","loss","draw"].includes(p.res) ? p.res : "loss"}));
  return {id: str(g.id, 40), at: +g.at || Date.now(), by: mid, players, turn: Math.max(0, Math.min(30, parseInt(g.turn, 10) || 0)), how: str(g.how, 20), note: str(g.note, 200)};
}
function apply(doc, op, b){
  const mid = str(b.mid, 40);
  if (!idOk(mid)) throw Object.assign(new Error("miembro inválido"), {status:400});
  if (op === "join"){
    if (!doc.members[mid] && Object.keys(doc.members).length >= MAX_MEMBERS) throw Object.assign(new Error("el grupo está lleno"), {status:409});
    doc.members[mid] = {name: str(b.name, 40) || "Jugador", at: Date.now()}; if (!doc.name && b.group) doc.name = str(b.group, 60);
  } else {
    if (!doc.members[mid]) throw Object.assign(new Error("primero únete al grupo"), {status:403});
    doc.members[mid].at = Date.now();
    if (op === "decks"){
      for (const k of Object.keys(doc.decks)) if (doc.decks[k].mid === mid) delete doc.decks[k];
      for (const d of (Array.isArray(b.decks) ? b.decks : []).slice(0, MAX_DECKS)) if (idOk(d.id)) doc.decks[mid + ":" + d.id] = cleanDeck(d, mid);
    } else if (op === "game"){
      const g = cleanGame(b.game || {}, mid); if (!idOk(g.id) || g.players.length < 2) throw Object.assign(new Error("partida inválida"), {status:400});
      doc.games = doc.games.filter(x => x.id !== g.id); doc.games.push(g); if (doc.games.length > MAX_GAMES) doc.games = doc.games.slice(-MAX_GAMES);
    } else if (op === "delgame"){
      doc.games = doc.games.filter(x => !(x.id === str(b.gid, 40) && (x.by === mid || x.players.some(p => p.mid === mid))));
    } else if (op === "leave"){
      delete doc.members[mid]; for (const k of Object.keys(doc.decks)) if (doc.decks[k].mid === mid) delete doc.decks[k];
    } else throw Object.assign(new Error("operación no válida"), {status:400});
  }
  doc.at = Date.now(); return doc;
}

export default async (req) => {
  if (limited(req)) return json({error:"demasiadas consultas"}, 429);
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[a-f0-9]{64}$/.test(id)) return json({error:"código inválido"}, 400);
  const store = getStore({name:"boveda-group", consistency:"strong"});
  if (req.method === "GET"){
    const r = await store.getWithMetadata(id, {type:"json"});
    return r && r.data ? json(r.data) : json({error:"no existe"}, 404);
  }
  if (req.method !== "POST") return json({error:"método no permitido"}, 405);
  let b; try { b = await req.json(); } catch { return json({error:"cuerpo inválido"}, 400); }
  for (let tries = 0; tries < 4; tries++){
    const cur = await store.getWithMetadata(id, {type:"json"});
    if (!cur && b.op !== "join") return json({error:"no existe"}, 404);
    const doc = cur && cur.data ? cur.data : {v:1, name:"", members:{}, decks:{}, games:[], at:0};
    try { apply(doc, b.op, b); } catch(e){ return json({error:e.message}, e.status || 400); }
    const res = await store.setJSON(id, doc, cur && cur.etag ? {onlyIfMatch: cur.etag} : {onlyIfNew: true});
    if (!res || res.modified !== false) return json(doc);
  }
  return json({error:"muchos cambios a la vez, intenta de nuevo"}, 409);
};
export const config = { path: "/api/group" };
