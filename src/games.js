/* =========================================================
   Bóveda EDH — Registro de partidas
   Se anota en segundos desde el teléfono: resultado, turno,
   cómo terminó, asiento y rivales. Con eso: % de victorias,
   turno promedio, rendimiento por asiento y contra cada rival,
   y cómo se compara con el nivel estimado del mazo.
   ========================================================= */
const GAME_HOW = [["combat","Combate"],["combo","Combo"],["drain","Drenaje"],["cmdr","Daño de comandante"],["alt","Victoria alternativa"],["concede","Se rindieron"],["other","Otro"]];
S.gm = S.gm || {res:null, turn:7, how:null, seat:null, opp:[], oppTxt:"", note:""};

function gamesOf(d){ return (S.data.games||[]).filter(g=>g.deck===d.id).sort((a,b)=>b.at-a.at); }
function gameStats(list){
  const n = list.length, w = list.filter(g=>g.res==="win").length, dr = list.filter(g=>g.res==="draw").length;
  const winTurns = list.filter(g=>g.res==="win" && g.turn).map(g=>g.turn);
  const seats = [1,2,3,4].map(s=>{ const L = list.filter(g=>g.seat===s); return {s, n:L.length, w:L.filter(g=>g.res==="win").length}; });
  const opp = new Map();
  for (const g of list) for (const o of g.opp||[]){ const x = opp.get(o) || {n:0, w:0}; x.n++; if (g.res==="win") x.w++; opp.set(o, x); }
  const how = new Map(); for (const g of list.filter(g=>g.res==="win" && g.how)) how.set(g.how, (how.get(g.how)||0)+1);
  return {n, w, l:n-w-dr, dr, pct: n ? w/n : null, avgTurn: winTurns.length ? winTurns.reduce((a,x)=>a+x,0)/winTurns.length : null,
    seats, opp:[...opp.entries()].map(([k,v])=>({k, ...v})).sort((a,b)=>b.n-a.n), how:[...how.entries()].sort((a,b)=>b[1]-a[1])};
}

function gamesHTML(d, A){
  const isC = A.isC; const F = S.gm; const list = gamesOf(d); const st = gameStats(list);
  const fair = isC ? 0.25 : 0.5;
  const rivals = isC ? S.data.decks.filter(x=>x.format==="commander" && x.id!==d.id).map(x=>({k:(x.commanders||[]).join(" + ") || x.name, es:x.rival ? `${x.name} (${x.rival.owner||"amigo"})` : x.name}))
    : ((META[d.format] && META[d.format].archetypes) || []).slice(0, 10).map(a=>({k:a.name, es:a.name}));
  const oppName = k => { const r = rivals.find(x=>x.k===k); return r ? r.es : k; };
  const chip = (attr, v, label, on) => `<button class="chip" data-gm-${attr}="${esc(String(v))}" aria-pressed="${!!on}">${label}</button>`;
  const P = isC && typeof powerOf==="function" ? powerOf(d, A) : null;
  const expect = st.pct==null ? "" : st.n < 5 ? `Con ${st.n} partida${st.n>1?"s":""} todavía es pronto para sacar conclusiones.`
    : st.pct >= fair*1.5 ? `Gana bastante más de lo esperado en una mesa pareja (${Math.round(fair*100)}%). ${P?`Si su nivel estimado es ${P.power.toFixed(1)}, probablemente juega por sobre eso con tu grupo.`:""}`
    : st.pct <= fair*0.5 ? `Gana bastante menos de lo esperado (${Math.round(fair*100)}%). Revisa la pestaña Mejorar o compara con los mazos de tu grupo.`
    : `Rinde parejo con tu grupo (lo esperado es ${Math.round(fair*100)}%).`;
  return `<div class="sec gm">
    <h3>Anotar partida</h3>
    <div class="gm-form">
      <div class="gm-row"><span class="gm-l">Resultado</span><div class="chips">${chip("res","win","Gané",F.res==="win")}${chip("res","loss","Perdí",F.res==="loss")}${chip("res","draw","Empate",F.res==="draw")}</div></div>
      <div class="gm-row"><span class="gm-l">Turno</span><div class="gm-step"><button class="btn sm" data-gm-turn="-1" aria-label="Un turno menos">−</button><b class="num">${F.turn}</b><button class="btn sm" data-gm-turn="1" aria-label="Un turno más">+</button></div></div>
      <div class="gm-row"><span class="gm-l">Cómo terminó</span><div class="chips">${GAME_HOW.filter(([k])=>isC || k!=="cmdr").map(([k,es])=>chip("how",k,es,F.how===k)).join("")}</div></div>
      ${isC?`<div class="gm-row"><span class="gm-l">Tu asiento</span><div class="chips">${[1,2,3,4].map(s=>chip("seat",s,String(s),F.seat===s)).join("")}</div></div>`:""}
      <div class="gm-row"><span class="gm-l">${isC?"Rivales":"Rival"}</span><div class="chips">${rivals.map(r=>chip("opp",r.k,esc(r.es),F.opp.includes(r.k))).join("") || `<span class="muted" style="font-size:.9rem">${isC?"Agrega los mazos de tu grupo en “Mazos de mis amigos” para elegirlos aquí.":"Sin arquetipos cargados."}</span>`}</div></div>
      <div class="gm-row"><span class="gm-l"></span><input type="text" id="gm-opp" placeholder="${isC?"Otros comandantes, separados por coma":"Otro rival"}" value="${esc(F.oppTxt)}" autocomplete="off"></div>
      <div class="gm-row"><span class="gm-l">Nota</span><input type="text" id="gm-note" placeholder="Opcional: qué funcionó, qué faltó" value="${esc(F.note)}" autocomplete="off"></div>
      <button class="btn primary" data-gm-save="1" ${F.res?"":"disabled"}>Guardar partida</button>
    </div></div>
  ${st.n ? `<div class="sec gm">
    <h3>Resultados</h3>
    <div class="stats"><div class="stat"><div class="k">partidas</div><div class="v">${st.n}</div></div><div class="stat ${st.pct>=fair?"good":"warn"}"><div class="k">victorias</div><div class="v">${Math.round(st.pct*100)}<small>%</small></div></div><div class="stat"><div class="k">récord</div><div class="v num" style="font-size:1.3rem">${st.w}-${st.l}${st.dr?`-${st.dr}`:""}</div></div><div class="stat"><div class="k">gana en el turno</div><div class="v">${st.avgTurn?st.avgTurn.toFixed(1).replace(".",","):"—"}</div></div></div>
    <p class="lede" style="margin-top:10px">${esc(expect)}</p>
    ${isC && st.seats.some(x=>x.n)?`<h4 class="td-h">Por asiento</h4><div class="td-seats gm-seats">${st.seats.map(x=>`<div class="td-seat"><small class="sc">asiento ${x.s}</small><b class="num">${x.n?Math.round(100*x.w/x.n)+"%":"—"}</b><span class="muted" style="font-size:.8rem">${x.w} de ${x.n}</span></div>`).join("")}</div>`:""}
    ${st.how.length?`<h4 class="td-h">Cómo gana</h4><div class="chips">${st.how.map(([k,c])=>`<span class="pill neutral">${esc((GAME_HOW.find(h=>h[0]===k)||[k,k])[1])} · ${c}</span>`).join("")}</div>`:""}
    ${st.opp.length?`<h4 class="td-h">Contra cada rival</h4>${st.opp.slice(0,12).map(o=>`<div class="rec"><span>${esc(oppName(o.k))}</span><span class="meta num">${o.w}/${o.n} · ${Math.round(100*o.w/o.n)}%</span></div>`).join("")}`:""}
    <h4 class="td-h">Últimas partidas</h4>
    ${list.slice(0, 15).map(g=>`<div class="rec gm-item"><span><b class="${g.res==="win"?"up":g.res==="loss"?"down":""}">${g.res==="win"?"Victoria":g.res==="loss"?"Derrota":"Empate"}</b>${g.turn?` · turno ${g.turn}`:""}${g.how?` · ${esc((GAME_HOW.find(h=>h[0]===g.how)||[g.how,g.how])[1]).toLowerCase()}`:""}${g.seat?` · asiento ${g.seat}`:""}<br><span class="muted" style="font-size:.85rem">${new Date(g.at).toLocaleDateString("es-CL",{day:"numeric",month:"short"})}${(g.opp||[]).length?` · vs ${esc(g.opp.map(oppName).join(", "))}`:""}${g.note?` · ${esc(g.note)}`:""}</span></span><button class="btn sm ghost" data-gm-del="${esc(g.id)}" aria-label="Borrar partida">Borrar</button></div>`).join("")}
  </div>` : `<div class="sec"><p class="muted">Aún no hay partidas anotadas con este mazo. Anota la primera arriba: con 5 o más ya se ve cómo rinde contra tu grupo.</p></div>`}`;
}

// récord de todos los mazos (para la tabla de poder y sal)
function gameRecord(d){ const st = gameStats(gamesOf(d)); return st.n ? st : null; }

document.addEventListener("click", ev => {
  const g = k => ev.target.closest(`[data-gm-${k}]`); const F = S.gm; let b;
  const keepInputs = () => { const o = $("#gm-opp"), n = $("#gm-note"); if (o) F.oppTxt = o.value; if (n) F.note = n.value; };
  if ((b = g("res"))){ keepInputs(); F.res = F.res===b.dataset.gmRes ? null : b.dataset.gmRes; render(); return; }
  if ((b = g("turn"))){ keepInputs(); F.turn = Math.max(1, Math.min(30, F.turn + (+b.dataset.gmTurn))); render(); return; }
  if ((b = g("how"))){ keepInputs(); F.how = F.how===b.dataset.gmHow ? null : b.dataset.gmHow; render(); return; }
  if ((b = g("seat"))){ keepInputs(); const s = +b.dataset.gmSeat; F.seat = F.seat===s ? null : s; render(); return; }
  if ((b = g("opp"))){ keepInputs(); const o = b.dataset.gmOpp; F.opp = F.opp.includes(o) ? F.opp.filter(x=>x!==o) : [...F.opp, o]; render(); return; }
  if ((b = g("del"))){ S.data.games = (S.data.games||[]).filter(x=>x.id!==b.dataset.gmDel); saveData(); render(); toast("Partida borrada."); return; }
  if ((b = g("save"))){
    keepInputs(); const d = S.data.decks.find(x=>x.id===S.sel[S.view]); if (!d || !F.res) return;
    const extra = String(F.oppTxt||"").split(",").map(x=>x.trim()).filter(Boolean);
    const game = {id:uid(), at:Date.now(), deck:d.id, res:F.res, turn:F.turn, how:F.how, seat:F.seat, opp:[...new Set([...F.opp, ...extra])].slice(0, 6), note:String(F.note||"").slice(0, 200)};
    S.data.games = [...(S.data.games||[]), game]; saveData();
    S.gm = {res:null, turn:F.turn, how:null, seat:null, opp:F.opp, oppTxt:"", note:""};   // los rivales suelen repetirse en la siguiente
    render(); toast(game.res==="win" ? "¡Victoria anotada!" : "Partida anotada."); return;
  }
});
