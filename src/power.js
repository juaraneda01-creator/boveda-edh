/* =========================================================
   Bóveda EDH — Nivel de poder y sal (referencia: commandersalt.com)
   Nivel de 1 a 10 con componentes a la vista, sal del mazo
   (lista de sal de EDHREC), amenaza que perciben los rivales,
   bracket oficial vs. bracket realista y tabla comparativa.
   ========================================================= */

// Top de sal de EDHREC (0 a ~3). Se actualiza en vivo desde EDHREC en la versión en vivo.
const SALT_TOP = {"Stasis":3.06,"Winter Orb":2.96,"Vivi Ornitier":2.81,"Tergrid, God of Fright":2.8,"Rhystic Study":2.73,"The Tabernacle at Pendrell Vale":2.68,"Armageddon":2.67,"Static Orb":2.62,"Vorinclex, Voice of Hunger":2.61,"Thassa's Oracle":2.59,"Grand Arbiter Augustin IV":2.58,"Smothering Tithe":2.58,"Jin-Gitaxias, Core Augur":2.57,"The One Ring":2.55,"Humility":2.51,"Drannith Magistrate":2.46,"Expropriate":2.45,"Sunder":2.44,"Obliterate":2.42,"Devastation":2.41,"Ravages of War":2.39,"Cyclonic Rift":2.36,"Jokulhaups":2.36,"Apocalypse":2.34,"Opposition Agent":2.32,"Urza, Lord High Artificer":2.31,"Fierce Guardianship":2.3,"Hokori, Dust Drinker":2.27,"Back to Basics":2.23,"Nether Void":2.23,"Jin-Gitaxias, Progress Tyrant":2.22,"Braids, Cabal Minion":2.21,"Worldfire":2.2,"Toxrill, the Corrosive":2.19,"Aura Shards":2.18,"Gaea's Cradle":2.17,"Kinnan, Bonder Prodigy":2.15,"Yuriko, the Tiger's Shadow":2.15,"Teferi's Protection":2.13,"Blood Moon":2.13,"Narset, Parter of Veils":2.01,"Glacial Chasm":1.99,"Ruination":1.99,"Mindslaver":1.98,"Epicenter":1.97,"The Ur-Dragon":1.97,"Notion Thief":1.96,"Void Winnower":1.96,"Jodah, the Unifier":1.94,"Storm, Force of Nature":1.91,"Wake of Destruction":1.91,"Force of Negation":1.91,"Mana Drain":1.89,"Blightsteel Colossus":1.88,"Dictate of Erebos":1.88,"Boil":1.87,"Winota, Joiner of Forces":1.85,"Mana Breach":1.84,"Global Ruin":1.84,"Catastrophe":1.83,"Emrakul, the World Anew":1.83,"Acid Rain":1.83,"Time Stretch":1.83,"Grave Pact":1.82,"Impending Disaster":1.82,"Ulamog, the Defiler":1.82,"Demonic Consultation":1.82,"Underworld Breach":1.81,"Consecrated Sphinx":1.8,"Divine Intervention":1.79,"Thoughts of Ruin":1.79,"Miirym, Sentinel Wyrm":1.78,"Vorinclex, Monstrous Raider":1.78,"Ad Nauseam":1.78,"Seedborn Muse":1.77,"Cataclysm":1.76,"Elesh Norn, Mother of Machines":1.76,"Boiling Seas":1.76,"Magus of the Moon":1.75,"Elesh Norn, Grand Cenobite":1.74,"Sway of the Stars":1.74,"Hullbreaker Horror":1.74,"Necropotence":1.73,"Atraxa, Praetors' Voice":1.72};
const SALT_AT = "EDHREC, 28 de septiembre de 2026";
const SALT_SLUG = Object.fromEntries(Object.entries(SALT_TOP).map(([k,v])=>[slug(k), v]));
function saltOf(n, m){
  const live = S.salt && S.salt.map && (S.salt.map[slug(n)] ?? S.salt.map[slug(String(n).split(" // ")[0])] ?? (m && m.n ? S.salt.map[slug(m.n)] ?? S.salt.map[slug(String(m.n).split(" // ")[0])] : undefined));
  if (live != null) return live;
  const full = S.salt && S.salt.done;   // con la lista completa, lo que no aparece tiene sal baja
  const v = SALT_SLUG[slug(n)] ?? SALT_SLUG[slug(String(n).split(" // ")[0])] ?? (m ? SALT_SLUG[slug(m.n)] : undefined);
  if (v != null) return v;
  if (!m) return 0;
  // cartas fuera del top: estimación por lo que hacen
  const tg = m.tg || [];
  let s = 0.15;
  if (tg.includes("stax")) s += 1.1;
  if (m.mld) s += 1.4;
  if (m.xt) s += 1;
  if (tg.includes("theft")) s += 0.6;
  if ((m.r||[]).includes("tutor")) s += 0.5;
  if ((m.sb||[]).includes("counter")) s += 0.3;
  if ((m.r||[]).includes("wipe")) s += 0.45;
  const rf = m.rf || [];
  if (rf.includes("edict")) s += 0.7;
  if (rf.includes("hoser")) s += 1.0;
  if (rf.includes("deathDrain") || rf.includes("wcDrain")) s += 0.2;
  if (FAST_MANA.has(String(n).toLowerCase())) s += 0.4;
  if (m.gc) s += 0.4;
  return Math.min(full ? 0.75 : 1.6, s);
}
async function loadSaltLive(quiet){
  // versión en vivo: la lista completa ya armada en el servidor (todas las cartas con sal 0,8 o más)
  if (typeof LIVE!=="undefined" && LIVE){
    try { const r = await fetch("/api/salt"); const j = await r.json(); if (!r.ok || !j.map) throw 0;
      S.salt = {at:j.at, map:j.map, n:j.n, done:!!j.done}; idb.set("salt", S.salt); bumpAnalysis(); render(); if (!quiet) toast(`Sal actualizada desde EDHREC (${j.n} cartas).`); return; }
    catch { if (quiet) return; }
  }
  try {
    const r = await fetch("https://json.edhrec.com/pages/top/salt.json"); if (!r.ok) throw 0;
    const j = await r.json(); const list = (((j.container||{}).json_dict||{}).cardlists||[]).flatMap(c=>c.cardviews||[]);
    if (list.length < 50) throw 0;
    S.salt = {at:Date.now(), map:Object.fromEntries(list.filter(c=>c.salt!=null).map(c=>[slug(c.name), +c.salt]))};
    idb.set("salt", S.salt); bumpAnalysis(); render(); toast(`Sal actualizada desde EDHREC (${list.length} cartas).`);
  } catch { toast(typeof offlineMsg==="function" ? offlineMsg("EDHREC") : "EDHREC no respondió."); }
}
idb.get("salt").then(v=>{ if (v && v.map) S.salt = v; })
  .finally(()=>{ if (typeof LIVE!=="undefined" && LIVE && (!S.salt || !S.salt.done || Date.now()-(S.salt.at||0) > 7*864e5)) setTimeout(()=>loadSaltLive(true), 1500); });

/* ---------- motor de sacrificio que cierra partidas (sin depender de Commander Spellbook) ---------- */
// salida de sacrificio + cartas que drenan por cada muerte + cuerpos que vuelven o se multiplican = bucle que gana
function comboEngine(rows){
  const has = (m,k) => (m.tg||[]).includes(k) || (m.rf||[]).includes(k);
  const q = f => rows.filter(r=>r.m && f(r.m)).reduce((a,r)=>a+r.q,0);
  const outlets = q(m=>has(m,"sacOutlet") && m.t!=="Land");
  const drains = q(m=>has(m,"deathDrain"));
  const fodder = q(m=>has(m,"sacFodder") || (has(m,"minusPay") && has(m,"token")) || (has(m,"token") && has(m,"dies")));
  const loops = outlets>=2 && drains>=2 && fodder>=3 ? Math.min(4, Math.floor(Math.min(outlets, drains, fodder/2))) : 0;
  return {outlets, drains, fodder, loops};
}

/* ---------- evaluación ---------- */
const clamp10 = x => Math.max(0, Math.min(10, x));
// el nivel se calcula una vez por análisis (y por ajustes que lo cambian): la tabla, la mesa y el grupo lo piden muchas veces
const _pwMemo = new WeakMap();
function powerOf(d, A){
  A = A || analyze(d);
  const st = (S.data && S.data.settings) || {};
  const key = [S.noCal?1:0, S.noFit?1:0, st.cedhCal ? st.cedhCal.at+":"+st.cedhCal.k : 0, st.csFit && st.csFit.on ? st.csFit.a+":"+st.csFit.b : 0, S.salt ? S.salt.at||1 : 0, d.combos ? (d.combos.at||1)+":"+(d.combos.inc||[]).length : 0, S.td && S.td.data ? S.td.data.at : 0].join("|");
  const hit = _pwMemo.get(A); if (hit && hit.key === key && hit.d === d) return hit.P;
  const P = powerOfRaw(d, A); _pwMemo.set(A, {key, d, P}); return P;
}
// staples de torneo: las más jugadas en TopDeck.gg (si se cargaron) y la lista fija de piezas cEDH
function stapleSet(){
  const k = S.td && S.td.data ? S.td.data.at : 0; if (stapleSet._k === k && stapleSet._v) return stapleSet._v;
  const s = new Set(Object.values(typeof CEDH_STAPLES!=="undefined" ? CEDH_STAPLES : {}).flat().map(slug));
  for (const [n, p] of (S.td && S.td.data && S.td.data.staples) || []) if (p >= 8) s.add(slug(n));
  stapleSet._k = k; return (stapleSet._v = s);
}
// bracket por dos ejes, como CommanderBracket: velocidad (en qué turno amenaza ganar) y deformación de la partida
// (stax, destrucción masiva de tierras, cadenas de turnos extra, interacción gratis). Manda el más alto.
const SPEED_TURNS = [[10,1],[8,2],[6,3],[4,4]];
function axesOf(d, A, x){
  const {sim, c2, fast, stax, free, cedh} = x;
  let t = sim && sim.winAvg ? sim.winAvg : null; const why = [];
  if (t != null) why.push(`remate lanzable en el turno ${t.toFixed(1).replace(".",",")}`);
  // un combo de 2 cartas con tutores adelanta la amenaza aunque el remate normal llegue tarde
  if ((c2||0) >= 1 && A.tutors.length >= 3){ const ct = Math.max(3, 7 - A.tutors.length*0.35 - fast*0.3); if (t == null || ct < t){ t = ct; why.push(`combo de 2 cartas con ${A.tutors.length} tutores (≈ turno ${ct.toFixed(1).replace(".",",")})`); } }
  let speed = t == null ? 2 : (SPEED_TURNS.find(([lim])=>t >= lim) || [0, 4])[1];
  if (t != null && t < 4 && cedh) speed = 5;
  const w = []; let warp = 1;
  if (A.mld.length){ warp = Math.max(warp, 4); w.push(`destrucción masiva de tierras (${A.mld.slice(0,2).join(", ")})`); }
  if (A.xt.length >= 2 || (A.xt.length && A.tutors.length >= 3)){ warp = Math.max(warp, 4); w.push(`turnos extra encadenables (${A.xt.slice(0,2).join(", ")})`); }
  else if (A.xt.length){ warp = Math.max(warp, 3); w.push(`un turno extra (${A.xt[0]})`); }
  if (stax >= 3){ warp = Math.max(warp, 4); w.push(`${stax} piezas de stax`); } else if (stax){ warp = Math.max(warp, 3); w.push(`${stax} pieza${stax>1?"s":""} de stax`); }
  if (free >= 3){ warp = Math.max(warp, 4); w.push(`${free} hechizos de interacción gratis`); } else if (free){ warp = Math.max(warp, 3); w.push(`${free} de interacción gratis`); }
  if (cedh && warp >= 4 && speed >= 4) speed = 5;
  if (!w.length) w.push("nada que deforme la partida (el removal y los contrahechizos normales no cuentan)");
  return {speed, warp, b: Math.max(speed, warp), turn: t, speedWhy: why.join("; ") || "sin remate detectado", warpWhy: w.join("; ")};
}
// ajuste lineal (mínimos cuadrados) del nivel a los valores de Commandersalt que anotaste en tus mazos
function csFitCompute(){
  const pts = S.data.decks.filter(d=>d.format==="commander" && d.csRef && d.csRef.p).map(d=>{ S.noFit = true; try { return [powerOf(d, analyze(d)).abs, +d.csRef.p, d.name]; } finally { S.noFit = false; } });
  if (pts.length < 3) return {err:`Anota el nivel de Commandersalt en al menos 3 mazos (tienes ${pts.length}).`};
  const n = pts.length, mx = pts.reduce((a,p)=>a+p[0],0)/n, my = pts.reduce((a,p)=>a+p[1],0)/n;
  const sxx = pts.reduce((a,p)=>a+(p[0]-mx)**2,0), sxy = pts.reduce((a,p)=>a+(p[0]-mx)*(p[1]-my),0);
  if (sxx < 0.25) return {err:"Tus mazos con referencia tienen niveles muy parecidos: agrega uno más bajo o más alto para ajustar la pendiente."};
  const a = Math.max(0.5, Math.min(2, sxy/sxx)), b = my - a*mx;
  const err0 = Math.sqrt(pts.reduce((s,p)=>s+(p[0]-p[1])**2,0)/n), err1 = Math.sqrt(pts.reduce((s,p)=>s+(a*p[0]+b-p[1])**2,0)/n);
  return {a:Math.round(a*1000)/1000, b:Math.round(b*1000)/1000, n, err0:Math.round(err0*100)/100, err1:Math.round(err1*100)/100, at:Date.now(), on:true, pts:pts.map(p=>({n:p[2], x:Math.round(p[0]*100)/100, y:p[1]}))};
}
function powerOfRaw(d, A){
  const sim = simulate(d, A);
  const rows = [...A.rows, ...A.cmdMeta.filter(Boolean).map(m=>({n:m.n, q:1, m, cmd:true}))].filter(r=>r.m);
  const cnt = f => rows.filter(r=>f(r.m, r)).reduce((a,r)=>a+r.q,0);
  const fast = cnt((m,r)=>FAST_MANA.has(r.n.toLowerCase()));
  const cheapRamp = cnt(m=>(m.r||[]).includes("ramp") && m.cmc<=2 && m.t!=="Land");
  const bigMana = cnt(m=>(m.rf||[]).includes("bigMana") && m.t!=="Land" && !/Instant|Sorcery/.test(m.t));
  const oneDrops = cnt(m=>(m.r||[]).includes("ramp") && m.cmc<=1 && m.t!=="Land");
  const protect = cnt(m=>(m.rf||[]).includes("protect") || (m.r||[]).includes("protection"));
  const select = cnt(m=>(m.rf||[]).includes("select"));
  const counters2 = cnt(m=>(m.rf||[]).includes("counter") || (m.sb||[]).includes("counter"));
  const free = cnt((m,r)=>FREE_INTERACTION.has(r.n.toLowerCase()));
  const counters = cnt(m=>(m.sb||[]).includes("counter"));
  const stax = cnt(m=>(m.tg||[]).includes("stax"));
  const c2 = d.combos ? combos2(d).length : null;
  const c3 = d.combos ? (d.combos.inc||[]).filter(c=>c.cards.length===3).length : null;
  const Y = typeof synergyOf==="function" ? synergyOf(d, A) : null;
  const scale = A.isC ? 1 : 0.6;
  const E = comboEngine(rows);
  const tutorQ = rows.filter(r=>!r.cmd && (r.m.r||[]).includes("tutor")).reduce((a,r)=>a + r.q*((r.m.tq!=null ? r.m.tq : 60)/100), 0);
  // tribal fuerte: la mayoría de las criaturas comparte tipo y hay cartas que lo aprovechan
  const crN = cnt(m=>m.t==="Creature"); const tb = Y && Y.tribes && Y.tribes[0];
  const tribeV = tb && crN ? Math.min(8, (tb.n/crN >= 0.6 ? 6 : tb.n/crN >= 0.4 ? 4 : 0) + Math.min(2, tb.pay.length*0.2)) : 0;
  const comp = [
    {k:"accel", es:"Aceleración", v:clamp10(fast*1.2 + cheapRamp*0.3/scale + bigMana*0.9), why:`${fast} de maná rápido, ${cheapRamp} ramp de 2 o menos${bigMana?`, ${bigMana} de mucho maná`:""}`, w:0.17},
    {k:"tutors", es:"Tutores", v:clamp10(tutorQ*1.4/scale), why:`${A.tutors.length} tutores (calidad ${A.tutors.length?Math.round(100*tutorQ/A.tutors.length):0}/100)`, w:0.13},
    {k:"interaction", es:"Interacción", v:clamp10((Math.max(A.roles.removal, counters2) + A.roles.wipe*1.3 + free*1.5 + protect*0.2)/1.6/scale), why:`${A.roles.removal} removal, ${A.roles.wipe} barridos, ${free} gratis, ${protect} protección`, w:0.13},
    {k:"cards", es:"Ventaja de cartas", v:clamp10((A.roles.draw + select*0.6)*0.8/scale), why:`${A.roles.draw} fuentes de robo${select?`, ${select} de selección`:""}`, w:0.11},
    {k:"efficiency", es:"Eficiencia", v:!A.spells ? null : clamp10(10 - (A.avg-1.9)*3.2 - (sim && sim.pScrew ? sim.pScrew*8 : 0)), why:`CMC promedio ${A.avg.toFixed(2)}${sim?`, ${Math.round((sim.pScrew||0)*100)}% manos atascadas`:""}`, w:0.13},
    {k:"combo", es:"Combos", v:c2==null ? (E.loops ? clamp10(E.loops*1.6) : null) : clamp10(c2*3.5 + c3*1.2 + E.loops*0.8), why:c2==null ? (E.loops ? `motor de sacrificio (${E.outlets} salidas, ${E.drains} drenajes); busca combos para confirmar` : "sin revisar (usa Buscar combos)") : `${c2} de 2 cartas, ${c3} de 3${E.loops?", motor de sacrificio":""}`, w:0.2},
    {k:"synergy", es:"Sinergia", v:Y ? clamp10(Math.max(Y.cohesion/10, tribeV)) : null, why:Y ? `cohesión ${Y.cohesion}%${tribeV>Y.cohesion/10?", tribal fuerte":""}` : "", w:0.08},
  ];
  // bonificación de aceleración temprana (muchas piezas de maná de 1): como la que suma Commandersalt
  const early = A.isC ? Math.max(0, oneDrops - 5) * 0.25 : 0;
  const bonus = Math.min(0.6, A.gc.length*0.1) + Math.min(0.8, stax*0.2) + (A.xt.length ? 0.3 : 0) + Math.min(1, early);
  const absOf = list => { const wsum = list.reduce((a,c)=>a+c.w,0) || 1; const raw = list.reduce((a,c)=>a+c.v*c.w,0) / wsum + bonus; return Math.max(1, Math.min(10, 1 + raw*0.95)); };
  const have = comp.filter(c=>c.v!=null);
  const abs0 = absOf(have);
  // base sin combos: es la que se calibra (las listas típicas de torneo no traen combos revisados)
  const absNC = absOf(have.filter(c=>c.k!=="combo"));
  // calibración con listas de torneo: estira solo el tramo sobre 8 de la base; lo que suman o restan los combos va aparte, sin estirar
  const cal = !S.noCal && S.data && S.data.settings && S.data.settings.cedhCal;
  const k = cal ? Math.min(2, +cal.k || 1) : 1;
  const absCal = k > 1 && absNC > 8 ? Math.max(1, Math.min(10, 8 + (absNC - 8) * k + (abs0 - absNC))) : abs0;
  // ajuste a tus referencias de Commandersalt (si lo activaste)
  const fit = !S.noFit && S.data && S.data.settings && S.data.settings.csFit;
  const abs = fit && fit.on && fit.a ? Math.max(1, Math.min(10, fit.a*absCal + fit.b)) : absCal;
  const power = Math.round(abs * 10) / 10;
  // bracket realista según el nivel y los elementos que definen cEDH
  const cedh = fast>=5 && A.tutors.length>=5 && (c2||0)>=1;
  const real = cedh || power>=8.8 ? 5 : power>=7.2 ? 4 : power>=5.4 ? 3 : power>=3 ? 2 : 1;
  const official = bracketOf(d, A);
  // sal y amenaza
  const salty = rows.filter(r=>!r.m.basic).map(r=>({n:r.n, m:r.m, s:saltOf(r.n, r.m)})).sort((a,b)=>b.s-a.s);
  const saltSum = salty.reduce((a,x)=>a+x.s,0);
  const salt = Math.round(Math.min(100, saltSum*2.2));
  const saltLabel = salt>=70 ? "Muy salado" : salt>=45 ? "Salado" : salt>=25 ? "Picante" : "Suave";
  const threatCards = rows.filter(r=>(r.m.tg||[]).some(k=>["stax","drawPay","theft","extraCombat"].includes(k)) || ((r.m.r||[]).includes("draw") && r.m.t!=="Instant" && r.m.t!=="Sorcery") || (r.m.sb||[]).includes("counter"));
  const threat = Math.round(clamp10((threatCards.length*0.3 + stax*0.8 + A.gc.length*0.4) / (A.isC?1:0.6)) * 10) / 10;
  const axes = A.isC ? axesOf(d, A, {sim, c2, fast, stax, free, cedh}) : null;
  // densidad competitiva: qué parte de los hechizos son piezas habituales de torneo
  const SS = stapleSet(); const spellsN = rows.filter(r=>!r.cmd && r.m.t!=="Land").reduce((a,r)=>a+r.q,0);
  const stN = rows.filter(r=>!r.cmd && r.m.t!=="Land" && SS.has(slug(r.n))).reduce((a,r)=>a+r.q,0);
  const density = spellsN ? {pct: stN/spellsN, n: stN, of: spellsN} : null;
  return {power, abs, abs0, absNC, absCal, fit: fit && fit.on ? fit : null, comp, E, early, real, official, cedh, salt, saltLabel, saltTop:salty.slice(0,10), threat, threatCards, sim, c2, axes, density};
}

/* ---------- vista del mazo ---------- */
const PL_ES = p => p>=9 ? "competitivo (cEDH)" : p>=7.5 ? "alto poder" : p>=6 ? "optimizado" : p>=4 ? "casual mejorado" : "casual";
function powerHTML(d, A){
  const P = powerOf(d, A);
  const R = typeof reportOf==="function" ? reportOf(d, A) : null;
  // datos de cartas guardados antes de la ficha: se completan solos una vez por sesión
  if (R && R.stale && !isWebView() && !S.busy){ S.rpAuto = S.rpAuto || {}; if (!S.rpAuto[d.id]){ S.rpAuto[d.id] = 1;
    const names = A.rows.filter(r=>r.m && !r.m.basic && r.m.rv!==RF_V).map(r=>r.n).concat(A.cmdMeta.filter(m=>m && m.rv!==RF_V).map(m=>m.n));
    setTimeout(async ()=>{ await fetchCards(names, {force:true, quiet:true, label:"Completando la ficha del mazo"}); bumpAnalysis(); render(); }, 50); } }
  // historial del nivel: solo con datos completos, para que "subió/bajó" refleje cambios reales del mazo
  if (R && !R.stale && !A.missing.length && typeof recordPower==="function" && recordPower(d, A)) setTimeout(()=>{ lsSet(LS_DATA, S.data, true); saveDataIdb(); }, 0);
  const bar = v => v==null ? `<span class="muted">—</span>` : `<span class="pw-bar"><i style="width:${v*10}%"></i></span><span class="num pw-v">${v.toFixed(1)}</span>`;
  return `${R ? reportHTML(d, A) : ""}
  <div class="two">
    <div class="sec"><h3>Lo que más sala la mesa</h3>${P.saltTop.filter(x=>x.s>0.4).map(x=>`<div class="rec"><span>${cardName(x.n,x.m)}${SALT_SLUG[slug(x.n)]!=null||(S.salt&&S.salt.map[slug(x.n)]!=null)?` <span class="tag">top sal EDHREC</span>`:""}</span><span class="meta num">${x.s.toFixed(2)}</span></div>`).join("") || `<p class="muted">Nada especialmente salado.</p>`}
      <p class="foot">Sal de 0 a 3 según la votación de EDHREC (${S.salt?`${S.salt.n?`${S.salt.n} cartas, `:""}actualizada ${new Date(S.salt.at).toLocaleDateString("es-CL")}`:esc(SALT_AT)}); las demás cartas se estiman por lo que hacen. ${isWebView()?"":`<button class="btn sm ghost" style="padding:0" data-pw="salt">Actualizar desde EDHREC</button>`}</p></div>
    <div class="sec"><h3>Por qué te ven como amenaza <span class="num muted" style="font-weight:400">${P.threat.toFixed(1)}/10</span></h3>${P.threatCards.length?`<div class="chips">${P.threatCards.slice(0,16).map(r=>`<span class="pill neutral" style="font-size:.9rem">${cardName(r.n,r.m)}</span>`).join("")}</div>`:`<p class="muted">Pocas cartas que llamen la atención de la mesa.</p>`}
      <p class="foot">Motores de robo, stax, contrahechizos, robo de permanentes y combates extra.</p></div>
  </div>
  <details class="sec pw-det"><summary><h3 style="display:inline">Cómo se calcula el nivel</h3></summary><div class="pw-comp">${P.comp.map(c=>`<div class="pw-row"><span class="pw-n">${c.es}</span>${bar(c.v)}<span class="muted pw-why">${esc(c.why)}</span></div>`).join("")}</div>
    ${P.c2==null?`<p class="foot"><button class="btn sm ghost" style="padding:0" data-act="combos">Buscar combos</button> para que el nivel considere los combos (pesan 20%).</p>`:""}
    <p class="foot">Se suman al nivel: Game Changers (${A.gc.length}), piezas de stax y turnos extra. El bracket oficial sigue la guía de Wizards (Game Changers, combos de 2 cartas, turnos extra, destrucción de tierras); el realista sale del nivel de poder. Criterios inspirados en <a href="https://www.commandersalt.com/" target="_blank" rel="noopener">Commandersalt</a>.</p></details>
  <div class="sec"><h3>Compárate</h3><p class="lede">La tabla con todos tus mazos y los de tus amigos está en <button class="btn sm ghost" style="padding:0" data-act="show-local">Mazos de mis amigos</button>.</p></div>`;
}
// tabla (leaderboard) de todos los mazos de Commander: tuyos y de tus amigos
function powerBoardHTML(){
  const all = S.data.decks.filter(d=>d.format==="commander");
  if (!all.length) return "";
  const sort = S.pwSort || "power";
  const rows = all.map(d=>{ const A = analyze(d); return {d, P:powerOf(d, A)}; })
    .sort((a,b)=> sort==="salt" ? b.P.salt-a.P.salt : sort==="threat" ? b.P.threat-a.P.threat : b.P.power-a.P.power);
  const th = (k,l) => `<th class="n"><button class="linkish" data-pw-sort="${k}" aria-pressed="${sort===k}">${l}${sort===k?" ↓":""}</button></th>`;
  const anyCS = all.some(d=>d.csRef), anyG = all.some(d=>typeof gameRecord==="function" && gameRecord(d));
  return `<div class="sec"><h3>Tabla de poder y sal</h3><p class="lede">Todos tus mazos y los de tus amigos con los mismos criterios. Toca una columna para ordenar.</p>
    <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Mazo</th>${th("power","Nivel")}${th("salt","Sal")}${th("threat","Amenaza")}<th class="n">Bracket</th>${anyCS?`<th class="n">Commandersalt</th>`:""}${anyG?`<th class="n">Récord</th>`:""}</tr></thead><tbody>
    ${rows.map((r,i)=>`<tr${r.d.rival?"":' style="background:var(--accent-soft)"'}><td class="num">${i+1}</td><td><b>${esc(r.d.name)}</b><br><span class="muted" style="font-size:.85rem">${esc((r.d.commanders||[]).join(" + "))} · ${r.d.rival?esc(r.d.rival.owner||"amigo"):"tú"}</span></td><td class="n">${r.P.power.toFixed(1)}</td><td class="n">${r.P.salt}</td><td class="n">${r.P.threat.toFixed(1)}</td><td class="n">${r.P.official.b} / ${r.P.real}</td>${anyCS?`<td class="n">${r.d.csRef?Number(r.d.csRef.p).toFixed(1):"—"}</td>`:""}${anyG?(()=>{ const g = gameRecord(r.d); return `<td class="n">${g?`${g.w}-${g.l}${g.dr?`-${g.dr}`:""} · ${Math.round(g.pct*100)}%`:"—"}</td>`; })():""}</tr>`).join("")}
    </tbody></table></div><p class="foot">Bracket: oficial / realista.${anyCS?" Commandersalt: el nivel que anotaste en la ficha de cada mazo.":""}</p>
    ${anyCS?(()=>{ const F = S.data.settings.csFit; const nCS = all.filter(d=>d.csRef).length;
      return `${F && F.on ? `<p class="lede">Nivel ajustado a tus referencias de Commandersalt (${F.n} mazos): nivel = ${String(F.a).replace(".",",")} × calculado ${F.b>=0?"+":"−"} ${String(Math.abs(F.b)).replace(".",",")}. Error promedio: de ${String(F.err0).replace(".",",")} a ${String(F.err1).replace(".",",")} niveles.</p>` : nCS>=3 ? `<p class="lede">Con ${nCS} mazos medidos en Commandersalt puedo ajustar la escala para que el nivel de todos tus mazos (y los de tus amigos) se parezca más al de Commandersalt.</p>` : ""}
      <div class="row"><button class="btn sm" data-pw="cs-copy">Copiar comparación con Commandersalt</button>${F && F.on ? `<button class="btn sm" data-pw="cs-fit">Volver a ajustar</button><button class="btn sm ghost" data-pw="cs-unfit">Quitar ajuste</button>` : nCS>=3 ? `<button class="btn sm primary" data-pw="cs-fit">Ajustar a Commandersalt</button>` : `<span class="muted" style="font-size:.88rem">Anota Commandersalt en ${3-nCS} mazo${3-nCS>1?"s":""} más para poder ajustar la escala.</span>`}</div>`; })():""}</div>`;
}
function powerPromptText(d, A){ const P = powerOf(d, A); return `Nivel estimado por la app: ${P.power}/10 (${PL_ES(P.power)}); sal ${P.salt}/100; bracket oficial ${P.official.b}, realista ${P.real}.`; }

document.addEventListener("click", async ev => {
  const s = ev.target.closest("[data-pw-sort]"); if (s){ S.pwSort = s.dataset.pwSort; render(); return; }
  const b = ev.target.closest("[data-pw]"); if (b && b.dataset.pw==="salt") await loadSaltLive();
  if (b && b.dataset.pw==="cs-fit"){ const F = csFitCompute(); if (F.err){ toast(F.err); return; } S.data.settings.csFit = F; saveData(); bumpAnalysis(); render(); toast(`Escala ajustada con ${F.n} mazos: el error promedio baja de ${F.err0.toFixed(2)} a ${F.err1.toFixed(2)} niveles.`); return; }
  if (b && b.dataset.pw==="cs-unfit"){ delete S.data.settings.csFit; saveData(); bumpAnalysis(); render(); toast("Ajuste a Commandersalt quitado."); return; }
  if (b && b.dataset.pw==="cs-copy"){
    const rows = S.data.decks.filter(d=>d.format==="commander" && d.csRef).map(d=>{ const A = analyze(d), P = powerOf(d, A); return `${d.name} (${(d.commanders||[]).join(" + ")}): Bóveda ${P.power.toFixed(1)} · Commandersalt ${Number(d.csRef.p).toFixed(2)} · diferencia ${(P.power-d.csRef.p>=0?"+":"")+(P.power-d.csRef.p).toFixed(1)} · bracket ${P.official.b}/${P.real}`; });
    copyText("Comparación Bóveda EDH vs Commandersalt\n" + rows.join("\n")); }
});
