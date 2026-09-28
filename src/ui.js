/* =========================================================
   Bóveda EDH v3 — interfaz
   ========================================================= */
const fmtOfView = () => (S.view in FORMATS ? S.view : null);

function render(){
  // conserva lo escrito en el editor si la pantalla se vuelve a dibujar
  if (S.editing && $("#f-list")){ S.editing.text=$("#f-list").value; S.editing.side=($("#f-side")||{}).value||""; S.editing.maybe=($("#f-maybe")||{}).value||""; S.editing.name=($("#f-name")||{}).value||""; if ($("#f-cmd")) S.editing.commanders=$("#f-cmd").value.split("+").map(x=>x.trim()).filter(Boolean); }
  const alertsN = alerts().length;
  const nav = [["home","Inicio","Inicio"],["commander","Commander","EDH"],["pauper","Pauper","Pauper"],["pioneer","Pioneer","Pioneer"],["coll","Colección","Colec."],["venta","Venta","Venta"],["market","Mercado","Mercado"]];
  $("#tabs").innerHTML = nav.map(([k,l,sh])=>`<button class="tab" role="tab" data-view="${k}" aria-selected="${S.view===k || (k==="home" && ["tools","weekly","news"].includes(S.view))}"><span class="tl">${l}</span><span class="ts" aria-hidden="true">${sh}</span>${k==="market"&&alertsN?`<span class="badge" aria-label="${alertsN} alertas">${alertsN}</span>`:""}</button>`).join("");
  renderBusy();
  renderSettings();
  const main=$("#main");
  if (fmtOfView()) main.innerHTML = formatViewHTML(S.view);
  else if (S.view==="coll") main.innerHTML = collHTML();
  else if (S.view==="venta") main.innerHTML = ventaHTML();
  else if (S.view==="tools") main.innerHTML = toolsHubHTML();
  else if (S.view==="home") main.innerHTML = homeHTML();
  else if (S.view==="news") main.innerHTML = newsHTML();
  else if (S.view==="weekly") main.innerHTML = weeklyHTML();
  else main.innerHTML = marketHTML();
  if (S.editing && typeof renderEditorPreview==="function") renderEditorPreview();
  renderModal();
  collapseBanners();
}
// un aviso a la vez: los demás quedan plegados bajo "N avisos más"
function collapseBanners(){
  for (const body of document.querySelectorAll("#main .pane-body")){
    const bs = [...body.children].filter(e=>e.classList.contains("banner"));
    if (bs.length < 2) continue;
    const det = document.createElement("details"); det.className = "more-banners";
    det.innerHTML = `<summary>${bs.length-1} aviso${bs.length>2?"s":""} más</summary>`;
    bs[0].after(det); for (const b of bs.slice(1)) det.append(b);
  }
}
function thumbHTML(m){ return m && m.img ? `<img class="thumb" src="${esc(m.img.replace("/normal/","/small/"))}" alt="" loading="lazy" decoding="async">` : `<span class="thumb thumb0" aria-hidden="true"></span>`; }
function renderBusy(){
  $("#sync").innerHTML = S.busy ? `${esc(S.busy.label)}…${S.busy.total>1?` <span class="num">${S.busy.done}/${S.busy.total}</span>`:""}` : (S.data.settings.lastRefresh?`Precios del ${new Date(S.data.settings.lastRefresh).toLocaleDateString("es-CL")}`:(typeof ACC!=="undefined"&&ACC.state==="on"?"Guardado en tu cuenta":"Guardado en este navegador")); if (typeof accRender==="function") accRender();
  const b=$("#busy-banner"); if (b) b.outerHTML = busyBanner();
}
function busyBanner(){
  if (!S.busy) return `<div id="busy-banner" hidden></div>`;
  const p = S.busy.total ? 100*S.busy.done/S.busy.total : 0;
  return `<div id="busy-banner" class="banner info" style="display:grid;gap:6px"><span>${esc(S.busy.label)}…</span>${S.busy.total>1?`<div class="progress"><i style="width:${p}%"></i></div>`:""}</div>`;
}
function renderSettings(){
  const el=$("#settings"); el.hidden=!S.settingsOpen; $("#btn-settings").setAttribute("aria-expanded", S.settingsOpen);
  if (!S.settingsOpen) return;
  const st=S.data.settings;
  el.innerHTML = `<h3 style="font-size:1.1rem">Ajustes</h3>
    <div class="field"><label>Moneda de precios</label><div class="chips"><button class="chip" data-cur="usd" aria-pressed="${st.cur==="usd"}">US$ (TCGplayer)</button><button class="chip" data-cur="eur" aria-pressed="${st.cur==="eur"}">€ (Cardmarket)</button></div></div>
    <div class="field"><label for="set-clp">Pesos chilenos por 1 ${st.cur==="eur"?"€":"US$"} (opcional)</label><input type="number" id="set-clp" min="0" step="1" placeholder="Tipo de cambio de hoy" value="${esc(st.clp)}"></div>
    <div class="field"><label>Alertas</label>
      <div class="row" style="gap:6px"><span class="muted" style="font-size:.9rem">Subida de</span><input type="number" id="set-rise" min="1" step="1" style="width:70px" value="${st.rise}"><span class="muted" style="font-size:.9rem">% · bajada de</span><input type="number" id="set-drop" min="1" step="1" style="width:70px" value="${st.drop}"><span class="muted" style="font-size:.9rem">%</span></div>
      <div class="row" style="gap:6px"><span class="muted" style="font-size:.9rem">Movimiento mínimo</span><input type="number" id="set-min" min="0" step="0.5" style="width:70px" value="${st.minMove}"><span class="muted" style="font-size:.9rem">· vender desde</span><input type="number" id="set-sell" min="0" step="1" style="width:70px" value="${st.sellMin}"></div></div>
    <label class="row" style="gap:8px"><input type="checkbox" id="set-auto" ${st.autoFetch?"checked":""}> Actualizar las cartas al importar</label>
    <label class="row" style="gap:8px"><input type="checkbox" id="set-autorefresh" ${st.autoRefresh?"checked":""}> Actualizar precios una vez al día al abrir</label>
    <h3 style="font-size:1.1rem;margin-top:6px">Claude (opcional)</h3>
    <p class="muted" style="margin:0;font-size:.9rem">Para “Optimizar con IA” y la radiografía con IA, pega una clave de la API de Anthropic (console.anthropic.com). Se guarda solo en este navegador y el uso se cobra en tu cuenta de Anthropic.</p>
    <div class="field"><label for="set-ai-key">Clave de API (opcional, se cobra aparte; sin ella la IA usa tu chat de Claude)</label><input type="password" id="set-ai-key" autocomplete="off" placeholder="sk-ant-…" value="${esc(st.aiKey||"")}"></div>
    <div class="field"><label for="set-ai-model">Modelo</label><select id="set-ai-model">${[["claude-sonnet-5","Claude Sonnet 5 (recomendado)"],["claude-opus-5-5","Claude Opus 5.5 (más profundo)"],["claude-haiku-4-5-20251001","Claude Haiku 4.5 (más rápido)"]].map(([v,l])=>`<option value="${v}" ${st.aiModel===v?"selected":""}>${l}</option>`).join("")}</select></div>
    <label class="row" style="gap:8px"><input type="checkbox" id="set-weekly" ${st.weekly?"checked":""}> Mostrarme el resumen semanal cada lunes</label>
    <h3 style="font-size:1.1rem;margin-top:6px">Respaldo</h3>
    <p class="muted" style="margin:0;font-size:.9rem">Tus datos viven en este navegador. Descarga un respaldo para pasarlos a otro equipo o por seguridad.</p>
    <div class="row"><button class="btn sm primary" data-act="backup">Descargar respaldo</button><button class="btn sm" data-act="restore">Importar respaldo</button></div>
    <div class="row"><button class="btn sm ghost" data-act="refresh-all">Actualizar precios ahora</button><button class="btn sm ghost" data-act="clear-cache">Borrar caché de cartas</button></div>`;
}

/* ---------- vistas de formato ---------- */
function formatViewHTML(fmt){
  const decks = S.data.decks.filter(d=>(d.format||"commander")===fmt && !d.rival).sort((a,b)=>(b.updated||0)-(a.updated||0));
  if (!S.sel[fmt] && decks[0] && !S.editing && !S.showMeta[fmt]) S.sel[fmt]=decks[0].id;
  const rail = `<aside class="rail fmt-rail">
    <button class="btn primary" data-act="new">+ Nuevo mazo de ${FORMATS[fmt].name}</button>
    <button class="btn meta-btn" data-act="show-meta" aria-pressed="${S.showMeta[fmt]===true}">${fmt==="commander"?"Meta cEDH y brackets":"Meta de "+FORMATS[fmt].name}</button>
    ${fmt==="commander"?`<button class="btn meta-btn" data-act="show-local" aria-pressed="${S.showMeta[fmt]==="local"}">Mazos de mis amigos</button>`:""}
    <ul class="deck-list">${decks.map(d=>{ const A=analyze(d); return `<li><button class="deck-item" data-deck="${esc(d.id)}" aria-current="${d.id===S.sel[fmt] && !S.editing && !S.showMeta[fmt]}"><span class="dn">${esc(d.name)}</span><span class="dc">${pipsHTML(A.ci)} ${esc(fmt==="commander"?((d.commanders||[]).join(" + ")||"sin comandante"):`${A.main} + ${A.sideN}`)} · <span class="num">${money(A.price)}</span>${d.mb?` · <span class="tag">ManaBox</span>`:""}</span></button></li>`; }).join("") || `<li class="muted" style="padding:8px 12px">Aún no tienes mazos de ${FORMATS[fmt].name}.</li>`}</ul>
  </aside>`;
  let pane;
  if (S.editing && S.editing.format===fmt) pane = editorHTML(S.editing);
  else if (S.showMeta[fmt]==="local") pane = localMetaHTML();
  else if (S.showMeta[fmt]) pane = fmt==="commander" ? cedhMetaHTML() : metaHTML(fmt);
  else {
    const d = S.data.decks.find(x=>x.id===S.sel[fmt] && (x.format||"commander")===fmt);
    pane = d ? deckHTML(d) : `<div class="pane"><div class="empty"><h2 style="margin-bottom:8px">Tu primer mazo de ${FORMATS[fmt].name}</h2><p>Pega una lista exportada de ManaBox, Moxfield, Archidekt o MTGGoldfish, o parte de un mazo del meta.</p><div class="row" style="justify-content:center"><button class="btn primary" data-act="new">+ Nuevo mazo</button><button class="btn" data-act="show-meta">Ver el meta</button></div></div></div>`;
  }
  return `<div class="decks-layout">${rail}<div id="deck-pane">${busyBanner()}${pane}</div></div>`;
}
function deckHTML(d){
  const A = analyze(d);
  // cinco grupos; cada uno con sus vistas
  const G = A.isC ? [
    ["resumen","Resumen",[["analisis","Análisis"],["mana","Base de maná"]]],
    ["lista","Lista",[["lista","Lista"]]],
    ["mejorar","Mejorar",[["mejorar","Recomendaciones"],["ia","Con IA"],["brackets","Brackets"],["combos","Combos"]]],
    ["jugar","Jugar",[["mano","Probar mano"],["radiografia","Cómo se juega"]]],
    ["precio","Precio",[["precio","Valor"],["versiones","Versiones"],["manabox","ManaBox"],["compartir","Compartir"]]]]
  : [
    ["resumen","Resumen",[["analisis","Análisis"],["mana","Base de maná"]]],
    ["lista","Lista",[["lista","Lista"]]],
    ["mejorar","Mejorar",[["meta","Contra el meta"],["ia","Con IA"]]],
    ["jugar","Jugar",[["mano","Probar mano"],["radiografia","Cómo se juega"]]],
    ["precio","Precio",[["precio","Valor"],["versiones","Versiones"],["manabox","ManaBox"],["compartir","Compartir"]]]];
  const tabs = G.flatMap(g=>g[2]);
  if (!tabs.some(t=>t[0]===S.deckTab)) S.deckTab="analisis";
  const body = {analisis:analysisHTML, lista:listHTML, mana:manaHTML, combos:combosHTML, brackets:bracketsHTML, mejorar:improveHTML, precio:priceHTML, meta:deckMetaHTML, manabox:mbDeckHTML, ia:iaHTML, radiografia:radioHTML, mano:manoHTML, versiones:versionesHTML, compartir:compartirHTML}[S.deckTab](d,A);
  const pendN = d.mb ? boardDiff(mbBase(d.mb), boardsOf(d)).n : 0;
  return `<div class="pane">
    <div class="pane-head">
      <div><h2>${esc(d.name)}</h2>${d.rival?`<div class="pill neutral" style="margin:4px 0">Mazo de ${esc(d.rival.owner||"un amigo")} · mazos de mis amigos</div>`:""}<div class="sub">${pipsHTML(A.ci)} <span>${esc(A.isC?((d.commanders||[]).join(" + ")||"Sin comandante"):FORMATS[A.fmt].name)}</span> <span class="num muted">· ${A.isC?`${A.total} cartas`:`main ${A.main}`} · side ${A.sideN} · maybe ${A.maybeN} · ${money(A.price)}</span>${pendN?` <span class="pill warn">${pendN} cambio${pendN>1?"s":""} sin pasar a ManaBox</span>`:""}</div></div>
      <div class="actions"><button class="btn sm" data-act="edit">Editar lista</button><button class="btn sm ghost danger" data-act="askdel">Borrar</button></div>
    </div>
    ${S.confirmDel?`<div style="padding:12px 20px 0"><div class="confirm">¿Borrar “${esc(d.name)}” de este navegador? <button class="btn sm danger" data-act="del">Sí, borrar</button><button class="btn sm ghost" data-act="nodel">Cancelar</button></div></div>`:""}
    <div class="subtabs grp" role="tablist">${G.map(([gk,gl,items])=>{ const on=items.some(i=>i[0]===S.deckTab); return `<button class="subtab" role="tab" data-sub="${on?S.deckTab:items[0][0]}" aria-selected="${on}">${gl}</button>`; }).join("")}</div>
    ${(()=>{ const g=G.find(x=>x[2].some(i=>i[0]===S.deckTab)); return g && g[2].length>1 ? `<div class="subchips">${g[2].map(([k,l])=>`<button class="chip" data-sub="${k}" aria-pressed="${S.deckTab===k}">${l}</button>`).join("")}</div>` : ""; })()}
    <div class="pane-body">${missingBanner(A)}${body}</div>
  </div>`;
}
function missingBanner(A){
  if (S.busy || !A.missing.length) return "";
  return `<div class="banner"><span><b class="num">${A.missing.length}</b> carta${A.missing.length>1?"s":""} sin datos todavía. El análisis las cuenta como desconocidas.</span><button class="btn sm primary" data-act="fetch">Actualizar cartas</button></div>`;
}
function ringSVG(score){
  const r=40, c=2*Math.PI*r, col = score>=80?"var(--good)":score>=60?"var(--warn)":"var(--bad)";
  return `<svg class="ring" viewBox="0 0 96 96" role="img" aria-label="Salud ${score} de 100"><circle cx="48" cy="48" r="${r}" fill="none" stroke="var(--sunk)" stroke-width="8"/><circle cx="48" cy="48" r="${r}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c*score/100} ${c}" transform="rotate(-90 48 48)"/><text x="48" y="55" text-anchor="middle" font-size="24" font-weight="500">${score}</text></svg>`;
}
function cardName(n, m){ m = m||cardOf(n); return `<span class="cn" data-card="${esc(n)}"${m&&m.img?` data-img="${esc(m.img)}"`:""} tabindex="0" role="button">${esc(n)}</span>`; }
function analysisHTML(d,A){
  const sim = simulate(d,A); const H = health(d,A,sim);
  const own = A.needCount?Math.round(100*A.ownedCount/A.needCount):100;
  const kl = karstenLands(A);
  const stats = A.isC ? `<div class="stats">
    <div class="stat ${A.total===100?"good":Math.abs(A.total-100)<=2?"warn":"bad"}"><div class="k">cartas</div><div class="v">${A.total}<small> / 100</small></div></div>
    <div class="stat ${status(A.roles.land,35,38)}"><div class="k">tierras</div><div class="v">${A.roles.land}</div></div>
    <div class="stat"><div class="k">cmc promedio</div><div class="v">${A.avg.toFixed(2)}</div></div>
    <div class="stat ${A.gc.length>3?"warn":""}"><div class="k">game changers</div><div class="v">${A.gc.length}</div></div>
    <div class="stat ${own===100?"good":own>=85?"warn":"bad"}"><div class="k">en tu colección</div><div class="v">${own}<small>%</small></div></div></div>`
  : `<div class="stats">
    <div class="stat ${A.main>=60?"good":"bad"}"><div class="k">main</div><div class="v">${A.main}<small> / 60</small></div></div>
    <div class="stat ${A.sideN<=15?"":"bad"}"><div class="k">sideboard</div><div class="v">${A.sideN}<small> / 15</small></div></div>
    <div class="stat ${Math.abs(A.roles.land-kl)<=2?"good":"warn"}"><div class="k">tierras</div><div class="v">${A.roles.land}<small> · sug. ${Math.round(kl)}</small></div></div>
    <div class="stat"><div class="k">cmc promedio</div><div class="v">${A.avg.toFixed(2)}</div></div>
    <div class="stat ${own===100?"good":own>=85?"warn":"bad"}"><div class="k">en tu colección</div><div class="v">${own}<small>%</small></div></div></div>`;
  const alertsH=[];
  if (A.off.length) alertsH.push(`<div class="banner bad">Fuera de la identidad de color: ${A.off.map(esc).join(", ")}</div>`);
  if (A.dupes.length) alertsH.push(`<div class="banner bad">${A.isC?"Copias repetidas (Commander es singleton)":"Más de 4 copias"}: ${A.dupes.map(esc).join(", ")}</div>`);
  if (A.illegal.length) alertsH.push(`<div class="banner bad">No legales en ${FORMATS[A.fmt].name}: ${A.illegal.map(esc).join(", ")}</div>`);
  if (A.isC && !(d.commanders||[]).length) alertsH.push(`<div class="banner">Este mazo no tiene comandante. Márcalo con *CMDR* o bajo el título “Commander”.</div>`);
  const typesMax = Math.max(1,...Object.values(A.types));
  const types = TYPE_ORDER.filter(t=>A.types[t]).map(t=>`<div class="hbar"><span>${TYPE_ES[t]}</span><span class="t"><i style="width:${100*A.types[t]/typesMax}%"></i></span><span class="n">${A.types[t]}</span></div>`).join("");
  let second;
  if (A.isC){
    const Bk=bracketOf(d,A); const bn = BRACKETS[Bk.b].name;
    second = `<div class="sec"><h3>Bracket estimado</h3><p class="lede">Según la guía oficial: Game Changers, combos de 2 cartas, turnos extra, tutores y destrucción masiva de tierras.</p>
      <div class="bracket"><span class="b">${Bk.b}</span><div><div class="sc" style="font-size:1.05rem">${bn}</div><div class="bt">${esc(Bk.why)}</div></div></div>
      ${Bk.exact?"":`<p class="foot">Aún no se buscaron combos. <button class="btn sm ghost" style="padding:0" data-act="combos">Buscar combos</button> para afinar la estimación.</p>`}
      <p class="foot"><button class="btn sm ghost" style="padding:0" data-sub="brackets">Ver cómo llevarlo a otro bracket →</button></p></div>`;
  } else {
    const mm = metaMatch(A)[0];
    second = `<div class="sec"><h3>Parecido al meta</h3><p class="lede">El arquetipo del meta actual que más se parece a tu main.</p>
      ${mm&&mm.score>0.15?`<div class="bracket"><span class="b" style="font-size:.95rem">${Math.round(mm.score*100)}%</span><div><div style="font-size:1.1rem;font-weight:700">${esc(mm.a.name)}</div><div class="bt">${mm.a.share}% del meta · ${esc(META[A.fmt].src)}</div></div></div>`:`<p class="muted">No se parece a ninguno de los arquetipos principales.</p>`}
      <p class="foot"><button class="btn sm ghost" style="padding:0" data-sub="meta">Comparar con el meta →</button></p></div>`;
  }
  const struct = A.isC ? `<div class="sec"><h3>Estructura</h3><p class="lede">Roles detectados leyendo el texto de cada carta. La franja marca el rango habitual en mazos equilibrados. Según la fórmula de Frank Karsten, tu curva pide unas ${Math.round(kl)} tierras.</p><div class="roles">${TARGETS.map(t=>{
    const v=A.roles[t.k], st=status(v,t.lo,t.hi), sc=x=>Math.min(100,100*x/t.max);
    return `<div class="role"><div class="rn">${t.n}<small>${t.d}</small></div><div class="meter" title="Rango sugerido ${t.lo}–${t.hi}"><span class="band" style="left:${sc(t.lo)}%;width:${sc(t.hi)-sc(t.lo)}%"></span><span class="fill ${st}" style="width:${sc(v)}%"></span></div><div class="rv"><span class="num">${v} <span class="muted">/ ${t.lo}–${t.hi}</span></span><span class="pill ${st}">${st==="good"?"en rango":v<t.lo?"bajo":"alto"}</span></div></div>`; }).join("")}</div>
    <p class="foot">También: <span class="num">${A.roles.tutor}</span> tutores · <span class="num">${A.roles.wincon}</span> remates · <span class="num">${A.roles.recursion}</span> de reciclaje.</p></div>`
  : `<div class="sec"><h3>Funciones</h3><p class="lede">Cartas por función en el main, leyendo el texto de cada carta.</p><div class="hbars">${["removal","draw","ramp","protection","wipe","recursion","wincon"].map(k=>`<div class="hbar"><span>${ROLE_ES[k][0].toUpperCase()+ROLE_ES[k].slice(1)}</span><span class="t"><i style="width:${Math.min(100,100*A.roles[k]/20)}%"></i></span><span class="n">${A.roles[k]}</span></div>`).join("")}</div></div>`;
  return `${stats}${alertsH.join("")}
  <div class="two">
    <div class="sec"><h3>Salud del mazo</h3><p class="lede">Puntaje según las reglas del formato y los rangos habituales.</p>
      <div class="health">${ringSVG(H.score)}<ul class="checks">${H.checks.map(c=>`<li><span class="${c.ok?"ok":"no"}" aria-hidden="true">${c.ok?"✓":"✕"}</span><span>${esc(c.t)}</span></li>`).join("")}</ul></div></div>
    ${second}
  </div>
  ${struct}
  <div class="two">
    <div class="sec chart"><h3>Curva de maná</h3><p class="lede">Hechizos por valor de maná (sin tierras).</p>${barsSVG(A.curve.map((v,i)=>({v,l:i===7?"7+":String(i)})),"Curva de maná")}</div>
    <div class="sec"><h3>Tipos de carta</h3><p class="lede">Distribución del main.</p><div class="hbars">${types}</div></div>
  </div>
  ${sim?simHTML(sim):`<div class="sec"><h3>Simulador</h3><p class="lede">Agrega al menos 40 cartas para simular manos.</p></div>`}`;
}
function barsSVG(items, label, colorFn){
  const W=440,H=190,pl=24,pb=26,pt=18, bw=(W-pl)/items.length, max=Math.max(4,...items.map(i=>i.v));
  const step = max>20?10:max>10?5:2; const top=Math.ceil(max/step)*step;
  const y=v=>pt+(H-pt-pb)*(1-v/top);
  let g=""; for(let v=0; v<=top; v+=step) g+=`<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
  const bars = items.map((it,i)=>{ const x=pl+i*bw+bw*0.18, w=bw*0.64; return `<rect x="${x}" y="${y(it.v)}" width="${w}" height="${Math.max(0,H-pb-y(it.v))}" rx="3" fill="${colorFn?colorFn(it,i):"var(--accent)"}"/>${it.v?`<text class="lbl" x="${x+w/2}" y="${y(it.v)-5}" text-anchor="middle">${it.v}</text>`:""}<text x="${x+w/2}" y="${H-8}" text-anchor="middle">${esc(it.l)}</text>`; }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}: ${items.map(i=>`${i.l}: ${i.v}`).join(", ")}">${g}${bars}</svg>`;
}
function handSVG(s){
  const W=440,H=150,pl=8,pb=24,pt=18, bw=(W-pl)/8, max=Math.max(...s.hyp);
  const y=v=>pt+(H-pt-pb)*(1-v/max);
  const bars = s.hyp.map((v,i)=>{ const x=pl+i*bw+bw*0.18,w=bw*0.64, ok=i>=2&&i<=5; return `<rect x="${x}" y="${y(v)}" width="${w}" height="${Math.max(0,H-pb-y(v))}" rx="3" fill="${ok?"var(--accent)":"var(--mC)"}"/>${v>=0.005?`<text class="lbl" x="${x+w/2}" y="${y(v)-5}" text-anchor="middle">${Math.round(v*100)}%</text>`:""}<text x="${x+w/2}" y="${H-8}" text-anchor="middle">${i}</text>`; }).join("");
  return `<div class="chart" style="margin-top:16px"><p class="lede" style="margin-bottom:4px">Tierras en la mano inicial de 7 (probabilidad exacta). En color, manos de 2 a 5 tierras que suelen quedarse.</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribución de tierras en la mano inicial">${bars}</svg></div>`;
}
function simHTML(s){
  const p=x=>(100*x).toFixed(0)+"%";
  if (s.sixty) return `<div class="sec"><h3>Probabilidades de maná</h3><p class="lede">Cálculo exacto con tus ${s.L} tierras en ${s.N} cartas, sin contar mulligans.</p>
    <div class="sim-grid"><div class="sim-card"><div class="k">Mano inicial jugable (2 a 5 tierras)</div><div class="v">${p(s.keep)}</div></div>
    ${s.drops.map(x=>`<div class="sim-card"><div class="k">Tierra de turno ${x.t} a tiempo (en la mano / robando)</div><div class="v">${p(x.play)} · ${p(x.draw)}</div></div>`).join("")}</div>${handSVG(s)}</div>`;
  return `<div class="sec" id="sim"><h3>Simulador de partidas</h3><p class="lede">${s.G.toLocaleString("es-CL")} partidas simuladas con tus ${s.L} tierras en ${s.N} cartas, mulligan de Londres (el primero es gratis) y el ramp que tengas en mano. No modela oponentes: mide si tu plan arranca.</p>
  <div class="sim-grid">
    <div class="sim-card"><div class="k">Comandante (coste ${s.cmdCmc}) en mesa, turno promedio</div><div class="v">${s.avgTurn?s.avgTurn.toFixed(1):"—"}</div></div>
    <div class="sim-card"><div class="k">Comandante a más tardar en turno 4 · 5 · 6</div><div class="v">${p(s.byT[4])} · ${p(s.byT[5])} · ${p(s.byT[6])}</div></div>
    <div class="sim-card"><div class="k">Partidas con mulligan</div><div class="v">${p(s.pMull)}</div></div>
    <div class="sim-card"><div class="k">Atascado (menos de 3 tierras en turno 4)</div><div class="v" style="color:var(--${s.pScrew>0.2?"bad":s.pScrew>0.12?"warn":"good"})">${p(s.pScrew)}</div></div>
    <div class="sim-card"><div class="k">Inundado (8+ tierras en las primeras 12 cartas)</div><div class="v" style="color:var(--${s.pFlood>0.25?"bad":s.pFlood>0.15?"warn":"good"})">${p(s.pFlood)}</div></div>
  </div>
  <div class="two" style="margin-top:16px">
    <div class="chart"><p class="lede" style="margin-bottom:4px">Maná disponible promedio por turno (tierras + ramp jugado).</p>${barsSVG(s.manaT.slice(1,9).map((v,i)=>({v:Math.round(v*10)/10,l:"T"+(i+1)})),"Maná por turno")}</div>
    <div class="sec"><h3 style="font-size:1.05rem">Reloj de victoria</h3>${s.hasWin?`<p class="lede">Turno en que tienes en la mano un remate y el maná para lanzarlo, sin contar interacción de rivales.</p>
      <div class="sim-grid"><div class="sim-card"><div class="k">Turno promedio</div><div class="v">${s.winAvg?s.winAvg.toFixed(1):"—"}</div></div><div class="sim-card"><div class="k">A más tardar en turno 6 · 8 · 10</div><div class="v">${p(s.winBy[6])} · ${p(s.winBy[8])} · ${p(s.winBy[10])}</div></div></div>`:`<p class="muted">No detecté remates en la lista. Marca tus cartas de cierre con la función “remate” en su ficha para calcular el reloj.</p>`}</div>
  </div>${handSVG(s)}</div>`;
}
function listHTML(d,A){
  const groups = {}; for (const r of A.rows){ const t=r.m?r.m.t:"Unknown"; (groups[t]=groups[t]||[]).push(r); }
  const row = (r,t,board) => { const o=ownedOf(r.n); const have=o>=r.q; const tags=[...(r.m&&r.m.gc&&A.isC?[`<span class="tag gc">game changer</span>`]:[]), ...((r.m&&r.m.r)||[]).map(x=>`<span class="tag">${ROLE_ES[x]}</span>`)];
    const mv = board==="side" ? `<button class="btn sm ghost" style="padding:0 6px" data-move="side>cards" data-card2="${esc(r.n)}" title="Pasar al main">→ main</button>`
             : board==="maybe" ? `<button class="btn sm ghost" style="padding:0 6px" data-move="maybe>cards" data-card2="${esc(r.n)}" title="Pasar al main">→ main</button>` : "";
    return `<div class="cr"><span class="q">${r.q}</span><span class="nm">${thumbHTML(r.m)}${cardName(r.n,r.m)}${tags.length?`<span class="tags">${tags.join("")}</span>`:""} ${mv}</span><span class="cm">${r.m&&t!=="Land"?r.m.cmc:""}</span><span class="own ${have?"y":"n"}">${r.m&&r.m.basic?"":have?"tengo":"falta"}</span></div>`; };
  const cmd = (d.commanders||[]).map(n=>{const m=cardOf(n); return `<div class="cr"><span class="q">1</span><span class="nm">${thumbHTML(m)}<b>${cardName(n,m)}</b></span><span class="cm">${m?m.cmc:"?"}</span><span class="own ${ownedOf(n)>0?"y":"n"}">${ownedOf(n)>0?"tengo":"falta"}</span></div>`;}).join("");
  const body = TYPE_ORDER.filter(t=>groups[t]).map(t=>{
    const rows = groups[t].sort((a,b)=>(a.m?a.m.cmc:99)-(b.m?b.m.cmc:99)||a.n.localeCompare(b.n));
    return `<div class="lg"><h4>${TYPE_ES[t]} · ${rows.reduce((a,r)=>a+r.q,0)}</h4>${rows.map(r=>row(r,t,"main")).join("")}</div>`;
  }).join("");
  const sorted = arr => [...arr].sort((a,b)=>(a.m?a.m.cmc:99)-(b.m?b.m.cmc:99)||a.n.localeCompare(b.n));
  const boardBox = (key, title, arr, n, info, note, extraBtns) => `<section class="board board-${key}" aria-label="${title}">
      <div class="board-head"><h3>${title} <span class="num muted">· ${n}</span></h3><span class="muted" style="font-size:.9rem">${note}</span>
        <span class="board-meta num">${money(info.price)}${info.miss.length?` · te faltan ${info.miss.reduce((a,m)=>a+m.q,0)} (${money(info.cost)})`:n?" · las tienes todas":""}</span></div>
      ${n?`<div class="list-groups">${sorted(arr).map(r=>row(r,r.m?r.m.t:"",key)).join("")}</div><div class="row" style="margin-top:8px">${extraBtns}</div>`:`<p class="muted" style="margin:0">Vacío. Agrégalo en “Editar lista”, en el campo ${title}.</p>`}
    </section>`;
  const sideNote = A.isC ? "No cuenta para las 100 cartas." : (A.sideN>15?`<span style="color:var(--bad)">Pasa de 15 cartas.</span>`:"Hasta 15 cartas.");
  const miss = A.missingCards;
  return `<div class="row"><button class="btn sm" data-act="copylist">Copiar lista completa</button><button class="btn sm" data-act="dllist">Descargar .txt</button>
    <span class="muted" style="margin-left:auto">${miss.length?`Te faltan <b class="num">${miss.reduce((a,m)=>a+m.q,0)}</b> cartas del ${A.isC?"mazo":"main y sideboard"}`:`Tienes todas las cartas del ${A.isC?"mazo":"main y sideboard"}`}</span>
    ${miss.length?`<button class="btn sm" data-act="copymiss">Copiar faltantes</button><button class="btn sm" data-act="wish-missing">Agregar faltantes a búsqueda</button>`:""}</div>
    <p class="foot" style="margin:0">Pasa el cursor sobre un nombre para ver la carta; haz clic para ver sus versiones y precios.</p>
    <section class="board board-main" aria-label="Main">
      <div class="board-head"><h3>${A.isC?"Deck":"Deck (main)"} <span class="num muted">· ${A.isC?A.total:A.main}${A.isC?" / 100":" / 60"}</span></h3><span class="muted" style="font-size:.9rem">${A.isC?"Comandante y 99 cartas.":"Lo que juegas en el game 1."}</span><span class="board-meta num">${money(A.isC?A.price:A.price-A.sideInfo.price)}</span></div>
      ${cmd?`<div class="lg"><h4>Comandante</h4>${cmd}</div>`:""}
      <div class="list-groups">${body}</div>
    </section>
    ${boardBox("side","Sideboard (banquillo)",A.side,A.sideN,A.sideInfo,sideNote,`<button class="btn sm" data-act="copyside">Copiar sideboard</button>`)}
    ${boardBox("maybe","Maybeboard (cartas probables)",A.maybe,A.maybeN,A.maybeInfo,"Cartas en evaluación. No cuentan para el mazo ni para el análisis.",`<button class="btn sm" data-act="copymaybe">Copiar maybeboard</button>${A.maybeInfo.miss.length?`<button class="btn sm" data-act="wish-maybe">Agregar las que te faltan a búsqueda</button>`:""}`)}`;
}
function manaHTML(d,A){
  const M = manaBase(A);
  if (!M.cols.length) return `<div class="sec"><h3>Base de maná</h3><p class="lede">Mazo incoloro o sin datos todavía.</p></div>`;
  const minFor = (c) => { const share=M.pips[c]/M.pipT; const ideal=Math.round(share*M.lands); return M.pips[c] ? Math.max(A.isC?12:8, ideal) : 0; };
  const rows = M.cols.map(c=>{
    const share = M.pips[c]/M.pipT, have=M.src[c], min=minFor(c);
    const st = have>=min ? "good" : have>=min*0.8 ? "warn" : "bad";
    return `<tr><td><span class="row" style="gap:6px"><i class="pip p-${c}"></i>${COLOR_ES[c]}</span></td><td class="n">${M.pips[c]}</td><td class="n">${Math.round(share*100)}%</td><td class="n">${have}</td><td class="n">${M.rocks[c]}</td><td class="n">${min}</td><td><span class="pill ${st}">${st==="good"?"bien":st==="warn"?"justo":"faltan fuentes"}</span></td></tr>`;
  }).join("");
  return `<div class="sec"><h3>Fuentes de color</h3><p class="lede">Compara cuántos símbolos de cada color pide tu mazo con cuántas tierras producen ese color. Sugerimos al menos ${A.isC?12:8} fuentes por color, o su parte proporcional de las tierras si es mayor.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Color</th><th class="n">Símbolos</th><th class="n">% del total</th><th class="n">Tierras que lo dan</th><th class="n">Ramp que lo da</th><th class="n">Sugerido</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>
  <div class="stats"><div class="stat"><div class="k">tierras</div><div class="v">${M.lands}</div></div><div class="stat"><div class="k">básicas</div><div class="v">${M.basics}</div></div>
    <div class="stat ${M.tapped.length>(A.isC?6:3)?"warn":""}"><div class="k">entran giradas</div><div class="v">${M.tapped.length}</div></div><div class="stat"><div class="k">de utilidad (incoloras)</div><div class="v">${M.utility.length}</div></div></div>
  ${M.tapped.length?`<p class="foot">Siempre giradas: ${M.tapped.map(esc).join(", ")}.</p>`:""}
  ${M.utility.length?`<p class="foot">No producen colores del mazo: ${M.utility.map(esc).join(", ")}.</p>`:""}`;
}
function combosHTML(d,A){
  const c = d.combos;
  const head = `<div class="sec"><h3>Combos</h3><p class="lede">Combos conocidos según Commander Spellbook: los que ya están completos en tu lista y los que te quedan a una carta.</p>
    <button class="btn ${c?"":"primary"}" data-act="combos" ${S.busy?"disabled":""}>${c?"Volver a buscar":"Buscar combos"}</button>${c?` <span class="foot">Última búsqueda: ${new Date(c.at).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"})}</span>`:""}</div>`;
  if (!c) return head;
  const inDeck = new Set([...A.rows.map(r=>slug(r.n)), ...(d.commanders||[]).map(slug)]);
  const item = (v, almost) => {
    const miss = almost ? v.cards.filter(n=>!inDeck.has(slug(n))) : [];
    return `<div class="combo"><div class="cards">${v.cards.map(n=> miss.includes(n)?`<span style="color:var(--good)">+ ${cardName(n)}</span>`:cardName(n)).join(" + ")}</div>
      ${v.prod.length?`<div class="prod">→ ${v.prod.slice(0,5).map(esc).join(" · ")}</div>`:""}
      ${almost && miss.length?`<div class="row">${miss.map(n=>ownedOf(n)>0?`<span class="pill good">${esc(n)}: en tu colección</span>`:`<span class="pill neutral">${esc(n)}: ${money(refPrice(cardOf(n)))}</span>`).join("")}</div>`:""}
      ${v.desc?`<details><summary>Cómo funciona</summary><p style="white-space:pre-line;margin:6px 0 0">${esc(v.desc)}</p></details>`:""}
      ${v.id?`<a href="https://commanderspellbook.com/combo/${encodeURIComponent(v.id)}/" target="_blank" rel="noopener" class="foot">Ver en Commander Spellbook</a>`:""}</div>`;
  };
  return `${head}
    <div class="sec"><h3>Completos en tu lista · ${c.inc.length}</h3>${c.inc.length?c.inc.map(v=>item(v,false)).join(""):`<p class="muted">No hay combos completos.</p>`}</div>
    <div class="sec"><h3>A una carta · ${c.almost.length}</h3><p class="lede">Agregando una carta, dentro de tu identidad de color.</p>${c.almost.length?c.almost.slice(0,30).map(v=>item(v,true)).join(""):`<p class="muted">Nada cerca.</p>`}</div>`;
}
function bracketsHTML(d,A){
  const cur0 = bracketOf(d,A).b; const t = S.targetBracket || cur0;
  const P = bracketPlan(d, A, t);
  const pick = `<div class="bk-grid" role="group" aria-label="Bracket objetivo">${[1,2,3,4,5].map(n=>`<button class="bk" data-bracket="${n}" aria-pressed="${n===t}"><b>${n}</b><span>${BRACKETS[n].name}${n===cur0?" · actual":""}</span></button>`).join("")}</div>`;
  const chk = P.checks.map(c=>`<li><span class="${c.ok===false?"no":c.ok?"ok":""}" aria-hidden="true">${c.ok===false?"✕":c.ok?"✓":"?"}</span><span>${esc(c.t)}</span></li>`).join("");
  const cuts = P.cuts.length ? `<div class="sec"><h3>Para bajar a bracket ${t}: saca estas cartas</h3><div class="swaps">${P.cuts.map(c=>`<div class="swap"><div><div class="mv"><span class="out">${esc(c.n)}</span>${c.rep?`<span aria-hidden="true">→</span><span class="in">${cardName(c.rep)}</span>${ownedOf(c.rep)>0?`<span class="pill good">en tu colección</span>`:`<span class="pill neutral">${money(refPrice(cardOf(c.rep)))}</span>`}`:""}</div><div class="why">${esc(c.why)}${c.rep?" · reemplazo con la misma función, sin romper el bracket":" · carga EDHREC en “Mejorar” para proponer reemplazo"}</div></div><div>${c.rep?`<button class="btn sm primary" data-swap-out="${esc(c.n)}" data-swap-in="${esc(c.rep)}">Aplicar</button>`:""}</div></div>`).join("")}</div></div>` : "";
  const adds = P.adds.length ? `<div class="sec"><h3>Para subir a bracket ${t}: considera agregar</h3><p class="lede">Ordenadas por lo que más se juega con tu comandante (si cargaste EDHREC).</p>${P.adds.map(a=>`<div class="rec"><span>${cardName(a.n)} ${a.owned?`<span class="pill good">tienes</span>`:""}<br><span class="muted" style="font-size:.88rem">${esc(a.why)}</span></span><span class="meta">${money(a.pr)}</span></div>`).join("")}</div>` : "";
  const cedh = P.cedh ? `<div class="sec"><h3>Referencia cEDH</h3>
    ${P.cedh.row?`<p>Tu comandante está en el meta cEDH: <b>#${P.cedh.pos+1}</b> con ${P.cedh.row[1]!=null?Number(P.cedh.row[1]).toFixed(2)+"%":"—"} del meta${P.cedh.row[2]?` y ${P.cedh.row[2]} mazos en torneos`:""}.</p>`:`<p class="muted">Tu comandante no aparece entre los 25 más jugados de EDHTop16 en los últimos 3 meses.</p>`}
    <div class="tbl-wrap"><table><thead><tr><th>Indicador</th><th class="n">Tu mazo</th><th class="n">Meta cEDH</th><th></th></tr></thead><tbody>${P.cedh.bench.map(b=>`<tr><td>${esc(b.k)}</td><td class="n">${esc(b.v)}</td><td class="n">${esc(b.goal)}</td><td><span class="pill ${b.ok?"good":"warn"}">${b.ok?"ok":"por debajo"}</span></td></tr>`).join("")}</tbody></table></div>
    <div class="row" style="margin-top:12px"><button class="btn sm" data-act="cedh-staples" ${S.busy?"disabled":""}>${d.cedhStaples?"Actualizar":"Traer"} cartas de torneo de tu comandante (EDHTop16)</button></div>
    ${d.cedhStaples?`<p class="lede" style="margin-top:10px">Lo que juegan los mazos de torneo de tu comandante (${new Date(d.cedhStaples.at).toLocaleDateString("es-CL")}). En verde, lo que te falta en el mazo.</p><div class="tiers"><div>${d.cedhStaples.list.map(n=>{ const inD=[...A.rows, ...A.cmdMeta.filter(Boolean).map(m=>({n:m.n}))].some(r=>slug(r.n)===slug(n)); return `<div class="rec"><span>${inD?"":`<span class="up">+ </span>`}${cardName(n)} ${inD?`<span class="tag">en tu mazo</span>`:ownedOf(n)>0?`<span class="pill good">tienes</span>`:""}</span><span class="meta">${money(refPrice(cardOf(n)))}</span></div>`; }).join("")}</div></div>`:""}
    <p class="foot"><a href="https://edhtop16.com/commander/${encodeURIComponent((d.commanders||[]).join(" / "))}" target="_blank" rel="noopener">Ver tu comandante en EDHTop16</a> · <a href="${META.cedh.url}" target="_blank" rel="noopener">Meta completo</a></p></div>` : "";
  const needGC = P.needGC && t>=3 ? `<div class="banner"><span>Para sugerir Game Changers necesito sus datos.</span><button class="btn sm primary" data-act="load-gc">Traer Game Changers</button></div>` : "";
  return `<div class="sec"><h3>Optimizar por bracket</h3><p class="lede">Elige el bracket en que quieres jugar. Te digo qué cumple tu lista, qué sacar y qué agregar según las reglas oficiales (actualización del 9 de febrero de 2026).</p>${pick}</div>
    <div class="banner info"><span><b>Bracket ${t} · ${esc(P.R.name)}.</b> ${esc(P.R.text)}</span></div>
    <div class="sec"><h3>Cumplimiento</h3><ul class="checks">${chk}</ul>${d.combos?"":`<p class="foot"><button class="btn sm ghost" style="padding:0" data-act="combos">Buscar combos</button> para revisar combos de 2 cartas.</p>`}</div>
    ${needGC}${cuts}${adds}${cedh}`;
}
function improveHTML(d,A){
  const E = edhOf(d);
  const budgets=[["own","Solo mi colección"],["2","Hasta 2"],["10","Hasta 10"],["inf","Sin límite"]];
  const sym = cur()==="eur"?"€":"US$";
  const head = `<div class="sec"><h3>Mejorar el mazo</h3><p class="lede">Compara tu lista con lo que juegan los mazos de este comandante en EDHREC. Propone cambios que respetan tu identidad de color y tu presupuesto por carta, y prioriza lo que ya tienes.</p>
    <div class="row">${isWebView()?`<a class="btn primary" href="${EDH_CMD(d)}" target="_blank" rel="noopener">Ver ${esc((d.commanders||[]).join(" + ")||"el comandante")} en EDHREC</a><span class="foot">En la versión web EDHREC se abre en su página; para traer sus recomendaciones aquí usa el archivo descargado.</span>`:`<button class="btn ${E?"":"primary"}" data-act="edhrec" ${S.busy?"disabled":""}>${E?"Actualizar datos de EDHREC":"Cargar datos de EDHREC"}</button>`}
    ${E?`<span class="foot">Datos de ${new Date(E.at).toLocaleDateString("es-CL")}${E.decks?` · ${Number(E.decks).toLocaleString("es-CL")} mazos analizados`:""} · <a href="https://edhrec.com/commanders/${esc(E.slug)}" target="_blank" rel="noopener">ver en EDHREC</a></span>`:""}</div></div>`;
  if (!E) return head + promptBlock();
  const inDeck = new Set([...A.rows.map(r=>slug(r.n)), ...(d.commanders||[]).map(slug)]);
  const cand = E.pool.filter(p=>!inDeck.has(slug(p.n))).map(p=>({...p, m:cardOf(p.n)})).filter(p=>p.m && p.m.t!=="Land" && !(A.ci && (p.m.ci||"").split("").some(c=>WUBRG.includes(c)&&!A.ci.includes(c)))).sort((a,b)=>(b.incl||0)-(a.incl||0));
  const tier = (lo,hi) => cand.filter(p=>{ const pr=refPrice(p.m); return pr!=null && pr>lo && pr<=hi; }).slice(0,12);
  const recRow = p => `<div class="rec"><span>${cardName(p.m.n,p.m)} ${ownedOf(p.n)>0?`<span class="pill good">tienes</span>`:""}</span><span class="meta">${p.incl!=null?Math.round(p.incl*100)+"%":""} · ${money(refPrice(p.m))}</span></div>`;
  const swaps = optimizeLocal(d,A,E,S.optBudget);
  const inYours = cand.filter(p=>ownedOf(p.n)>0).slice(0,24);
  return head + `<div class="sec"><h3>Optimizador</h3><p class="lede">Cambia las cartas menos jugadas con tu comandante por las más jugadas que caben en tu presupuesto. Protege los roles donde te faltan cartas.</p>
    <div class="field" style="margin-bottom:10px"><label>Presupuesto por carta nueva (${sym})</label><div class="chips">${budgets.map(([k,l])=>`<button class="chip" data-budget="${k}" aria-pressed="${S.optBudget===k}">${l}</button>`).join("")}</div></div>
    <div class="swaps">${swaps.map(s=>`<div class="swap"><div><div class="mv"><span class="out">${esc(s.sale)}</span><span aria-hidden="true">→</span><span class="in">${cardName(s.entra)}</span>${s.owned?`<span class="pill good">en tu colección</span>`:`<span class="pill neutral">${money(s.pr)}</span>`}</div><div class="why">${esc(s.why)}</div></div><div><button class="btn sm primary" data-swap-out="${esc(s.sale)}" data-swap-in="${esc(s.entra)}">Aplicar</button></div></div>`).join("")||`<p class="muted" style="padding:12px 0">Tu lista ya coincide con lo más jugado en este presupuesto.</p>`}</div></div>
  <div class="sec"><h3>Subir de nivel por precio</h3><p class="lede">Las cartas más jugadas con tu comandante que no están en la lista, separadas por precio por carta. El % es cuántos mazos de este comandante la usan.</p>
    <div class="tiers"><div class="tier"><h4>Baratas · hasta ${sym}2</h4><p>Lo que más rinde por casi nada.</p>${tier(-1,2).map(recRow).join("")||`<p class="muted">Sin datos de precio.</p>`}</div>
    <div class="tier"><h4>El salto · ${sym}2 a ${sym}10</h4><p>Piezas sensatas que ya no son tan baratas.</p>${tier(2,10).map(recRow).join("")||`<p class="muted">Nada en este rango.</p>`}</div>
    <div class="tier"><h4>Sin tope · más de ${sym}10</h4><p>Lo que un tope de precio te escondía.</p>${tier(10,Infinity).map(recRow).join("")||`<p class="muted">Nada en este rango.</p>`}</div></div></div>
  <div class="sec"><h3>Recomendadas que ya tienes · ${inYours.length}</h3>${inYours.length?`<div class="tiers"><div>${inYours.slice(0,12).map(recRow).join("")}</div>${inYours.length>12?`<div>${inYours.slice(12).map(recRow).join("")}</div>`:""}</div>`:`<p class="muted">Ninguna por ahora.</p>`}</div>
  ${E.themes.length?`<div class="sec"><h3>Temas de este comandante</h3><div class="chips">${E.themes.map(t=>`<a class="pill neutral" style="font-size:.9rem;text-decoration:none" target="_blank" rel="noopener" href="https://edhrec.com/commanders/${esc(E.slug)}/${esc(t.s||"")}">${esc(t.v)}${t.c?` · ${t.c}`:""}</a>`).join("")}</div></div>`:""}
  ${promptBlock()}`;
}
function promptBlock(){ return `<div class="sec"><h3>Análisis con Claude</h3><p class="lede">Copia un resumen del mazo con tu colección y pégalo en Claude para una revisión estratégica más profunda.</p><button class="btn" data-act="prompt">Copiar resumen para Claude</button></div>`; }
function deckMetaHTML(d,A){
  const ms = metaMatch(A);
  const best = ms[0];
  const mine = new Map(); for (const r of [...A.rows,...A.side]) mine.set(slug(r.n),(mine.get(slug(r.n))||0)+r.q);
  const missFrom = a => [...a.main, ...a.side].filter(c=>!BASICS.has(slug(c.n)) && (mine.get(slug(c.n))||0)<c.q);
  return `<div class="sec"><h3>Contra el meta de ${FORMATS[A.fmt].name}</h3><p class="lede">Comparado con una lista reciente de cada arquetipo principal (${esc(META[A.fmt].src)}, foto del ${META_AT}).</p>
    ${ms.map(({a,score})=>`<div class="arch"><div><div class="an">${esc(a.name)} <span class="muted num" style="font-weight:400">${a.share}% del meta</span></div><div class="as">Coincide ${Math.round(score*100)}% con tu main · <a href="${a.arch}" target="_blank" rel="noopener">MTGTop8</a></div></div><div class="meter" style="width:120px"><span class="fill ${score>0.6?"good":score>0.3?"warn":""}" style="width:${score*100}%"></span></div></div>`).join("")}</div>
  ${best && best.score>0.15 ? `<div class="sec"><h3>Para acercarte a ${esc(best.a.name)}</h3><p class="lede">Cartas de la lista de referencia (main y sideboard) que no tienes en el mazo, con precio y si están en tu colección.</p>
    ${missFrom(best.a).map(c=>{ const m=cardOf(c.n); const have=mine.get(slug(c.n))||0; return `<div class="rec"><span>${c.q-have}× ${cardName(c.n,m)} ${c.side?`<span class="tag">side</span>`:""} ${ownedOf(c.n)>=c.q?`<span class="pill good">tienes</span>`:""}</span><span class="meta">${money(refPrice(m))}</span></div>`; }).join("") || `<p class="muted">Tu lista ya tiene todas sus cartas.</p>`}
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="fetch-meta" data-arch="${esc(best.a.name)}">Traer precios de estas cartas</button><a class="btn sm ghost" href="${best.a.deck}" target="_blank" rel="noopener">Ver la lista original</a></div></div>` : ""}
  ${A.fmt==="pauper"?pauperDeckMuHTML(d,A):""}
  ${sideGuideHTML(A)}
  ${promptBlock()}`;
}
function sideGuideHTML(A){
  if (!A.side.length) return `<div class="sec"><h3>Guía de sideboard</h3><p class="muted">Agrega un sideboard a la lista (sección “Sideboard”) para armar la guía contra cada arquetipo.</p></div>`;
  const noData = A.side.some(r=>r.m && !r.m.sb);
  const rows = metaDecks(A.fmt).map(a=>({a, g:sideGuide(A,a)})).filter(x=>x.g);
  const PLAN = {aggro:"agresivo", control:"control", combo:"combo"};
  return `<div class="sec"><h3>Guía de sideboard</h3><p class="lede">Qué entra y qué sale de tu main contra cada arquetipo del meta, según lo que hace cada carta de tu sideboard (anti-artefactos, anti-cementerio, blasts, ganar vida, contrahechizos…). Es un punto de partida: ajústalo con tu experiencia.</p>
    ${noData?`<div class="banner"><span>Algunas cartas se guardaron antes de esta versión y no traen su función de sideboard.</span><button class="btn sm primary" data-act="refetch-deck">Volver a traer datos</button></div>`:""}
    <div class="tbl-wrap"><table><thead><tr><th>Contra</th><th>Entran</th><th>Salen</th></tr></thead><tbody>
    ${rows.map(({a,g})=>`<tr><td style="min-width:130px"><b>${esc(a.name)}</b><br><span class="muted" style="font-size:.85rem">${PLAN[g.info.plan]} · ${a.share}%</span></td>
      <td style="min-width:200px">${g.ins.length?g.ins.map(x=>`<div><span class="up">+${x.q}</span> ${cardName(x.n)} <span class="muted" style="font-size:.8rem">${esc(x.why)}</span></div>`).join(""):`<span class="muted">Nada específico en tu sideboard.</span>`}</td>
      <td style="min-width:170px">${g.outs.map(x=>`<div><span class="down">−${x.q}</span> ${cardName(x.n)}</div>`).join("")}${g.short>0?`<div class="muted" style="font-size:.8rem">Elige ${g.short} más a criterio.</div>`:""}</td></tr>`).join("")}</tbody></table></div></div>`;
}
function priceHTML(d,A){
  const rows = [...A.rows, ...A.side, ...A.cmdMeta.filter(Boolean).map(m=>({n:m.n,q:1,m}))].filter(r=>r.m&&!r.m.basic).map(r=>({...r, p:refPrice(r.m)})).sort((a,b)=>(b.p||0)*b.q-(a.p||0)*a.q);
  const noPrice = rows.filter(r=>r.p==null).length;
  return `<div class="stats">
    <div class="stat"><div class="k">valor del mazo</div><div class="v" style="font-size:1.2rem">${money(A.price,{clp:true})}</div></div>
    <div class="stat ${A.missingCost==null||A.missingCost>0?"warn":"good"}"><div class="k">para completarlo</div><div class="v" style="font-size:1.2rem">${money(A.missingCost,{clp:true})}</div></div>
    <div class="stat"><div class="k">cartas de 1 o menos</div><div class="v">${rows.filter(r=>r.p!=null&&r.p<=1).length}</div></div>
    <div class="stat ${noPrice?"warn":""}"><div class="k">sin precio</div><div class="v">${noPrice}</div></div></div>
  <div class="two">
    <div class="sec"><h3>Las más caras</h3><div class="tbl-wrap"><table><tbody>${rows.slice(0,15).map(r=>{ const fc=forecast(r.n); return `<tr><td>${cardName(r.n,r.m)} ${ownedOf(r.n)>=r.q?`<span class="own y">tengo</span>`:""}</td><td>${fc?`<span class="fc ${fc.label}">${FC_ES[fc.label]}</span>`:""}</td><td class="n">${money(r.p)}</td></tr>`; }).join("")}</tbody></table></div></div>
    <div class="sec"><h3>Lo que te falta comprar</h3>${A.missingCards.length?`<div class="tbl-wrap"><table><tbody>${[...A.missingCards].sort((a,b)=>(refPrice(b.m)||0)-(refPrice(a.m)||0)).slice(0,30).map(m=>`<tr><td>${m.q>1?m.q+"× ":""}${cardName(m.n,m.m)}</td><td class="n">${money((refPrice(m.m)||0)*m.q)}</td></tr>`).join("")}</tbody></table></div><div class="row" style="margin-top:10px"><button class="btn sm" data-act="copymiss">Copiar lista de compras</button><button class="btn sm" data-act="wish-missing">Agregar a búsqueda</button></div>`:`<p class="muted">Tienes todas las cartas.</p>`}</div>
  </div>
  <p class="foot">Precio de referencia de Scryfall (${cur()==="eur"?"Cardmarket, €":"TCGplayer, US$"}), actualizado una vez al día. Se usa la versión más barata en inglés cuando ya se buscó. <button class="btn sm ghost" style="padding:0" data-act="cheapest">Buscar la versión más barata de cada carta</button> · <button class="btn sm ghost" style="padding:0" data-act="refresh-deck">Actualizar precios</button></p>`;
}
function mbDeckHTML(d,A){
  const linked = d.mb;
  const bd = linked ? boardDiff(mbBase(linked), boardsOf(d)) : null;
  const pv = S.deckMbPreview && S.deckMbPreview.id===d.id ? S.deckMbPreview : null;
  const BL = {main:"Deck", side:"Sideboard (banquillo)", maybe:"Maybeboard (cartas probables)"};
  const lines = df => `${df.add.map(x=>`<span class="a">+ ${x.q} ${esc(x.n)}</span>`).join("")}${df.rem.map(x=>`<span class="r">− ${x.q} ${esc(x.n)}</span>`).join("")}`;
  const boardsHTML = (b, cmd) => { const parts = []; if (cmd && (cmd.add.length||cmd.rem.length)) parts.push(`<div><div class="sc" style="font-size:.9rem">comandante</div><div class="diff">${lines(cmd)}</div></div>`);
    for (const k of ["main","side","maybe"]){ const x=b[k]; if (!x.add.length && !x.rem.length) continue; parts.push(`<div><div class="sc" style="font-size:.9rem">${BL[k].toLowerCase()}</div><div class="diff">${lines(x)}</div></div>`); }
    return parts.length ? `<div style="display:grid;gap:10px">${parts.join("")}</div>` : `<p class="muted" style="margin:0">Sin diferencias.</p>`; };
  const logBoards = e => { const g={main:{add:[],rem:[]}, side:{add:[],rem:[]}, maybe:{add:[],rem:[]}, cmd:{add:[],rem:[]}}; for (const x of e.add||[]) g[x.cmd?"cmd":x.side?"side":x.maybe?"maybe":"main"].add.push(x); for (const x of e.rem||[]) g[x.cmd?"cmd":x.side?"side":x.maybe?"maybe":"main"].rem.push(x); return boardsHTML(g, g.cmd); };
  const log = (d.log||[]).map(e=>`<div class="log-e"><div class="h">${new Date(e.at).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"})} · ${esc({manual:"edición manual",optimizador:"optimizador",bracket:"plan de bracket",manabox:"importado de ManaBox",meta:"meta"}[e.src]||e.src)}</div>${logBoards(e)}</div>`).join("");
  return `<div class="sec"><h3>Vínculo con ManaBox</h3><p class="lede">ManaBox no tiene una conexión pública, así que el vínculo funciona con sus exportaciones. Exporta el mazo en ManaBox (Compartir → Texto o CSV) y pégalo aquí: la Bóveda compara main, sideboard y maybeboard por separado, te muestra los cambios y registra el historial.</p>
    ${linked?`<p class="foot">Vinculado desde el ${new Date(linked.at).toLocaleDateString("es-CL")}. Última sincronización: ${new Date(linked.sync||linked.at).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"})}.</p>`:""}
    <div class="field"><label for="mb-deck-text">Exportación de ManaBox</label><textarea id="mb-deck-text" style="min-height:140px" spellcheck="false" placeholder="Pega aquí el texto o CSV exportado desde ManaBox (con sus secciones Sideboard y Maybeboard)"></textarea></div>
    <div class="row"><button class="btn sm primary" data-act="mb-deck-compare">Comparar con esta lista</button><label class="btn sm ghost" for="mb-deck-file" style="cursor:pointer">Abrir archivo…</label><input type="file" id="mb-deck-file" accept=".csv,.txt,text/csv,text/plain" hidden></div>
    ${pv?`<div class="card-box"><h3>Cambios que trae ManaBox</h3>${boardsHTML(pv.bd, pv.cmd)}<div class="row"><button class="btn sm primary" data-act="mb-deck-apply">Aplicar al mazo</button><button class="btn sm ghost" data-act="mb-deck-cancel">Cancelar</button></div></div>`:""}
  </div>
  ${linked?`<div class="sec"><h3>Cambios pendientes de pasar a ManaBox</h3><p class="lede">Lo que modificaste aquí desde la última sincronización, separado por main, sideboard y maybeboard.</p>${boardsHTML(bd)}
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="mb-copy-changes" ${bd.n?"":"disabled"}>Copiar cambios</button><button class="btn sm" data-act="copylist">Copiar lista completa para importar</button><button class="btn sm ghost" data-act="mb-mark-synced" ${bd.n?"":"disabled"}>Marcar como sincronizado</button></div>
    <p class="foot">En ManaBox: abre el mazo → menú → Importar, pega la lista completa y elige reemplazar. La lista trae las secciones Sideboard y Maybeboard para que cada carta vuelva a su lugar.</p></div>`
  :`<div class="sec"><p class="muted">Aún no vinculas este mazo. <button class="btn sm" data-act="mb-link-now">Vincular con la lista actual</button> para empezar a registrar cambios pendientes.</p></div>`}
  <div class="sec"><h3>Historial de cambios</h3>${log?`<div class="log">${log}</div>`:`<p class="muted">Sin cambios registrados todavía.</p>`}</div>`;
}
function editorHTML(e){
  const isNew = !e.id; const isC = e.format==="commander";
  return `<div class="pane"><div class="pane-head"><h2>${isNew?`Nuevo mazo de ${FORMATS[e.format].name}`:"Editar “"+esc(e.name)+"”"}</h2></div>
  <form class="form" id="deck-form">
    ${linkBoxHTML("ed")}
    <div class="field"><label for="f-name">Nombre</label><input type="text" id="f-name" required value="${esc(e.name)}" placeholder="${isC?"Ej.: Tokens de Selesnya":"Ej.: Burn de Pauper"}"></div>
    ${isC?`<div class="field"><label for="f-cmd">Comandante(s)</label><input type="text" id="f-cmd" value="${esc((e.commanders||[]).join(" + "))}" placeholder="Se detecta solo si la lista lo marca; para dos, sepáralos con +"></div>`:""}
    <div class="field board-field board-main"><label for="f-list">${isC?"Deck (99 cartas + comandante)":"Deck · main (60 cartas)"}</label><textarea id="f-list" spellcheck="false" placeholder="${isC?"1 Sol Ring&#10;1 Cultivate&#10;32 Forest":"4 Lightning Bolt&#10;20 Mountain"}">${esc(e.text)}</textarea>
      <span class="hint">Acepta exportaciones de ManaBox (texto o CSV), Moxfield, Archidekt, MTGGoldfish y MTG Arena. Si pegas la exportación completa, las secciones “Sideboard/Banquillo” y “Maybeboard/Cartas probables” se pasan solas a sus cuadros.</span></div>
    <div class="board-fields">
      <div class="field board-field board-side"><label for="f-side">Sideboard (banquillo)${isC?" · opcional, no cuenta para las 100":" · hasta 15"}</label><textarea id="f-side" spellcheck="false" style="min-height:150px" placeholder="3 Pyroblast&#10;2 Relic of Progenitus">${esc(e.side||"")}</textarea></div>
      <div class="field board-field board-maybe"><label for="f-maybe">Maybeboard (cartas probables)</label><textarea id="f-maybe" spellcheck="false" style="min-height:150px" placeholder="1 Cyclonic Rift&#10;1 Rhystic Study">${esc(e.maybe||"")}</textarea></div>
    </div>
    <div class="pv" id="f-preview" aria-live="polite"></div>
    ${isNew&&isC?builderBlockHTML():""}
    ${isNew?`<label class="row" style="gap:8px"><input type="checkbox" id="f-mb" checked> Vincular con ManaBox (registra los cambios que hagas desde ahora)</label>`:""}
    <div class="row"><button class="btn primary" type="submit">${isNew?"Crear mazo":"Guardar cambios"}</button><button class="btn ghost" type="button" data-act="cancel">Cancelar</button></div>
  </form></div>`;
}

/* ---------- meta ---------- */
function metaHTML(fmt){
  const M = META[fmt];
  const arr = metaDecks(fmt).map(a=>({a, cov:metaCoverage(a)}));
  return `<div class="pane"><div class="pane-head"><div><h2>Meta de ${FORMATS[fmt].name}</h2><div class="sub">${esc(M.src)} · foto del ${META_AT}</div></div>
    <div class="actions"><a class="btn sm" href="${M.url}" target="_blank" rel="noopener">MTGTop8</a><a class="btn sm" href="${M.mtgdecks}" target="_blank" rel="noopener">MTGDecks</a></div></div>
    <div class="pane-body">
      <p class="muted" style="margin:0">Cada arquetipo con su parte del meta, una lista reciente de referencia y cuánto de ella ya tienes en tu colección. Úsalo para ver qué mazo competitivo te queda más cerca.</p>
      ${arr.some(x=>x.cov.miss.some(m=>m.p==null))?`<div class="banner"><span>Faltan precios de cartas del meta.</span><button class="btn sm primary" data-act="fetch-meta-all">Traer precios</button></div>`:""}
      <div>${arr.map(({a,cov})=>`<div class="arch"><div><div class="an">${esc(a.name)} <span class="muted num" style="font-weight:400">${a.share}%</span></div>
        <div class="as">${esc(a.sample)} · tienes ${Math.round(cov.p*100)}% · te falta ${money(cov.cost)}</div>
        <div class="meter" style="margin-top:6px;max-width:320px"><span class="fill ${cov.p===1?"good":cov.p>0.6?"warn":"bad"}" style="width:${cov.p*100}%"></span></div></div>
        <div class="row"><button class="btn sm" data-act="meta-create" data-arch="${esc(a.name)}">Crear mazo</button><a class="btn sm ghost" href="${a.arch}" target="_blank" rel="noopener">Listas</a></div></div>`).join("")}</div>
      ${fmt==="pauper"?pauperMatrixHTML():""}
      <p class="foot">Los porcentajes y listas vienen de MTGTop8. Para el meta de hoy, abre los enlaces: esta foto no se actualiza sola porque MTGTop8 y MTGDecks no permiten conectarse desde otra página.</p>
    </div></div>`;
}
function cedhMetaHTML(){
  const live = S.cedhLive; const top = live ? live.top : META.cedh.top;
  const mineCmd = new Set(S.data.decks.filter(d=>d.format==="commander").flatMap(d=>d.commanders||[]).map(n=>n.toLowerCase()));
  const isMine = name => String(name).toLowerCase().split(" / ").some(p=>[...mineCmd].some(m=>p.includes(m.split(" // ")[0])));
  return `<div class="pane"><div class="pane-head"><div><h2>Meta cEDH y brackets</h2><div class="sub">${live?`EDHTop16 en vivo · ${new Date(live.at).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"})}`:`${esc(META.cedh.src)} · foto del ${META_AT}`}</div></div>
    <div class="actions"><button class="btn sm" data-act="cedh-live">Actualizar desde EDHTop16</button><a class="btn sm ghost" href="${META.cedh.url}" target="_blank" rel="noopener">EDHTop16</a></div></div>
    <div class="pane-body">
      <div class="sec"><h3>Los 5 brackets</h3><div class="tbl-wrap"><table><thead><tr><th>Bracket</th><th>Game Changers</th><th>Combos de 2 cartas</th><th>Turnos extra</th><th>Destrucción de tierras</th></tr></thead><tbody>
        ${BRACKETS.slice(1).map(b=>`<tr><td><b>${b.n}</b> · ${b.name}</td><td>${b.gc===0?"no":b.gc<99?"hasta "+b.gc:"sin límite"}</td><td>${b.combo2?"sí":"no"}</td><td>${b.xt===0?"no":b.xt<99?"sin encadenar":"sí"}</td><td>${b.mld?"sí":"no"}</td></tr>`).join("")}</tbody></table></div>
        <p class="foot">Guía oficial de Wizards, actualización del 9 de febrero de 2026. En cada mazo, la pestaña “Brackets” te dice qué sacar o agregar para llegar al nivel que elijas.</p></div>
      <div class="sec"><h3>Comandantes más jugados en torneos cEDH</h3><div class="tbl-wrap"><table><thead><tr><th>#</th><th>Comandante</th><th class="n">% del meta</th><th class="n">Mazos</th>${live?`<th class="n">Conversión</th>`:""}</tr></thead><tbody>
        ${top.map((t,i)=>`<tr><td class="num">${i+1}</td><td>${esc(t[0])} ${isMine(t[0])?`<span class="pill good">tienes un mazo</span>`:""}</td><td class="n">${t[1]!=null?Number(t[1]).toFixed(2)+"%":"—"}</td><td class="n">${t[2]??"—"}</td>${live?`<td class="n">${t[3]!=null?Number(t[3]).toFixed(1)+"%":"—"}</td>`:""}</tr>`).join("")}</tbody></table></div></div>
      <div class="sec"><h3>Piezas habituales de cEDH por color</h3><p class="lede">Referencia para el bracket 5. Mana Crypt, Jeweled Lotus, Dockside Extortionist y Nadu están prohibidas desde septiembre de 2024.</p>
        <div class="tiers">${Object.entries(CEDH_STAPLES).map(([c,l])=>`<div class="tier"><h4><span class="row" style="gap:6px"><i class="pip p-${c}"></i>${c==="C"?"Incoloras":COLOR_ES[c]}</span></h4>${l.map(n=>`<div class="rec"><span>${cardName(n)}</span><span class="meta">${ownedOf(n)>0?`<span class="own y">tengo</span>`:money(refPrice(cardOf(n)))}</span></div>`).join("")}</div>`).join("")}</div>
        <div class="row" style="margin-top:10px"><button class="btn sm" data-act="fetch-staples">Traer precios de estas cartas</button></div></div>
    </div></div>`;
}

/* ---------- colección ---------- */
function collHTML(){
  const idx = collIndex(); const used = usedMap();
  const items = [...(S.data.collection.items||[])].sort((a,b)=>a.n.localeCompare(b.n) || (a.set||"").localeCompare(b.set||""));
  const total = items.reduce((a,i)=>a+i.q,0);
  let value=0, paid=0; for (const i of items){ const p=itemPrice(i); if(p!=null) value+=p*i.q; if (i.pp!=null) paid+=i.pp*i.q; }
  const q = S.collQ.trim().toLowerCase();
  let view = items.filter(i=>!q || i.n.toLowerCase().includes(q) || (i.set||"").toLowerCase()===q);
  if (S.collAvail){ const freeBy=new Map(); for (const [k,g] of idx){ const need=(used.get(k)||[]).reduce((a,u)=>Math.max(a,u.q),0); freeBy.set(k, g.q-need); } view = view.filter(i=>(freeBy.get(slug(i.n))||0)>0); }
  const lim = S.collShow || 150; const shown = view.slice(0,lim);
  const posOf = new Map(S.data.collection.items.map((it,j)=>[it,j]));
  const fmtCov = f => S.data.decks.filter(d=>d.format===f && !d.rival).map(d=>{ const A=analyze(d); return {d, p:A.needCount?A.ownedCount/A.needCount:1, miss:A.missingCards.reduce((a,m)=>a+m.q,0), cost:A.missingCost}; });
  const cov = ["commander","pauper","pioneer"].flatMap(f=>fmtCov(f).map(x=>({...x,f}))).sort((a,b)=>b.p-a.p);
  const pick = S.picked || (S.picked=new Set());
  const nPick = [...pick].filter(i=>S.data.collection.items.includes(i)).length;
  const allShownPicked = shown.length && shown.every(i=>pick.has(i));
  const rows = shown.map((i)=>{ const u=used.get(slug(i.n))||[]; const m=cardOf(i.n); const pr=itemPrice(i); const key=itemKey(i); const c7=change(key,7), c30=change(key,30); const idxI = posOf.get(i);
    return `<tr${pick.has(i)?' style="background:var(--accent-soft)"':""}><td><input type="checkbox" data-pick="${idxI}" ${pick.has(i)?"checked":""} aria-label="Seleccionar ${esc(i.n)}"></td><td><span class="qty"><button data-dq="${idxI}" data-d="-1" aria-label="Quitar una copia">−</button><span class="num" style="min-width:22px;text-align:center">${i.q}</span><button data-dq="${idxI}" data-d="1" aria-label="Agregar una copia">+</button></span></td>
      <td>${cardName(i.n,m)}${i.sell?` <span class="pill warn">vender</span>`:""}</td><td class="muted" style="font-size:.88rem;white-space:nowrap">${i.set?esc(i.set)+(i.num?" #"+esc(i.num):""):"—"}${i.foil?` <span class="tag">${esc(i.foil)}</span>`:""}${i.lang&&!/^(en|english)$/i.test(i.lang)?` <span class="tag">${esc(i.lang)}</span>`:""}</td>
      <td class="muted" style="font-size:.88rem">${u.map(x=>esc(x.d)).filter((v,j,a)=>a.indexOf(v)===j).join(", ")||"—"}</td>
      <td class="n">${money(pr)}</td><td class="n ${c7&&c7.pct>0?"up":c7&&c7.pct<0?"down":""}">${c7?pct(c7.pct):"—"}</td><td class="n ${c30&&c30.pct>0?"up":c30&&c30.pct<0?"down":""}">${c30?pct(c30.pct):"—"}</td></tr>`; }).join("");
  const missingData = items.filter(i=>!BASICS.has(slug(i.n)) && !S.cards[slug(i.n)] && !(pkOf(i)&&S.prints[pkOf(i)])).length;
  const mp = S.mbPreview;
  const lastSync = S.data.mbLog[0];
  return `<div class="coll-head"><div><h2>Mi colección</h2><div class="muted"><span class="num">${total.toLocaleString("es-CL")}</span> cartas · <span class="num">${idx.size.toLocaleString("es-CL")}</span> distintas · valor <span class="num">${money(value,{clp:true})}</span>${paid?` · pagaste ${money(paid)} (${pct(100*(value-paid)/paid)})`:""}</div></div></div>
  ${busyBanner()}
  ${missingData&&!S.busy?`<div class="banner" style="margin-bottom:16px"><span><b class="num">${missingData}</b> cartas sin precio ni datos.</span><button class="btn sm primary" data-act="coll-fetch">Actualizar cartas</button></div>`:""}
  <div class="coll-grid">
    <div class="pane" style="padding:16px;min-width:0">
      <div class="row" style="margin-bottom:12px"><input type="search" id="coll-q" placeholder="Buscar carta o código de set…" value="${esc(S.collQ)}" style="flex:1;min-width:180px"><button class="chip" id="coll-avail" aria-pressed="${S.collAvail}">Solo libres</button></div>
      ${nPick?`<div class="banner info" style="margin-bottom:10px"><b class="num">${nPick}</b> seleccionada${nPick>1?"s":""}
        <button class="btn sm" data-bulk="sell">Marcar para vender</button><button class="btn sm" data-bulk="unsell">Quitar marca</button>
        <select id="bulk-cond" aria-label="Cambiar condición" style="width:auto"><option value="">Cambiar condición…</option>${["near_mint","lightly_played","moderately_played","heavily_played","damaged"].map(c=>`<option value="${c}">${{near_mint:"Near Mint",lightly_played:"Lightly Played",moderately_played:"Moderately Played",heavily_played:"Heavily Played",damaged:"Damaged"}[c]}</option>`).join("")}</select>
        ${S.bulkDel?`<span>¿Eliminar de la colección?</span><button class="btn sm danger" data-bulk="del-ok">Sí, eliminar</button><button class="btn sm ghost" data-bulk="del-no">Cancelar</button>`:`<button class="btn sm danger" data-bulk="del">Eliminar</button>`}
        <button class="btn sm ghost" data-bulk="none">Deseleccionar</button></div>`:""}
      ${items.length?`<div class="tbl-wrap"><table><thead><tr><th><input type="checkbox" id="pick-all" ${allShownPicked?"checked":""} aria-label="Seleccionar todas las visibles"></th><th>Cant.</th><th>Carta</th><th>Versión</th><th>En mazos</th><th class="n">Precio</th><th class="n">7 días</th><th class="n">30 días</th></tr></thead><tbody>${rows}</tbody></table></div>${view.length>lim?`<div class="row" style="margin-top:10px"><button class="btn" data-act="coll-more">Mostrar ${Math.min(150, view.length-lim)} más</button><span class="foot">Mostrando ${lim} de ${view.length.toLocaleString("es-CL")}</span></div>`:""}`:`<div class="empty">Tu colección está vacía. Sincroniza con ManaBox o importa una lista a la derecha.</div>`}
      <p class="foot">El precio es el de tu versión exacta (set, número y acabado) cuando la conoces; si no, el de referencia. Los cambios de 7 y 30 días se calculan con el historial que la Bóveda guarda cada día que la abres.</p>
    </div>
    <div style="display:grid;gap:16px;align-content:start">
      <div class="side-card"><h3>Sincronizar con ManaBox</h3>
        <p class="muted" style="margin:0;font-size:.9rem">En ManaBox: Colección → menú ⋮ → Exportar → CSV. Pega o abre el archivo: verás qué cambió antes de aplicarlo. Conserva set, número, foil, idioma, condición y precio de compra.</p>
        ${lastSync?`<p class="foot" style="margin:0">Última sincronización: ${new Date(lastSync.at).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"})} · +${lastSync.a} −${lastSync.r} ~${lastSync.c}</p>`:""}
        <div class="field"><label for="coll-text">CSV de ManaBox u otra lista</label><textarea id="coll-text" style="min-height:130px" spellcheck="false" placeholder="Name,Set code,Collector number,Foil,Quantity,Scryfall ID…"></textarea><span class="hint">También acepta texto (“4 Lightning Bolt”) y CSV de Moxfield, Deckbox o Dragon Shield.</span></div>
        <div class="row"><button class="btn primary sm" data-act="mb-sync">Comparar y sincronizar</button><button class="btn sm" data-act="coll-add">Solo agregar</button><label class="btn sm ghost" for="coll-file" style="cursor:pointer">Abrir archivo…</label><input type="file" id="coll-file" accept=".csv,.txt,text/csv,text/plain" hidden></div>
        ${mp?`<div class="card-box"><h3 style="font-size:1.05rem">Cambios encontrados</h3><p style="margin:0">+${mp.diff.added.reduce((a,x)=>a+x.q,0)} nuevas · −${mp.diff.removed.reduce((a,x)=>a+x.q,0)} que ya no están · ${mp.diff.changed.length} con otra cantidad</p>
          <div class="diff" style="max-height:180px;overflow:auto">${mp.diff.added.slice(0,40).map(x=>`<span class="a">+ ${x.q} ${esc(x.n)}${x.set?` (${esc(x.set)})`:""}</span>`).join("")}${mp.diff.removed.slice(0,40).map(x=>`<span class="r">− ${x.q} ${esc(x.n)}${x.set?` (${esc(x.set)})`:""}</span>`).join("")}${mp.diff.changed.slice(0,40).map(x=>`<span>~ ${esc(x.n)}: ${x.from} → ${x.q}</span>`).join("")}</div>
          <div class="row"><button class="btn sm primary" data-act="mb-sync-ok">Aplicar sincronización</button><button class="btn sm ghost" data-act="mb-sync-no">Cancelar</button></div></div>`:""}
        <div class="row"><button class="btn sm ghost" data-act="coll-mb-csv">Exportar CSV para ManaBox</button><button class="btn sm ghost" data-act="coll-dl">Descargar .txt</button></div>
      </div>
      <div class="side-card"><h3>Cobertura por mazo</h3><p class="muted" style="margin:0;font-size:.92rem">Qué parte de cada lista ya tienes (sin básicas) y cuánto cuesta completarla.</p>
        <div class="cov">${cov.map(c=>`<div class="cov-row"><div class="top2"><button class="btn ghost sm" style="padding:0;text-align:left" data-open="${esc(c.d.id)}">${esc(c.d.name)} <span class="tag">${FORMATS[c.f].short}</span></button><span class="num">${Math.round(c.p*100)}%${c.miss?` <span class="muted">· ${money(c.cost)}</span>`:""}</span></div><div class="meter"><span class="fill ${c.p===1?"good":c.p>=0.85?"warn":"bad"}" style="width:${c.p*100}%"></span></div></div>`).join("")||`<p class="muted">Sin mazos todavía.</p>`}</div>
      </div>
    </div>
  </div>`;
}

/* ---------- mercado ---------- */
function marketHTML(){
  const tabs=[["alertas","Alertas"],["senales","Comprar y vender"],["busqueda","Lista de búsqueda"],["tendencias","Tendencias"],["fuentes","Fuentes"]];
  const body = {alertas:mkAlertsHTML, senales:mkSignalsHTML, busqueda:mkWishHTML, tendencias:mkTrendsHTML, fuentes:mkSourcesHTML}[S.marketTab]();
  const hasHist = Object.keys(S.hist).length;
  const days = hasHist ? Math.max(0,...Object.values(S.hist).map(h=>h.length?h[h.length-1][0]-h[0][0]:0)) : 0;
  return `<div class="fmt-head"><h2>Mercado</h2><span class="muted">${days?`${days} días de historial guardado`:"El historial empieza hoy: cada día que abras la Bóveda guarda los precios del día"}</span>
    <button class="btn sm" data-act="refresh-all" style="margin-left:auto" ${S.busy?"disabled":""}>Actualizar precios ahora</button></div>
    ${busyBanner()}
    <div class="pane"><div class="subtabs" role="tablist">${tabs.map(([k,l])=>`<button class="subtab" role="tab" data-mtab="${k}" aria-selected="${S.marketTab===k}">${l}</button>`).join("")}</div>
    <div class="pane-body">${body}
    <p class="disclaimer">Estas señales son orientativas: combinan tu historial de precios, la popularidad en EDHREC, el meta y la antigüedad de la impresión. No son asesoría financiera ni garantizan cómo se moverá un precio. Revisa el precio real en la tienda antes de comprar o vender.</p></div></div>`;
}
function mkAlertsHTML(){
  const al = alerts();
  const st=S.data.settings;
  return `<div class="sec"><h3>Alertas · ${al.length}</h3><p class="lede">Subidas de ${st.rise}% o más (y al menos ${money(st.minMove)}) en cartas de tu colección, bajadas de ${st.drop}% o más en tu lista de búsqueda y en cartas que te faltan para tus mazos, y precios objetivo alcanzados. Cambia los umbrales en Ajustes.</p>
    ${al.length?al.map(a=>`<div class="alert"><span class="ic ${a.kind==="up"?"up":a.kind==="down"?"down":"tg"}" aria-hidden="true">${a.kind==="up"?"↑":a.kind==="down"?"↓":"★"}</span><div><div class="t">${cardName(a.n)} ${a.kind==="up"?`<span class="up">${pct(a.ch.pct)}</span>`:a.kind==="down"?`<span class="down">${pct(a.ch.pct)}</span>`:""}</div><div class="s">${esc(a.s)}</div></div><button class="btn sm ghost" data-dismiss="${esc(a.id)}">Descartar</button></div>`).join("")
    :`<p class="muted">Sin alertas por ahora.${Object.keys(S.hist).length?"":" Las alertas aparecen cuando hay al menos dos días de precios guardados."}</p>`}</div>`;
}
function mkSignalsHTML(){
  const {sell, buy} = signals();
  const ckBtn = `<div class="row"><button class="btn sm" data-act="load-ck" ${S.busy?"disabled":""}>${S.ck?"Actualizar":"Cargar"} precios de compra de Card Kingdom</button>${S.ck?`<span class="foot">Card Kingdom del ${new Date(S.ck.at).toLocaleDateString("es-CL")}</span>`:`<span class="foot">Muestra cuánto te pagaría Card Kingdom (buylist). Es un archivo grande.</span>`}</div>`;
  return `${ckBtn}
  <div class="grid-2">
    <div class="sec"><h3>Para vender · ${sell.length}</h3><p class="lede">Copias que no usas en ningún mazo y valen desde ${money(S.data.settings.sellMin)}, versiones caras que podrías cambiar por una barata, y cartas que subieron.</p>
      ${sell.map(s=>`<div class="rec"><span>${s.q>1?s.q+"× ":""}${cardName(s.n)} ${s.it&&s.it.set?`<span class="tag">${esc(s.it.set)}${s.it.foil?" "+esc(s.it.foil):""}</span>`:""}<br><span class="muted" style="font-size:.88rem">${s.why.map(esc).join(" · ")}</span></span><span class="meta">${money(s.kind==="version"?s.val:s.val)}${s.kind==="version"?"<br>liberas":""}</span></div>`).join("")||`<p class="muted">Nada que sugerir. Sincroniza tu colección para ver oportunidades.</p>`}</div>
    <div class="sec"><h3>Para comprar · ${buy.length}</h3><p class="lede">De tu lista de búsqueda y de lo que te falta para tus mazos: precios bajo tu objetivo, bajadas recientes y mínimos de 30 días.</p>
      ${buy.map(b=>`<div class="rec"><span>${b.q>1?b.q+"× ":""}${cardName(b.n)}<br><span class="muted" style="font-size:.88rem">${b.why.map(esc).join(" · ")}</span></span><span class="meta">${money(b.pr)}${b.ck?`<br><a href="${esc(b.ck)}" target="_blank" rel="noopener">Card Kingdom</a>`:""}</span></div>`).join("")||`<p class="muted">Nada destacado hoy. Agrega cartas a tu lista de búsqueda con un precio objetivo.</p>`}</div>
  </div>`;
}
function mkWishHTML(){
  const w = S.data.wishlist;
  return `<div class="sec"><h3>Lista de búsqueda</h3><p class="lede">Cartas que quieres comprar. Pon un precio objetivo y te aviso cuando baje. Haz clic en el nombre para ver todas sus versiones: desde ahí puedes buscar una versión concreta (un set o foil) con su propio precio.</p>
    <form id="wish-form" class="row" style="align-items:flex-end"><div class="field" style="flex:2;min-width:180px"><label for="w-name">Carta</label><input type="text" id="w-name" placeholder="Nombre en inglés" required></div>
      <div class="field" style="flex:1;min-width:110px"><label for="w-target">Precio objetivo</label><input type="number" id="w-target" min="0" step="0.01" placeholder="Opcional"></div>
      <button class="btn primary" type="submit">Agregar</button></form></div>
    ${w.length?`<div class="tbl-wrap"><table><thead><tr><th>Carta</th><th class="n">Precio</th><th class="n">Objetivo</th><th class="n">7 días</th><th class="n">30 días</th><th>Señal</th><th></th></tr></thead><tbody>
      ${w.map((x,i)=>{ const m=cardOf(x.n); const pr=wishPrice(x); const key=wishKey(x); const c7=change(key,7), c30=change(key,30); const fc=forecast(x.n,key); const pv=x.pk&&S.prints[x.pk];
        return `<tr><td>${cardName(x.n,m)}<br><span class="muted" style="font-size:.82rem">${pv?`${esc(pv.sn)} (${esc(pv.set)} #${esc(pv.num)})${x.finish?" · "+esc(x.finish):""}`:(m&&m.minP?`cualquier versión · la más barata: ${esc(m.minP.set)} #${esc(m.minP.num)}`:"cualquier versión")}</span></td><td class="n">${money(pr)}</td><td class="n"><input type="number" min="0" step="0.01" data-wtarget="${i}" value="${x.target??""}" style="width:90px;text-align:right" aria-label="Precio objetivo de ${esc(x.n)}"></td>
          <td class="n ${c7&&c7.pct>0?"up":c7&&c7.pct<0?"down":""}">${c7?pct(c7.pct):"—"}</td><td class="n ${c30&&c30.pct>0?"up":c30&&c30.pct<0?"down":""}">${c30?pct(c30.pct):"—"}</td>
          <td>${fc?`<span class="fc ${fc.label}" title="${esc(fc.why.join(" · "))}">${FC_ES[fc.label]}</span>`:""}${pr!=null&&x.target!=null&&pr<=x.target?` <span class="pill good">¡objetivo!</span>`:""}</td>
          <td><button class="btn sm ghost danger" data-wdel="${i}" aria-label="Quitar ${esc(x.n)}">Quitar</button></td></tr>`; }).join("")}</tbody></table></div>`:`<p class="muted">Tu lista está vacía. También puedes agregar lo que te falta de un mazo desde su pestaña “Lista”.</p>`}`;
}
function mkTrendsHTML(){
  const seen=new Set(); const rows=[];
  for (const it of S.data.collection.items||[]){
    const k=slug(it.n); if (BASICS.has(k) || seen.has(k)) continue; seen.add(k);
    const key=itemKey(it); const fc=forecast(it.n, key); if (!fc) continue;
    const pr=itemPrice(it); if (pr==null || pr<1) continue;
    rows.push({it, fc, pr, g:collIndex().get(k)});
  }
  rows.sort((a,b)=>Math.abs(b.fc.s)-Math.abs(a.fc.s) || b.pr-a.pr);
  return `<div class="sec"><h3>Tendencias de tu colección</h3><p class="lede">Cartas de 1 o más, ordenadas por la fuerza de la señal. Cada una explica por qué: historial de precios, popularidad en EDHREC, presencia en el meta, Lista reservada y antigüedad de la última impresión. Con menos de 3 semanas de historial, la confianza es baja.</p>
    ${rows.length?`<div class="tbl-wrap"><table><thead><tr><th>Carta</th><th class="n">Tienes</th><th class="n">Precio</th><th class="n">7 días</th><th class="n">30 días</th><th>Señal</th><th>Por qué</th></tr></thead><tbody>
    ${rows.slice(0,120).map(r=>`<tr><td>${cardName(r.it.n)}</td><td class="n">${r.g.q}</td><td class="n">${money(r.pr)}</td><td class="n ${r.fc.c7&&r.fc.c7.pct>0?"up":r.fc.c7&&r.fc.c7.pct<0?"down":""}">${r.fc.c7?pct(r.fc.c7.pct):"—"}</td><td class="n ${r.fc.c30&&r.fc.c30.pct>0?"up":r.fc.c30&&r.fc.c30.pct<0?"down":""}">${r.fc.c30?pct(r.fc.c30.pct):"—"}</td><td><span class="fc ${r.fc.label}">${FC_ES[r.fc.label]}</span><br><span class="muted" style="font-size:.78rem">confianza ${r.fc.conf}</span></td><td class="muted" style="font-size:.85rem;min-width:220px">${esc(r.fc.why.join(" · ")||"sin señales")}</td></tr>`).join("")}</tbody></table></div>`
    :`<p class="muted">Sincroniza tu colección y trae sus precios para ver tendencias.</p>`}</div>`;
}
function mkSourcesHTML(){
  const L = (u,t,d) => `<div class="rec"><span><a href="${u}" target="_blank" rel="noopener">${t}</a><br><span class="muted" style="font-size:.88rem">${d}</span></span></div>`;
  return `<div class="grid-2"><div class="sec"><h3>Conectadas a la Bóveda</h3>
    ${L("https://scryfall.com/docs/api","Scryfall","Datos de cartas, versiones, imágenes y precios diarios de TCGplayer (US$) y Cardmarket (€). Base del historial y las alertas.")}
    ${L("https://www.cardkingdom.com/","Card Kingdom","Precios de venta y de compra (buylist) por versión. Enlaces directos en cada versión.")}
    ${L("https://edhrec.com","EDHREC","Qué se juega con cada comandante: inclusión, sinergia y temas.")}
    ${L("https://commanderspellbook.com","Commander Spellbook","Combos de tu lista y los que te quedan a una carta.")}
    ${L("https://edhtop16.com","EDHTop16","Meta de torneos cEDH.")}
    ${L("https://www.manabox.app/guides/collection/import-export/","ManaBox","Tu colección y tus mazos, por exportación CSV o texto.")}</div>
  <div class="sec"><h3>Para consultar a mano</h3>
    ${L("https://www.mtgstocks.com/interests","MTGStocks · Interests","Las mayores subidas y bajadas del día y de la semana. Complementa las alertas de tu colección.")}
    ${L("https://www.mtgstocks.com/news","MTGStocks · Noticias","Artículos de finanzas de Magic, reimpresiones y spoilers que mueven precios.")}
    ${L("https://mtgtop8.com","MTGTop8","Resultados de torneos y meta por formato.")}
    ${L("https://mtgdecks.net","MTGDecks","Meta, listas y precios de mazos.")}
    <p class="foot">MTGStocks, MTGTop8 y MTGDecks no ofrecen una conexión abierta, por eso aparecen como enlaces y el meta es una foto del ${META_AT}.</p></div></div>`;
}

/* ---------- ficha de carta ---------- */
function renderModal(){
  const el=$("#modal");
  if (!S.modal){ el.hidden=true; el.innerHTML=""; return; }
  const n=S.modal.name; const m=cardOf(n); const v=S.versions[slug(n)];
  const lgs = m&&m.lg ? ["commander","pauper","pioneer"].map(f=>`<span class="pill ${m.lg[f]==="legal"?"good":m.lg[f]==="banned"?"bad":"neutral"}">${FORMATS[f].name}: ${m.lg[f]==="legal"?"legal":m.lg[f]==="banned"?"prohibida":"no legal"}</span>`).join("") : "";
  const key = (S.hist[histKey("m",slug(n))]&&cur()==="usd")?histKey("m",slug(n)):oracleKey(n);
  const fc = forecast(n, key);
  const e = cur()==="eur";
  const owned = (collIndex().get(slug(n))||{items:[]}).items;
  const inWish = S.data.wishlist.some(w=>slug(w.n)===slug(n));
  const verRows = v ? v.list.filter(p=>p.lang==="en"||owned.some(o=>o.sid===p.id)).slice(0,120).map(p=>{
    const vals = [["normal", e?p.eur:p.usd], ["foil", e?p.eurF:p.usdF], ["etched", e?p.eurE:p.usdE]].filter(x=>x[1]!=null);
    const wishedV = k => S.data.wishlist.some(w=>w.pk===p.id && (w.finish||"normal")===k);
    const mine = owned.filter(o=>o.sid===p.id || (o.set&&o.set.toLowerCase()===p.set.toLowerCase()&&String(o.num)===String(p.num)));
    const ck = S.ck && (S.ck.byId[p.id]||S.ck.byId[p.id+":f"]);
    const tags = [p.promo?"promo":"", p.full?"arte completo":"", p.bord==="borderless"?"sin borde":"", p.fx.includes("showcase")?"showcase":"", p.fx.includes("extendedart")?"arte extendido":"", p.fx.includes("etched")?"etched":""].filter(Boolean);
    return `<tr><td>${p.sm?`<img src="${esc(p.sm)}" alt="" loading="lazy" style="width:40px;border-radius:3px;vertical-align:middle">`:""}</td><td><b>${esc(p.sn)}</b><br><span class="muted" style="font-size:.85rem">${esc(p.set)} #${esc(p.num)} · ${esc(p.rar)} · ${esc((p.rel||"").slice(0,4))}${tags.length?" · "+tags.join(", "):""}</span>${mine.length?`<br><span class="pill good">tienes ${mine.reduce((a,o)=>a+o.q,0)}</span>`:""}</td>
      <td class="n">${vals.map(([k,x])=>`${k==="normal"?"":`<span class="muted">${k}</span> `}${money(x)} ${wishedV(k)?`<span class="tag">buscada</span>`:`<button class="btn sm ghost" style="padding:0 4px" data-wishv="${esc(p.id)}" data-fin="${k}" aria-label="Buscar ${esc(p.sn)} ${k}">＋</button>`}`).join("<br>")||"—"}</td>
      <td class="n">${ck?`${ck.r!=null?money(ck.r):"—"}${ck.b?`<br><span class="muted">compra ${money(ck.b)}</span>`:""}`:"—"}</td>
      <td>${p.ck?`<a href="${esc(p.ck)}" target="_blank" rel="noopener">Card Kingdom</a><br>`:""}${p.tcg?`<a href="${esc(p.tcg)}" target="_blank" rel="noopener">TCGplayer</a><br>`:""}${p.cm?`<a href="${esc(p.cm)}" target="_blank" rel="noopener">Cardmarket</a>`:""}</td></tr>`;
  }).join("") : "";
  el.hidden=false;
  el.innerHTML = `<div class="modal-bg" data-close="1"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(n)}">
    <div class="modal-top">${m&&m.img?`<img src="${esc(m.img)}" alt="${esc(n)}">`:`<div class="empty">Sin imagen</div>`}
      <div style="display:grid;gap:10px;align-content:start;min-width:0">
        <div class="row" style="justify-content:space-between;align-items:flex-start"><h2>${esc(m?m.n:n)}</h2><button class="btn sm ghost" data-close="1" aria-label="Cerrar">Cerrar ✕</button></div>
        <div class="muted">${m?esc(m.tl||""):""} ${m&&m.ci!=null?pipsHTML(m.ci):""}</div>
        <div class="legal">${lgs}${m&&m.gc?`<span class="pill warn">Game Changer</span>`:""}${m&&m.rsv?`<span class="pill neutral">Lista reservada</span>`:""}</div>
        <div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))"><div class="stat"><div class="k">referencia</div><div class="v" style="font-size:1.1rem">${money(m&&(e?m.eur:m.usd))}</div></div><div class="stat"><div class="k">más barata</div><div class="v" style="font-size:1.1rem">${money(m&&(e?m.minE:m.min))}</div></div><div class="stat"><div class="k">tienes</div><div class="v" style="font-size:1.1rem">${owned.reduce((a,o)=>a+o.q,0)}</div></div></div>
        ${m&&!m.basic&&m.t!=="Land"?`<div><div class="muted" style="font-size:.85rem;margin-bottom:4px">Funciones en tus análisis${m.rOv?" (editadas por ti)":""}:</div><div class="chips">${Object.keys(ROLE_ES).map(r=>`<button class="chip" data-role="${r}" aria-pressed="${(m.r||[]).includes(r)}" style="padding:2px 10px;font-size:.85rem">${ROLE_ES[r]}</button>`).join("")}${m.rOv?`<button class="btn sm ghost" data-act="role-reset">Restablecer</button>`:""}</div></div>`:""}
        ${fc?`<div><span class="fc ${fc.label}">${FC_ES[fc.label]}</span> <span class="muted" style="font-size:.85rem">confianza ${fc.conf}</span><p class="muted" style="margin:6px 0 0;font-size:.9rem">${esc(fc.why.join(" · ")||"Sin señales suficientes todavía.")}</p></div>`:""}
        ${sparkSVG(key)}
        <div class="row">${inWish?`<span class="pill good">En tu lista de búsqueda</span>`:`<input type="number" id="modal-target" min="0" step="0.01" placeholder="Precio objetivo" style="width:150px"><button class="btn sm primary" data-act="modal-wish">Agregar a búsqueda</button>`}
          ${m&&m.uri?`<a class="btn sm ghost" href="${esc(m.uri)}" target="_blank" rel="noopener">Scryfall</a>`:""}<a class="btn sm ghost" href="https://edhrec.com/cards/${esc(edhSlug(n))}" target="_blank" rel="noopener">EDHREC</a><a class="btn sm ghost" href="https://www.mtgstocks.com/interests" target="_blank" rel="noopener">MTGStocks</a></div>
      </div></div>
    ${isWebView()?webCardLinksHTML(n)+(m&&m.est?`<p class="foot" style="margin:0">Datos completados por Claude, sin precio. Revísalos en Scryfall si algo no calza.</p>`:""):""}
    <div class="sec"><h3>Versiones</h3><p class="lede">Todas las impresiones en papel, de la más nueva a la más antigua, con precio por acabado. Usa ＋ para buscar una versión concreta. ${S.ck?"Incluye precio y buylist de Card Kingdom.":"Carga Card Kingdom en Mercado → Comprar y vender para ver su buylist."}</p>
      ${v?`<div class="tbl-wrap"><table><thead><tr><th></th><th>Edición</th><th class="n">${e?"Cardmarket":"TCGplayer"}</th><th class="n">Card Kingdom</th><th>Comprar</th></tr></thead><tbody>${verRows}</tbody></table></div>`:`<p class="muted">${isWebView()?"En la versión web las versiones se ven en Scryfall (enlace de arriba).":S.modal.loading?"Buscando versiones en Scryfall…":"No se pudieron cargar las versiones."}</p>`}</div>
  </div></div>`;
}
function sparkSVG(key){
  const h=S.hist[key]; if (!h || h.length<2) return `<p class="foot" style="margin:0">El gráfico de precio aparece con al menos dos días de historial.</p>`;
  const W=420,H=90,p=8; const xs=h.map(x=>x[0]), ys=h.map(x=>x[1]); const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
  const X=v=>p+(W-2*p)*(x1===x0?1:(v-x0)/(x1-x0)), Y=v=>H-p-12-(H-2*p-12)*(y1===y0?0.5:(v-y0)/(y1-y0));
  const d=h.map((pt,i)=>`${i?"L":"M"}${X(pt[0]).toFixed(1)},${Y(pt[1]).toFixed(1)}`).join("");
  const last=h[h.length-1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Precio de ${money(ys[0])} a ${money(last[1])} en ${x1-x0} días"><path d="${d} L${X(x1)},${H-p-12} L${X(x0)},${H-p-12}Z" fill="var(--accent-soft)"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2"/><circle cx="${X(last[0])}" cy="${Y(last[1])}" r="3.5" fill="var(--accent)"/><text x="${p}" y="${H-2}">${money(ys[0])}</text><text x="${W-p}" y="${H-2}" text-anchor="end">${money(last[1])} · ${x1-x0} días</text></svg>`;
}
async function openCard(name){
  S.modal={name, loading:true}; renderModal();
  if (!cardOf(name)) await fetchCards([name],{quiet:true});
  await fetchVersions(name);
  if (S.modal && S.modal.name===name){ S.modal.loading=false; renderModal(); }
}


/* ---------- venta: carpetas ---------- */
function ventaHTML(){
  const bs = S.data.binders;
  if (!S.binderSel || !bs.some(b=>b.id===S.binderSel)) S.binderSel = bs[0] ? bs[0].id : null;
  const b = bs.find(x=>x.id===S.binderSel);
  const rail = `<aside class="rail">
    <div class="side-card"><h3>Subir carpeta de venta</h3>
      <p class="muted" style="margin:0;font-size:.9rem">En ManaBox: abre la carpeta (binder) → menú ⋮ → Exportar → CSV. Puedes subir varios archivos: cada uno crea su carpeta. Si el CSV trae la columna de carpeta (Binder), se separa en una carpeta por cada una.</p>
      <label class="btn primary" for="binder-files" style="cursor:pointer;justify-content:center">Subir archivo(s) CSV o texto</label><input type="file" id="binder-files" accept=".csv,.txt,text/csv,text/plain" multiple hidden>
      <details><summary class="muted" style="cursor:pointer">O pegar una lista</summary>
        <div class="field" style="margin-top:8px"><label for="binder-name">Nombre de la carpeta</label><input type="text" id="binder-name" placeholder="Ej.: Venta octubre"></div>
        <div class="field"><label for="binder-text">Lista</label><textarea id="binder-text" style="min-height:120px" spellcheck="false" placeholder="4 Lightning Bolt (2X2) 117&#10;1 Sol Ring (CMM) 400 *F*"></textarea></div>
        <button class="btn sm" data-act="binder-paste">Crear carpeta</button></details>
    </div>
    <ul class="deck-list">${bs.map(x=>{ const T=binderTotals(x); return `<li><button class="deck-item" data-binder="${esc(x.id)}" aria-current="${x.id===S.binderSel}"><span class="dn">${esc(x.name)}</span><span class="dc"><span class="num">${T.cards}</span> cartas · <span class="num">${showPrice(x,T.fin)}</span>${x.sales.length?` · ${x.sales.reduce((a,s)=>a+s.q,0)} vendidas`:""}</span></button></li>`; }).join("") || `<li class="muted" style="padding:8px 12px">Aún no tienes carpetas de venta.</li>`}</ul>
  </aside>`;
  return `<div class="fmt-head"><h2>Venta</h2><span class="muted">Tus carpetas de venta con precio de mercado por versión, precio sugerido y buylist de Card Kingdom.</span></div>
    ${busyBanner()}
    <div class="decks-layout">${rail}<div style="min-width:0">${b?binderPaneHTML(b):`<div class="pane"><div class="empty"><h2 style="margin-bottom:8px">Sube tu primera carpeta de venta</h2><p>Exporta el binder desde ManaBox en CSV y súbelo a la izquierda. Verás el valor de cada carta en su versión exacta, un precio de venta sugerido y una lista lista para compartir.</p></div></div>`}</div></div>`;
}
function manaCostHTML(cost){
  const t=(String(cost||"").match(/\{[^}]+\}/g)||[]).map(x=>x.slice(1,-1));
  if (!t.length) return "";
  return `<span class="mc" aria-label="Coste ${esc(t.join(" "))}">${t.map(x=>{
    if (/^\d+$/.test(x)||x==="X"||x==="Y") return `<i class="mcs n">${x}</i>`;
    if (WUBRG.includes(x)) return `<i class="mcs p-${x}"></i>`;
    if (x==="C") return `<i class="mcs p-C"></i>`;
    const h=x.split("/").filter(c=>WUBRG.includes(c)); if (h.length===2) return `<i class="mcs" style="background:linear-gradient(135deg,var(--m${h[0]}) 50%,var(--m${h[1]}) 50%)"></i>`;
    if (h.length===1) return `<i class="mcs p-${h[0]}"></i>`;
    return `<i class="mcs n">${esc(x[0]||"")}</i>`; }).join("")}</span>`;
}
const BL_ORDER = ["Planeswalker","Creature","Instant","Sorcery","Artifact","Enchantment","Battle","Land","Unknown"];
const BL_ES = {Planeswalker:"Planeswalkers",Creature:"Criaturas",Instant:"Instantáneos",Sorcery:"Conjuros",Artifact:"Artefactos",Enchantment:"Encantamientos",Battle:"Batallas",Land:"Tierras",Unknown:"Sin datos"};
function binderPaneHTML(b){
  const P=b.pricing, T=binderTotals(b), used=usedMap(), rate=usdClp(), step=+P.round||1;
  const q=(S.bQ||"").trim().toLowerCase(); const sort=S.bSort||"price"; const view=S.bView||"list";
  const all = b.items.map((it,i)=>({it,i,L:binderLine(b,it),m:cardOf(it.n)})).filter(x=>!q || x.it.n.toLowerCase().includes(q) || (x.it.set||"").toLowerCase()===q);
  const cmp = sort==="name" ? (a,c)=>a.it.n.localeCompare(c.it.n) : sort==="trend" ? (a,c)=>((change(itemKey(c.it),30)||{pct:-1e9}).pct)-((change(itemKey(a.it),30)||{pct:-1e9}).pct) : (a,c)=>(c.L.fin||0)-(a.L.fin||0);
  const groups = {}; for (const x of all){ const t=x.m?x.m.t:"Unknown"; (groups[t]=groups[t]||[]).push(x); }
  const imgOf = (it,m,kind) => { const pk=pkOf(it); const pr=pk&&S.prints[pk]; if (kind==="art") return (pr&&(pr.art||pr.sm))||(m&&m.img)||""; return (pr&&pr.img)||(m&&m.img)||""; };
  const priceSub = L => L.ckR!=null ? `CK ${usd(L.ckR)}${L.ck.match!=="exacta"?` <span class="tag" title="Coincidencia por ${esc(L.ck.match)}, no por versión exacta">${esc(L.ck.match)}</span>`:""}` : L.tcg!=null ? `<span class="tag" title="Sin precio de Card Kingdom para esta versión">TCG</span> ${usd(L.tcg)}` : `<span class="muted">sin precio</span>`;
  const row = ({it,i,L,m}) => { const u=used.get(slug(it.n))||[]; const c30=change(itemKey(it),30); const img=imgOf(it,m,"art");
    return `<div class="bl-row">
      <div class="bl-thumb cn" data-card="${esc(it.n)}"${m&&m.img?` data-img="${esc(imgOf(it,m,"img"))}"`:""} role="button" tabindex="0">${img?`<img src="${esc(img)}" alt="" loading="lazy">`:`<span class="bl-noimg">${esc(it.n.slice(0,1))}</span>`}<span class="bl-badge">${L.ckR!=null?usd(L.ckR):L.tcg!=null?usd(L.tcg):"—"}</span></div>
      <div class="bl-mid">
        <div class="bl-name">${cardName(it.n,m)}${it.foil?`<span class="bl-foil" title="${esc(it.foil)}">${it.foil==="etched"?"E":"F"}</span>`:""} ${m?manaCostHTML(m.cost):""}</div>
        <div class="bl-sub">${it.set?`<b>${esc(it.set)}</b>${it.num?" #"+esc(it.num):""}`:"sin versión"}${it.cond?` · ${esc(condShort(it.cond))}`:""}${it.lang&&!/^(en|english)$/i.test(it.lang)?` · ${esc(it.lang.toUpperCase())}`:""}${c30?` · <span class="${c30.pct>0?"up":c30.pct<0?"down":""}">${pct(c30.pct)} 30 d</span>`:""}${u.length?` · <span class="pill warn" title="${esc(u.map(x=>x.d).join(", "))}">en uso</span>`:""}</div>
        <div class="bl-sub">${priceSub(L)}${L.ck&&L.ck.b!=null?` · CK te paga ${usd(L.ck.b)}`:""}${L.ck&&L.ck.u?` · <a href="${esc(L.ck.u)}" target="_blank" rel="noopener">ver en CK</a>`:""}</div>
        ${S.bEdit===i?`<div class="row" style="margin-top:6px"><input type="number" min="0" step="${P.clp?step:0.01}" data-bask="${i}" value="${it.ask&&it.ask.v!=null?esc(it.ask.v):""}" placeholder="${L.sug!=null?(P.clp?Math.round(L.sug*rate):L.sug.toFixed(2)):""}" style="width:120px" aria-label="Tu precio (${P.clp?"CLP":"US$"})"><span class="muted" style="font-size:.85rem">${P.clp?"CLP":"US$"} · vacío = sugerido</span></div>`:""}
      </div>
      <div class="bl-right">
        <div class="bl-qty">${it.q}</div>
        <div class="bl-price">${showPrice(b,L.fin)}${L.custom?` <span class="tag">fijado</span>`:""}</div>
        ${it.q>1?`<div class="muted" style="font-size:.8rem">c/u · total ${showPrice(b,(L.fin||0)*it.q)}</div>`:""}
        <div class="bl-acts"><button class="btn sm ghost" data-bedit="${i}" title="Fijar precio">Precio</button><button class="btn sm" data-bsold="${i}">Vendida</button><button class="btn sm ghost danger" data-bdel="${i}" aria-label="Quitar ${esc(it.n)}">✕</button></div>
      </div></div>`; };
  const tile = ({it,i,L,m}) => { const img=imgOf(it,m,"img");
    return `<div class="bl-tile"><div class="bl-tile-img cn" data-card="${esc(it.n)}" role="button" tabindex="0">${img?`<img src="${esc(img)}" alt="${esc(it.n)}" loading="lazy">`:`<span class="bl-noimg">${esc(it.n)}</span>`}
      <span class="bl-q">${it.q}</span>${it.foil?`<span class="bl-foil bl-foil-t">${it.foil==="etched"?"E":"F"}</span>`:""}<span class="bl-badge">${showPrice(b,L.fin)}</span></div>
      <div class="bl-tile-n">${esc(it.n)}</div><div class="bl-sub">${esc(it.set||"")}${it.num?" #"+esc(it.num):""} · ${L.ckR!=null?"CK "+usd(L.ckR):L.tcg!=null?"TCG "+usd(L.tcg):"sin precio"}</div>
      <div class="row" style="gap:4px"><button class="btn sm" data-bsold="${i}">Vendida</button><button class="btn sm ghost danger" data-bdel="${i}" aria-label="Quitar ${esc(it.n)}">✕</button></div></div>`; };
  const sections = BL_ORDER.filter(t=>groups[t]).map(t=>{ const arr=groups[t].sort(cmp); const n=arr.reduce((a,x)=>a+x.it.q,0); const sub=arr.reduce((a,x)=>a+(x.L.fin||0)*x.it.q,0); const subCK=arr.reduce((a,x)=>a+(x.L.ckR||0)*x.it.q,0);
    return `<section class="bl-sec"><div class="bl-sec-h"><span class="bl-sec-t">${BL_ES[t]}</span><span class="bl-sec-m"><span>${n} carta${n>1?"s":""}</span><span class="num">${showPrice(b,sub)}${P.clp?` · CK ${usd(subCK)}`:""}</span></span></div>
      ${view==="grid"?`<div class="bl-grid">${arr.map(tile).join("")}</div>`:arr.map(row).join("")}</section>`; }).join("");
  const srcs=[["ck","Card Kingdom · venta (exacto)"],["tcg","TCGplayer"],["ckbuy","Card Kingdom · compra"]];
  const sales = b.sales.slice(0,30).map((x,j)=>`<div class="rec"><span>${x.q}× ${esc(x.n)}${x.set?` <span class="tag">${esc(x.set)}</span>`:""} <span class="muted" style="font-size:.85rem">· ${new Date(x.at).toLocaleDateString("es-CL")}</span></span><span class="meta">${showPrice(b,x.price)}${j===0?` <button class="btn sm ghost" style="padding:0 4px" data-act="binder-undo">Deshacer</button>`:""}</span></div>`).join("");
  const ckState = S.ck ? `<span class="pill good">Card Kingdom del ${new Date(S.ck.at).toLocaleDateString("es-CL")}</span>` : `<span class="pill warn">Sin precios de Card Kingdom</span>`;
  return `<div class="pane bl-pane">
    <div class="bl-head">
      <div style="min-width:0;flex:1">
        <input type="text" id="binder-rename" value="${esc(b.name)}" aria-label="Nombre de la carpeta" class="bl-title">
        <div class="bl-meta"><span class="num">${T.cards}</span> cartas ${pipsHTML(binderColors(b))} · ${ckState}</div>
      </div>
      <div class="bl-total"><div class="k">Card Kingdom</div><div class="v">${usd(T.ck)}</div><div class="c">${clp(T.ck,step)} <span class="muted">CLP</span></div></div>
    </div>
    <div class="pane-body">
      ${!S.ck || T.noCk ? `<div class="banner ${S.ck?"":"info"}" style="display:grid;gap:8px">
        <span>${S.ck?`<b class="num">${T.noCk}</b> carta${T.noCk>1?"s":""} sin precio de Card Kingdom para su versión; se usa TCGplayer como respaldo.`:"Para usar el precio exacto de Card Kingdom, carga su lista de precios."}</span>
        <div class="row"><button class="btn sm primary" data-act="load-ck" ${S.busy?"disabled":""}>${S.ck?"Actualizar":"Descargar"} precios de Card Kingdom</button><label class="btn sm" for="ck-file" style="cursor:pointer">Subir archivo de Card Kingdom</label><input type="file" id="ck-file" accept=".json,application/json" hidden></div>
        ${S.ckFail||!S.ck?`<span class="muted" style="font-size:.88rem">Si la descarga falla: abre <a href="https://api.cardkingdom.com/api/v2/pricelist" target="_blank" rel="noopener">api.cardkingdom.com/api/v2/pricelist</a> en tu navegador, guarda la página (Ctrl+S) como archivo .json y súbelo con “Subir archivo de Card Kingdom”.</span>`:""}
      </div>`:""}
      ${T.noPrice&&!S.busy?`<div class="banner"><span><b class="num">${T.noPrice}</b> sin ningún precio todavía.</span><button class="btn sm primary" data-act="binder-fetch">Actualizar cartas</button></div>`:""}
      <div class="stats">
        <div class="stat"><div class="k">valor Card Kingdom</div><div class="v" style="font-size:1.1rem">${usd(T.ck)}</div><div class="muted num" style="font-size:.9rem">${clp(T.ck,step)}</div></div>
        <div class="stat good"><div class="k">tu precio de venta</div><div class="v" style="font-size:1.1rem">${showPrice(b,T.fin)}</div><div class="muted num" style="font-size:.9rem">${P.clp?usd(T.fin):clp(T.fin,step)}</div></div>
        <div class="stat"><div class="k">Card Kingdom te paga</div><div class="v" style="font-size:1.1rem">${S.ck?usd(T.ckb):"—"}</div><div class="muted num" style="font-size:.9rem">${S.ck?clp(T.ckb,step):""}</div></div>
        <div class="stat"><div class="k">vendido</div><div class="v" style="font-size:1.1rem">${showPrice(b,T.sold)}</div><div class="muted num" style="font-size:.9rem">${b.sales.reduce((a,x)=>a+x.q,0)} cartas</div></div>
      </div>
      ${T.inUse?`<div class="banner"><span><b class="num">${T.inUse}</b> carta${T.inUse>1?"s":""} de esta carpeta se usa${T.inUse>1?"n":""} en tus mazos (marcadas “en uso”).</span></div>`:""}
      <div class="bl-bar">
        <div class="field"><label>Precio base</label><div class="chips">${srcs.map(([k,l])=>`<button class="chip" data-bsrc="${k}" aria-pressed="${P.src===k}">${l}</button>`).join("")}</div></div>
        <div class="row" style="gap:14px;align-items:flex-end">
          <div class="field"><label for="vx-rate">Tipo de cambio</label><div class="row" style="gap:6px;flex-wrap:nowrap"><span class="muted">1 US$ =</span><input type="number" id="vx-rate" min="1" step="1" value="${rate}" style="width:90px"><span class="muted">CLP</span></div></div>
          <div class="field" style="width:110px"><label for="b-pct">% del precio</label><input type="number" id="b-pct" min="1" max="300" step="1" value="${P.pct}"></div>
          <div class="field" style="width:120px"><label for="b-round">Redondear a</label><select id="b-round">${[1,10,50,100,500,1000].map(v=>`<option value="${v}" ${step===v?"selected":""}>$${v.toLocaleString("es-CL")}</option>`).join("")}</select></div>
          <label class="row" style="gap:6px;padding-bottom:8px"><input type="checkbox" id="b-clp" ${P.clp?"checked":""}> Mostrar en pesos chilenos</label>
          <label class="row" style="gap:6px;padding-bottom:8px"><input type="checkbox" id="b-sync" ${P.syncColl?"checked":""}> Al vender, descontar de mi colección</label>
        </div>
      </div>
      <div class="row">
        <button class="btn sm primary" data-act="binder-copy">Copiar lista de precios</button><button class="btn sm" data-act="binder-txt">Descargar .txt</button><button class="btn sm" data-act="binder-csv">Descargar CSV</button><button class="btn sm ghost" data-act="binder-mb">CSV para ManaBox</button>
        <label class="btn sm ghost" for="binder-add-file" style="cursor:pointer">Agregar archivo</label><input type="file" id="binder-add-file" accept=".csv,.txt,text/csv,text/plain" hidden>
        <label class="btn sm ghost" for="binder-replace-file" style="cursor:pointer">Reemplazar con archivo nuevo</label><input type="file" id="binder-replace-file" accept=".csv,.txt,text/csv,text/plain" hidden>
        <button class="btn sm ghost" data-act="binder-refresh" ${S.busy?"disabled":""}>Actualizar precios</button>
        ${S.bDel?`<span class="confirm">¿Eliminar esta carpeta? <button class="btn sm danger" data-act="binder-del-ok">Sí, eliminar</button><button class="btn sm ghost" data-act="binder-del-no">Cancelar</button></span>`:`<button class="btn sm ghost danger" data-act="binder-del" style="margin-left:auto">Eliminar carpeta</button>`}
      </div>
      ${S.bReplace?`<div class="card-box"><h3 style="font-size:1.05rem">Reemplazar “${esc(b.name)}” con el archivo nuevo</h3><p style="margin:0">+${S.bReplace.diff.added.reduce((a,x)=>a+x.q,0)} nuevas · −${S.bReplace.diff.removed.reduce((a,x)=>a+x.q,0)} que ya no están · ${S.bReplace.diff.changed.length} con otra cantidad. Tus precios fijados se conservan.</p><div class="row"><button class="btn sm primary" data-act="binder-replace-ok">Reemplazar</button><button class="btn sm ghost" data-act="binder-replace-no">Cancelar</button></div></div>`:""}
      <div class="bl-tools"><input type="search" id="b-q" placeholder="Buscar cartas…" value="${esc(S.bQ||"")}"><select id="b-sort" aria-label="Ordenar"><option value="price" ${sort==="price"?"selected":""}>Mayor precio</option><option value="trend" ${sort==="trend"?"selected":""}>Mayor subida 30 días</option><option value="name" ${sort==="name"?"selected":""}>Nombre</option></select>
        <div class="chips" role="group" aria-label="Vista"><button class="chip" data-bview="list" aria-pressed="${view==="list"}">Lista</button><button class="chip" data-bview="grid" aria-pressed="${view==="grid"}">Galería</button></div></div>
      <div>${sections||`<p class="muted">Sin cartas.</p>`}</div>
      <div class="sec"><h3>Ventas registradas</h3>${sales?`<div>${sales}</div>`:`<p class="muted">Cuando vendas una carta, márcala con “Vendida” y queda registrada aquí con su precio.</p>`}</div>
    </div></div>`;
}
