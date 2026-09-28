/* =========================================================
   Bóveda EDH — Torneos cEDH (TopDeck.gg, 24+ jugadores)
   Meta por comandante, asientos, torneos con su desglose,
   listas importables y comparación de tu mazo con las listas
   de torneo de tu comandante. Datos: /api/cedh (versión en vivo).
   ========================================================= */
const TD_DAYS = [30, 90, 180], TD_MIN = [24, 32, 48, 64];
S.td = S.td || {data:null, err:"", loading:false, days:90, min:24, sort:"entries", open:null, tour:{}, cmd:{}};

async function tdLoad(force){
  if (!LIVE){ toast("Los torneos cEDH se consultan en la versión en vivo: boveda-edh.netlify.app"); return; }
  if (S.td.loading) return; S.td.loading = true; S.td.err = ""; render();
  try {
    const r = await fetch("/api/cedh?q=data" + (force ? "" : ""), {cache: force ? "no-store" : "default"});
    const j = await r.json().catch(()=>({}));
    if (r.status === 501) S.td.err = "sin_clave";
    else if (!r.ok) S.td.err = j.error || ("HTTP " + r.status);
    else { S.td.data = j; try { idb.set("tdData", j); } catch {} }
  } catch { S.td.err = "Sin conexión con el servidor."; }
  finally { S.td.loading = false; render(); }
}
idb.get("tdData").then(v=>{ if (v && v.tours && !S.td.data) S.td.data = v; }).catch(()=>{});

// agrega los torneos que cumplen el filtro (fecha y tamaño)
function tdAgg(){
  const D = S.td.data; if (!D) return null;
  const since = Date.now()/1000 - S.td.days*86400;
  const tours = D.tours.filter(t=>t.s >= S.td.min && (!t.d || t.d >= since));
  const by = new Map(); let entries = 0, known = 0;
  const seat = [0,0,0,0,0,0];
  for (const t of tours){
    for (let i=0;i<6;i++) seat[i] += (t.seat||[])[i]||0;
    for (const [c, standing, w, dr, l] of t.e){
      entries++; if (c < 0) continue; known++;
      const name = D.cmds[c]; const x = by.get(name) || {name, n:0, top:0, w:0, d:0, l:0, best:999};
      x.n++; if (t.tc && standing <= t.tc) x.top++; x.w+=w; x.d+=dr; x.l+=l; x.best = Math.min(x.best, standing);
      by.set(name, x);
    }
  }
  const cmds = [...by.values()].map(x=>({...x, conv: x.n ? x.top/x.n : 0, wr: (x.w+x.d+x.l) ? x.w/(x.w+x.d+x.l) : 0, share: known ? x.n/known : 0}));
  return {tours, entries, known, cmds, seat};
}
function tdCmdKey(name){ return String(name||"").split(" / ").map(slug).sort().join("|"); }
function tdStatsFor(d){
  const A = tdAgg(); if (!A || !d || !(d.commanders||[]).length) return null;
  const k = tdCmdKey((d.commanders||[]).join(" / "));
  const row = A.cmds.find(c=>tdCmdKey(c.name)===k);
  const rank = row ? [...A.cmds].sort((a,b)=>b.n-a.n).findIndex(c=>c===row)+1 : null;
  return row ? {...row, rank, total:A.cmds.length} : {none:true};
}
const pct1 = v => (v*100).toFixed(1).replace(".", ",") + "%";
const tdDate = s => s ? new Date(s*1000).toLocaleDateString("es-CL", {day:"numeric", month:"short", year:"numeric"}) : "—";

/* ---------- calibración del tramo alto con listas de torneo ---------- */
// la "lista típica" de un comandante: las cartas que juega la mayoría de sus listas en torneos de 24+ jugadores
async function tdCalibrate(){
  const A = tdAgg(); if (!A) return;
  const top = [...A.cmds].filter(c=>c.n>=8).sort((a,b)=>b.n-a.n).slice(0, 8);
  if (top.length < 3){ toast("Hacen falta al menos 3 comandantes con 8 o más listas."); return; }
  S.td.cal = "Armando las listas típicas…"; render();
  const rows = [];
  try {
    for (const c of top){
      const r = await fetch("/api/cedh?q=cmd&name=" + encodeURIComponent(c.name)); if (!r.ok) continue;
      const j = await r.json(); const cards = (j.cards||[]).filter(x=>x[1]>=25).slice(0, 99);
      if (cards.length < 70) continue;
      const d = {id:"cal-"+slug(c.name), format:"commander", name:c.name, commanders:c.name.split(" / "), cards:cards.map(x=>({n:x[0], q:1})), side:[], maybe:[], log:[]};
      await fetchCards(allNames(d), {quiet:true});
      S.noCal = true; try { const P = powerOf(d, analyzeRaw(d)); rows.push({c:c.name, p:Math.round(P.abs0*100)/100, lists:j.lists}); } finally { S.noCal = false; }
      S.td.cal = `Calculando… ${rows.length} de ${top.length}`; render();
    }
    if (rows.length < 3){ toast("No hubo suficientes listas para calibrar."); return; }
    const mean = rows.reduce((a,x)=>a+x.p,0)/rows.length;
    const k = mean > 8.05 ? Math.max(1, Math.min(2.5, (9.4 - 8) / (mean - 8))) : 2.5;
    S.data.settings.cedhCal = {at:Date.now(), mean:Math.round(mean*100)/100, k:Math.round(k*100)/100, rows};
    saveData(); bumpAnalysis();
    toast(k > 1.02 ? `Calibrado: las listas de torneo daban ${mean.toFixed(1)}; el tramo sobre 8 se estira ×${k.toFixed(2)}.` : "Las listas de torneo ya dan nivel cEDH: no hace falta ajustar.");
  } finally { S.td.cal = null; render(); }
}
function tdCalHTML(){
  const C = S.data.settings.cedhCal;
  return `<h4 class="td-h">Calibrar el nivel alto</h4>
    <p class="lede">Arma la lista típica de los comandantes más jugados (las cartas que usan la mayoría de sus listas), calcula su nivel y, si queda bajo 9,4, estira el tramo sobre 8 para que los mazos de torneo den nivel cEDH. Los mazos casuales no cambian.</p>
    ${C ? `<p>Calibrado el ${new Date(C.at).toLocaleDateString("es-CL")}: las listas típicas daban <b class="num">${String(C.mean).replace(".",",")}</b> en promedio → tramo alto ×<b class="num">${String(C.k).replace(".",",")}</b>.</p>
      <div class="chips">${C.rows.map(r=>`<span class="pill neutral">${esc(r.c)} · ${String(r.p).replace(".",",")}</span>`).join("")}</div>` : ""}
    <div class="row" style="margin-top:8px"><button class="btn sm ${C?"":"primary"}" data-td-cal="run" ${S.td.cal?"disabled":""}>${S.td.cal?esc(S.td.cal):C?"Volver a calibrar":"Calibrar con torneos"}</button>${C?`<button class="btn sm ghost" data-td-cal="off">Quitar calibración</button>`:""}</div>`;
}

/* ---------- vista: meta de torneos ---------- */
function tdHTML(){
  const credit = `<p class="foot">Datos de torneos: <a href="https://topdeck.gg" target="_blank" rel="noopener">TopDeck.gg</a> (API pública), con el mismo criterio de <a href="https://edhtop16.com" target="_blank" rel="noopener">EDHTop16</a>. Solo torneos con ${S.td.min} o más jugadores.</p>`;
  if (!LIVE) return `<div class="sec"><h3>Torneos cEDH (24+ jugadores)</h3><p class="lede">El meta de torneos con listas y resultados se consulta en la versión en vivo.</p><a class="btn sm" href="https://boveda-edh.netlify.app" target="_blank" rel="noopener">Abrir la versión en vivo</a></div>`;
  if (S.td.err === "sin_clave") return `<div class="sec"><h3>Torneos cEDH (24+ jugadores)</h3><div class="note">Falta conectar TopDeck.gg. Es gratis: crea una clave en <a href="https://topdeck.gg/developers" target="_blank" rel="noopener">topdeck.gg/developers</a> y guárdala en Netlify como <span class="mono">TOPDECK_KEY</span> (Configuración del sitio → Variables de entorno). Después vuelve a publicar el sitio.</div>${credit}</div>`;
  if (!S.td.data) return `<div class="sec"><h3>Torneos cEDH (24+ jugadores)</h3><p class="lede">Resultados reales de torneos: qué comandantes llegan al top cut, cómo rinde cada asiento y las listas de cada jugador.</p>
    ${S.td.err?`<p class="down">${esc(S.td.err)}</p>`:""}<button class="btn primary" data-td="load" ${S.td.loading?"disabled":""}>${S.td.loading?"Cargando torneos…":"Cargar torneos"}</button>${credit}</div>`;
  const A = tdAgg();
  const sorted = [...A.cmds].filter(c=>S.td.sort==="entries" || c.n>=5).sort((a,b)=> S.td.sort==="conv" ? b.conv-a.conv || b.n-a.n : S.td.sort==="wr" ? b.wr-a.wr || b.n-a.n : b.n-a.n).slice(0, 30);
  const mine = new Set(S.data.decks.filter(d=>d.format==="commander" && !d.rival).map(d=>tdCmdKey((d.commanders||[]).join(" / "))));
  const seatN = A.seat[0] || 0;
  const th = (k,l) => `<th class="n"><button class="linkish" data-td-sort="${k}" aria-pressed="${S.td.sort===k}">${l}${S.td.sort===k?" ↓":""}</button></th>`;
  const chip = (k, v, l, cur) => `<button class="chip" data-td-${k}="${v}" aria-pressed="${cur===v}">${l}</button>`;
  return `<div class="sec td">
    <div class="rp-h"><h3>Torneos cEDH</h3><button class="btn sm ghost" data-td="load" ${S.td.loading?"disabled":""}>${S.td.loading?"Actualizando…":"Actualizar"}</button></div>
    <div class="td-filters"><div class="chips" role="group" aria-label="Periodo">${TD_DAYS.map(v=>chip("days", v, v===30?"1 mes":v===90?"3 meses":"6 meses", S.td.days)).join("")}</div>
      <div class="chips" role="group" aria-label="Tamaño mínimo">${TD_MIN.map(v=>chip("min", v, v+"+ jugadores", S.td.min)).join("")}</div></div>
    <div class="stats td-stats"><div class="stat"><div class="k">torneos</div><div class="v">${A.tours.length}</div></div><div class="stat"><div class="k">jugadores</div><div class="v">${A.entries.toLocaleString("es-CL")}</div></div><div class="stat"><div class="k">con lista</div><div class="v">${A.entries?Math.round(100*A.known/A.entries):0}<small>%</small></div></div><div class="stat"><div class="k">comandantes</div><div class="v">${A.cmds.length}</div></div></div>
    <h4 class="td-h">Comandantes</h4>
    <div class="tbl-wrap"><table class="td-tbl"><thead><tr><th class="td-rank">#</th><th>Comandante</th>${th("entries","Top/mazos")}${th("conv","Conv.")}${th("wr","Vict.")}</tr></thead><tbody>
      ${sorted.map((c,i)=>`<tr${mine.has(tdCmdKey(c.name))?' class="td-mine"':""}><td class="num td-rank">${i+1}</td><td>${esc(c.name)}${mine.has(tdCmdKey(c.name))?` <span class="pill good">tu mazo</span>`:""}<br><span class="muted num" style="font-size:.8rem">${pct1(c.share)} del meta</span></td><td class="n">${c.top}/${c.n}</td><td class="n">${Math.round(c.conv*100)}%</td><td class="n">${Math.round(c.wr*100)}%</td></tr>`).join("")}
    </tbody></table></div>
    <p class="foot">Top/mazos = llegaron al top cut de los inscritos. Conv. = ese porcentaje. Vict. = % de partidas ganadas. ${S.td.sort!=="entries"?"Para conversión y % de victorias solo cuentan comandantes con 5 mazos o más.":""}</p>
    ${seatN?`<h4 class="td-h">Asiento en la mesa</h4><div class="td-seats">${[1,2,3,4].map(i=>`<div class="td-seat"><small class="sc">asiento ${i}</small><b class="num">${pct1(A.seat[i]/seatN)}</b><span class="rp-track sm"><i style="width:${100*A.seat[i]/seatN/0.4}%"></i></span></div>`).join("")}<div class="td-seat"><small class="sc">empates</small><b class="num">${pct1(A.seat[5]/seatN)}</b><span class="rp-track sm"><i style="width:${100*A.seat[5]/seatN/0.4}%"></i></span></div></div>
      <p class="foot">De ${seatN.toLocaleString("es-CL")} mesas de 4. Partir primero suele ganar bastante más que el 25% esperado.</p>`:""}
    <h4 class="td-h">Últimos torneos</h4>
    <div class="td-tours">${A.tours.slice(0, 25).map(t=>`<div class="td-tour"><button class="td-tour-h" data-td-tour="${esc(t.id)}" aria-expanded="${S.td.open===t.id}"><span><b>${esc(t.n)}</b><br><span class="muted" style="font-size:.85rem">${tdDate(t.d)}${t.city?` · ${esc(t.city)}${t.st?", "+esc(t.st):""}`:""}</span></span><span class="num td-size">${t.s}<small> jug.</small></span></button>${S.td.open===t.id?tdTourHTML(t):""}</div>`).join("") || `<p class="muted">No hay torneos con este filtro.</p>`}</div>
    ${S.td.data.staples && S.td.data.staples.length?`<h4 class="td-h">Staples de torneo</h4><p class="lede">Las cartas más presentes en todas las listas (${S.td.data.lists.toLocaleString("es-CL")} listas en los últimos ${S.td.data.days} días).</p><div class="td-staples">${S.td.data.staples.slice(0,30).map(([n,p])=>`<div class="rec"><span>${cardName(n)}</span><span class="meta"><span class="num">${String(p).replace(".",",")}%</span> ${ownedOf(n)>0?`<span class="own y">tengo</span>`:""}</span></div>`).join("")}</div>`:""}
    ${tdCalHTML()}
    <p class="foot">Actualizado ${new Date(S.td.data.at).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"})}.</p>${credit}</div>`;
}
function tdTourHTML(t){
  const D = S.td.data; const by = new Map();
  for (const [c, standing] of t.e){ const name = c<0 ? "Sin lista" : D.cmds[c]; const x = by.get(name)||{n:0, top:0}; x.n++; if (t.tc && standing<=t.tc) x.top++; by.set(name, x); }
  const rows = [...by.entries()].sort((a,b)=>b[1].top-a[1].top || b[1].n-a[1].n);
  const det = S.td.tour[t.id];
  return `<div class="td-body">
    <p class="muted" style="margin:0">Top ${t.tc||"—"} · ${t.s} jugadores${t.seat&&t.seat[0]?` · asiento 1 ganó ${pct1(t.seat[1]/t.seat[0])}`:""}</p>
    <div class="tbl-wrap"><table><thead><tr><th>Comandante</th><th class="n">Top</th><th class="n">Mazos</th><th class="n">Conv.</th></tr></thead><tbody>${rows.slice(0,20).map(([n,x])=>`<tr><td>${esc(n)}</td><td class="n">${x.top}</td><td class="n">${x.n}</td><td class="n">${pct1(x.top/x.n)}</td></tr>`).join("")}</tbody></table></div>
    ${det && det.std ? `<h4 class="td-h">Posiciones</h4><div class="td-std">${det.std.slice(0, Math.max(16, t.tc||0)).map(p=>`<div class="rec"><span><b class="num">${p.standing}.</b> ${esc(p.name)}<br><span class="muted" style="font-size:.85rem">${esc(p.cmd||"sin lista")} · ${p.w}-${p.d}-${p.l}</span></span>${p.list&&p.pid?`<button class="btn sm" data-td-deck="${esc(t.id+"/"+p.pid)}">Importar</button>`:""}</div>`).join("")}</div>`
      : det && det.err ? `<p class="muted">${esc(det.err)}</p>` : `<button class="btn sm" data-td-std="${esc(t.id)}">Ver posiciones y listas</button>`}
    <p class="foot"><a href="https://topdeck.gg/bracket/${encodeURIComponent(t.id)}" target="_blank" rel="noopener">Ver en TopDeck.gg</a> · <a href="https://edhtop16.com/tournament/${encodeURIComponent(t.id)}?tab=breakdown" target="_blank" rel="noopener">EDHTop16</a></p></div>`;
}

// lista de un jugador de torneo → "Mazos de mis amigos"
function importRivalText(raw, name){
  const nx = splitDeck(parseList(raw), "commander", []);
  if (!nx.cards.length || !nx.commanders.length){ copyText(raw); toast("No pude separar la lista: quedó copiada para pegarla a mano."); return; }
  const owner = String(name||"").split(" · ")[0] || "Torneo";
  const nd = {id:uid(), format:"commander", rival:{owner:"Torneo: "+owner}, name:nx.commanders.join(" + ")+" (torneo)", commanders:nx.commanders, cards:nx.cards, side:nx.side, maybe:nx.maybe, log:[], created:Date.now(), updated:Date.now()};
  S.data.decks.push(nd); saveData(); toast(`Lista de ${owner} agregada a “Mazos de mis amigos”.`);
  fetchCards(allNames(nd), {quiet:true}).then(()=>{ bumpAnalysis(); render(); });
}

/* ---------- vista: tu mazo contra las listas de torneo ---------- */
function tdDeckHTML(d, A){
  if (!LIVE || S.td.err==="sin_clave") return "";
  const key = tdCmdKey((d.commanders||[]).join(" / "));
  const C = S.td.cmd[key]; const st = tdStatsFor(d);
  const head = `<div class="sec"><h3>Tu comandante en torneos (24+ jugadores)</h3>`;
  const statLine = st && !st.none ? `<p>${st.n} mazos en ${S.td.days===30?"el último mes":`los últimos ${S.td.days/30} meses`} · <b>${st.top}</b> al top cut (${pct1(st.conv)}) · ${pct1(st.wr)} de victorias · puesto ${st.rank} de ${st.total} en popularidad.</p>` : st && st.none ? `<p class="muted">Tu comandante no aparece en torneos grandes recientes.</p>` : "";
  if (!C) return `${head}${statLine}<p class="lede">Compara tu lista con las de los jugadores que llevan tu comandante a torneos: qué juegan casi todos y te falta, y qué juegas tú que casi nadie usa.</p><button class="btn sm" data-td-cmd="1" ${S.td.loading?"disabled":""}>Comparar con listas de torneo</button></div>`;
  if (C.err) return `${head}${statLine}<p class="muted">${esc(C.err)}</p></div>`;
  const inDeck = new Set([...(d.cards||[]), ...(d.side||[])].map(c=>slug(c.n)));
  const missing = C.cards.filter(([n,p])=>p>=50 && !inDeck.has(slug(n)) && !BASICS.has(slug(n))).slice(0, 25);
  const pct = new Map(C.cards.map(([n,p])=>[slug(n), p]));
  const rareAll = (d.cards||[]).filter(c=>!BASICS.has(slug(c.n)) && (pct.get(slug(c.n))||0) < 10).sort((a,b)=>(pct.get(slug(a.n))||0)-(pct.get(slug(b.n))||0)); const rare = rareAll.slice(0, 12);
  const topOnly = C.top ? C.cards.filter(([n,p,t])=>t!=null && t-p>=20 && !inDeck.has(slug(n))).slice(0, 12) : [];
  const shared = (d.cards||[]).filter(c=>(pct.get(slug(c.n))||0) >= 50).length;
  const row = ([n,p,t]) => `<div class="rec"><span>${cardName(n)} ${ownedOf(n)>0?`<span class="pill good">tienes</span>`:""}<br><span class="muted num" style="font-size:.82rem">${String(p).replace(".",",")}% de las listas${t!=null?` · ${String(t).replace(".",",")}% en el top`:""}</span></span><button class="btn sm ghost" data-sy-maybe="${esc(n)}">+ probable</button></div>`;
  return `${head}${statLine}
    <p class="lede">${C.lists} listas de torneo con tu comandante (${C.top} llegaron al top cut). Tu mazo comparte <b>${shared}</b> de las cartas que juega la mayoría.</p>
    <div class="two">
      <div><h4 class="td-h">Juegan casi todos y te falta</h4>${missing.map(row).join("") || `<p class="muted">Tienes todo lo que juega la mayoría.</p>`}</div>
      <div><h4 class="td-h">Tus cartas poco vistas en torneo</h4>${rare.map(c=>`<div class="rec"><span>${cardName(c.n)}</span><span class="meta num">${String(pct.get(slug(c.n))||0).replace(".",",")}%</span></div>`).join("") || `<p class="muted">Todas tus cartas aparecen en listas de torneo.</p>`}${rareAll.length>12?`<p class="muted" style="margin:.4em 0 0">y ${rareAll.length-12} más.</p>`:""}<p class="foot">Menos del 10% de las listas. No significa que estén mal: puede ser tu sello personal.</p></div>
    </div>
    ${topOnly.length?`<h4 class="td-h">Marcan diferencia en el top cut</h4><p class="lede">Aparecen bastante más en las listas que llegaron al top que en el resto.</p>${topOnly.map(row).join("")}`:""}
    <p class="foot">Datos: <a href="https://topdeck.gg" target="_blank" rel="noopener">TopDeck.gg</a>, torneos de 24+ jugadores de los últimos 6 meses.</p></div>`;
}

document.addEventListener("click", async ev => {
  const g = k => ev.target.closest(`[data-td-${k}]`);
  let b;
  if ((b = ev.target.closest("[data-td]")) && b.dataset.td==="load"){ await tdLoad(true); return; }
  if ((b = g("cal"))){ if (b.dataset.tdCal==="off"){ delete S.data.settings.cedhCal; saveData(); bumpAnalysis(); render(); toast("Calibración quitada."); } else await tdCalibrate(); return; }
  if ((b = g("days"))){ S.td.days = +b.dataset.tdDays; render(); return; }
  if ((b = g("min"))){ S.td.min = +b.dataset.tdMin; render(); return; }
  if ((b = g("sort"))){ S.td.sort = b.dataset.tdSort; render(); return; }
  if ((b = g("tour"))){ S.td.open = S.td.open===b.dataset.tdTour ? null : b.dataset.tdTour; render(); return; }
  if ((b = g("std"))){ const id = b.dataset.tdStd; b.disabled = true;
    try { const r = await fetch("/api/cedh?q=t&id="+encodeURIComponent(id)); const j = await r.json(); S.td.tour[id] = r.ok ? j : {err:j.error||"No se encontraron las posiciones."}; } catch { S.td.tour[id] = {err:"Sin conexión."}; }
    render(); return; }
  if ((b = g("deck"))){ b.disabled = true; const t0 = b.textContent; b.textContent = "Importando…";
    try { const r = await fetch("/api/cedh?q=deck&id="+encodeURIComponent(b.dataset.tdDeck).replace(/%2F/i,"/")); const j = await r.json(); if (!r.ok || !j.raw) throw new Error(j.error||"sin lista");
      if (typeof importRivalText==="function") importRivalText(j.raw, j.name); else { copyText(j.raw); toast("Lista copiada: pégala en un mazo nuevo."); } }
    catch(e){ toast("No se pudo traer la lista: "+e.message); }
    finally { b.disabled = false; b.textContent = t0; } return; }
  if ((b = g("cmd"))){ const d = S.data.decks.find(x=>x.id===S.sel[S.view]); if (!d) return; const key = tdCmdKey((d.commanders||[]).join(" / "));
    b.disabled = true; b.textContent = "Buscando listas…";
    if (!S.td.data) await tdLoad(false);
    try { const r = await fetch("/api/cedh?q=cmd&name="+encodeURIComponent((d.commanders||[]).join(" / "))); const j = await r.json(); S.td.cmd[key] = r.ok ? j : {err: r.status===404 ? "No hay suficientes listas de torneo con tu comandante (se necesitan 3 o más)." : (j.error||"Error")}; }
    catch { S.td.cmd[key] = {err:"Sin conexión."}; }
    const need = S.td.cmd[key] && S.td.cmd[key].cards ? S.td.cmd[key].cards.slice(0,60).map(c=>c[0]) : [];
    if (need.length) await fetchCards(need, {quiet:true});
    render(); return; }
});
