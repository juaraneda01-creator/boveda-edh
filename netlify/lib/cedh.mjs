// Datos de torneos cEDH desde la API pública de TopDeck.gg (requiere clave gratuita en TOPDECK_KEY).
// Se guardan compactos para que el teléfono pueda filtrar por fecha y tamaño sin volver a consultar.
export const TD_API = process.env.TOPDECK_API || "https://topdeck.gg/api";
export const MIN_PLAYERS = 24;      // torneos con 24 o más jugadores: datos más confiables
export const DAYS = 180;

const norm = s => String(s || "").trim();
export const slugName = s => norm(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// lista de una posición: primero el objeto estructurado, si no el texto "~~Commanders~~ / ~~Mainboard~~"
export function parseDeck(s){
  const cmds = [], main = [];
  const o = s && s.deckObj;
  if (o && typeof o === "object"){
    for (const [sec, cards] of Object.entries(o)){
      const target = /command/i.test(sec) ? cmds : /main|deck|library/i.test(sec) ? main : null;
      if (!target || !cards) continue;
      const list = Array.isArray(cards) ? cards.map(c => [c && (c.name || c.n || c.cardName), c && (c.count || c.quantity || c.qty)])
        : Object.entries(cards).map(([n, v]) => [(v && v.name) || n, v && typeof v === "object" ? (v.count || v.quantity || v.qty) : v]);
      for (const [n, q] of list) if (n) target.push([norm(n), Math.max(1, parseInt(q, 10) || 1)]);
    }
  }
  const txt = s && typeof s.decklist === "string" ? s.decklist : "";
  const url = /^https?:\/\//i.test(txt.trim()) ? txt.trim() : null;
  if (!cmds.length && !main.length && txt && !url){
    let sec = "";
    for (const line of txt.split(/\r?\n/)){
      const h = line.match(/^\s*~~\s*(.+?)\s*~~\s*$/) || line.match(/^\s*\/\/\s*(.+)$/); if (h){ sec = h[1]; continue; }
      const m = line.match(/^\s*(\d+)\s*x?\s+(.+?)\s*$/i); if (!m) continue;
      (/command/i.test(sec) ? cmds : /side|maybe|considering/i.test(sec) ? [] : main).push([m[2].replace(/\s*\([^)]*\)\s*[\w-]*\s*$/, ""), +m[1]]);
    }
  }
  return {cmds: cmds.map(x => x[0]).sort(), main, url};
}

async function td(path, {method = "GET", body, key}){
  const r = await fetch(TD_API + path, {method, headers:{Authorization:key, "content-type":"application/json", accept:"application/json"}, body: body ? JSON.stringify(body) : undefined});
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error("La clave de TopDeck.gg no es válida."), {code:"key"});
  if (r.status === 429) throw Object.assign(new Error("TopDeck.gg pidió esperar un momento."), {code:"rate"});
  if (!r.ok) throw Object.assign(new Error("TopDeck.gg respondió " + r.status), {code:"http"});
  return r.json();
}

// arma el conjunto compacto: torneos, posiciones, asientos y cartas por comandante
export async function buildDataset(key, {days = DAYS, min = MIN_PLAYERS} = {}){
  const list = await td("/v2/tournaments", {method:"POST", key, body:{
    game:"Magic: The Gathering", format:"EDH", last:days, participantMin:min,
    columns:["name", "id", "decklist", "wins", "draws", "losses", "winRate"],
    rounds:["round", "tables"], tables:["table", "players", "winner_id", "status"], players:["id"]}});
  const arr = Array.isArray(list) ? list : (list && (list.data || list.tournaments)) || [];
  const cmdIdx = new Map(), cmdNames = [];
  const cmdId = n => { if (!cmdIdx.has(n)){ cmdIdx.set(n, cmdNames.length); cmdNames.push(n); } return cmdIdx.get(n); };
  const tours = [], cardsBy = new Map(), global = new Map(); let lists = 0;
  const details = [];
  for (const t of arr){
    const st = Array.isArray(t.standings) ? t.standings : [];
    if (st.length < min) continue;
    const topCut = +t.topCut || 0;
    const entries = [];
    const std = [];
    st.forEach((s, i) => {
      const D = parseDeck(s);
      const name = D.cmds.length ? D.cmds.join(" / ") : "";
      const c = name ? cmdId(name) : -1;
      const standing = +s.standing || i + 1;
      const top = topCut && standing <= topCut ? 1 : 0;
      entries.push([c, standing, +s.wins || 0, +s.draws || 0, +s.losses || 0]);
      std.push({standing, name:norm(s.name), pid:norm(s.id), cmd:name, w:+s.wins || 0, d:+s.draws || 0, l:+s.losses || 0, list:!!(D.main.length || D.url)});
      if (name && D.main.length){
        lists++;
        let agg = cardsBy.get(name); if (!agg){ agg = {lists:0, top:0, cards:new Map()}; cardsBy.set(name, agg); }
        agg.lists++; if (top) agg.top++;
        for (const [n] of D.main){ const k = agg.cards.get(n) || [0, 0]; k[0]++; if (top) k[1]++; agg.cards.set(n, k); global.set(n, (global.get(n) || 0) + 1); }
      }
    });
    // asientos: el orden de los jugadores en la mesa es el orden de asiento
    const seat = [0, 0, 0, 0, 0, 0];   // mesas, asiento 1..4, empates
    for (const r of Array.isArray(t.rounds) ? t.rounds : []) for (const tb of Array.isArray(r.tables) ? r.tables : []){
      const ps = Array.isArray(tb.players) ? tb.players : []; if (ps.length !== 4) continue;
      if (tb.status && !/complete|finished|done/i.test(tb.status)) continue;
      seat[0]++;
      const w = tb.winner_id || (tb.winner && typeof tb.winner === "object" ? tb.winner.id : null);
      const pos = w ? ps.findIndex(p => (p && (p.id || p)) === w) : -1;
      if (pos >= 0) seat[pos + 1]++; else seat[5]++;
    }
    const date = +t.startDate || 0;
    tours.push({id:norm(t.TID || t.tid), n:norm(t.tournamentName || t.name), d:date, s:st.length, tc:topCut, city:norm(t.eventData && (t.eventData.city || "")), st:norm(t.eventData && (t.eventData.state || "")), e:entries, seat});
    details.push({id:norm(t.TID || t.tid), n:norm(t.tournamentName || t.name), d:date, s:st.length, tc:topCut, std});
  }
  tours.sort((a, b) => b.d - a.d);
  const cmdCards = {};
  for (const [name, agg] of cardsBy){ if (agg.lists < 3) continue;
    cmdCards[slugName(name)] = {name, lists:agg.lists, top:agg.top, cards:[...agg.cards.entries()].map(([n, [a, b]]) => [n, Math.round(1000 * a / agg.lists) / 10, agg.top ? Math.round(1000 * b / agg.top) / 10 : null]).sort((x, y) => y[1] - x[1]).slice(0, 220)}; }
  const staples = [...global.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([n, c]) => [n, lists ? Math.round(1000 * c / lists) / 10 : 0]);
  return {data:{at:Date.now(), days, min, src:"TopDeck.gg", cmds:cmdNames, tours, staples, lists}, cmdCards, details};
}

export async function saveDataset(store, built){
  // en paralelo y por tandas; "data" al final para que nadie vea un índice que apunta a torneos aún no guardados
  const jobs = [() => store.setJSON("cmdCards", built.cmdCards), ...built.details.slice(0, 120).filter(t => t.id).map(t => () => store.setJSON("t-" + t.id, t))];
  for (let i = 0; i < jobs.length; i += 12) await Promise.all(jobs.slice(i, i + 12).map(f => f()));
  await store.setJSON("data", built.data);
}

// una sola reconstrucción a la vez: el candado vence solo a los 15 minutos
export const LOCK_MS = 15 * 60e3;
export async function takeLock(store){
  const cur = await store.getWithMetadata("lock", {type:"json"}).catch(() => null);
  if (cur && cur.data && Date.now() - (cur.data.at || 0) < LOCK_MS) return false;
  const r = await store.setJSON("lock", {at: Date.now()}, cur && cur.etag ? {onlyIfMatch: cur.etag} : {onlyIfNew: true});
  return !r || r.modified !== false;
}
export async function refreshDataset(store, key){
  if (!(await takeLock(store))) return "ocupado";
  try { await saveDataset(store, await buildDataset(key)); await store.setJSON("lock", {at: 0}); return "ok"; }
  catch(e){ await store.setJSON("meta-err", {at: Date.now(), msg: String(e && e.message || e).slice(0, 200)}).catch(() => {}); return "error"; }   // el candado queda: no se reintenta en cada visita
}
// firma para que solo la propia app pueda pedir una reconstrucción
export const refreshSig = async key => { const { createHash } = await import("node:crypto"); return createHash("sha256").update("boveda-cedh-refresh:" + key).digest("hex"); };
export async function kickRefresh(store, key, base){
  const cur = await store.get("lock", {type:"json"}).catch(() => null);
  if (cur && Date.now() - (cur.at || 0) < LOCK_MS) return false;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
    await fetch(new URL("/.netlify/functions/cedh-refresh-background", base), {method:"POST", headers:{"x-boveda-refresh": await refreshSig(key)}, signal: ctl.signal}).catch(() => {});
    clearTimeout(t);
  } catch {}
  return true;
}

export async function deckFromTopdeck(key, tid, pid){
  const j = await td(`/v2/tournaments/${encodeURIComponent(tid)}/players/${encodeURIComponent(pid)}`, {key});
  const p = j && (j.data || j);
  const D = parseDeck(p);
  const lines = [];
  if (D.cmds.length) lines.push("Commander", ...D.cmds.map(n => "1 " + n), "", "Deck");
  lines.push(...D.main.map(([n, q]) => `${q} ${n}`));
  return {name: norm(p && p.name) ? `${norm(p.name)} · ${D.cmds.join(" / ")}` : D.cmds.join(" / "), raw: lines.join("\n"), url: D.url};
}
