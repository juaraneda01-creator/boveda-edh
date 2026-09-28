/* =========================================================
   Bóveda EDH — Pauper: matchups (Paupergeddon + Pauper World)
   y adiciones para los duelos difíciles.
   Importar mazos por enlace (Moxfield, Archidekt, ManaBox,
   MTGGoldfish, MTGTop8, TappedOut, Deckstats, MTGDecks, Melee).
   ========================================================= */

PAUPER_MU.alias["Mono Blue Aggro"] = "Mono Blue Terror";
const PG_COLORS = {"Grixis Affinity":"UBR","Mono Red Madness":"R","Mono Blue Terror":"U","Spy Combo":"BG","Jund Wildfire":"BRG","Naya Gates":"WRG","Elves":"G","Monster Tron":"G","Dimir Faeries":"UB","Jeskai Ephemerate":"WUR","Mono Red Rally":"R","White Weenie":"W","Dimir Terror":"UB"};
const PG_SHORT = {"Grixis Affinity":"Afin","Mono Red Madness":"MRM","Mono Blue Terror":"MBT","Spy Combo":"Spy","Jund Wildfire":"JWf","Naya Gates":"Gates","Elves":"Elves","Monster Tron":"Tron","Dimir Faeries":"Faer","Jeskai Ephemerate":"Ephe","Mono Red Rally":"Rally","White Weenie":"WW","Dimir Terror":"DTer"};
const MIN_GAMES = 8;

const _pg = {};
function pgDeck(name){
  if (_pg[name]) return _pg[name];
  const L = PG_LISTS[name]; if (!L) return null;
  const p = parseList(L.list, {keepSide:true});
  return (_pg[name] = {name, ...L, main:p.filter(x=>!x.side), side:p.filter(x=>x.side)});
}
function muGet(a, b){
  if (a===b) return null;
  let r = PAUPER_MU.m[a+"|"+b]; if (r) return {w:r[0], l:r[1]};
  r = PAUPER_MU.m[b+"|"+a]; if (r) return {w:r[1], l:r[0]};
  return null;
}
const muP = x => x && (x.w+x.l) ? x.w/(x.w+x.l) : null;
function mt8Share(n){ const a=(META.pauper.archetypes||[]).find(a=>(PAUPER_MU.alias[a.name]||a.name)===n); return a?a.share:null; }
// peso de cada rival en el meta: Pauper World (MTGO) > MTGTop8 > Paupergeddon día 2 > mínimo
function muWeight(n){ return PAUPER_MU.pw[n] ?? mt8Share(n) ?? PAUPER_MU.day2[n] ?? 1.5; }
function muRow(a){
  return PAUPER_MU.arch.filter(b=>b!==a).map(b=>{ const x=muGet(a,b); return {b, w:x?x.w:0, l:x?x.l:0, n:x?x.w+x.l:0, p:muP(x), wt:muWeight(b)}; });
}
function muSummary(a){
  const row = muRow(a); let W=0, L=0, sw=0, swp=0;
  for (const r of row){ W+=r.w; L+=r.l; if (r.p!=null && r.n>=MIN_GAMES){ sw+=r.wt; swp+=r.wt*r.p; } }
  const ok = row.filter(r=>r.p!=null && r.n>=MIN_GAMES).sort((x,y)=>x.p-y.p);
  return {a, W, L, p:W+L?W/(W+L):null, wp:sw?swp/sw:null, worst:ok[0], best:ok[ok.length-1], pw:PAUPER_MU.pw[a]??null, d2:PAUPER_MU.day2[a]??null, mt:mt8Share(a)};
}
const mpct = p => p==null ? "—" : Math.round(p*100)+"%";
const muTone = p => p==null ? "" : p>=0.6 ? "g2" : p>=0.53 ? "g1" : p>0.47 ? "n" : p>0.4 ? "b1" : "b2";

/* ---------- a qué arquetipo se parece un mazo ---------- */
function pauperArchGuess(A){
  const mine = new Map(); for (const r of A.rows) mine.set(slug(r.n), (mine.get(slug(r.n))||0)+r.q);
  const score = main => { let hit=0, tot=0; for (const c of main){ if (BASICS.has(slug(c.n))) continue; tot+=c.q; hit+=Math.min(c.q, mine.get(slug(c.n))||0); } return tot?hit/tot:0; };
  const res = PAUPER_MU.arch.map(n=>({n, s:PG_LISTS[n]?score(pgDeck(n).main):0}));
  for (const {a, score:s} of metaMatch(A)){ const n=PAUPER_MU.alias[a.name]; const r=n&&res.find(x=>x.n===n); if (r && s>r.s) r.s=s; }
  return res.sort((x,y)=>y.s-x.s);
}
function pauperArchOf(d, A){
  if (d.pauperArch && PAUPER_MU.arch.includes(d.pauperArch)) return {n:d.pauperArch, s:null, manual:true};
  const g = pauperArchGuess(A)[0];
  return g && g.s>=0.2 ? g : null;
}

/* ---------- adiciones para un duelo difícil ---------- */
const colorsOk = (col, C) => !col || col==="C" || col.split("").every(c=>!WUBRG.includes(c) || C.includes(c));
function sbColorOf(n){ for (const l of Object.values(PAUPER_SB)) for (const [x,c] of l) if (slug(x)===slug(n)) return c; return null; }
function pauperAdds(C, opp, exclude, arch){
  const info = META_VS.pauper[opp] || {vs:[]};
  const cands = new Map();
  const add = (n, sc, why) => { const k=slug(n); if (exclude.has(k)) return; const o=cands.get(k)||{n, s:0, why:new Set()}; o.s+=sc; o.why.add(why); cands.set(k,o); };
  // 1) banquillos de los arquetipos que le ganan a ese rival
  const winners = PAUPER_MU.arch.filter(x=>x!==opp && x!==arch).map(x=>({x, r:muGet(x,opp)})).filter(o=>o.r && o.r.w+o.r.l>=MIN_GAMES && muP(o.r)>=0.55 && PG_LISTS[o.x]);
  for (const {x, r} of winners){
    const p = muP(r);
    for (const c of pgDeck(x).side){
      const m = cardOf(c.n);
      const col = m ? (m.t==="Land" ? "" : (m.col||m.ci||"C")) : (sbColorOf(c.n) ?? PG_COLORS[x]);
      if (!colorsOk(col, C)) continue;
      const hit = m && m.sb ? m.sb.filter(k=>info.vs.includes(k)) : [];
      add(c.n, (p-0.5)*10*Math.min(c.q,3)/2 + hit.length*1.5, `${c.q} en el banquillo de ${x} (gana ${mpct(p)})`);
      for (const k of hit) add(c.n, 0, SB_ES[k]);
    }
  }
  // 2) catálogo por función según lo que pide el rival
  info.vs.forEach((cat, i) => { for (const [n, col] of (PAUPER_SB[cat]||[])) if (colorsOk(col, C)) add(n, Math.max(0.8, 3-i*0.6), SB_ES[cat]); });
  return [...cands.values()].sort((a,b)=>b.s-a.s).slice(0, 7).map(o=>({n:o.n, why:[...o.why]}));
}

/* ---------- vista: matriz y cuadro comparativo del meta ---------- */
function pauperMatrixHTML(){
  const arch = PAUPER_MU.arch;
  const sums = arch.map(muSummary).sort((x,y)=>(y.wp??0)-(x.wp??0));
  const sel = S.pmArch && arch.includes(S.pmArch) ? S.pmArch : sums[0].a;
  const cell = (a,b) => { if (a===b) return `<td class="mx-self">·</td>`; const x=muGet(a,b); const p=muP(x);
    return `<td class="mx ${muTone(p)}${x&&x.w+x.l<MIN_GAMES?" few":""}" title="${esc(a)} vs ${esc(b)}: ${x?x.w+"-"+x.l:"sin datos"}"><b>${mpct(p)}</b><small>${x?x.w+"-"+x.l:""}</small></td>`; };
  const shareCell = v => v==null ? `<td class="n muted">—</td>` : `<td class="n">${String(v).replace(".",",")}%</td>`;
  return `<div class="sec pm"><h3>Matchups de Pauper · Paupergeddon Summer 2026</h3>
    <p class="lede">Porcentaje de victorias de la fila contra la columna, con partidas ganadas-perdidas (${esc(PAUPER_MU.src)}). En gris claro, cruces con menos de ${MIN_GAMES} partidas: tómalos con cautela.</p>
    <div class="tbl-wrap mx-wrap"><table class="mx-t"><thead><tr><th class="mx-h0">Fila vs columna</th>${arch.map(b=>`<th class="mx-h" title="${esc(b)}">${esc(PG_SHORT[b]||b)}</th>`).join("")}</tr></thead><tbody>
      ${arch.map(a=>`<tr><th class="mx-r"><button class="linkish" data-pm="arch" data-v="${esc(a)}">${esc(a)}</button></th>${arch.map(b=>cell(a,b)).join("")}</tr>`).join("")}
    </tbody></table></div>
    <div class="mx-legend"><span class="mx g2">60%+</span><span class="mx g1">53–59%</span><span class="mx n">parejo</span><span class="mx b1">41–47%</span><span class="mx b2">40% o menos</span></div>
  </div>
  <div class="sec pm"><h3>Cuadro comparativo de arquetipos</h3>
    <p class="lede">Participación en tres fuentes y rendimiento en Paupergeddon. “Contra el meta” pondera cada cruce por lo que se juega hoy en MTGO (Pauper World, ${esc(PAUPER_MU.pwAt)}), y si falta, por MTGTop8 o el día 2 de Paupergeddon.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Arquetipo</th><th class="n">Pauper World</th><th class="n">MTGTop8</th><th class="n">PG día 2</th><th class="n">Récord PG</th><th class="n">% total</th><th class="n">Contra el meta</th><th>Peor duelo</th><th>Mejor duelo</th></tr></thead><tbody>
      ${sums.map(s=>`<tr${s.a===sel?` class="pm-sel"`:""}><td><button class="linkish" data-pm="arch" data-v="${esc(s.a)}"><b>${esc(s.a)}</b></button>${PAUPER_MU.top8.some(t=>t.startsWith(s.a))?` <span class="tag">top 8</span>`:""}</td>${shareCell(s.pw)}${shareCell(s.mt)}${shareCell(s.d2)}<td class="n num">${s.W}-${s.L}</td><td class="n"><span class="mx-pill ${muTone(s.p)}">${mpct(s.p)}</span></td><td class="n"><span class="mx-pill ${muTone(s.wp)}">${mpct(s.wp)}</span></td>
        <td>${s.worst?`${esc(s.worst.b)} <span class="down num">${mpct(s.worst.p)}</span>`:"—"}</td><td>${s.best?`${esc(s.best.b)} <span class="up num">${mpct(s.best.p)}</span>`:"—"}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="foot">Otros mazos con presencia en MTGO sin datos de matchup en Paupergeddon: ${Object.entries(PAUPER_MU.pwOther).map(([n,v])=>`${esc(n)} (${String(v).replace(".",",")}%)`).join(", ")}. Top 8 del Main Event: ${PAUPER_MU.top8.map(esc).join(" · ")}.</p>
  </div>
  ${archDetailHTML(sel)}
  <div class="sec"><h3>Fuentes para actualizar</h3><div class="row">
    <a class="btn sm" href="${PAUPER_MU.url}" target="_blank" rel="noopener">Matriz Paupergeddon</a>
    <a class="btn sm" href="https://www.paupergeddon.com/Stats/Paupergeddon_0726/Paupergeddon_0726.html" target="_blank" rel="noopener">Estadísticas Paupergeddon</a>
    <a class="btn sm" href="https://melee.gg/Tournament/View/438329" target="_blank" rel="noopener">Main Event en Melee</a>
    <a class="btn sm" href="${PAUPER_MU.pwUrl}" target="_blank" rel="noopener">Pauper World</a></div>
    <p class="foot">Foto del ${esc(PAUPER_MU.at)}. Estas páginas no permiten leerse desde otra web, así que la tarea mensual programada trae los datos nuevos y actualiza el archivo.</p></div>`;
}
function archDetailHTML(a){
  const row = muRow(a).sort((x,y)=>(x.p??.5)-(y.p??.5));
  const L = pgDeck(a); const C = PG_COLORS[a]||"";
  const hard = row.filter(r=>r.p!=null && r.p<0.47 && r.n>=MIN_GAMES).sort((x,y)=>y.wt*(0.5-y.p)-x.wt*(0.5-x.p)).slice(0,3);
  const excl = new Set(L ? [...L.main, ...L.side].map(c=>slug(c.n)) : []);
  return `<div class="sec pm pm-detail"><h3>${esc(a)}: duelo por duelo</h3>
    <div class="pm-grid"><div>
      ${row.map(r=>`<div class="mu-bar"><span class="mu-n">${esc(r.b)}</span><span class="mu-track"><span class="mu-fill ${muTone(r.p)}" style="width:${r.p==null?0:Math.round(r.p*100)}%"></span><i></i></span><span class="mu-v num">${mpct(r.p)} <small class="muted">${r.n?r.w+"-"+r.l:""}</small></span></div>`).join("")}
    </div><div>
      ${L?`<p class="muted" style="margin:0 0 6px">Lista de referencia: ${esc(L.pilot)}, puesto ${L.place} del Main Event.</p><div class="row"><button class="btn sm" data-pm="create" data-v="${esc(a)}">Crear mazo con esta lista</button><button class="btn sm ghost" data-pm="copy" data-v="${esc(a)}">Copiar lista</button><a class="btn sm ghost" href="${PAUPER_MU.pwSlug(a)}" target="_blank" rel="noopener">Pauper World</a></div>`:`<p class="muted">Sin lista de referencia en el Top 64 de Paupergeddon.</p>`}
      ${hard.length?`<h4 style="margin:14px 0 4px">Para sus duelos más difíciles</h4>${hard.map(h=>`<div class="pm-hard"><b>vs ${esc(h.b)}</b> <span class="down num">${mpct(h.p)}</span><div class="pm-adds">${pauperAdds(C, h.b, excl, a).map(x=>`<div class="rec"><span>${cardName(x.n)} <span class="muted" style="font-size:.82rem">${esc(x.why[0])}</span></span><span class="meta">${ownedOf(x.n)>0?`<span class="own y">tengo</span>`:money(refPrice(cardOf(x.n)))}</span></div>`).join("")}</div></div>`).join("")}
        <div class="row" style="margin-top:8px"><button class="btn sm" data-pm="fetch" data-v="${esc(a)}">Traer precios de estas cartas</button></div>`:`<p class="muted" style="margin-top:12px">No tiene cruces claramente desfavorables con datos suficientes.</p>`}
    </div></div></div>`;
}

/* ---------- vista: en el mazo ---------- */
function pauperDeckMuHTML(d, A){
  const g = pauperArchOf(d, A);
  const guesses = pauperArchGuess(A).slice(0,3);
  const pick = `<label class="row" style="gap:8px;font-size:.92rem">Tu mazo juega como <select id="pm-deck-arch"><option value="">${g&&!g.manual?`Detectado: ${esc(g.n)}`:"Detectar solo"}</option>${PAUPER_MU.arch.map(n=>`<option value="${esc(n)}"${d.pauperArch===n?" selected":""}>${esc(n)}</option>`).join("")}</select></label>`;
  if (!g) return `<div class="sec pm"><h3>Matchups (Paupergeddon)</h3><p class="lede">Tu lista no se parece lo suficiente a ningún arquetipo de Paupergeddon. Elige el más cercano para ver sus duelos y qué agregar.</p>${pick}</div>`;
  const a = g.n; const row = muRow(a); const s = muSummary(a);
  const hard = row.filter(r=>r.p!=null && r.n>=MIN_GAMES && r.p<0.5).sort((x,y)=>y.wt*(0.5-y.p)-x.wt*(0.5-x.p));
  const C = A.ci || PG_COLORS[a] || "";
  const excl = new Set([...A.rows, ...A.side].map(r=>slug(r.n)));
  const sideN = A.side.reduce((t,r)=>t+r.q,0);
  const sorted = [...row].sort((x,y)=>(x.p??.5)-(y.p??.5));
  return `<div class="sec pm"><h3>Matchups de ${esc(a)} · Paupergeddon Summer 2026</h3>
    <p class="lede">${g.manual?"Arquetipo elegido por ti.":`Detectado por coincidencia con las listas de referencia (${Math.round(g.s*100)}%${guesses[1]&&guesses[1].s>0.2?`; también se parece a ${esc(guesses[1].n)} ${Math.round(guesses[1].s*100)}%`:""}).`} Récord del arquetipo: ${s.W}-${s.L} (${mpct(s.p)}); contra el meta actual de MTGO: <b>${mpct(s.wp)}</b>.</p>
    ${pick}
    <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>Rival</th><th class="n">Se juega</th><th class="n">Récord</th><th class="n">Victorias</th><th>Lectura</th></tr></thead><tbody>
      ${sorted.map(r=>`<tr><td>${esc(r.b)}</td><td class="n">${String(r.wt).replace(".",",")}%</td><td class="n num">${r.n?r.w+"-"+r.l:"—"}</td><td class="n"><span class="mx-pill ${muTone(r.p)}">${mpct(r.p)}</span></td><td>${r.p==null?"sin datos":r.n<MIN_GAMES?`<span class="muted">muestra chica</span>`:r.p<0.45?`<span class="pill bad">difícil</span>`:r.p<0.5?`<span class="pill warn">cuesta arriba</span>`:r.p<=0.55?`<span class="pill neutral">parejo</span>`:`<span class="pill good">favorable</span>`}</td></tr>`).join("")}
    </tbody></table></div></div>
  ${hard.length?`<div class="sec pm"><h3>Adiciones para los duelos más complicados</h3>
    <p class="lede">Ordenados por cuánto pesan en el meta. Las cartas salen de los banquillos de los mazos que sí le ganan a ese rival en Paupergeddon y de las piezas de banquillo habituales para lo que pide el duelo, filtradas por tus colores (${C?C.split("").map(c=>`<i class="pip p-${c}"></i>`).join(""):"incoloro"}).${sideN>=15?` Tu banquillo ya tiene ${sideN} cartas: por cada una que agregues, saca otra.`:""}</p>
    ${hard.slice(0,4).map(h=>{ const g2=sideGuide(A,{name:h.b}); const adds=pauperAdds(C, h.b, excl, a);
      return `<div class="pm-hard card-box"><div class="row" style="justify-content:space-between"><b>vs ${esc(h.b)} <span class="down num">${mpct(h.p)}</span> <span class="muted" style="font-weight:400">${h.w}-${h.l} · ${String(h.wt).replace(".",",")}% del meta</span></b><a class="btn sm ghost" href="${PAUPER_MU.pwSlug(h.b)}" target="_blank" rel="noopener">Ver ${esc(h.b)}</a></div>
      ${g2&&g2.ins.length?`<div class="muted" style="font-size:.88rem;margin:4px 0">Con tu banquillo actual: ${g2.ins.map(x=>`+${x.q} ${esc(x.n)}`).join(", ")}${g2.outs.length?` · salen ${g2.outs.map(x=>`−${x.q} ${esc(x.n)}`).join(", ")}`:""}.</div>`:""}
      ${adds.map(x=>`<div class="rec"><span>${cardName(x.n)} ${ownedOf(x.n)>0?`<span class="pill good">tienes</span>`:""}<br><span class="muted" style="font-size:.84rem">${esc(x.why.join(" · "))}</span></span><span class="meta row" style="gap:6px">${money(refPrice(cardOf(x.n)))}<button class="btn sm" data-pm="side-add" data-v="${esc(x.n)}">+ banquillo</button><button class="btn sm ghost" data-pm="maybe-add" data-v="${esc(x.n)}" title="Agregar al maybeboard">probable</button></span></div>`).join("") || `<p class="muted">Sin sugerencias en tus colores.</p>`}</div>`; }).join("")}
    <div class="row" style="margin-top:8px"><button class="btn sm" data-pm="fetch-deck">Traer precios y datos de estas cartas</button></div></div>`:""}`;
}

/* =========================================================
   Importar por enlace
   ========================================================= */
const LINK_SRC = [
  {k:"moxfield", n:"Moxfield", re:/moxfield\.com\/decks\/([\w-]+)/i},
  {k:"archidekt", n:"Archidekt", re:/archidekt\.com\/(?:api\/)?decks\/(\d+)/i},
  {k:"manabox", n:"ManaBox", re:/manabox\.app\/decks\/([\w-]+)/i},
  {k:"goldfish", n:"MTGGoldfish", re:/mtggoldfish\.com\/deck\/(?:download\/|visual\/|arena_download\/)?(\d+)/i},
  {k:"mtgtop8", n:"MTGTop8", re:/mtgtop8\.com\/.*[?&]d=(\d+)/i},
  {k:"tappedout", n:"TappedOut", re:/tappedout\.net\/mtg-decks\/([\w-]+)/i},
  {k:"deckstats", n:"Deckstats", re:/deckstats\.net\/decks\/(\d+\/[\w-]+)/i},
  {k:"mtgdecks", n:"MTGDecks", re:/mtgdecks\.net\/[^\s]+/i},
  {k:"melee", n:"Melee", re:/melee\.gg\/Decklist\/View\/([\w-]+)/i},
  {k:"goldfisharch", n:"MTGGoldfish", re:/mtggoldfish\.com\/archetype\/[\w-]+/i},
];
const PROXIES = [u=>"https://corsproxy.io/?url="+encodeURIComponent(u), u=>"https://api.allorigins.win/raw?url="+encodeURIComponent(u)];
async function getVia(url, {json=false}={}){
  const tries = [url, ...(S.data.settings.linkProxy===false ? [] : PROXIES.map(p=>p(url)))];
  let last;
  for (const u of tries){
    try { const r = await fetch(u, {headers:{Accept: json?"application/json":"text/plain,text/html,*/*"}}); if (!r.ok){ last=new Error("HTTP "+r.status); continue; }
      const t = await r.text(); if (!t || t.length<10){ last=new Error("vacío"); continue; }
      if (json){ try { return JSON.parse(t); } catch(e){ last=e; continue; } }
      return t;
    } catch(e){ last=e; }
  }
  throw last||new Error("sin respuesta");
}
const fmtGuess = f => { f=String(f||"").toLowerCase(); return /commander|edh|brawl|duel|oathbreaker/.test(f)?"commander":/pauper/.test(f)?"pauper":/pioneer/.test(f)?"pioneer":null; };
// texto de lista suelto → secciones; una línea en blanco separa el banquillo en exportaciones MTGO/Arena
function textToDeck(t, fmt){
  let text = String(t).replace(/\r/g,"").replace(/^\s*(deck|main ?deck|mainboard)\s*$/gim,"").trim();
  if (!/^(sideboard|banquillo|maybeboard|commander|companion)\b/im.test(text)){
    const blocks = text.split(/\n\s*\n/).filter(b=>b.trim());
    if (blocks.length===2 && fmt!=="commander") text = blocks[0]+"\nSideboard\n"+blocks[1];
    else if (blocks.length===2 && fmt==="commander" && blocks[1].trim().split("\n").length<=2) text = "Commander\n"+blocks[1]+"\nDeck\n"+blocks[0];
  }
  return text;
}
function pack(name, fmt, cmds, main, side, maybe){
  const L = a => a.filter(c=>c && c.n && c.q>0).map(c=>`${c.q} ${c.n}`).join("\n");
  return {name, fmt, commanders:cmds, text:L(main), side:L(side), maybe:L(maybe)};
}
async function namesFromIds(ids){
  const out = {}; const uniq=[...new Set(ids.filter(Boolean))];
  for (let i=0;i<uniq.length;i+=75){ const r = await sf("https://api.scryfall.com/cards/collection", {identifiers:uniq.slice(i,i+75).map(id=>({id}))}); if (!r.ok) continue; const j=await r.json(); for (const c of j.data||[]) out[c.id]=c.name; }
  return out;
}
const IMPORTERS = {
  async moxfield(id){
    let j; try { j = await getVia(`https://api2.moxfield.com/v3/decks/all/${id}`, {json:true}); } catch(e){ j = await getVia(`https://api2.moxfield.com/v2/decks/all/${id}`, {json:true}); }
    const board = b => { if (!b) return []; const cards = b.cards || b; return Object.values(cards).map(x=>({n:(x.card&&x.card.name)||x.name, q:x.quantity||1})); };
    const B = j.boards || j;
    const cmds = board(B.commanders).map(c=>c.n);
    return pack(j.name, fmtGuess(j.format), cmds, board(B.mainboard), board(B.sideboard), board(B.maybeboard));
  },
  async archidekt(id){
    const j = await getVia(`https://archidekt.com/api/decks/${id}/`, {json:true});
    const main=[], side=[], maybe=[], cmds=[];
    const cats = new Map((j.categories||[]).map(c=>[c.name, c.includedInDeck!==false]));
    for (const c of j.cards||[]){ const n=(c.card&&c.card.oracleCard&&c.card.oracleCard.name)||(c.card&&c.card.name); const q=c.quantity||1; const cs=(c.categories||[]).map(String);
      if (cs.some(x=>/commander/i.test(x))) cmds.push(n);
      else if (cs.some(x=>/side/i.test(x))) side.push({n,q});
      else if (cs.some(x=>/maybe/i.test(x)) || cs.some(x=>cats.get(x)===false)) maybe.push({n,q});
      else main.push({n,q}); }
    const F = {1:"standard",2:"modern",3:"commander",4:"legacy",5:"vintage",6:"pauper",15:"pioneer"}[j.deckFormat||j.format];
    return pack(j.name, fmtGuess(F||(cmds.length?"commander":"")), cmds, main, side, maybe);
  },
  async manabox(id){ return manaboxFromHTML(await getVia(`https://manabox.app/decks/${id}`)); },
  async goldfish(id){ const t = await getVia(`https://www.mtggoldfish.com/deck/download/${id}`); return {raw:t, name:"Mazo de MTGGoldfish"}; },
  async mtgtop8(id){ const t = await getVia(`https://mtgtop8.com/mtgo?d=${id}`); return {raw:t, name:"Mazo de MTGTop8"}; },
  async tappedout(id){ const t = await getVia(`https://tappedout.net/mtg-decks/${id}/?fmt=txt`); return {raw:t, name:id.replace(/-/g," ")}; },
  async deckstats(id){ const t = await getVia(`https://deckstats.net/decks/${id}/?include_comments=0&export_txt=1`); return {raw:t, name:id.split("/")[1].replace(/-/g," ")}; },
};
/* ---------- ManaBox: la página pública del mazo ---------- */
// Astro serializa las props de sus componentes como [tipo, valor]; 1 = arreglo
const unAstro = v => Array.isArray(v) ? (v.length===2 && typeof v[0]==="number" ? (v[0]===1 && Array.isArray(v[1]) ? v[1].map(unAstro) : unAstro(v[1])) : v.map(unAstro))
  : v && typeof v==="object" ? Object.fromEntries(Object.entries(v).map(([k,x])=>[k, unAstro(x)])) : v;
function mbRowsFromData(j){
  const rows = [];
  const walk = (o, board, depth=0) => { if (!o || depth>12) return;
    if (Array.isArray(o)){ for (const x of o) walk(x, board, depth+1); return; }
    if (typeof o!=="object") return;
    const q = o.quantity ?? o.qty ?? o.count ?? o.amount; const idv = o.scryfallId || o.scryfall_id || o.scryfallID || (o.card&&(o.card.scryfallId||o.card.scryfall_id||o.card.id)); const nm = (typeof o.name==="string" && o.name) || (o.card&&o.card.name);
    if (q!=null && !isNaN(q) && (idv || nm)){ const bd = String(o.boardCategory ?? o.board ?? o.boardType ?? o.category ?? o.section ?? board ?? ""); rows.push({q:+q||1, id:idv, n:nm, b:bd}); return; }
    for (const [k,v] of Object.entries(o)) if (v && typeof v==="object") walk(v, /side|maybe|command|main|consider|companion/i.test(k)?k:board, depth+1);
  };
  walk(j, "");
  return rows;
}
async function manaboxFromHTML(html){
  html = String(html);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta = n => (doc.querySelector(`meta[property="${n}"],meta[name="${n}"]`)||{}).content||"";
  const name = meta("og:title") || (doc.querySelector("title")||{}).textContent || "Mazo de ManaBox";
  // 1) datos estructurados dentro de la página (props de Astro o JSON embebido)
  let rows = [];
  const blobs = [...doc.querySelectorAll("astro-island[props]")].map(e=>e.getAttribute("props"))
    .concat([...doc.querySelectorAll('script[type="application/json"],script#__NEXT_DATA__')].map(e=>e.textContent));
  for (const b of blobs){ try { const r = mbRowsFromData(unAstro(JSON.parse(b))); if (r.length > rows.length) rows = r; } catch {} }
  if (rows.length){
    const need = rows.filter(r=>!r.n && r.id).map(r=>r.id); const map = need.length ? await namesFromIds(need) : {};
    for (const r of rows) if (!r.n) r.n = map[r.id];
    const kind = b => /command|^1$/i.test(b)?"c":/side|^2$/i.test(b)?"s":/maybe|consider|^3$/i.test(b)?"m":"d";
    const by = k => mergeRows(rows.filter(r=>r.n && kind(r.b)===k));
    if (by("d").length || by("c").length) return pack(name, null, by("c").map(c=>c.n), by("d"), by("s"), by("m"));
  }
  // 2) el texto de la página: la cantidad y el nombre vienen en líneas separadas
  const parsed = manaboxFromText(doc);
  if (!parsed.main.length && !parsed.cmds.length) throw new Error("No encontré cartas en la página del mazo de ManaBox.");
  return pack(name.trim(), null, parsed.cmds, parsed.main, parsed.side, parsed.maybe);
}
function mergeRows(arr){ const m=new Map(); for (const r of arr){ const k=slug(r.n); const o=m.get(k); if (o) o.q+=r.q; else m.set(k,{n:r.n,q:r.q}); } return [...m.values()]; }
function manaboxFromText(doc){
  const clone = doc.body ? doc.body.cloneNode(true) : null; if (!clone) return {cmds:[],main:[],side:[],maybe:[]};
  for (const s of clone.querySelectorAll("script,style,noscript,svg,header,footer,nav")) s.remove();
  const html = clone.innerHTML.replace(/<(br|\/div|\/p|\/li|\/tr|\/td|\/h\d|\/span|\/a|\/button|img)\b[^>]*>/gi, m=>m+"\n");
  const d2 = new DOMParser().parseFromString(html, "text/html");
  const lines = d2.body.textContent.split(/\n+/).map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean);
  const SEC = {commander:"c", commanders:"c", comandante:"c", companion:"c", sideboard:"s", banquillo:"s", maybeboard:"m", considering:"m", "cartas probables":"m", mainboard:"d", deck:"d"};
  const pairs = []; let sec = "d";
  for (let i=0; i<lines.length; i++){
    const l = lines[i], low = l.toLowerCase();
    if (SEC[low]){ sec = SEC[low]; continue; }
    if (/^(creatures?|artifacts?|instants?|sorcer(y|ies)|enchantments?|lands?|planeswalkers?|battles?|others?|criaturas|artefactos|instant[aá]neos|conjuros|encantamientos|tierras)$/i.test(l)){ if (sec==="c") sec="d"; continue; }
    const one = l.match(/^(\d{1,3})x?\s+([A-Za-z0-9"'].{1,80})$/);
    if (one && !/^\d+ cards?/i.test(l)){ pairs.push({sec, q:+one[1], n:one[2].replace(/\s*\([A-Z0-9]{2,6}\)\s*[\w-]*$/,"").trim()}); continue; }
    if (/^\d{1,3}$/.test(l) && i+1<lines.length){ const nx = lines[i+1]; if (/^[A-Za-z0-9"'][^]{1,80}$/.test(nx) && !/^\d+$/.test(nx) && !SEC[nx.toLowerCase()] && !/^(creatures?|artifacts?|instants?|sorcer(y|ies)|enchantments?|lands?|planeswalkers?|battles?|others?)$/i.test(nx)){ pairs.push({sec, q:+l, n:nx}); i++; } }
  }
  // la página repite cada carta (vista de lista y de cuadrícula): se quitan las repeticiones
  let ps = pairs.filter((p,i)=>!(i>0 && pairs[i-1].n===p.n && pairs[i-1].q===p.q && pairs[i-1].sec===p.sec));
  const h = ps.length/2; if (Number.isInteger(h) && h>0 && ps.slice(0,h).every((p,i)=>p.n===ps[h+i].n && p.q===ps[h+i].q)) ps = ps.slice(0,h);
  const by = k => mergeRows(ps.filter(p=>p.sec===k));
  return {cmds: by("c").map(c=>c.n), main: by("d"), side: by("s"), maybe: by("m")};
}

// páginas HTML sin exportación conocida: se busca la lista en el texto de la página
function listFromHTML(html){
  const doc = new DOMParser().parseFromString(String(html).replace(/<(br|\/div|\/p|\/li|\/tr|\/td|\/h\d|\/span|\/a)\b[^>]*>/gi, m=>m+"\n"), "text/html");
  const title = (doc.querySelector("h1")||doc.querySelector("title")||{}).textContent||"";
  for (const ta of doc.querySelectorAll("textarea, pre")){ const v=ta.textContent.trim(); if ((v.match(/^\s*\d+x?\s+\S/gm)||[]).length>=8) return {raw:v, name:title.trim()}; }
  for (const s of doc.querySelectorAll("script,style,noscript")) s.remove();
  const lines = (doc.body?doc.body.textContent:"").split(/\n+/).map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean);
  const out = []; let sec="";
  for (const l of lines){
    if (/^(sideboard|banquillo)\b/i.test(l)){ sec="Sideboard"; out.push(sec); continue; }
    if (/^(maybeboard|considering)\b/i.test(l)){ sec="Maybeboard"; out.push(sec); continue; }
    if (/^(commander|comandante)s?\b/i.test(l) && !/\d/.test(l)){ out.push("Commander"); continue; }
    const m = l.match(/^(\d{1,2})x?\s+([A-Z][^$€\d]{1,60}?)(?:\s+[$€]?\d+[.,]\d+.*)?$/);
    if (m) out.push(`${m[1]} ${m[2].trim()}`);
  }
  if (out.filter(l=>/^\d/.test(l)).length<8) throw new Error("No encontré una lista de cartas en esa página.");
  return {raw:out.join("\n"), name:title.trim()};
}
async function importFromLink(url, fmtHint){
  url = String(url||"").trim(); if (!/^https?:\/\//i.test(url)) url = "https://"+url;
  const src = LINK_SRC.find(s=>s.re.test(url));
  const m = src && url.match(src.re);
  let r;
  if (src && IMPORTERS[src.k]) r = await IMPORTERS[src.k](m[1]);
  else if (src && src.k==="mtgdecks"){ try { r = {raw: await getVia(url.replace(/\/$/,"")+"/txt"), name:""}; if (!/^\s*\d+\s+\S/m.test(r.raw)) throw 0; } catch(e){ r = listFromHTML(await getVia(url)); } }
  else r = listFromHTML(await getVia(url));
  if (r.raw!=null){
    const fmt = fmtHint || (/^commander\b/im.test(r.raw)?"commander":null);
    const p = splitDeck(parseList(textToDeck(r.raw, fmt), {keepSide:fmt!=="commander"}), fmt||"pauper", []);
    const L = a => a.map(c=>`${c.q} ${c.n}`).join("\n");
    r = {name:r.name, fmt, commanders:p.commanders, text:L(p.cards), side:L(p.side), maybe:L(p.maybe)};
  }
  r.src = src ? src.n : new URL(url).hostname;
  if (!r.fmt){ const n = (r.text.match(/^\d+/gm)||[]).reduce((a,x)=>a+ +x,0); r.fmt = r.commanders.length || n>=90 ? "commander" : null; }
  if (!r.text.trim() && !r.commanders.length) throw new Error("El enlace no trajo cartas.");
  return r;
}
function linkBoxHTML(where){
  if (isWebView()) return `<div class="card-box link-box"><h3>Importar desde un enlace</h3><p class="muted" style="margin:0">En la versión web no se pueden leer enlaces de otros sitios. Desde ManaBox: abre el mazo → ⋯ → Exportar → Texto, copia y pega la lista en el cuadro “Deck” (el banquillo y las cartas probables se separan solos). Moxfield, Archidekt y MTGGoldfish también tienen “Exportar como texto”. Para importar con el enlace, usa la <a href="https://boveda-edh.netlify.app" target="_blank" rel="noopener">versión en vivo</a>.</p></div>`;
  return `<div class="card-box link-box"><h3>Importar desde un enlace</h3><p class="muted" style="margin:0">Moxfield, Archidekt, ManaBox (enlace compartido), MTGGoldfish, MTGTop8, TappedOut, Deckstats, MTGDecks o Melee. El mazo debe ser público.</p>
    <div class="row"><input type="url" id="${where}-url" placeholder="https://moxfield.com/decks/…" style="flex:1;min-width:220px">
    ${where==="hub"?`<select id="hub-url-fmt" aria-label="Formato"><option value="">Formato: detectar</option><option value="commander">Commander</option><option value="pauper">Pauper</option><option value="pioneer">Pioneer</option></select>`:""}
    <button class="btn sm primary" type="button" data-pm="url-import" data-v="${where}">Traer lista</button></div>
    <label class="chk-line"><input type="checkbox" id="set-link-proxy"${S.data.settings.linkProxy===false?"":" checked"}><span>Si el sitio no responde directo, usar un puente público (corsproxy.io o allorigins.win). Solo se envía la dirección del mazo.</span></label></div>`;
}
async function runLinkImport(where){
  const inp = $("#"+where+"-url"); const url = inp && inp.value.trim(); if (!url){ toast("Pega el enlace del mazo."); return; }
  const inEditor = where==="ed" && S.editing;
  const hint = inEditor ? S.editing.format : (($("#hub-url-fmt")||{}).value||null);
  S.busy={label:"Trayendo la lista desde el enlace", done:0, total:1}; renderBusy();
  let r;
  try { r = await importFromLink(url, hint); }
  catch(e){ S.busy=null; renderBusy(); toast(`No pude leer ese enlace (${e.message||e}). Si el sitio lo bloquea, exporta la lista como texto y pégala.`); return; }
  S.busy=null; renderBusy();
  const fmt = inEditor ? S.editing.format : (hint || r.fmt || (S.view in FORMATS ? S.view : "pauper"));
  if (inEditor){
    const set=(id,v)=>{ const el=$(id); if (el) el.value=v; };
    set("#f-list", r.text); set("#f-side", r.side); set("#f-maybe", r.maybe);
    if (!($("#f-name")||{}).value && r.name) set("#f-name", r.name);
    if (fmt==="commander" && r.commanders.length) set("#f-cmd", r.commanders.join(" + "));
    renderEditorPreview();
  } else {
    S.view = fmt; S.showMeta[fmt]=false;
    S.editing = {format:fmt, name:r.name||"", commanders:fmt==="commander"?r.commanders:[], text:r.text, side:r.side, maybe:r.maybe};
    if (fmt!=="commander" && r.commanders.length) S.editing.text = r.commanders.map(n=>"1 "+n).join("\n")+"\n"+r.text;
    render(); renderEditorPreview(); window.scrollTo(0,0);
  }
  const n = s => (s.match(/^\d+/gm)||[]).reduce((a,x)=>a+ +x,0);
  toast(`Lista traída de ${r.src}: ${n(r.text)+r.commanders.length} en el deck, ${n(r.side)} en banquillo, ${n(r.maybe)} probables. Revisa y guarda.`);
}

/* ---------- eventos ---------- */
document.addEventListener("click", async ev=>{
  const b = ev.target.closest("[data-pm]"); if (!b) return;
  const v = b.dataset.v; const d = curDeck();
  switch(b.dataset.pm){
    case "arch": S.pmArch=v; render(); { const el=document.querySelector(".pm-detail"); if (el) el.scrollIntoView({behavior:"smooth", block:"start"}); } break;
    case "copy": copyText(PG_LISTS[v].list); break;
    case "create": { const L=pgDeck(v); S.view="pauper"; S.showMeta.pauper=false; S.editing={format:"pauper", name:`${v} (Paupergeddon)`, commanders:[], text:listText(L.main), side:listText(L.side), maybe:""}; render(); window.scrollTo(0,0); break; }
    case "fetch": { const a=v; const L=pgDeck(a); const excl=new Set(L?[...L.main,...L.side].map(c=>slug(c.n)):[]); const names=muRow(a).flatMap(r=>pauperAdds(PG_COLORS[a]||"", r.b, excl, a).map(x=>x.n)); await fetchCards([...names, ...(L?[...L.main,...L.side].map(c=>c.n):[])],{label:"Trayendo cartas de Paupergeddon"}); break; }
    case "fetch-deck": { if (!d) break; const A=analyze(d); const g=pauperArchOf(d,A); if (!g) break; const excl=new Set([...A.rows,...A.side].map(r=>slug(r.n)));
      const names = muRow(g.n).flatMap(r=>pauperAdds(A.ci||PG_COLORS[g.n]||"", r.b, excl, g.n).map(x=>x.n));
      const sides = PAUPER_MU.arch.filter(x=>PG_LISTS[x]).flatMap(x=>pgDeck(x).side.map(c=>c.n));
      await fetchCards([...names, ...sides],{label:"Trayendo cartas de banquillo"}); break; }
    case "side-add": case "maybe-add": { if (!d) break; const to = b.dataset.pm==="side-add"?"side":"maybe"; const arr=(d[to]||[]).map(c=>({...c}));
      if (arr.some(c=>slug(c.n)===slug(v))){ toast("Ya está ahí."); break; }
      arr.push({n:v, q:1}); saveDeck({...d, [to]:arr}, {src:"meta"});
      const sn = to==="side" ? arr.reduce((t,c)=>t+c.q,0) : 0;
      toast(to==="side" ? `${v} al banquillo${sn>15?` · ahora tienes ${sn}: saca ${sn-15} para volver a 15`:""}.` : `${v} agregada a cartas probables.`);
      fetchCards([v],{quiet:true}); break; }
    case "url-import": await runLinkImport(v); break;
  }
});
document.addEventListener("change", e=>{
  if (e.target.id==="pm-deck-arch"){ const d=curDeck(); if (!d) return; saveDeck({...d, pauperArch:e.target.value||null}, {noLog:true}); }
  if (e.target.id==="set-link-proxy"){ S.data.settings.linkProxy=e.target.checked; saveData(); }
});
document.addEventListener("keydown", e=>{ if (e.key==="Enter" && e.target && /-url$/.test(e.target.id||"") && e.target.id!=="set-link-proxy"){ e.preventDefault(); runLinkImport(e.target.id.replace(/-url$/,"")); } });
