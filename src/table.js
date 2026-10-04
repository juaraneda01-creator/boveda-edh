/* =========================================================
   Bóveda EDH — Mesa de hoy
   Eliges los mazos que se sientan a jugar y la app dice si la
   mesa está pareja: nivel, bracket, sal, velocidad y amenaza,
   quién está muy por encima o por debajo y qué conviene cambiar.
   Se puede simular esa mesa y compartir el resumen (regla 0).
   ========================================================= */
S.mesa = S.mesa || {ids:[], sim:null, busy:false};

function mesaDecks(){ return S.mesa.ids.map(id=>S.data.decks.find(d=>d.id===id)).filter(Boolean); }
function mesaEval(decks = mesaDecks()){
  if (!decks || !decks.length) return null;
  const rows = decks.map(d=>{ const A = analyze(d); const P = powerOf(d, A); const s = simulate(d, A);
    const W = typeof winTurnOf==="function" ? winTurnOf(d, s) : {t: s && s.winAvg ? s.winAvg : null, n:0};
    return {d, A, P, speed: W.t, real: W.n, owner: d.rival ? (d.rival.owner||"amigo") : "tú"}; });
  const pw = rows.map(r=>r.P.power), avg = pw.reduce((a,x)=>a+x,0)/pw.length;
  const spread = Math.max(...pw) - Math.min(...pw);
  const br = rows.map(r=>r.P.real), brSpread = Math.max(...br) - Math.min(...br);
  // cada mazo contra el promedio de los otros (no contra un promedio que lo incluye a él mismo)
  for (const r of rows){ const others = rows.filter(x=>x!==r); r.gap = others.length ? r.P.power - others.reduce((a,x)=>a+x.P.power,0)/others.length : 0; }
  const verdict = rows.length < 2 ? {k:"warn", es:"Falta un rival", s:"Elige al menos dos mazos para comparar la mesa."}
    : spread <= 1 && brSpread <= 1 ? {k:"good", es:"Mesa pareja", s:"Los mazos están a un nivel parecido: debería ser una buena partida."}
    : spread <= 2 && brSpread <= 1 ? {k:"warn", es:"Mesa algo dispareja", s:"Hay diferencias, pero se puede jugar si todos lo saben."}
    : {k:"bad", es:"Mesa dispareja", s:"Hay mazos bastante por encima del resto: conviene conversarlo antes de jugar."};
  const tips = [];
  const hi = rows.filter(r=>r.gap >= 1).sort((a,b)=>b.gap-a.gap), lo = rows.filter(r=>r.gap <= -1).sort((a,b)=>a.gap-b.gap);
  for (const r of hi){
    const alt = S.data.decks.filter(x=>x.format==="commander" && !decks.includes(x) && (!!x.rival===!!r.d.rival) && (!x.rival || (x.rival.owner||"")===(r.d.rival.owner||""))).map(x=>({x, p:powerOf(x, analyze(x)).power})).sort((a,b)=>Math.abs(a.p-avg)-Math.abs(b.p-avg))[0];
    const gcs = r.A.gc.slice(0,3);
    tips.push(`${r.d.name} está ${r.gap.toFixed(1).replace(".",",")} niveles sobre el resto de la mesa.${alt && Math.abs(alt.p-avg) < Math.abs(r.gap) ? ` Podría jugar ${alt.x.name} (nivel ${alt.p.toFixed(1)}).` : ""}${gcs.length ? ` O sacar ${gcs.join(", ")} (Game Changer${gcs.length>1?"s":""}).` : ""}`);
  }
  for (const r of lo) tips.push(`${r.d.name} está ${Math.abs(r.gap).toFixed(1).replace(".",",")} niveles bajo el resto de la mesa: los demás podrían darle un poco de ventaja o no apuntarle primero.`);
  const salty = rows.filter(r=>r.P.salt >= 60); if (salty.length){ const sc = salty.flatMap(r=>r.P.saltTop.filter(x=>x.s>=1.5).slice(0,2).map(x=>x.n)); tips.push(`Avisa las cartas saladas de ${salty.map(r=>r.d.name).join(" y ")}${sc.length?` (${sc.join(", ")})`:""}.`); }
  const combos = rows.filter(r=>r.P.c2); if (combos.length) tips.push(`${combos.map(r=>r.d.name).join(" y ")} ${combos.length>1?"tienen":"tiene"} combos de 2 cartas: acuerden si valen.`);
  return {rows, avg, spread, brSpread, verdict, tips};
}
function mesaTableHTML(M){
  return `<div class="tbl-wrap"><table><thead><tr><th>Mazo</th><th class="n">Nivel</th><th class="n">Bracket</th><th class="n">Sal</th><th class="n">Gana en</th></tr></thead><tbody>
      ${M.rows.map(r=>`<tr><td><b>${esc(r.d.name)}</b><br><span class="muted" style="font-size:.82rem">${esc(r.owner)}</span></td><td class="n ${r.gap>=1?"warn":r.gap<=-1?"muted":""}">${r.P.power.toFixed(1)}${Math.abs(r.gap)>=1?` <small>${r.gap>0?"▲":"▼"}</small>`:""}</td><td class="n">${r.P.official.b}/${r.P.real}</td><td class="n">${r.P.salt}</td><td class="n">${r.speed?`T${r.speed.toFixed(1).replace(".",",")}${r.real?` <small title="Ajustado con ${r.real} victoria${r.real>1?"s":""} real${r.real>1?"es":""}">✓</small>`:""}`:"—"}</td></tr>`).join("")}
      </tbody></table></div>`;
}
function mesaText(M){
  return ["Mesa de hoy — Bóveda EDH", ...M.rows.map(r=>`• ${r.d.name} (${r.owner}): nivel ${r.P.power.toFixed(1)} · bracket ${r.P.official.b}/${r.P.real} · sal ${r.P.salt}`), `${M.verdict.es}${M.rows.length>1?`: diferencia de ${M.spread.toFixed(1)} niveles`:""}.`, ...M.tips.map(t=>"- "+t),
    ...(!M.rows.some(r=>r.d.qc) && S.mesa.sim && S.mesa.sim.key===S.mesa.ids.join("|") ? ["Simulación: " + S.mesa.sim.decks.map(x=>`${x.name} ${Math.round(x.pct*100)}%`).join(" · ")] : [])].join("\n");
}
function mesaHTML(){
  const all = S.data.decks.filter(d=>d.format==="commander");
  if (all.length < 2) return "";
  S.mesa.ids = S.mesa.ids.filter(id=>all.some(d=>d.id===id));
  const M = mesaEval();
  const chip = d => `<button class="chip" data-mesa-deck="${esc(d.id)}" aria-pressed="${S.mesa.ids.includes(d.id)}" ${S.mesa.busy?"disabled":""}>${esc(d.name)}${d.rival?` <small>(${esc(d.rival.owner||"amigo")})</small>`:""}</button>`;
  return `<div class="sec mesa"><h3>Mesa de hoy</h3><p class="lede">Elige los mazos que van a jugar (hasta 4) y te digo si la mesa está pareja antes de empezar.</p>
    ${S.match && !S.match.done ? `<div class="banner info"><span>Hay una partida en vivo en el turno ${S.match.turn}.</span><button class="btn sm primary" data-mt="resume">Seguir la partida</button></div>` : ""}
    <div class="chips">${all.map(chip).join("")}</div>
    ${M ? `<div class="banner ${M.verdict.k==="good"?"info":""} mesa-v mesa-${M.verdict.k}"><span><b>${M.verdict.es}.</b> ${esc(M.verdict.s)} ${M.rows.length>1?`<span class="muted">(diferencia de ${M.spread.toFixed(1).replace(".",",")} niveles)</span>`:""}</span></div>
      ${mesaTableHTML(M)}
      ${M.tips.length?`<ul class="mesa-tips">${M.tips.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>`:""}
      <div class="row">${M.rows.length>=2?`<button class="btn" data-mesa="sim" ${S.mesa.busy?"disabled":""}>${S.mesa.busy?"Simulando…":"Simular esta mesa (300 partidas)"}</button>`:""}${M.rows.length>=2?`<button class="btn primary" data-mt="play">Jugar esta mesa</button>`:""}<button class="btn" data-mesa="share">Compartir resumen</button>${S.mesa.ids.length?`<button class="btn ghost" data-mesa="clear">Limpiar</button>`:""}</div>
      ${S.mesa.sim && S.mesa.sim.key===S.mesa.ids.join("|") ? `<p class="lede" style="margin-top:8px">Simulación: ${S.mesa.sim.decks.slice().sort((a,b)=>b.pct-a.pct).map(x=>`<b>${esc(x.name)}</b> ${Math.round(x.pct*100)}%`).join(" · ")} <span class="muted">(pareja sería ${Math.round(100/S.mesa.sim.players)}% cada uno)</span></p>` : ""}
      <p class="foot">“Gana en” es el turno promedio en que el mazo tiene un remate lanzable según la simulación de manos (sin contar la interacción rival), corregido con las victorias reales anotadas cuando las hay (✓); el nivel y el bracket son los de la ficha de cada mazo.</p>` : ""}
  </div>`;
}

document.addEventListener("click", async ev => {
  const c = ev.target.closest("[data-mesa-deck]");
  if (c){ if (S.mesa.busy) return; const id = c.dataset.mesaDeck; S.mesa.ids = S.mesa.ids.includes(id) ? S.mesa.ids.filter(x=>x!==id) : [...S.mesa.ids, id].slice(-4); S.mesa.sim = null; render(); return; }
  const b = ev.target.closest("[data-mesa]"); if (!b) return;
  const M = mesaEval();
  if (b.dataset.mesa==="clear"){ if (S.mesa.busy) return; S.mesa = {ids:[], sim:null, busy:false}; render(); return; }
  if (b.dataset.mesa==="share" && M){ const text = mesaText(M); if (navigator.share){ try { await navigator.share({title:"Mesa de hoy", text}); return; } catch(e){ if (e && e.name==="AbortError") return; } } copyText(text); return; }
  if (b.dataset.mesa==="sim" && M && !S.mesa.busy){
    const key = S.mesa.ids.join("|"), decks = mesaDecks();   // la mesa que se pidió, aunque cambie mientras simula
    S.mesa.busy = true; render();
    try { const out = await simRun(decks, 300); S.mesa.sim = {...out, key}; }
    catch(e){ toast(e && e.message ? e.message : "No se pudo simular esta mesa."); }
    finally { S.mesa.busy = false; render(); }
  }
});
