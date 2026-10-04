/* =========================================================
   Bóveda EDH — meta al día (versión en vivo)
   El servidor arma cada día el meta de Pauper y Pioneer
   (MTGTop8 + Pauper World). Si es más nuevo que la foto
   guardada en la app, lo reemplaza: arquetipos, %, listas
   más recientes y participación en MTGO.
   ========================================================= */
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function esDate(s){ const m = String(s||"").match(/(\d{1,2}) de (\w+) de (\d{4})/); if (!m) return 0; const i = MESES.indexOf(m[2].toLowerCase()); return i<0 ? 0 : Date.UTC(+m[3], i, +m[1], 12); }
const fmtEs = t => { const d = new Date(t); return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; };
// fecha que se muestra en la app: la del meta en vivo si se cargó, si no la foto guardada
var META_LIVE = {pauper:null, pioneer:null, pw:null};
function metaWhen(fmt){ const t = fmt && META_LIVE && META_LIVE[fmt]; return t ? `al día (${fmtEs(t)})` : `foto del ${META_AT}`; }

// días desde la lista de referencia (sale de la fecha dd/mm/aa al final de "sample", o de a.date)
function listAgeDays(a, now = Date.now()){
  let t = a && a.date;
  if (!t){ const m = String(a && a.sample || "").match(/(\d{2})\/(\d{2})\/(\d{2})\s*$/); if (m) t = Date.UTC(2000 + +m[3], +m[2]-1, +m[1], 12); }
  return t ? Math.max(0, Math.floor((now - t) / 864e5)) : null;
}
function listAgeHTML(a){
  const d = listAgeDays(a); if (d == null) return "";
  return d > 30 ? ` <span class="pill warn" title="MTGTop8 no tiene una lista más nueva de este arquetipo">lista de hace ${d} días</span>` : ` <span class="muted">· hace ${d} día${d===1?"":"s"}</span>`;
}

// plan de sideboard por defecto para un arquetipo nuevo, según su categoría en MTGTop8
const VS_DEFAULT = {aggro:{plan:"aggro", vs:["removal","wipe","life"]}, control:{plan:"control", vs:["counter","discard"]}, combo:{plan:"combo", vs:["grave","counter","discard"]}};
// nombre en Pauper World de cada arquetipo de la matriz (si difiere)
PAUPER_MU.pwAlias = Object.assign({"Spy Combo":"Balustrade Spy", "White Weenie":"Mono White Weenie", "Aura Aggro":"Bogles"}, PAUPER_MU.pwAlias||{});

// orden del top: % de MTGTop8; si empatan, más mazos en Pauper World (Pauper) o más listas en las últimas 2 semanas
function rankLive(fmt, arr, pw){
  const pwOf = n => { if (!pw) return -1; const k = PAUPER_MU.alias[n] || n; const pn = PAUPER_MU.pwAlias[k] || k; const r = pw.rows.find(x=>x.name===pn || x.name===n); return r ? (r.decks ?? r.pct) : -1; };
  return [...arr].sort((a,b)=> b.share - a.share || (fmt==="pauper" ? pwOf(b.name) - pwOf(a.name) : 0) || (b.recent||0) - (a.recent||0));
}

// lo que llega del servidor se limpia antes de usarlo: solo direcciones de MTGTop8, números como números y textos acotados
const MT8_OK = /^https:\/\/mtgtop8\.com\/[\w?=&.\/-]+$/;
function cleanLiveMeta(d){
  const str = (v, n) => typeof v === "string" ? v.slice(0, n) : "";
  const numOr = (v, alt) => { const x = typeof v === "number" ? v : parseFloat(v); return isFinite(x) ? x : alt; };
  const out = {};
  for (const fmt of ["pauper","pioneer"]){
    const L = d[fmt]; if (!L || typeof L !== "object" || !Array.isArray(L.archetypes)) continue;
    out[fmt] = {at: numOr(L.at, 0), total: numOr(L.total, 0), archetypes: L.archetypes.slice(0, 20).filter(a=>a && typeof a === "object" && str(a.name, 60).trim() && MT8_OK.test(a.arch || "") && isFinite(numOr(a.share, NaN)))
      .map(a=>({name:str(a.name, 60).trim(), share:numOr(a.share, 0), arch:a.arch, deck:MT8_OK.test(a.deck || "") ? a.deck : undefined, sample:str(a.sample, 160) || undefined, date:numOr(a.date, null), list:str(a.list, 6000) || undefined, cat:Object.hasOwn(VS_DEFAULT, a.cat) ? a.cat : "aggro", recent:numOr(a.recent, 0)}))};
  }
  const W = d.pw;
  if (W && typeof W === "object" && Array.isArray(W.rows)) out.pw = {at: numOr(W.at, 0), period: str(W.period, 60), total: numOr(W.total, 0),
    rows: W.rows.slice(0, 60).filter(r=>r && str(r.name, 60) && isFinite(numOr(r.pct, NaN))).map(r=>({name:str(r.name, 60), pct:numOr(r.pct, 0), decks:numOr(r.decks, null)}))};
  return out;
}
function applyLiveMeta(d){
  if (!d || typeof d !== "object") return false;
  d = cleanLiveMeta(d);
  const baked = esDate(META_AT); let changed = false;
  for (const fmt of ["pauper","pioneer"]){
    const L = d[fmt]; if (!L || !Array.isArray(L.archetypes) || (L.at||0) <= baked) continue;
    const N = fmt==="pauper" ? 9 : 8;
    const old = new Map((META[fmt].archetypes||[]).map(a=>[a.name, a]));
    const top = rankLive(fmt, L.archetypes, d.pw).filter(a=>a.list || old.has(a.name)).slice(0, N);
    if (top.length < Math.min(N, 5)) continue;
    META[fmt].archetypes = top.map(a=>({name:a.name, share:a.share, arch:a.arch, deck:a.deck||(old.get(a.name)||{}).deck, sample:a.sample||(old.get(a.name)||{}).sample, date:a.date||null, list:a.list||old.get(a.name).list, cat:a.cat}));
    for (const a of top) if (!META_VS[fmt][a.name]) META_VS[fmt][a.name] = {...(VS_DEFAULT[a.cat]||VS_DEFAULT.aggro), auto:true};
    META[fmt].src = `MTGTop8 · últimas 2 semanas${L.total?` · ${L.total} mazos`:""}`;
    META_LIVE[fmt] = L.at; delete _metaParsed[fmt]; changed = true;
  }
  const W = d.pw;
  if (W && Array.isArray(W.rows) && W.rows.length >= 8 && (W.at||0) > baked){
    const pw = {}; const used = new Set();
    for (const n of PAUPER_MU.arch){ const pn = PAUPER_MU.pwAlias[n] || n; const r = W.rows.find(x=>x.name===pn); if (r){ pw[n] = r.pct; used.add(r.name); } }
    const top = Object.entries(pw).sort((a,b)=>b[1]-a[1]).slice(0, 8);
    if (top.length >= 4){
      PAUPER_MU.pw = Object.fromEntries(top);
      const cut = top[top.length-1][1];
      PAUPER_MU.pwOther = Object.fromEntries(W.rows.filter(r=>!used.has(r.name) && r.pct >= cut).slice(0, 3).map(r=>[r.name, r.pct]));
      PAUPER_MU.pwAt = `${W.period || fmtEs(W.at)}${W.total?` · ${W.total.toLocaleString("es-CL")} mazos MTGO`:""}`;
      META_LIVE.pw = W.at; changed = true;
    }
  }
  if (changed){ if (typeof metaCardSet.reset === "function") metaCardSet.reset(); bumpAnalysis(); }
  return changed;
}

async function loadLiveMeta(){
  if (typeof LIVE === "undefined" || !LIVE) return;
  try {
    const r = await fetch("/api/meta"); if (!r.ok) throw new Error("meta " + r.status);
    const d = await r.json(); try { idb.set("liveMeta", d); } catch {}
    if (applyLiveMeta(d)) render();
  } catch {
    try { const d = await idb.get("liveMeta"); if (d && applyLiveMeta(d)) render(); } catch {}
  }
}
if (typeof LIVE !== "undefined" && LIVE) S.boot.then(()=>setTimeout(loadLiveMeta, 300));
