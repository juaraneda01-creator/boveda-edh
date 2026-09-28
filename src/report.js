/* =========================================================
   Bóveda EDH — Ficha del mazo (referencia: Commandersalt)
   Medidor de nivel, boleta de notas, perfil, pilares contra una
   base casual o cEDH, tabla nutricional, radiografía por áreas
   y tarjeta de regla 0 para conversar el nivel antes de jugar.
   ========================================================= */
const RF_V = 1;   // versión de las marcas de cada carta; si sube, se vuelven a calcular

// marcas extra por carta, calculadas con el texto de Oracle (se guardan en m.rf y m.tq)
function cardFlags(o, t, tl){
  o = o || ""; const f = new Set(); const land = t === "Land";
  const perm = !/Instant|Sorcery/.test(t||"");
  if (/(^|\n)flash(\s|$)/.test(o)) f.add("flash");
  if (/counter target (\w+ ){0,3}(spell|ability)/.test(o)) f.add("counter");
  if (/(creatures?|permanents?|artifacts?|planeswalkers?|lands?|commanders?|\w+s) you control (gain|gains|have|has|get)[^.]*(hexproof|indestructible|shroud|protection from)/.test(o)
    || /target (\w+ ){0,2}(creature|permanent|artifact|planeswalker)s? you control (gains?|gets?)[^.]*(hexproof|indestructible|shroud|protection)/.test(o)
    || /\bphases? out\b/.test(o) || /can't be countered/.test(o) || /that targets? (a|an|one or more) [^.]*you control/.test(o)
    || /spells your opponents cast that target [^.]*cost/.test(o) || /\bward\b/.test(o) && /you control/.test(o)) f.add("protect");
  if (/cost \{\d+\} more|costs? \{\d+\} more|costs? \{x\} more|unless (that player|its controller|they|he or she) pays?/.test(o)) f.add("tax");
  if (/(target (player|opponent)|each opponent|each player) (reveals [^.]*hand[^.]*)?discards?/.test(o)) f.add("discard");
  if (/each opponent loses|target (player|opponent) loses (\d+|x|that much|half)|deals? (\d+|x) damage to each opponent|each opponent (mills|loses)/.test(o)) f.add("wcDrain");
  if (/you win the game|loses the game/.test(o)) f.add("wcAlt");
  if (/(target player|target opponent|each opponent) mills|mills? (\w+ )?cards? equal/.test(o) && !/you mill/.test(o)) f.add("wcMill");
  if (/creatures you control get \+|other (\w+ ){1,2}(creatures )?(you control )?get \+|\w+s you control get \+\d|creatures you control (gain|have) (trample|double strike|flying)|can't be blocked|additional combat|double strike|\w+walk\b/.test(o)) f.add("wcCombat");
  if (/spells? you cast (of the chosen type |that share a creature type )?costs? \{\d\} less|(\w+ )?(creature )?spells (and \w+ spells )?you cast (of the chosen type )?cost \{\d\} less/.test(o)) f.add("reducer");
  if (/(^|\n)infect|toxic \d|poison counter/.test(o)) f.add("wcPoison");
  if (perm && !land && /whenever|at the beginning of/.test(o)) f.add("repeat");
  if (!perm && /draw|create|search your library|return|put [^.]*counter|onto the battlefield/.test(o)) f.add("oneShot");
  if (/when(ever)? [^.]*(enters|enter the battlefield)/.test(o)) f.add("etb");
  if (/when(ever)? [^.]*dies|when(ever)? [^.]*is put into a graveyard from the battlefield/.test(o)) f.add("dies");
  if (/(search your library for|put) [^.]*\bland (card|cards)?[^.]*onto the battlefield|put (a|up to (one|two)) land cards? from your hand onto the battlefield|play (an|two) additional lands?|search your library for (a|up to (one|two|three)) basic land/.test(o) && !land) f.add("landRamp");
  if (/(return|put) [^.]*from (your|a) graveyard (to|onto|into)|return target [^.]*card from your graveyard/.test(o)) f.add("recursion");
  if (land){
    if (/search your library for/.test(o)) f.add("fetch");
    const lines = o.replace(/\([^)]*\)/g,"").split("\n").map(x=>x.trim()).filter(Boolean);
    if (lines.some(x=>/:/.test(x) && !/add (\{|one mana|two mana|three mana|an amount|x mana|mana)/.test(x) && !/search your library/.test(x)) || /can't be countered|becomes a [^.]*creature|cycling|channel/.test(o)) f.add("utility");
  }
  if (/(^|\n)(scry|surveil) \d|look at the top|draw a card\.?$/m.test(o) && !perm) f.add("select");
  // tutor: 100 = cualquier carta a la mano, menos si restringe tipo o va arriba de la biblioteca
  let tq;
  const tm = o.match(/search your library for (a|an|up to (one|two|three)) ([^.]*?)card[^.]*?(put (it|that card) (into your hand|onto the battlefield|on top)|reveal it)/);
  if (tm && !/basic land|land card|forest|island|plains|swamp|mountain/.test(tm[3])){
    const any = tm[3].trim()==="" ;
    const where = /onto the battlefield/.test(o) ? "bf" : /on top of (your|its owner's) library|then shuffle and put that card on top/.test(o) ? "top" : "hand";
    tq = (any ? 100 : 60) * (where==="top" ? 0.55 : where==="bf" ? 0.9 : 1);
    tq = Math.round(tq);
  }
  return {rf:[...f], tq, rv:RF_V};
}

/* ---------- utilidades ---------- */
const LV = (n, dense, mod, light=1) => n>=dense ? {k:"dense", es:"Denso"} : n>=mod ? {k:"mod", es:"Moderado"} : n>=light ? {k:"light", es:"Ligero"} : {k:"none", es:"—"};
const GRADE = v => v==null ? "—" : v>=9.3?"A+":v>=8.7?"A":v>=8?"A-":v>=7.5?"B+":v>=7?"B":v>=6.5?"B-":v>=6?"C+":v>=5.3?"C":v>=4.6?"C-":v>=3.8?"D+":v>=3?"D":"F";
const DECK_TYPE = p => p>=9.3 ? {es:"cEDH", s:"Se juega para ganar lo antes posible."} : p>=8.3 ? {es:"Alto poder", s:"Optimizado a fondo, sin llegar a cEDH."} : p>=7 ? {es:"Optimizado", s:"Afinado, con respuestas y remates claros."} : p>=5 ? {es:"Casual enfocado", s:"Tiene un plan y lo sigue."} : {es:"Casual", s:"Para pasarlo bien y ver qué pasa."};
function cmdTier(d){
  const top = (typeof META!=="undefined" && META.cedh && META.cedh.top) || [];
  const names = (d.commanders||[]).map(n=>slug(n));
  if (!names.length) return null;
  const idx = top.findIndex(([n])=>{ const parts = String(n).split(" / ").map(slug); return names.every(x=>parts.includes(x)) || names.some(x=>parts.length===1 && parts[0]===x); });
  if (idx<0) return {t:4, why:"no aparece en el meta de cEDH"};
  return idx<10 ? {t:1, why:`top ${idx+1} de cEDH`} : idx<30 ? {t:2, why:`puesto ${idx+1} en cEDH`} : {t:3, why:`aparece en cEDH (puesto ${idx+1})`};
}
const typeHits = m => { const tl = (m.tl||m.t||""); return ["Creature","Artifact","Enchantment","Instant","Sorcery","Planeswalker","Battle"].filter(x=>tl.includes(x)); };

/* ---------- cálculo de la ficha ---------- */
const _repMemo = new WeakMap();
function reportOf(d, A){
  A = A || analyze(d);
  const hit = _repMemo.get(d); if (hit && hit.ep===_anaEpoch && hit.A===A) return hit.R;
  const P = powerOf(d, A);
  const Y = typeof synergyOf==="function" ? synergyOf(d, A) : null;
  const rows = A.rows.filter(r=>r.m);
  const nonland = rows.filter(r=>r.m.t!=="Land"), lands = rows.filter(r=>r.m.t==="Land");
  const sum = arr => arr.reduce((a,r)=>a+r.q,0);
  const has = (r,k) => (r.m.rf||[]).includes(k);
  const cnt = k => sum(rows.filter(r=>has(r,k)));
  const role = k => sum(rows.filter(r=>(r.m.r||[]).includes(k)));
  const stale = rows.filter(r=>!r.m.basic && r.m.rv!==RF_V).length;
  // base de maná
  const basics = sum(lands.filter(r=>r.m.basic || /Basic/.test(r.m.tl||"")));
  const colors = (A.ci||"").split("").filter(c=>WUBRG.includes(c)).length;
  const mana = {lands:sum(lands), basics, nonbasic:sum(lands)-basics, fetch:cnt("fetch"), utility:cnt("utility"), colors, lv: LV(sum(lands), 38, 34, 30)};
  // composición (una carta con varios tipos cuenta en cada uno)
  const withCmd = [...nonland, ...A.cmdMeta.filter(Boolean).map(m=>({n:m.n, q:1, m}))];
  const comp = {}; for (const r of withCmd) for (const t of typeHits(r.m)) comp[t]=(comp[t]||0)+r.q;
  const nonlandN = sum(nonland), compN = sum(withCmd), permN = sum(withCmd.filter(r=>!/Instant|Sorcery/.test(r.m.t)));
  // curva
  const mvs = nonland.map(r=>({mv:Math.round(r.m.cmc||0), q:r.q}));
  const buckets = {}; for (const x of mvs) buckets[x.mv]=(buckets[x.mv]||0)+x.q;
  const peak = +Object.entries(buckets).sort((a,b)=>b[1]-a[1] || a[0]-b[0])[0]?.[0] || 0;
  const curve = {avg:A.avg, peak, cheap:sum(nonland.filter(r=>(r.m.cmc||0)<2)), fin:sum(nonland.filter(r=>(r.m.cmc||0)>=6))};
  curve.lv = A.avg<=2.6 ? {k:"fast", es:"Rápida"} : A.avg<=3.3 ? {k:"mod", es:"Moderada"} : {k:"slow", es:"Lenta"};
  // ramp
  const fast = sum(rows.filter(r=>FAST_MANA.has(r.n.toLowerCase())));
  const rampR = nonland.filter(r=>(r.m.r||[]).includes("ramp"));
  const ramp = {n:sum(rampR), rocks:sum(rampR.filter(r=>/Artifact/.test(r.m.tl||r.m.t))), dorks:sum(rampR.filter(r=>r.m.t==="Creature" && !has(r,"landRamp"))), land:sum(nonland.filter(r=>has(r,"landRamp"))), red:cnt("reducer"), fast};
  ramp.lv = LV(ramp.n + ramp.land*0.5, 12, 8, 1);
  // tutores
  const tutR = nonland.filter(r=>(r.m.r||[]).includes("tutor"));
  const tq = tutR.map(r=>r.m.tq).filter(x=>x!=null);
  const tutors = {n:sum(tutR), q: tq.length ? Math.round(tq.reduce((a,x)=>a+x,0)/tq.length) : null, lv: LV(sum(tutR), 5, 3, 1)};
  // ventaja de cartas
  const cards = {draw:role("draw"), rec:Math.max(role("recursion"), cnt("recursion"))};
  cards.lvDraw = LV(cards.draw, 12, 8, 1); cards.lvRec = LV(cards.rec, 5, 3, 1);
  // interacción
  const counters = sum(nonland.filter(r=>has(r,"counter") || (r.m.sb||[]).includes("counter")));
  const removal = sum(nonland.filter(r=>(r.m.r||[]).includes("removal") && !has(r,"counter") && !(r.m.sb||[]).includes("counter")));
  const inter = {counters, removal, wipes:role("wipe"), protect:Math.max(role("protection"), cnt("protect")), grave:sum(rows.filter(r=>(r.m.sb||[]).includes("grave"))), free:sum(rows.filter(r=>FREE_INTERACTION.has(r.n.toLowerCase())))};
  inter.lv = {counters:LV(counters,6,3), removal:LV(removal,8,5), wipes:LV(inter.wipes,3,2), protect:LV(inter.protect,5,3), grave:LV(inter.grave,3,2)};
  const interTotal = counters + removal + inter.wipes + inter.protect;
  inter.all = LV(interTotal, 20, 12, 1);
  // negación de recursos
  const deny = {stax:sum(rows.filter(r=>(r.m.tg||[]).includes("stax"))), tax:cnt("tax"), discard:sum(nonland.filter(r=>has(r,"discard") || (r.m.sb||[]).includes("discard")))};
  deny.lv = {stax:LV(deny.stax,4,2), tax:LV(deny.tax,7,3), discard:LV(deny.discard,3,2)};
  // tiempos
  const inst = sum(nonland.filter(r=>r.m.t==="Instant" || (has(r,"flash") && r.m.t!=="Sorcery")));
  const sorc = sum(nonland.filter(r=>r.m.t==="Sorcery"));
  const timing = {inst, sorc, pct: inst+sorc ? Math.round(100*inst/(inst+sorc)) : null};
  timing.lv = timing.pct==null ? {k:"none", es:"—"} : timing.pct>=85 ? {k:"dense", es:"Instantáneo"} : timing.pct>=60 ? {k:"mod", es:"Mixto"} : {k:"light", es:"Principal"};
  // remates
  const c2 = P.c2 || 0;
  const paths = [];
  const combatN = sum(rows.filter(r=>has(r,"wcCombat") || (r.m.tg||[]).includes("extraCombat")));
  if (combatN>=3 || sum(nonland.filter(r=>r.m.t==="Creature"))>=25) paths.push({k:"combat", es:"Combate", n:combatN});
  const drainN = cnt("wcDrain"); if (drainN>=2) paths.push({k:"drain", es:"Drenar vidas", n:drainN});
  if (c2>0 || (d.combos && (d.combos.inc||[]).length)) paths.push({k:"combo", es:"Combo", n:(d.combos&&(d.combos.inc||[]).length)||c2});
  const altN = cnt("wcAlt"); if (altN) paths.push({k:"alt", es:"Victoria alternativa", n:altN});
  const millN = cnt("wcMill"); if (millN>=2) paths.push({k:"mill", es:"Moler", n:millN});
  const poisonN = cnt("wcPoison"); if (poisonN>=3) paths.push({k:"poison", es:"Veneno", n:poisonN});
  const voltN = sum(rows.filter(r=>(r.m.tg||[]).some(k=>k==="equipment"||k==="aura"||k==="voltronPay"))); if (voltN>=6) paths.push({k:"voltron", es:"Daño de comandante", n:voltN});
  const wins = {paths, lv: paths.length>=3 ? {k:"dense", es:"Varios planes"} : paths.length===2 ? {k:"mod", es:"Dos planes"} : paths.length ? {k:"light", es:"Plan único"} : {k:"none", es:"Sin remate claro"}};
  // motor
  const engine = {etb:sum(rows.filter(r=>has(r,"etb") || (r.m.tg||[]).includes("etb"))), dies:sum(rows.filter(r=>has(r,"dies") || (r.m.tg||[]).includes("dies"))), rep:cnt("repeat"), one:cnt("oneShot")};
  engine.lvRep = LV(engine.rep, 18, 10); engine.lvOne = LV(engine.one, 15, 6);
  // tribal
  const creatures = sum(nonland.filter(r=>r.m.t==="Creature"));
  const tribe = Y && Y.tribes && Y.tribes[0] ? {s:Y.tribes[0].s, n:Y.tribes[0].n, pct: creatures ? Math.round(100*Y.tribes[0].n/creatures) : 0, pay:Y.tribes[0].pay.length} : null;
  // sinergia: cobertura (cartas conectadas) y cuánto gira en torno al comandante
  let syn = null;
  if (Y){
    const cmdRows = [...A.cmdMeta.filter(Boolean)];
    const cmdTags = new Set(cmdRows.flatMap(m=>m.tg||[]));
    const cmdThemes = Y.themes.filter(t=>t.cmd);
    const linkedToCmd = nonland.filter(r=>{ const tg = r.m.tg||[]; if (tg.some(k=>cmdTags.has(k))) return true; if (cmdThemes.some(t=>t.enR.includes(r)||t.payR.includes(r))) return true;
      if (tribe && cmdRows.some(m=>subtypesOf(m).includes(tribe.s)) && subtypesOf(r.m).includes(tribe.s)) return true; return false; });
    const cmdPct = nonlandN ? Math.round(100*sum(linkedToCmd)/nonlandN) : 0;
    const top = Y.themes[0], topShare = top && nonlandN ? (top.E+top.P)/nonlandN : 0;
    const shape = cmdPct>=60 ? {es:"Estrella", s:"gira en torno al comandante"} : Y.themes.filter(t=>t.state==="fuerte").length>=3 ? {es:"Red", s:"varios temas que se cruzan"} : top && top.state==="fuerte" ? {es:"Núcleo", s:"un tema principal"} : {es:"Suelta", s:"pocas conexiones entre cartas"};
    const focus = topShare>=0.45 || (tribe && tribe.pct>=60) ? {es:"Concentrada", s:"pocos temas, bien cubiertos"} : {es:"Repartida", s:"muchos temas a la vez"};
    const lonely = new Set(Y.lonely.map(r=>r.n));
    const covered = nonland.filter(r=>!lonely.has(r.n) || (tribe && tribe.pct>=40 && subtypesOf(r.m).includes(tribe.s)) || linkedToCmd.includes(r));
    const cov = nonlandN ? Math.round(100*sum(covered)/nonlandN) : 0;
    const score = Math.round((Y.cohesion + cov + cmdPct)/3);
    syn = {score, cov, cmd:cmdPct, shape, focus, lv:LV(score, 75, 50, 1)};
  }
  // perfil (arquetipo de juego / estrategia)
  const inter10 = clamp10(interTotal/2.4);
  const arch = [
    {es:"Control", v: (counters*1.2 + inter.wipes*1.4 + removal*0.6 + (timing.pct||0)/20) * (creatures>=22 ? 0.3 : creatures>=15 ? 0.6 : 1)},
    {es:"Aggro", v: (creatures>=28?4:creatures/8) + (A.avg<=2.6?3:0) + combatN*0.3 - counters*0.5},
    {es:"Midrange", v: 4 + (creatures>=15 && creatures<=34 ? 2 : 0) + Math.min(3, interTotal/8) - Math.abs(A.avg-3)},
    {es:"Combo", v: c2*3 + tutors.n*0.7 + (altN?2:0)},
    {es:"Stax", v: deny.stax*1.5 + deny.tax*0.6},
    {es:"Ramp", v: ramp.n*0.35 + ramp.land*0.3 + curve.fin*0.5 - 1},
  ].sort((a,b)=>b.v-a.v);
  const plan = arch[0].es;
  const strat = tribe && tribe.pct>=40 ? "Tribal" : Y && Y.themes.find(t=>t.state==="fuerte") ? Y.themes.find(t=>t.state==="fuerte").es : (arch[1] && arch[1].v>arch[0].v*0.8 ? arch[1].es : "Pila de valor");
  // etiquetas destacadas
  const chips = [];
  if (counters>=6 && (timing.pct||0)>=70) chips.push({es:"Base de control", tone:"good"});
  if (tribe && tribe.pct>=40) chips.push({es:`Tribal ${tribe.s}`, tone:"good"});
  for (const p of paths.slice(0,2)) chips.push({es: p.k==="combat" ? "Gana por combate" : p.k==="combo" ? "Gana por combo" : p.k==="drain" ? "Gana drenando" : `Remate: ${p.es.toLowerCase()}`, tone:"warn"});
  if (paths.length===1) chips.push({es:"Plan único y enfocado", tone:"warn"});
  if (paths.length>=3) chips.push({es:"Varios caminos a la victoria", tone:"good"});
  if (A.avg && A.avg<=2.6) chips.push({es:"Curva baja", tone:"warn"}); else if (A.avg>=3.8) chips.push({es:"Curva alta", tone:"warn"});
  if (fast>=3) chips.push({es:"Maná rápido", tone:"bad"});
  if (tutors.n>=5) chips.push({es:"Muchos tutores", tone:"bad"});
  if (deny.stax>=3) chips.push({es:"Stax", tone:"bad"});
  // pilares 0–10, con bases de comparación
  const sim = P.sim;
  const keep = sim ? (sim.pMull!=null ? 1-sim.pMull : sim.keep!=null ? sim.keep : null) : null;
  const pill = [
    {k:"cons", es:"Consistencia", v:clamp10(tutors.n*0.9 + cards.draw*0.35 + cnt("select")*0.25 + (keep!=null ? keep*3 : 1.5) + (mana.lands>=33 && mana.lands<=38 ? 1 : 0)), why:`${tutors.n} tutor${tutors.n===1?"":"es"}, ${cards.draw} robo${keep!=null?`, ${Math.round(keep*100)}% manos jugables`:""}`},
    {k:"eff", es:"Eficiencia", v:clamp10(10 - (A.avg-1.9)*2.6 + ramp.n*0.12 + curve.cheap*0.06 - 1.2), why:`CMC ${A.avg.toFixed(2)}, ${curve.cheap} baratas, ${ramp.n} ramp`},
    {k:"speed", es:"Velocidad", v:clamp10(fast*1.3 + sum(rampR.filter(r=>(r.m.cmc||0)<=2))*0.45 + (A.avg<=2.6?1.5:A.avg<=3.2?0.7:0)), why:`${fast} maná rápido, ${sum(rampR.filter(r=>(r.m.cmc||0)<=2))} ramp de 2 o menos`},
    {k:"inter", es:"Interacción", v:clamp10(inter10 + inter.free*0.5 + ((timing.pct||0)>=80?0.5:0)), why:`${interTotal} piezas, ${inter.free} gratis`},
    {k:"wins", es:"Remates", v:clamp10(paths.length*1.5 + c2*2.2 + Math.min(2, curve.fin*0.4) + Math.min(5, combatN*0.4) + (altN?1:0)), why: paths.length ? paths.map(p=>p.es.toLowerCase()).join(", ") : "sin remate claro"},
    {k:"res", es:"Resiliencia", v:clamp10(cards.rec*0.8 + inter.protect*0.7 + engine.rep*0.08 + (cards.draw>=10?1:0)), why:`${cards.rec} reciclaje, ${inter.protect} protección`},
  ];
  const BASE = {casual:{cons:4.5, eff:5, speed:3, inter:4.5, wins:4.5, res:4}, cedh:{cons:9, eff:9, speed:9, inter:8.5, wins:8.5, res:7}};
  // tabla nutricional contra la plantilla de EDH (puntos medios de lo recomendado)
  const DV = [["Tierras", mana.lands, 36.5], ["Ramp", ramp.n, 10], ["Robo", cards.draw, 10], ["Removal", removal+counters, 8], ["Barridos", inter.wipes, 3], ["Protección", inter.protect, 4], ["Tutores", tutors.n, 3], ["Reciclaje", cards.rec, 3]];
  const nutri = DV.map(([es, n, ref])=>({es, n, pct: Math.round(100*n/ref)}));
  const report = {grades:[
      {es:"Sal", v:P.salt, g:GRADE(P.salt/10), s:P.saltLabel},
      {es:"Interacción", v:interTotal, g:GRADE(pill[3].v), s:`${interTotal} piezas`},
      {es:"Remates", v:paths.length, g:GRADE(pill[4].v), s:wins.lv.es.toLowerCase()},
      {es:"Sinergia", v:syn?syn.score:null, g:syn?GRADE(syn.score/10):"—", s:syn?`${syn.score}% conectado`:"sin datos"},
    ]};
  const R = {P, Y, abs: P.abs, type: DECK_TYPE(P.power), tier: cmdTier(d), plan, strat, chips, mana, comp, nonlandN, compN, permN, curve, ramp, tutors, cards, inter, deny, timing, wins, engine, tribe, syn, pill, BASE, nutri, report, creatures, stale};
  _repMemo.set(d, {ep:_anaEpoch, A, R});
  return R;
}

/* ---------- vista ---------- */
function repMeterHTML(p){
  const cur = Math.max(1, Math.min(10, Math.round(p)));
  return `<div class="rp-meter" role="img" aria-label="Nivel ${p.toFixed(1)} de 10">${Array.from({length:10},(_, i)=>{ const n=i+1; return `<span class="rp-seg ${n<cur?"on":""} ${n===cur?"cur":""}" style="--h:${Math.round(130 - i*13)}">${n===cur?`<b class="num">${n}</b>`:`<small>${n}</small>`}</span>`; }).join("")}</div>`;
}
const lvPill = lv => lv && lv.k!=="none" ? `<span class="rp-lv lv-${lv.k}">${lv.es}</span>` : `<span class="rp-lv lv-none">—</span>`;
const lvBar = lv => `<span class="rp-lvbar lv-${lv.k}"><i></i></span>`;
function repBoxHTML(title, tag, body, extra=""){ return `<section class="rp-box ${extra}"><div class="rp-h"><h4>${title}</h4>${tag||""}</div>${body}</section>`; }

function reportHTML(d, A){
  const R = reportOf(d, A); const P = R.P;
  const base = S.rpBase || "casual"; const B = R.BASE[base];
  const hist = (d.pwHist||[]).slice(-2);
  const prev = hist.length>=2 && Math.abs(hist[1].p-hist[0].p)>=0.05 ? hist[0] : null;
  const bTone = P.real>P.official.b ? "warn" : P.real<P.official.b ? "neutral" : "good";
  const lineLv = (es, n, lv) => `<div class="rp-line"><span>${es}</span>${lvBar(lv)}<span class="rp-lvt lv-${lv.k}">${lv.k==="none"?"—":`${lv.es}`}${n!=null?` <small class="num">${n}</small>`:""}</span></div>`;
  const compRows = [["Creature","Criaturas"],["Artifact","Artefactos"],["Enchantment","Encantamientos"],["Instant","Instantáneos"],["Sorcery","Conjuros"],["Planeswalker","Planeswalkers"],["Battle","Batallas"]].filter(([k])=>R.comp[k]);
  const maxComp = Math.max(1, ...compRows.map(([k])=>R.comp[k]));
  const staleNote = R.stale && !isWebView() ? `<div class="note">Faltan detalles de ${R.stale} carta${R.stale>1?"s":""} para la radiografía completa. <button class="btn sm" data-rp="refresh">Actualizar datos de cartas</button></div>`
    : R.stale ? `<div class="note">Faltan detalles de ${R.stale} carta${R.stale>1?"s":""}: usa “Completar datos con Claude” en la lista para afinar la radiografía.</div>` : "";
  return `<div class="rp">
  ${staleNote}
  <section class="rp-hero">
    <div class="rp-hero-l">
      <div class="k sc">nivel práctico</div>
      ${repMeterHTML(P.power)}
      <div class="rp-abs"><span class="muted">Puntaje exacto</span> <b class="num">${R.abs.toFixed(2)}</b> <span class="muted">· cEDH = 10</span></div>
      ${prev ? `<div class="rp-chg ${hist[1].p>prev.p?"up":"down"}">${hist[1].p>prev.p?"Subió":"Bajó"} de ${prev.p.toFixed(1)} a ${hist[1].p.toFixed(1)} desde el ${new Date(hist[1].at).toLocaleDateString("es-CL")}</div>` : ""}
      <details class="rp-what"><summary>¿Qué significa?</summary><p>El nivel práctico mide qué tan fuerte juega el mazo en la mesa, de 1 a 10, donde 10 es cEDH. Sale de seis pilares (consistencia, eficiencia, velocidad, interacción, remates y resiliencia) más los Game Changers, el stax y los combos. Es una estimación para conversar antes de jugar, no un veredicto.</p></details>
    </div>
    <div class="rp-hero-r">
      <div class="rp-type"><div class="k sc">evaluación</div><b>${R.type.es}</b><span class="muted">${R.type.s}</span>
        <div class="rp-meta"><span><small class="sc">nivel</small> <b class="num">${P.power.toFixed(1)}</b></span>${R.tier?`<span title="${esc(R.tier.why)}"><small class="sc">comandante</small> <b>T${R.tier.t}</b></span>`:""}</div></div>
      <div class="rp-br"><div class="k sc">bracket</div><div class="rp-br-row"><div><small class="sc">oficial</small><b class="num">${P.official.b}</b></div><div><small class="sc">realista</small><b class="num">${P.real}</b></div></div><span class="pill ${bTone}">${P.real>P.official.b?"juega por sobre su bracket":P.real<P.official.b?"juega por debajo":"coinciden"}</span></div>
    </div>
  </section>

  <div class="rp-row2">
    <section class="rp-card"><h4 class="sc">boleta de notas</h4><div class="rp-grades">${R.report.grades.map(g=>`<div class="rp-grade"><small class="sc">${g.es}</small><b class="g g-${g.g.replace("+","p").replace("-","m")}">${g.g}</b><span class="muted">${esc(g.s)}</span></div>`).join("")}</div>
      <p class="foot">A+ = mucho de eso; F = casi nada. En sal, más alto significa que incomoda más a la mesa.</p></section>
    <section class="rp-card rp-flavor"><h4 class="sc">perfil</h4><div class="rp-fl"><b>${esc(R.plan)}</b><span>/</span><b>${esc(R.strat)}</b></div>
      <div class="chips">${R.chips.map(c=>`<span class="pill ${c.tone}">${esc(c.es)}</span>`).join("")}</div></section>
  </div>

  <section class="rp-card"><div class="rp-h"><h4 class="sc">pilares</h4><div class="seg" role="group" aria-label="Comparar con"><button class="btn sm ${base==="casual"?"primary":""}" data-rp-base="casual">Base casual</button><button class="btn sm ${base==="cedh"?"primary":""}" data-rp-base="cedh">Base cEDH</button></div></div>
    <div class="rp-pills">${R.pill.map(p=>{ const b = B[p.k]; const diff = Math.round(100*(p.v-b)/b); return `<div class="rp-pill"><span class="rp-pn">${p.es}</span><span class="rp-track"><i style="width:${p.v*10}%"></i><em style="left:${b*10}%" title="base ${base==="casual"?"casual":"cEDH"}: ${b}"></em></span><span class="num rp-pv">${p.v.toFixed(1)}</span><span class="rp-diff ${diff>=0?"up":"down"} num">${diff>=0?"▲":"▼"} ${Math.abs(diff)}%</span><span class="muted rp-why">${esc(p.why)}</span></div>`; }).join("")}</div>
    <p class="foot">La marca vertical es un mazo ${base==="casual"?"casual típico (bracket 2–3)":"de cEDH típico"}; el porcentaje dice cuánto te alejas de esa base.</p></section>

  <div class="rp-grid">
    ${repBoxHTML("Base de maná", lvPill(R.mana.lv.k==="dense"?{k:"dense",es:"Densa"}:R.mana.lv.k==="mod"?{k:"mod",es:"Justa"}:{k:"light",es:"Corta"}), `<p class="muted rp-sub">${R.mana.colors} color${R.mana.colors===1?"":"es"}</p><div class="rp-big"><b class="num">${R.mana.lands}</b> tierras</div>
      <div class="rp-split"><i style="flex:${R.mana.basics||0.01}">${R.mana.basics} básicas</i><i style="flex:${R.mana.nonbasic||0.01}">${R.mana.nonbasic} no básicas</i></div>
      <p class="muted rp-sub">${R.mana.fetch} fetch · ${R.mana.utility} de utilidad</p><button class="btn sm ghost" data-sub="mana" style="padding:0">Ver base de maná completa →</button>`)}
    ${repBoxHTML("Composición", "", `<p class="muted rp-sub">${R.compN} sin contar tierras (con el comandante) · ${R.compN?Math.round(100*R.permN/R.compN):0}% permanentes</p>
      ${compRows.map(([k,es])=>`<div class="rp-line"><span>${es}</span><span class="rp-track sm"><i style="width:${100*R.comp[k]/maxComp}%"></i></span><b class="num">${R.comp[k]}</b></div>`).join("")}
      <p class="foot">Una carta con varios tipos cuenta en cada uno.</p>`, "wide")}
    ${repBoxHTML("Curva y velocidad", lvPill(R.curve.lv.k==="fast"?{k:"dense",es:"Rápida"}:R.curve.lv.k==="mod"?{k:"mod",es:"Moderada"}:{k:"light",es:"Lenta"}), `<div class="rp-big"><b class="num">${R.curve.avg.toFixed(2)}</b> CMC promedio</div>
      <p class="rp-sub"><b class="num">${R.curve.peak}</b> <span class="muted">CMC más común</span> · <b class="num">${R.curve.cheap}</b> <span class="muted">baratas (&lt;2)</span> · <b class="num">${R.curve.fin}</b> <span class="muted">remates (6+)</span></p>
      ${R.curve.avg<=2.6?`<span class="pill warn">Se despliega rápido</span>`:R.curve.avg>=3.8?`<span class="pill warn">Arranca lento</span>`:""}`)}
    ${repBoxHTML("Ramp", lvPill(R.ramp.lv), `<p class="rp-sub"><b class="num">${R.ramp.rocks}</b> <span class="muted">rocas</span> · <b class="num">${R.ramp.dorks}</b> <span class="muted">criaturas</span> · <b class="num">${R.ramp.land}</b> <span class="muted">de tierras</span>${R.ramp.red?` · <b class="num">${R.ramp.red}</b> <span class="muted">reductores</span>`:""}</p>
      ${R.ramp.fast?`<span class="pill ${R.ramp.fast>=3?"bad":"warn"}">${R.ramp.fast>=3?"Maná rápido":"Algo de maná rápido"} (${R.ramp.fast})</span>`:""}`)}
    ${repBoxHTML("Tutores", lvPill(R.tutors.lv), `<p class="rp-sub"><b class="num">${R.tutors.n}</b> <span class="muted">tutor${R.tutors.n===1?"":"es"}</span>${R.tutors.q!=null?` · calidad <b class="num">${R.tutors.q}</b><span class="muted">/100</span>`:""}</p>
      ${R.tutors.q!=null?`<span class="pill ${R.tutors.q>=80?"bad":"neutral"}">${R.tutors.q>=80?"Buscan cualquier carta":R.tutors.q>=50?"Buscan por tipo":"Dejan la carta arriba"}</span>`:""}`)}
    ${repBoxHTML("Ventaja de cartas", "", lineLv("Robo", R.cards.draw, R.cards.lvDraw) + lineLv("Reciclaje", R.cards.rec, R.cards.lvRec))}
    ${repBoxHTML("Interacción", lvPill(R.inter.all), lineLv("Contrahechizos", R.inter.counters, R.inter.lv.counters) + lineLv("Removal", R.inter.removal, R.inter.lv.removal) + lineLv("Barridos", R.inter.wipes, R.inter.lv.wipes) + lineLv("Protección", R.inter.protect, R.inter.lv.protect) + lineLv("Contra cementerio", R.inter.grave, R.inter.lv.grave), "wide")}
    ${repBoxHTML("Negación de recursos", "", lineLv("Stax", R.deny.stax, R.deny.lv.stax) + lineLv("Impuestos", R.deny.tax, R.deny.lv.tax) + lineLv("Descarte", R.deny.discard, R.deny.lv.discard))}
    ${repBoxHTML("Tiempos", lvPill(R.timing.lv), `<p class="muted rp-sub">${R.timing.pct!=null?`${R.timing.pct}% a velocidad de instantáneo`:"sin hechizos no permanentes"}</p><p class="rp-sub"><b class="num">${R.timing.inst}</b> <span class="muted">instantáneo o con destello</span> · <b class="num">${R.timing.sorc}</b> <span class="muted">conjuros</span></p>`)}
    ${repBoxHTML("Remates", lvPill(R.wins.lv), `${R.wins.paths.length?`<div class="chips">${R.wins.paths.map(p=>`<span class="pill warn">${p.es}</span>`).join("")}</div><p class="rp-sub"><b class="num">${R.wins.paths.length}</b> <span class="muted">camino${R.wins.paths.length>1?"s":""} a la victoria</span></p>`:`<p class="muted">No encontré un remate claro. Revisa la pestaña Mejorar.</p>`}
      ${P.c2==null?`<button class="btn sm ghost" data-act="combos" style="padding:0">Buscar combos</button>`:""}`)}
    ${repBoxHTML("Motor", "", `<p class="rp-sub"><b class="num">${R.engine.etb}</b> <span class="muted">al entrar</span> · <b class="num">${R.engine.dies}</b> <span class="muted">al morir</span></p>` + lineLv("Repetible", R.engine.rep, R.engine.lvRep) + lineLv("De un uso", R.engine.one, R.engine.lvOne))}
    ${R.syn?repBoxHTML("Sinergia", lvPill(R.syn.lv), `<p class="muted rp-sub">${R.syn.shape.es} · ${R.syn.focus.es}</p><div class="rp-big"><b class="num">${R.syn.score}</b> de 100</div>
      <p class="rp-sub"><b class="num">${R.syn.cov}%</b> <span class="muted">conectado</span> · <b class="num">${R.syn.cmd}%</b> <span class="muted">con el comandante</span></p><p class="foot">${esc(R.syn.shape.s)}; ${esc(R.syn.focus.s)}.</p>`):""}
    ${R.tribe?repBoxHTML("Tribal", "", `<p class="muted rp-sub">Tribal ${esc(R.tribe.s)}</p><p class="rp-sub"><b class="num">${R.tribe.n}</b> <span class="muted">${esc(R.tribe.s)}</span> · <b class="num">${R.tribe.pct}%</b> <span class="muted">de las criaturas</span> · <b class="num">${R.tribe.pay}</b> <span class="muted">la aprovechan</span></p>`):""}
  </div>

  <section class="rp-card rp-nutri"><h4>Información nutricional</h4><div class="rp-nh"><span>por mazo de 100 cartas</span><span>% valor diario*</span></div>
    ${R.nutri.map(n=>`<div class="rp-nr"><span><b>${n.es}</b> ${n.n}</span><b class="num ${n.pct<70?"down":n.pct>150?"warn":""}">${n.pct}%</b></div>`).join("")}
    <p class="foot">*Contra la plantilla recomendada para Commander (36–37 tierras, 10 ramp, 10 robo, 8 respuestas, 3 barridos, 4 protección).</p></section>

  <section class="rp-card rp-r0"><div><h4>Tarjeta de regla 0</h4><p class="muted" style="margin:0">Una imagen con el nivel, el bracket, el plan y las cartas que conviene avisar. Mándala al grupo antes de jugar.</p></div>
    <div class="row"><button class="btn primary" data-rp="r0">Crear tarjeta</button><button class="btn" data-rp="r0-text">Copiar como texto</button></div></section>
  </div>`;
}

/* ---------- tarjeta de regla 0 ---------- */
function rule0Text(d, A){
  const R = reportOf(d, A); const P = R.P;
  const warn = [...A.gc.map(n=>`${n} (Game Changer)`), ...(P.c2 ? combos2(d).slice(0,4).map(c=>`combo: ${c.cards.join(" + ")}`) : []), ...P.saltTop.filter(x=>x.s>=1.5 && !A.gc.includes(x.n)).slice(0,4).map(x=>`${x.n} (sal)`)];
  return [`${d.name} — ${(d.commanders||[]).join(" + ")}`,
    `Nivel ${P.power.toFixed(1)}/10 · ${R.type.es} · Bracket ${P.official.b} oficial / ${P.real} realista`,
    `Perfil: ${R.plan} / ${R.strat}${R.wins.paths.length?` · Gana por: ${R.wins.paths.map(p=>p.es.toLowerCase()).join(", ")}`:""}`,
    `Sal ${P.salt}/100 · Interacción ${R.report.grades[1].g} · Velocidad ${R.pill[2].v.toFixed(1)}/10`,
    warn.length ? `Aviso: ${[...new Set(warn)].join("; ")}` : "Sin Game Changers ni combos de 2 cartas.",
    "Hecho con Bóveda EDH"].join("\n");
}
async function rule0Card(d, A){
  const R = reportOf(d, A); const P = R.P;
  const W = 1080, H = 1350; const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  const css = getComputedStyle(document.documentElement); const v = k => css.getPropertyValue(k).trim();
  const bg = "#16201B", ink = "#EEF3EF", mut = "#9FB0A7", acc = "#62B89A";
  g.fillStyle = bg; g.fillRect(0,0,W,H);
  const cm = d.commanders && d.commanders[0] ? cardOf(d.commanders[0]) : null;
  let art = false;
  if (cm && (cm.art||cm.img)){ try { const img = await new Promise((res, rej)=>{ const i = new Image(); i.crossOrigin = "anonymous"; i.onload = ()=>res(i); i.onerror = rej; i.src = artOf(cm); setTimeout(rej, 4000); });
    const h = 520; g.drawImage(img, 0, 0, img.width, img.height, 0, 0, W, h); const gr = g.createLinearGradient(0, 200, 0, h); gr.addColorStop(0, "rgba(22,32,27,0)"); gr.addColorStop(1, bg); g.fillStyle = gr; g.fillRect(0, 0, W, h); art = true; } catch {} }
  const font = (w, s, f="system-ui, sans-serif") => `${w} ${s}px ${f}`;
  const wrap = (text, x, y, maxW, lh) => { const words = String(text).split(" "); let line = ""; for (const w of words){ const t = line ? line+" "+w : w; if (g.measureText(t).width > maxW && line){ g.fillText(line, x, y); y += lh; line = w; } else line = t; } if (line){ g.fillText(line, x, y); y += lh; } return y; };
  let y = art ? 470 : 150;
  g.fillStyle = mut; g.font = font(600, 30); g.fillText("TARJETA DE REGLA 0", 64, y); y += 70;
  g.fillStyle = ink; g.font = font(800, 64, "Georgia, serif"); y = wrap(d.name, 64, y, W-128, 72);
  g.fillStyle = mut; g.font = font(500, 34); y = wrap((d.commanders||[]).join(" + "), 64, y+4, W-128, 42) + 30;
  // medidor
  const segW = (W-128-9*10)/10;
  for (let i=0;i<10;i++){ const on = i < Math.round(P.power); g.fillStyle = on ? `hsl(${130 - i*13} 60% 48%)` : "#26322C"; g.fillRect(64 + i*(segW+10), y, segW, 54); }
  g.fillStyle = ink; g.font = font(800, 40); g.fillText(`${P.power.toFixed(1)} / 10 · ${R.type.es}`, 64, y+118); y += 180;
  const box = (x, label, val) => { g.fillStyle = "#1F2B25"; g.fillRect(x, y, 300, 150); g.fillStyle = mut; g.font = font(600, 26); g.fillText(label, x+24, y+46); g.fillStyle = ink; g.font = font(800, 60); g.fillText(val, x+24, y+120); };
  box(64, "BRACKET OF. · REAL", `${P.official.b} · ${P.real}`); box(390, "SAL", String(P.salt)); box(716, "INTERACCIÓN", R.report.grades[1].g); y += 200;
  g.fillStyle = acc; g.font = font(700, 36); g.fillText(`${R.plan} / ${R.strat}`, 64, y); y += 52;
  g.fillStyle = ink; g.font = font(500, 32);
  if (R.wins.paths.length) y = wrap("Gana por: " + R.wins.paths.map(p=>p.es.toLowerCase()).join(", "), 64, y, W-128, 42);
  const warn = [...A.gc, ...(P.c2 ? combos2(d).slice(0,3).map(cb=>cb.cards.join(" + ")) : [])];
  if (warn.length){ g.fillStyle = "#E3AE55"; g.font = font(700, 30); y = wrap("Avisa: " + [...new Set(warn)].slice(0,8).join(" · "), 64, y+12, W-128, 40); }
  g.fillStyle = mut; g.font = font(500, 26); g.fillText("Hecho con Bóveda EDH · boveda-edh.netlify.app", 64, H-56);
  const blob = await new Promise(res=>c.toBlob(res, "image/png"));
  const name = `regla0-${slug(d.name)||"mazo"}.png`;
  const file = typeof File==="function" ? new File([blob], name, {type:"image/png"}) : null;
  if (file && navigator.canShare && navigator.canShare({files:[file]})){ try { await navigator.share({files:[file], title:d.name, text:rule0Text(d, A)}); return; } catch(e){ if (e && e.name==="AbortError") return; } }
  download(name, blob, "image/png");
}

/* ---------- historial del puntaje (¿cambió tu nivel?) ---------- */
function recordPower(d, A){
  if (!d || d.rival || d.format!=="commander") return;
  const P = powerOf(d, A); const h = d.pwHist || (d.pwHist = []);
  const last = h[h.length-1];
  if (!last || Math.abs(last.p - P.power) >= 0.05){ h.push({at:Date.now(), p:P.power}); if (h.length>20) h.splice(0, h.length-20); return true; }
  return false;
}

document.addEventListener("click", async ev => {
  const bb = ev.target.closest("[data-rp-base]"); if (bb){ S.rpBase = bb.dataset.rpBase; render(); return; }
  const b = ev.target.closest("[data-rp]"); if (!b) return;
  const d = S.data.decks.find(x=>x.id===S.sel[S.view]); if (!d) return;
  const A = analyze(d);
  if (b.dataset.rp==="refresh"){ await fetchCards(allNames(d), {force:true, label:"Actualizando datos de las cartas del mazo"}); bumpAnalysis(); render(); }
  else if (b.dataset.rp==="r0"){ b.disabled = true; try { await rule0Card(d, A); } finally { b.disabled = false; } }
  else if (b.dataset.rp==="r0-text"){ copyText(rule0Text(d, A)); }
});
