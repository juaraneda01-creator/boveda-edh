// Meta de Pauper y Pioneer armado en el servidor: MTGTop8 (arquetipos, % y listas) y Pauper World (MTGO).
// Lo usa la tarea programada; así la versión en vivo no depende de que alguien actualice el archivo a mano.
const UA = "BovedaEDH/1.0 (+https://boveda-edh.netlify.app)";
const MT8 = "https://mtgtop8.com/";
export const FORMATS = {pauper:{f:"PAU", top:9}, pioneer:{f:"PI", top:8}};
const WINDOW_DAYS = 14;   // "últimas 2 semanas" de MTGTop8

const decode = s => String(s||"").replace(/&amp;/g,"&").replace(/&#0?39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n));
const text = h => decode(String(h||"").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim();
const num = s => parseFloat(String(s).replace(",", "."));

// dd/mm/yy → milisegundos (UTC, mediodía)
export function parseDate(s){
  const m = String(s||"").match(/(\d{2})\/(\d{2})\/(\d{2,4})/); if (!m) return null;
  const y = m[3].length===2 ? 2000 + +m[3] : +m[3];
  const t = Date.UTC(y, +m[2]-1, +m[1], 12); return isNaN(t) ? null : t;
}

/* ---------- página del formato: arquetipos, %, categoría y total ---------- */
export function parseFormat(html){
  const marked = String(html||"").replace(/<a\b[^>]*href=["']?([^"' >]*archetype\?a=(\d+)[^"' >]*)["']?[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, id, name) => ` \u0001${id}\u0003${decode(href)}\u0003${text(name)}\u0002 `);
  const t = text(marked);   // las marcas (caracteres de control) sobreviven a quitar etiquetas
  const out = []; const seen = new Set(); let cat = null;
  const re = /\b(AGGRO|CONTROL|COMBO)\b\s*\d+(?:[.,]\d+)?\s*%|\u0001(\d+)\u0003([^\u0003]*)\u0003([^\u0002]*)\u0002\s*(\d+(?:[.,]\d+)?)\s*%/g;
  let m;
  while ((m = re.exec(t))){
    if (m[1]){ cat = m[1].toLowerCase(); continue; }
    const id = m[2]; if (seen.has(id)) continue; seen.add(id);
    const name = m[4].trim(); if (!name || /^other\b/i.test(name)) continue;
    let href = m[3].replace(/^\.?\//, "");
    if (!/^archetype\?[\w=&.-]+$/.test(href)) href = `archetype?a=${id}`;   // nunca se guarda una dirección con comillas u otros caracteres
    out.push({id, name, share: num(m[5]), cat: cat || "aggro", arch: MT8 + href});
  }
  const tot = t.match(/(\d[\d.,]*)\s*decks/i);
  return {archetypes: out, total: tot ? parseInt(tot[1].replace(/[.,]/g, ""), 10) : null};
}

/* ---------- página del arquetipo: todas las listas con su fecha ---------- */
export function parseArchetype(html, now = Date.now()){
  const rows = [];
  for (const tr of String(html||"").split(/<tr\b/i).slice(1)){
    const row = tr.split(/<\/tr>/i)[0];
    const link = row.match(/href=["']?[^"' >]*event\?e=(\d+)&(?:amp;)?d=(\d+)(?:&(?:amp;)?f=(\w+))?[^"' >]*["']?[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const cells = row.split(/<td\b/i).slice(1).map(c => text("<td" + c));
    const date = parseDate(cells.find(c => /^\d{2}\/\d{2}\/\d{2,4}$/.test(c)) || text(row));
    if (!date) continue;
    const name = text(link[4]);
    const rank = cells.find(c => /^\d{1,3}(-\d{1,3})?$/.test(c)) || "";
    const ev = cells.filter(c => c && c !== name && c !== rank && !/^\d{2}\/\d{2}\/\d{2,4}$/.test(c));
    rows.push({e: link[1], d: link[2], f: link[3] || "", name, event: ev.length >= 2 ? ev[ev.length-1] : (ev[0] || ""), rank, date});
  }
  rows.sort((a, b) => b.date - a.date || (+b.d) - (+a.d));
  const recent = rows.filter(r => now - r.date <= WINDOW_DAYS * 864e5).length;
  return {rows, recent, newest: rows[0] || null};
}

/* ---------- lista en formato MTGO ---------- */
export function parseList(raw){
  const lines = String(raw||"").replace(/\r/g, "").split("\n").map(l => l.trim());
  const main = [], side = []; let inSide = false, seenCards = false;
  for (const l of lines){
    if (!l){ if (seenCards && main.length) inSide = true; continue; }
    if (/^sideboard\b/i.test(l)){ inSide = true; continue; }
    const m = l.match(/^(\d{1,2})x?\s+(.+)$/); if (!m) continue;
    seenCards = true;
    const name = m[2].replace(/\s+\/\/?\s+/, " // ").trim();
    (inSide ? side : main).push(`${m[1]} ${name}`);
  }
  const count = a => a.reduce((s, l) => s + parseInt(l, 10), 0);
  if (count(main) < 40) return null;
  return {main, side, text: [...main, ...(side.length ? ["Sideboard", ...side] : [])].join("\n"), n: count(main), ns: count(side)};
}

/* ---------- Pauper World ---------- */
export function parsePauperWorld(html){
  const rows = [];
  for (const tr of String(html||"").split(/<tr\b/i).slice(1)){
    const cells = tr.split(/<\/tr>/i)[0].split(/<t[dh]\b/i).slice(1).map(c => text("<td" + c));
    const pi = cells.findIndex(c => /^\d+(?:[.,]\d+)?\s*%$/.test(c)); if (pi < 1) continue;
    const name = cells.slice(0, pi).filter(c => c && !/^\d+$/.test(c)).pop(); if (!name) continue;
    const decks = parseInt((cells[pi+1] || "").replace(/[^\d]/g, ""), 10);
    rows.push({name, pct: num(cells[pi]), decks: isNaN(decks) ? null : decks});
  }
  const t = text(html);
  const period = (t.match(/([A-Z][a-z]+ \d{1,2}\s*[-–]\s*(?:[A-Z][a-z]+ )?\d{1,2},? \d{4})/) || [])[1] || "";
  const tot = t.match(/([\d,.]+)\s*decks?\s*(?:across|from|in)\s*(\d+)\s*events/i);
  return {rows: rows.sort((a, b) => b.pct - a.pct), period, total: tot ? parseInt(tot[1].replace(/[.,]/g, ""), 10) : null, events: tot ? +tot[2] : null};
}

/* ---------- armar todo ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function fetchText(url, ms = 12000){
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, {headers:{"user-agent":UA, accept:"text/html,text/plain,*/*"}, signal:ctl.signal}); if (!r.ok) throw new Error(url + " → " + r.status); return await r.text(); }
  finally { clearTimeout(t); }
}

// Un formato: arquetipos del top (más los empatados en el último puesto) con su lista más reciente.
export async function buildFormat(fmt, get = fetchText, {pause = 300, now = Date.now()} = {}){
  const F = FORMATS[fmt];
  const P = parseFormat(await get(`${MT8}format?f=${F.f}`));
  const arch = [...P.archetypes].sort((a, b) => b.share - a.share);
  if (arch.length < F.top) throw new Error(`${fmt}: solo ${arch.length} arquetipos`);
  const cut = arch[F.top - 1].share;
  const pick = arch.filter(a => a.share >= cut).slice(0, F.top + 5);   // los empatados se desempatan en la app
  const out = [];
  for (const a of pick){
    try {
      await sleep(pause);
      const A = parseArchetype(await get(a.arch), now);
      if (!A.newest) continue;
      await sleep(pause);
      const L = parseList(await get(`${MT8}mtgo?d=${A.newest.d}`));
      if (!L) continue;
      const d = new Date(A.newest.date);
      const dd = `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${String(d.getUTCFullYear()).slice(2)}`;
      out.push({name:a.name, share:a.share, cat:a.cat, arch:a.arch, recent:A.recent,
        deck:`${MT8}event?e=${A.newest.e}&d=${A.newest.d}&f=${F.f}`, date:A.newest.date,
        sample:`${A.newest.name}${A.newest.event?` · ${A.newest.event}`:""}${A.newest.rank?` (${A.newest.rank})`:""} · ${dd}`, list:L.text});
    } catch {}
  }
  if (out.length < Math.min(F.top, 5)) throw new Error(`${fmt}: solo ${out.length} listas`);
  return {at: now, total: P.total, archetypes: out};
}

export async function buildPauperWorld(get = fetchText){
  const W = parsePauperWorld(await get("https://pauperworld.com/meta"));
  if (W.rows.length < 8) throw new Error("Pauper World: " + W.rows.length + " filas");
  return {at: Date.now(), ...W, rows: W.rows.slice(0, 40)};
}

// Guarda lo que se pudo armar; lo que falla conserva la versión anterior.
export async function refreshMeta(store, get = fetchText, opts = {}){
  const prev = await store.get("meta", {type:"json"}).catch(() => null) || {};
  const next = {...prev, v:1, at: Date.now(), errors: []};
  for (const fmt of Object.keys(FORMATS)){
    try { next[fmt] = await buildFormat(fmt, get, opts); } catch(e){ next.errors.push(e.message); }
  }
  try { next.pw = await buildPauperWorld(get); } catch(e){ next.errors.push(e.message); }
  if (!next.pauper && !next.pioneer && !next.pw) throw new Error("ninguna fuente respondió: " + next.errors.join("; "));
  await store.setJSON("meta", next);
  return next;
}

// Firma de la reconstrucción: un secreto al azar que vive solo en el almacén del sitio (se crea la primera vez).
export async function metaSig(store){
  const read = async () => { const v = await store.get("secret", {type:"json"}).catch(() => null); return v && typeof v.s === "string" && v.s.length >= 32 ? v.s : null; };
  let s = await read(); if (s) return s;
  const { randomBytes } = await import("node:crypto");
  await store.setJSON("secret", {s: randomBytes(32).toString("hex")}, {onlyIfNew: true}).catch(() => {});
  return await read();
}
// Candado de la reconstrucción (atómico): solo una a la vez; si una queda colgada, se libera sola a los 20 minutos.
export async function takeBuildLock(store){
  const cur = await store.getWithMetadata("building", {type:"json"}).catch(() => null);
  if (cur && cur.data && Date.now() - (cur.data.at || 0) < LOCK_MS) return false;
  const r = await store.setJSON("building", {at: Date.now()}, cur && cur.etag ? {onlyIfMatch: cur.etag} : {onlyIfNew: true});
  return !r || r.modified !== false;
}
export async function refreshMetaLocked(store, get = fetchText, opts = {}){
  if (!(await takeBuildLock(store))) return "ocupado";
  try { const d = await refreshMeta(store, get, opts); return d.errors.length ? d.errors.join("; ") : "ok"; }
  catch(e){ return "error: " + e.message; }
  finally { await store.setJSON("building", {at: 0}).catch(() => {}); }
}
const LOCK_MS = 20 * 60e3;
export async function kickMeta(store, base){
  const cur = await store.get("lock", {type:"json"}).catch(() => null);
  if (cur && Date.now() - (cur.at || 0) < LOCK_MS) return false;
  await store.setJSON("lock", {at: Date.now()}).catch(() => {});
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
    await fetch(new URL("/.netlify/functions/meta-refresh-background", base), {method:"POST", headers:{"x-boveda-refresh": await metaSig(store) || ""}, signal: ctl.signal}).catch(() => {});
    clearTimeout(t);
  } catch {}
  return true;
}
