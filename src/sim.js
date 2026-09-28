/* =========================================================
   Bóveda EDH — Partidas simuladas
   Un modelo rápido y aproximado (no un motor de reglas): cada
   jugador roba, baja tierras, lanza lo que su maná le permite,
   ataca, drena y responde con removal, contrahechizos y barridos
   cuando otro se escapa. Sirve para comparar mazos entre sí y ver
   tendencias (quién gana, en qué turno, cómo), no para predecir
   una partida concreta. Nunca se mezcla con las partidas reales.
   ========================================================= */

// cada carta se reduce a lo que importa para la carrera
function simCard(r, cmd){
  const m = r.m || {}; const has = k => (m.tg||[]).includes(k) || (m.rf||[]).includes(k) || (m.r||[]).includes(k);
  const t = m.t || "Creature"; const name = r.n.toLowerCase();
  const creature = /Creature/.test(m.tl||t) && t!=="Land";
  const c = {n:r.n, cmd:!!cmd, land:t==="Land", cmc:Math.round(m.cmc||0), inst: t==="Instant" || has("flash"), creature, perm: !/Instant|Sorcery/.test(t)};
  if (!m.t){ Object.assign(c, {creature:true, perm:true, cmc:3, pow:2}); return c; }   // carta sin datos: una criatura promedio
  c.pow = creature ? (m.pw!=null ? Math.max(0, m.pw) : Math.max(1, Math.round((m.cmc||1)*0.85))) : 0;
  c.evasive = has("evasion");
  c.anthem = has("wcCombat") ? 1 : 0;
  c.mana = 0;
  if (!c.land && !c.perm && has("landRamp")) c.landRamp = /two basic land|up to two|two land/.test((m.tg||[]).join(" ")) ? 2 : 1;   // Cultivate, Rampant Growth: suman una tierra
  else if (!c.land && has("ramp")){ c.mana = FAST_MANA.has(name) && /ring|vault|crypt/.test(name) ? 2 : 1; if (!c.perm) { c.ritual = FAST_MANA.has(name) ? 2 : 1; c.mana = 0; } }
  if (!c.land && c.perm && has("landRamp")) c.mana = Math.max(c.mana, 1);
  if (FAST_MANA.has(name) && c.perm && !c.land) c.fast = true;
  c.draw = has("draw") ? (c.perm && has("repeat") ? 1 : 2) : 0; c.drawEngine = c.perm && has("draw") && has("repeat");
  c.removal = has("removal") && !has("counter") && !(m.sb||[]).includes("counter");
  c.counter = has("counter") || (m.sb||[]).includes("counter");
  c.wipe = has("wipe"); c.protect = has("protect") || has("protection");
  c.tutor = has("tutor"); c.free = FREE_INTERACTION.has(name);
  c.drain = has("deathDrain") ? 1 : 0; c.drainTurn = has("wcDrain") && c.perm && has("repeat") ? 1 : 0;
  c.outlet = has("sacOutlet"); c.fodder = has("sacFodder");
  c.tokens = has("token") && c.perm && has("repeat") ? 1 : 0;
  c.alt = has("wcAlt");
  return c;
}
function simDeck(d){
  const A = analyze(d);
  const lib = []; for (const r of A.rows) for (let i=0;i<r.q;i++) lib.push(simCard(r));
  const cmds = A.cmdMeta.map((m,i)=>simCard({n:(d.commanders||[])[i], q:1, m}, true));
  const combos = ((d.combos && d.combos.inc) || []).map(c=>c.cards.map(n=>n.toLowerCase())).filter(c=>c.length && c.length<=4).slice(0, 30);
  const P = typeof powerOf==="function" ? powerOf(d, A) : null;
  return {id:d.id, name:d.name, lib, cmds, combos, loops: P && P.E ? P.E.loops : 0, isC:A.isC};
}

// una partida: jugadores en orden de asiento; devuelve ganador, turno y cómo ganó
function simGame(decks, rnd, {life=40, maxTurns=20}={}){
  const players = decks.map((D, seat) => {
    const lib = D.lib.map(c=>({...c})); for (let i=lib.length-1;i>0;i--){ const j = Math.floor(rnd()*(i+1)); [lib[i], lib[j]] = [lib[j], lib[i]]; }
    let hand = lib.splice(0, 7);
    // mulligan simple: menos de 2 o más de 5 tierras, se baraja una vez y se roban 7 (y se deja una abajo)
    const lands = hand.filter(c=>c.land).length;
    if (lands < 2 || lands > 5){ lib.push(...hand); for (let i=lib.length-1;i>0;i--){ const j = Math.floor(rnd()*(i+1)); [lib[i], lib[j]] = [lib[j], lib[i]]; } hand = lib.splice(0, 7); const worst = hand.findIndex(c=>c.cmc>=5) ; lib.push(hand.splice(worst>=0?worst:0, 1)[0]); }
    return {D, seat, life, lib, hand, board:[], lands:0, landNames:[], cmdZone:D.cmds.map(c=>({...c})), cmdTax:0, alive:true, gy:0, how:null, spare:0};
  });
  const alive = () => players.filter(p=>p.alive);
  const boardPow = p => { const anth = p.board.reduce((a,c)=>a+(c.anthem||0),0); const cr = p.board.filter(c=>c.creature); return cr.reduce((a,c)=>a+c.pow,0) + (anth ? anth*cr.length : 0) + p.board.reduce((a,c)=>a+(c.tokensMade||0),0); };
  const threat = p => boardPow(p) + p.board.filter(c=>c.drain||c.drainTurn||c.drawEngine).length*2 + (40-p.life<0?0:0);
  const hasCombo = p => { const names = new Set(p.board.map(c=>c.n.toLowerCase())); const inHand = new Set(p.hand.map(c=>c.n.toLowerCase()));
    return p.D.combos.some(cb=>cb.every(n=>names.has(n) || inHand.has(n)) && cb.filter(n=>!names.has(n)).length<=1); };
  // los rivales responden: el que tenga respuesta y maná la usa contra quien va ganando
  const respond = (target, kind) => {
    for (const q of alive()){ if (q===target) continue;
      const idx = q.hand.findIndex(c=> !c.perm && (kind==="counter" ? c.counter && (c.free || c.cmc<=q.spare) : kind==="wipe" ? c.wipe && c.cmc<=q.spare : c.removal && (c.free || c.cmc<=q.spare)));
      if (idx<0) continue;
      const card = q.hand.splice(idx, 1)[0]; if (!card.free) q.spare -= card.cmc; q.gy++;
      // la protección del objetivo lo salva una vez
      const pi = target.hand.findIndex(c=>c.protect && !c.perm && (c.free || c.cmc<=target.spare));
      if (pi>=0 && kind!=="counter"){ const pc = target.hand.splice(pi,1)[0]; target.spare -= pc.cmc; target.gy++; return false; }
      return true;
    }
    return false;
  };
  const wipeAll = () => { for (const q of players){ q.board = q.board.filter(x=>!x.creature || x.cmd && (q.cmdZone.push(x), q.cmdTax+=2, false)); for (const x of q.board) x.tokensMade = 0; } };
  const removeTop = p => { const foes = alive().filter(q=>q!==p); if (!foes.length) return; const lead = foes.reduce((a,q)=>threat(q)>threat(a)?q:a, foes[0]);
    const big = lead.board.filter(c=>c.creature||c.drawEngine||c.drain).sort((a,b)=>(b.pow+(b.drain?4:0)+(b.drawEngine?3:0))-(a.pow+(a.drain?4:0)+(a.drawEngine?3:0)))[0];
    if (big){ lead.board.splice(lead.board.indexOf(big),1); if (big.cmd){ lead.cmdZone.push(big); lead.cmdTax += 2; } } };
  // combo listo: todas las piezas en mesa (o tierras jugadas) salvo las que están en la mano y se pueden pagar ahora
  const comboReady = p => p.D.combos.some(cb=>{ let cost = 0;
    for (const n of cb){ if (p.board.some(c=>c.n.toLowerCase()===n) || p.landNames.includes(n) || p.cmdZone.length===0 && p.board.some(c=>c.cmd && c.n.toLowerCase()===n)) continue;
      const h = p.hand.find(c=>c.n.toLowerCase()===n && !c.land); if (!h) return false; cost += h.free ? 0 : h.cmc; }
    return cost <= p.spare; });
  const kill = (p, q, how) => { if (q.alive && q.life <= 0){ q.alive = false; p.how = how; } };
  const castFromHand = (p, mana, turn) => {
    // prioridad: ramp temprano, luego motores, amenazas y piezas de combo; se guarda maná para una respuesta si se tiene
    const keep = p.hand.some(c=>(c.counter||c.removal) && c.inst && !c.free) ? Math.min(3, Math.max(0, mana-2)) : 0;
    let budget = mana - keep;
    const score = c => (c.mana ? (turn<=4?10:3) : 0) + (c.drawEngine?6:0) + (c.tutor?5:0) + c.pow*1.2 + (c.drain?4:0) + (c.drainTurn?4:0) + (c.outlet?2:0) + (c.anthem?3:0) + (c.tokens?3:0) + (p.D.combos.some(cb=>cb.includes(c.n.toLowerCase()))?8:0) + (c.landRamp ? (turn<=5?9:2) : 0) + (c.perm && c.removal ? 4 : 0) - (!c.perm && (c.removal||c.counter||c.wipe||c.protect) ? 20 : 0);
    const rituals = p.hand.filter(c=>c.ritual); for (const r of rituals){ if (budget>=r.cmc){ budget += r.ritual; p.hand.splice(p.hand.indexOf(r),1); p.gy++; } }
    // comandante
    for (const cm of p.cmdZone.slice()){ const cost = cm.cmc + p.cmdTax; if (cost<=budget && turn>=2){ budget -= cost; p.cmdZone.splice(p.cmdZone.indexOf(cm),1); cm.sick = true; p.board.push(cm); } }
    const opts = p.hand.filter(c=>!c.land && c.cmc<=budget).sort((a,b)=>score(b)-score(a));
    for (const c of opts){
      if (c.cmc>budget || score(c)<0) continue;
      budget -= c.cmc; p.hand.splice(p.hand.indexOf(c),1);
      // hechizos grandes o piezas de combo pueden ser contrarrestados
      if ((c.cmc>=5 || p.D.combos.some(cb=>cb.includes(c.n.toLowerCase()))) && respond(p, "counter")){ p.gy++; continue; }
      if (c.perm){ c.sick = true; p.board.push(c); if (c.removal) removeTop(p); }
      else p.gy++;
      if (c.landRamp) p.lands += c.landRamp;
      if (c.draw && !c.drawEngine) p.hand.push(...p.lib.splice(0, c.draw));
      if (c.tutor){ const want = p.D.combos.flat().find(n=>!p.hand.concat(p.board).some(x=>x.n.toLowerCase()===n)); const i = want ? p.lib.findIndex(x=>x.n.toLowerCase()===want) : p.lib.findIndex(x=>x.pow>=4||x.drawEngine); if (i>=0) p.hand.push(p.lib.splice(i,1)[0]); }
      if (c.wipe && !c.perm) wipeAll();
    }
    p.spare = Math.max(0, budget);
  };
  for (let turn=1; turn<=maxTurns; turn++){
    for (const p of players){
      if (!p.alive) continue;
      if (alive().length===1) break;
      // robar y bajar tierra
      if (!(turn===1 && p.seat===0 && players.length===2)) p.hand.push(...p.lib.splice(0,1));
      const engines = p.board.filter(c=>c.drawEngine).length; if (engines) p.hand.push(...p.lib.splice(0, Math.min(2, engines)));
      const li = p.hand.findIndex(c=>c.land); if (li>=0){ const L = p.hand.splice(li,1)[0]; p.lands++; p.landNames.push(L.n.toLowerCase()); }
      for (const c of p.board) c.sick = false;
      const mana = p.lands + p.board.reduce((a,c)=>a+(c.mana||0),0);
      castFromHand(p, mana, turn);
      // barrido si voy muy atrás en mesa
      const mine = boardPow(p), top = Math.max(0, ...alive().filter(q=>q!==p).map(boardPow));
      const wi = p.hand.findIndex(c=>c.wipe && c.cmc<=p.spare);
      if (wi>=0 && top >= mine + 8){ const w = p.hand.splice(wi,1)[0]; p.spare -= w.cmc; wipeAll(); }
      // combo armado: gana si nadie lo contrarresta
      if (p.D.combos.length && comboReady(p)){ if (!respond(p, "counter")){ for (const q of alive()) if (q!==p){ q.life = 0; q.alive = false; } p.how = "combo"; return {winner:p.seat, turn, how:"combo"}; } }
      // bucle de sacrificio: salida + drenajes + cuerpos en mesa
      const drains = p.board.filter(c=>c.drain).length, outlet = p.board.some(c=>c.outlet), bodies = p.board.filter(c=>c.creature).length + p.board.reduce((a,c)=>a+(c.tokensMade||0),0);
      if (outlet && drains){ const dmg = Math.min(60, drains * Math.max(0, bodies-1)); if (dmg >= 6){ for (const q of alive()) if (q!==p){ q.life -= dmg; kill(p, q, "drain"); } p.board = p.board.filter(c=>!c.creature || c.cmd || c.outlet || c.drain); for (const c of p.board) c.tokensMade = 0; p.how = "drain"; } }
      // drenaje por turno y fichas
      for (const c of p.board){ if (c.drainTurn) for (const q of alive()) if (q!==p){ q.life -= c.drainTurn; kill(p, q, "drain"); } if (c.tokens) c.tokensMade = (c.tokensMade||0) + c.tokens; }
      // combate contra el rival más débil; los bloqueadores frenan lo que no evade
      // a quién atacar: al que está más cerca de morir o al más peligroso (empates al azar)
      const opps = alive().filter(q=>q!==p && q.life>0).map(q=>({q, k: q.life - threat(q)*0.8 + rnd()*6})).sort((a,b)=>a.k-b.k).map(x=>x.q);
      if (opps.length){
        const tgt = opps[0]; const anth = p.board.reduce((a,c)=>a+(c.anthem||0),0);
        const atk = p.board.filter(c=>c.creature && !c.sick);
        let dmg = 0; const blockers = tgt.board.filter(c=>c.creature).length;
        atk.forEach((c,i)=>{ const pw = c.pow + anth; if (c.evasive || i >= blockers) dmg += pw; else dmg += pw*0.35; });
        dmg += p.board.reduce((a,c)=>a+(c.tokensMade||0),0) * (blockers>atk.length?0.3:1);
        if (dmg>0){ tgt.life -= Math.round(dmg); kill(p, tgt, "combat"); }
        // quien va ganando recibe removal de los demás
        const lead = alive().reduce((a,q)=>threat(q)>threat(a)?q:a, alive()[0]);
        if (lead && threat(lead) >= 8 && respond(lead, "removal")){ const big = lead.board.filter(c=>c.creature||c.drawEngine||c.drain).sort((a,b)=>(b.pow+(b.drain?4:0)+(b.drawEngine?3:0))-(a.pow+(a.drain?4:0)+(a.drawEngine?3:0)))[0]; if (big){ lead.board.splice(lead.board.indexOf(big),1); if (big.cmd){ lead.cmdZone.push(big); lead.cmdTax += 2; } } }
      }
      for (const q of players) if (q.alive && q.life<=0) q.alive = false;
      if (alive().length===1) return {winner:alive()[0].seat, turn, how:alive()[0].how||"combat"};
      if (!alive().length) return {winner:-1, turn, how:null};
    }
  }
  return {winner:-1, turn:maxTurns, how:null};
}

// muchas partidas rotando asientos; devuelve estadísticas por mazo
async function simRun(deckObjs, n, onStep){
  let seed = 12345 + n; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const D = deckObjs.map(simDeck);
  const small = D.filter(x=>x.lib.length < (x.isC ? 60 : 30));
  if (small.length) throw Object.assign(new Error(`${small.map(x=>x.name).join(", ")} tiene${small.length>1?"n":""} muy pocas cartas para simular.`), {user:true});
  const isC = D[0].isC; const life = isC ? 40 : 20;
  const res = D.map(x=>({id:x.id, name:x.name, w:0, turns:[], how:{}, seat:[0,0,0,0], seatN:[0,0,0,0]}));
  let draws = 0;
  for (let g=0; g<n; g++){
    const order = D.map((_,i)=>i); const rot = g % D.length; const seats = order.slice(rot).concat(order.slice(0, rot));
    const out = simGame(seats.map(i=>D[i]), rnd, {life});
    seats.forEach((di, s)=>{ res[di].seatN[s]++; });
    if (out.winner<0) draws++;
    else { const di = seats[out.winner]; const R = res[di]; R.w++; R.turns.push(out.turn); R.how[out.how] = (R.how[out.how]||0)+1; R.seat[out.winner]++; }
    if (g % 50 === 49){ if (onStep) onStep(g+1); await new Promise(r=>setTimeout(r, 0)); }
  }
  return {at:Date.now(), n, draws, players:D.length, decks:res.map(r=>({id:r.id, name:r.name, pct:r.w/n, w:r.w, avgTurn:r.turns.length ? r.turns.reduce((a,x)=>a+x,0)/r.turns.length : null, how:r.how, seat:r.seat.map((w,i)=>r.seatN[i] ? w/r.seatN[i] : null)}))};
}

/* ---------- vista (dentro de Jugar → Partidas) ---------- */
S.simSel = S.simSel || {};
function simGamesHTML(d, A){
  const isC = A.isC;
  const rivals = S.data.decks.filter(x=>x.id!==d.id && (x.format||"commander")===(d.format||"commander"));
  const sel = S.simSel[d.id] || (S.simSel[d.id] = rivals.slice(0, isC ? 3 : 1).map(x=>x.id));
  const max = isC ? 3 : 1;
  const R = d.sim;
  const real = typeof gameStats==="function" ? gameStats(gamesOf(d)) : null;
  const howEs = {combat:"combate", drain:"drenaje", combo:"combo"};
  const mine = R && R.decks.find(x=>x.id===d.id);
  return `<div class="sec gm sim">
    <h3>Partidas simuladas</h3>
    <p class="lede">Juega cientos de partidas rápidas contra los mazos de tu grupo, rotando los asientos. Es un modelo aproximado: sirve para comparar mazos y ver tendencias, no para predecir una partida. No se mezcla con tus partidas reales.</p>
    ${rivals.length ? `<div class="gm-row"><span class="gm-l">Rivales (hasta ${max})</span><div class="chips">${rivals.map(x=>`<button class="chip" data-sim-opp="${esc(x.id)}" aria-pressed="${sel.includes(x.id)}">${esc(x.name)}${x.rival?` (${esc(x.rival.owner||"amigo")})`:""}</button>`).join("")}</div></div>
      <div class="row" style="margin-top:10px">${[200,500,1000].map(n=>`<button class="btn ${n===500?"primary":""}" data-sim-run="${n}" ${sel.length?"":"disabled"}>${n} partidas</button>`).join("")}</div>
      ${S.simBusy?`<p class="muted">Simulando… ${S.simBusy}</p>`:""}`
    : `<p class="muted">Agrega mazos de tu grupo en “Mazos de mis amigos” (o más mazos tuyos del mismo formato) para simular partidas contra ellos.</p>`}
    ${R ? `<h4 class="td-h">Resultado (${R.n} partidas, ${new Date(R.at).toLocaleDateString("es-CL",{day:"numeric",month:"short"})})</h4>
      <div class="tbl-wrap"><table><thead><tr><th>Mazo</th><th class="n">Gana</th><th class="n">Turno</th><th>Cómo</th></tr></thead><tbody>
      ${[...R.decks].sort((a,b)=>b.pct-a.pct).map(x=>`<tr${x.id===d.id?' class="td-mine"':""}><td>${esc(x.name)}</td><td class="n">${Math.round(x.pct*100)}%</td><td class="n">${x.avgTurn?x.avgTurn.toFixed(1).replace(".",","):"—"}</td><td style="font-size:.85rem">${Object.entries(x.how).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${howEs[k]||k} ${Math.round(100*v/Math.max(1,x.w))}%`).join(" · ")||"—"}</td></tr>`).join("")}
      </tbody></table></div>
      ${R.draws?`<p class="foot">${Math.round(100*R.draws/R.n)}% de las partidas llegó al turno 20 sin ganador.</p>`:""}
      ${mine && isC ? `<h4 class="td-h">Tu mazo por asiento</h4><div class="td-seats gm-seats">${mine.seat.slice(0, R.players).map((v,i)=>`<div class="td-seat"><small class="sc">asiento ${i+1}</small><b class="num">${v==null?"—":Math.round(v*100)+"%"}</b></div>`).join("")}</div>` : ""}
      ${mine ? `<p class="lede" style="margin-top:10px">${real && real.n>=5 ? `En la mesa real ganas ${Math.round(real.pct*100)}% (${real.n} partidas); la simulación da ${Math.round(mine.pct*100)}%. ${Math.abs(real.pct-mine.pct)>=0.15 ? (real.pct>mine.pct ? "Juegas el mazo mejor de lo que el modelo supone, o tu grupo interactúa menos." : "Tu grupo juega más fuerte o interactúa más de lo que el modelo supone.") : "Coinciden bastante."}` : `Esperado en una mesa pareja: ${Math.round(100/R.players)}%. ${mine.pct>=1.4/R.players ? "Tu mazo sale favorito en este grupo." : mine.pct<=0.6/R.players ? "Tu mazo sale en desventaja en este grupo." : "Tu mazo sale parejo con este grupo."}`}</p>` : ""}
      ${!d.combos && isC ? `<p class="foot">Los combos entran en la simulación después de <button class="btn sm ghost" style="padding:0" data-act="combos">buscarlos</button> en cada mazo.</p>` : ""}` : ""}
  </div>`;
}

document.addEventListener("click", async ev => {
  const o = ev.target.closest("[data-sim-opp]");
  if (o){ const d = S.data.decks.find(x=>x.id===S.sel[S.view]); if (!d) return; const A = analyze(d); const max = A.isC ? 3 : 1;
    const sel = S.simSel[d.id] || []; const id = o.dataset.simOpp;
    S.simSel[d.id] = sel.includes(id) ? sel.filter(x=>x!==id) : [...sel, id].slice(-max); render(); return; }
  const b = ev.target.closest("[data-sim-run]"); if (!b || S.simBusy) return;
  const d = S.data.decks.find(x=>x.id===S.sel[S.view]); if (!d) return;
  const opps = (S.simSel[d.id]||[]).map(id=>S.data.decks.find(x=>x.id===id)).filter(Boolean);
  if (!opps.length){ toast("Elige al menos un rival."); return; }
  const need = [d, ...opps].flatMap(x=>allNames(x)).filter(n=>!cardOf(n));
  if (need.length && !isWebView()) await fetchCards(need, {quiet:true});
  const n = +b.dataset.simRun; S.simBusy = `0 de ${n}`; render();
  try {
    const out = await simRun([d, ...opps], n, k=>{ S.simBusy = `${k} de ${n}`; const el = document.querySelector(".sim .muted"); if (el) el.textContent = `Simulando… ${S.simBusy}`; });
    const cur = S.data.decks.find(x=>x.id===d.id);
    if (cur){ saveDeck({...cur, sim:out}, {silent:true, noLog:true}); const me = out.decks.find(x=>x.id===d.id); toast(`Listo: tu mazo ganó ${Math.round(me.pct*100)}% de ${n} partidas simuladas.`); }
  } catch(e){ toast(e && e.user ? e.message : "No se pudo simular: " + ((e && e.message) || "error")); }
  finally { S.simBusy = null; render(); }
});
