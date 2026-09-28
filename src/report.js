/* =========================================================
   Bóveda EDH — Ficha del mazo (referencia: Commandersalt)
   Medidor de nivel, boleta de notas, perfil, pilares contra una
   base casual o cEDH, tabla nutricional, radiografía por áreas
   y tarjeta de regla 0 para conversar el nivel antes de jugar.
   ========================================================= */
const RF_V = 6;   // versión de las marcas de cada carta; si sube, se vuelven a calcular

// marcas extra por carta, calculadas con el texto de Oracle (se guardan en m.rf y m.tq)
function cardFlags(o, t, tl){
  o = o || ""; const f = new Set(); const land = t === "Land";
  const perm = !/Instant|Sorcery/.test(t||"");
  if (/(^|\n)flash(\s|$)/.test(o)) f.add("flash");
  if (/counter target (\w+ ){0,3}(spell|ability)|(choose new targets|change the target) (for|of) target spell/.test(o)) f.add("counter");
  if (!land && /add (\{[wubrgc]\} |an amount of \{[wubrgc]\} |x mana )?(for each|equal to)|add \{[wubrgc]\} for each|add x mana/.test(o)) f.add("bigMana");
  if (/look at the top card of your library any time|you may (cast|play) [^.]*from the top of your library|look at the top (\w+) cards[^.]*put (up to )?(one|two|a)[^.]*(onto the battlefield|into your hand)/.test(o)) f.add("select");
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
  if (/creatures you control get \+(x|[2-9])|\w+ creatures you control get \+[2-9]|\+1\/\+1 counters? on each (other )?creature you control|creatures you control gain [^.]*double strike|elves you control get \+[2-9]/.test(o)) f.add("overrun");
  if (/deals that much damage to (target|each) opponent|deals (\d+|x) damage to each opponent/.test(o)) f.add("wcDrain");
  if (/(each|target) (opponent|other player|player)s? sacrifices?|each player sacrifices/.test(o)) f.add("edict");
  if (/base toughness 1|creatures your opponents control (get|have) -|(opponents|players) can't (cast|untap|search|draw more)/.test(o)) f.add("hoser");
  if (/whenever [^.]*(creature|another creature)[^.]*dies[^.]*(loses|deals? \d+ damage to each opponent)|whenever you sacrifice [^.]*(loses|damage)/.test(o)) f.add("deathDrain");
  if (perm && !land && /whenever|at the beginning of/.test(o)) f.add("repeat");
  // tipo de mecánica (para el perfil de sinergia): disparada, activada, estática o de reemplazo
  const body = o.replace(/\([^)]*\)/g, "");
  if (/(^|\n|\. )(whenever|when|at the beginning of)\b/.test(body)) f.add("trig");
  if (/(^|\n)[^\n"—]*[^\s]:\s/.test(body) && !/(^|\n)(choose one|spree)/.test(body)) f.add("act");
  if (/\binstead\b|if [^.]*would|enters with|as [^.]* enters/.test(body)) f.add("repl");
  if (perm && /(creatures?|permanents?|spells?|lands?|\w+s) (you control|your opponents control|you cast) (get|have|gain|cost|can't)|you may (look|cast|play)|other [^.]*get [+-]|^(flying|trample|deathtouch|lifelink|menace|reach|hexproof|indestructible)/m.test(body)) f.add("static");
  if (!perm && /draw|create|search your library|return|put [^.]*counter|onto the battlefield/.test(o)) f.add("oneShot");
  if (/when(ever)? [^.]*(enters|enter the battlefield)/.test(o)) f.add("etb");
  if (/when(ever)? [^.]*dies|when(ever)? [^.]*is put into a graveyard from the battlefield/.test(o)) f.add("dies");
  if (/(search your library for|put) [^.]*\bland (card|cards)?[^.]*onto the battlefield|put (a|up to (one|two)) land cards? from your hand onto the battlefield|play (an|two) additional lands?|search your library for (a|up to (one|two|three)) basic land/.test(o) && !land){ f.add("landRamp");
    if (/two [^.]*land cards?[^.]*put them onto the battlefield|put (both|two) [^.]*lands? onto the battlefield/.test(o)) f.add("landRamp2");     // Explosive Vegetation, Skyshroud Claim
    else if (/put one onto the battlefield[^.]*and the other into your hand/.test(o)) f.add("landHand"); }                                  // Cultivate, Kodama's Reach
  if (/(return|put) [^.]*from (your|a) graveyard (to|onto|into)|return target [^.]*card from your graveyard|return the chosen cards to the battlefield|return (that card|it) to the battlefield under your control|(^|\n)(undying|persist)\b/.test(o)) f.add("recursion");
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
  const drainN = cnt("wcDrain") + cnt("deathDrain"); if (drainN>=2) paths.push({k:"drain", es:"Drenar vidas", n:drainN});
  if (c2>0 || (d.combos && (d.combos.inc||[]).length)) paths.push({k:"combo", es:"Combo", n:(d.combos&&(d.combos.inc||[]).length)||c2});
  else if (P.E && P.E.loops) paths.push({k:"combo", es:"Bucle de sacrificio", n:P.E.loops});
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
      if (tribe && cmdRows.some(m=>subtypesOf(m).includes(tribe.s) || (m.tg||[]).includes("tribe:"+tribe.s)) && subtypesOf(r.m).includes(tribe.s)) return true; return false; });
    const cmdPct = nonlandN ? Math.round(100*sum(linkedToCmd)/nonlandN) : 0;
    const top = Y.themes[0], topShare = top && nonlandN ? (top.E+top.P)/nonlandN : 0;
    const strongN = Y.themes.filter(t=>t.state==="fuerte").length;
    const shape0 = cmdPct>=60 ? {es:"Estrella", s:"gira en torno al comandante"} : strongN>=3 ? {es:"Red", s:"varios temas que se cruzan"} : top && top.state==="fuerte" ? {es:"Núcleo", s:"un tema principal"} : {es:"Suelta", s:"pocas conexiones entre cartas"};
    const focus = topShare>=0.45 || (tribe && tribe.pct>=60) ? {es:"Concentrada", s:"pocos temas, bien cubiertos"} : {es:"Repartida", s:"muchos temas a la vez"};
    const lonely = new Set(Y.lonely.map(r=>r.n));
    const covered = nonland.filter(r=>!lonely.has(r.n) || (tribe && tribe.pct>=40 && subtypesOf(r.m).includes(tribe.s)) || linkedToCmd.includes(r));
    const cov = nonlandN ? Math.round(100*sum(covered)/nonlandN) : 0;
    const score = Math.round((Y.cohesion + cov + cmdPct)/3);
    const shape = shape0.es==="Suelta" && cov>=60 ? (strongN>=2 ? {es:"Red", s:"varios temas que se cruzan"} : {es:"Núcleo", s:"un tema principal"}) : shape0;
    // perfil: cuántas conexiones tiene cada carta, qué tan concentradas están y de qué tipo son sus mecánicas
    const L = nonland.map(r=>({r, n:(Y.links.get(r.n)||{n:0}).n, why:(Y.links.get(r.n)||{why:[]}).why})).filter(x=>x.n>0);
    const tot = L.reduce((a,x)=>a+x.n,0) || 1;
    const sorted = [...L].sort((a,b)=>b.n-a.n);
    const topEntry = sorted.length ? sorted[0].n/tot : 0, top5 = sorted.slice(0,5).reduce((a,x)=>a+x.n,0)/tot;
    const ns = sorted.map(x=>x.n).sort((a,b)=>a-b); let gini = 0;
    if (ns.length > 1){ const m = tot/ns.length; let acc = 0; for (const a of ns) for (const b of ns) acc += Math.abs(a-b); gini = acc/(2*ns.length*ns.length*m); }
    const entries = L.reduce((a,x)=>a+x.why.length,0);
    const mix = {trig:0, act:0, stat:0, repl:0};
    for (const x of L){ const f = x.r.m.rf||[]; if (f.includes("trig")) mix.trig++; if (f.includes("act")) mix.act++; if (f.includes("static")) mix.stat++; if (f.includes("repl")) mix.repl++; }
    const mixT = (mix.trig+mix.act+mix.stat+mix.repl) || 1;
    const partners = entries ? Math.round(10*tot/entries)/10 : 0;
    const labels = [];
    if (sorted.length && topEntry >= 0.12) labels.push({es:`${sorted[0].r.n} sostiene la red`, tone:"warn"});
    if (mix.trig/mixT >= 0.5) labels.push({es:"Motor de disparadores", tone:"warn"});
    if (cov >= 80) labels.push({es:"La sinergia toca casi todo el mazo", tone:"good"});
    if (cmdPct >= 60) labels.push({es:"Gira en torno al comandante", tone:"warn"});
    if (partners >= 5) labels.push({es:"Apoyo redundante", tone:"good"});
    if (top5 < 0.35 && sorted.length >= 10) labels.push({es:"Peso repartido en muchas piezas", tone:"good"});
    else if (top5 >= 0.5) labels.push({es:"Depende de pocas piezas clave", tone:"bad"});
    const prof = {entries, cards:L.length, partners, mix:{trig:Math.round(100*mix.trig/mixT), act:Math.round(100*mix.act/mixT), stat:Math.round(100*mix.stat/mixT), repl:Math.round(100*mix.repl/mixT)},
      gini:Math.round(100*gini)/100, topEntry:Math.round(100*topEntry), top5:Math.round(100*top5), hubs:sorted.slice(0,5).map(x=>({n:x.r.n, m:x.r.m, pct:Math.round(100*x.n/tot)})), labels,
      cmdRole: cmdPct>=60 ? "Dominante" : cmdPct>=35 ? "Importante" : "De apoyo"};
    syn = {score, cov, cmd:cmdPct, shape, focus, prof, lv:LV(score, 75, 50, 1)};
  }
  // perfil (arquetipo de juego / estrategia)
  const inter10 = clamp10(interTotal/2.4);
  const arch = [
    {es:"Control", v: (counters*1.2 + inter.wipes*1.4 + removal*0.6 + (timing.pct||0)/20) * (creatures>=22 ? 0.3 : creatures>=15 ? 0.6 : 1)},
    {es:"Aggro", v: (creatures>=28?3:creatures/9) + (A.avg<=2.4?3:A.avg<=2.8?1.5:0) + combatN*0.3 - counters*0.5 - inter.protect*0.1 - interTotal*0.1},
    {es:"Midrange", v: 4 + (creatures>=15 && creatures<=40 ? 2 : 0) + Math.min(3, interTotal/8) - Math.abs(A.avg-3)*0.8},
    {es:"Combo", v: c2*3 + (P.E ? P.E.loops*2.5 : 0) + tutors.n*0.7 + (altN?2:0)},
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
    {k:"wins", es:"Remates", v:clamp10(paths.length*1.5 + c2*2.2 + (P.E ? Math.min(4, P.E.loops*2) : 0) + Math.min(2, drainN*0.35) + Math.min(2, curve.fin*0.4) + Math.min(5, combatN*0.4) + Math.min(2.2, cnt("overrun")*0.4) + (altN?1:0)), why: paths.length ? paths.map(p=>p.es.toLowerCase()).join(", ") : "sin remate claro"},
    {k:"res", es:"Resiliencia", v:clamp10(cards.rec*0.8 + inter.protect*0.7 + engine.rep*0.08 + (cards.draw>=10?1:0)), why:`${cards.rec} reciclaje, ${inter.protect} protección`},
  ];
  const BASE = {casual:{cons:4.5, eff:5, speed:3, inter:4.5, wins:4.5, res:4}, cedh:{cons:9, eff:9, speed:9, inter:8.5, wins:8.5, res:7}};
  // tabla nutricional contra la plantilla de EDH (puntos medios de lo recomendado)
  // base de maná: arreglo de colores, tierras que entran enderezadas y jugar en curva
  const deckCols = (A.ci||"").split("").filter(c=>WUBRG.includes(c));
  const fixers = sum(rows.filter(r=>{ const pm = (r.m.pm||[]).filter(c=>deckCols.includes(c)); return (r.m.t==="Land" || (r.m.r||[]).includes("ramp")) && (pm.length>=2 || (r.m.rf||[]).includes("fetch")); }));
  const fixNeed = deckCols.length<=1 ? 1 : 8 + (deckCols.length-2)*6;
  const untapped = lands.length ? sum(lands.filter(r=>!r.m.tap))/Math.max(1,mana.lands) : 1;
  const onCurve = P.sim && P.sim.pScrew!=null ? (1-P.sim.pScrew) : null;
  mana.fix = deckCols.length<=1 ? 100 : Math.round(100*fixers/fixNeed); mana.untapped = Math.round(100*untapped);
  const landsOK = mana.lands>=35 && mana.lands<=39 ? 1 : mana.lands>=33 && mana.lands<=40 ? 0.8 : 0.5;
  const nonbasicShare = deckCols.length<=1 ? 1 : (mana.lands ? mana.nonbasic/mana.lands : 0);
  mana.quality = Math.round(100*Math.min(1, 0.35*Math.min(1, fixers/fixNeed) + 0.3*untapped + 0.2*landsOK + 0.15*nonbasicShare));
  const DV = [["Arreglo de colores", fixers, fixNeed], ...(onCurve!=null ? [["Juega en curva", Math.round(onCurve*100)+"%", 85, Math.round(onCurve*100)]] : []), ["Calidad de la base", mana.quality+"%", 80, mana.quality], ["Tierras", mana.lands, 36.5], ["Ramp", ramp.n, 10], ["Robo", cards.draw, 10], ["Removal", removal+counters, 8], ["Barridos", inter.wipes, 3], ["Protección", inter.protect, 4], ["Tutores", tutors.n, 3], ["Reciclaje", cards.rec, 3]];
  const nutri = DV.map(([es, n, ref, val])=>({es, n, pct: Math.round(100*(val!=null ? val : n)/ref)}));
  const report = {grades:[
      {es:"Sal", v:P.salt, g:GRADE(P.salt/10), s:P.saltLabel},
      {es:"Interacción", v:interTotal, g:GRADE(pill[3].v*0.855), s:`${interTotal} piezas`},
      {es:"Remates", v:paths.length, g:GRADE(pill[4].v), s:wins.lv.es.toLowerCase()},
      {es:"Sinergia", v:syn?syn.score:null, g:syn?GRADE(Math.min(10, syn.score/10*1.24)):"—", s:syn?`${syn.score}% conectado`:"sin datos"},
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
  const hp = x => x.p0!=null ? x.p0 : x.p;   // nivel sin calibrar (el antiguo guardaba el calibrado)
  const prev = hist.length>=2 && (hist[0].p0==null)===(hist[1].p0==null) && Math.abs(hp(hist[1])-hp(hist[0]))>=0.05 ? hist[0] : null;
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
      ${prev ? `<div class="rp-chg ${hp(hist[1])>hp(prev)?"up":"down"}">${hp(hist[1])>hp(prev)?"Subió":"Bajó"} de ${hp(prev).toFixed(1)} a ${hp(hist[1]).toFixed(1)}${Math.abs(P.abs - P.abs0) > 0.001 ? " (sin calibrar)" : ""} desde el ${new Date(hist[1].at).toLocaleDateString("es-CL")}</div>` : ""}
      <div class="rp-cs">${d.csRef ? `<span>Commandersalt: <b class="num">${Number(d.csRef.p).toFixed(2)}</b> <span class="muted">(${(P.power - d.csRef.p >= 0 ? "+" : "") + (P.power - d.csRef.p).toFixed(1)} aquí)</span></span>` : `<span class="muted">¿Lo mediste en Commandersalt?</span>`}
        <input type="text" id="rp-cs" inputmode="decimal" placeholder="Ej: 6,6" value="${d.csRef?esc(String(d.csRef.p)):""}" aria-label="Nivel en Commandersalt"><button class="btn sm" data-rp="cs">Guardar</button></div>
      <details class="rp-what"><summary>¿Qué significa?</summary>${Math.abs(P.abs - P.abs0) > 0.001 ? `<p class="muted">Tramo alto calibrado con listas de torneo (sin calibrar daría ${P.abs0.toFixed(1)}).</p>` : ""}<p>El nivel práctico mide qué tan fuerte juega el mazo en la mesa, de 1 a 10, donde 10 es cEDH. Sale de seis pilares (consistencia, eficiencia, velocidad, interacción, remates y resiliencia) más los Game Changers, el stax y los combos. Es una estimación para conversar antes de jugar, no un veredicto.</p></details>
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

  ${pillarCardsHTML(d, A)}

  <div class="rp-grid">
    ${repBoxHTML("Base de maná", lvPill(R.mana.lv.k==="dense"?{k:"dense",es:"Densa"}:R.mana.lv.k==="mod"?{k:"mod",es:"Justa"}:{k:"light",es:"Corta"}), `<p class="muted rp-sub">${R.mana.colors} color${R.mana.colors===1?"":"es"}</p><div class="rp-big"><b class="num">${R.mana.lands}</b> tierras</div>
      <div class="rp-split"><i style="flex:${R.mana.basics||0.01}">${R.mana.basics} básicas</i><i style="flex:${R.mana.nonbasic||0.01}">${R.mana.nonbasic} no básicas</i></div>
      <p class="muted rp-sub">${R.mana.fetch} fetch · ${R.mana.utility} de utilidad · ${R.mana.untapped}% entran enderezadas · calidad ${R.mana.quality}%</p><button class="btn sm ghost" data-sub="mana" style="padding:0">Ver base de maná completa →</button>`)}
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

  ${R.syn && R.syn.prof ? synProfileHTML(R.syn) : ""}

  <section class="rp-card rp-nutri"><h4>Información nutricional</h4><div class="rp-nh"><span>por mazo de 100 cartas</span><span>% valor diario*</span></div>
    ${R.nutri.map(n=>`<div class="rp-nr"><span><b>${n.es}</b> ${n.n}</span><b class="num ${n.pct<70?"down":n.pct>150?"warn":""}">${n.pct}%</b></div>`).join("")}
    <p class="foot">*Contra la plantilla recomendada para Commander (36–37 tierras, 10 ramp, 10 robo, 8 respuestas, 3 barridos, 4 protección). Arreglo de colores: tierras y ramp que dan dos o más de tus colores. Juega en curva: manos que no se atascan en la simulación. Calidad: arreglo, tierras que entran enderezadas y cantidad de tierras.</p></section>

  <section class="rp-card rp-r0"><div><h4>Tarjeta de regla 0</h4><p class="muted" style="margin:0">Una imagen con el nivel, el bracket, el plan y las cartas que conviene avisar. Mándala al grupo antes de jugar.</p></div>
    <div class="row"><button class="btn primary" data-rp="r0">Crear tarjeta</button><button class="btn" data-rp="r0-text">Copiar como texto</button></div></section>
  </div>`;
}

/* ---------- perfil de sinergia ---------- */
function synProfileHTML(Y){
  const P = Y.prof;
  const seg = (k, es, cls) => P.mix[k] ? `<i class="${cls}" style="flex:${P.mix[k]}" title="${es} ${P.mix[k]}%">${P.mix[k]>=12?`${P.mix[k]}%`:""}</i>` : "";
  const mixLead = P.mix.trig>=50 ? "Basada en disparadores" : P.mix.act>=40 ? "Basada en habilidades activadas" : P.mix.stat>=40 ? "Basada en efectos estáticos" : "Mezclada";
  return `<section class="rp-card sy-prof"><div class="rp-h"><h4 class="sc">perfil de sinergia</h4><span class="muted">${esc(Y.shape.es)} · ${esc(Y.focus.es)}</span></div>
    ${P.labels.length?`<div class="chips">${P.labels.map(l=>`<span class="pill ${l.tone}">${esc(l.es)}</span>`).join("")}</div>`:""}
    <div class="sy-stats">
      <div><small class="sc">conexiones</small><b class="num">${P.entries}</b><span class="muted">en ${P.cards} cartas</span></div>
      <div><small class="sc">apoyo por conexión</small><b class="num">${String(P.partners).replace(".",",")}</b><span class="muted">cartas que la sostienen</span></div>
      <div><small class="sc">alcance</small><b class="num">${Y.cov}%</b><span class="muted">de las cartas sin tierras</span></div>
      <div><small class="sc">comandante</small><b>${esc(P.cmdRole)}</b><span class="muted">${Y.cmd}% conectado a él</span></div>
    </div>
    <div><small class="sc muted">tipo de mecánicas · ${mixLead}</small>
      <div class="sy-mix">${seg("trig","Disparadas","m-t")}${seg("act","Activadas","m-a")}${seg("stat","Estáticas","m-s")}${seg("repl","De reemplazo","m-r")}</div>
      <div class="sy-legend"><span><i class="m-t"></i>Disparadas ${P.mix.trig}%</span><span><i class="m-a"></i>Activadas ${P.mix.act}%</span><span><i class="m-s"></i>Estáticas ${P.mix.stat}%</span><span><i class="m-r"></i>Reemplazo ${P.mix.repl}%</span></div></div>
    <div class="sy-shape"><span><small class="sc">forma de la red</small> ${esc(Y.shape.es)}: ${esc(Y.shape.s)}</span><span class="muted num">gini ${String(P.gini).replace(".",",")} · la carta principal ${P.topEntry}% · las 5 principales ${P.top5}%</span></div>
    ${P.hubs.length?`<div><small class="sc muted">cartas que sostienen el plan</small>${P.hubs.map(h=>`<div class="rec"><span>${cardName(h.n,h.m)}</span><span class="meta num">${h.pct}%</span></div>`).join("")}</div>`:""}
    <p class="foot">Gini cerca de 0 = el peso está repartido; cerca de 1 = unas pocas cartas cargan todo. Si una carta sostiene mucho, protégela o busca redundancia.</p></section>`;
}

/* ---------- cartas por pilar (qué aporta cada carta) ---------- */
const PILLAR_GROUPS = [
  {k:"cons", es:"Consistencia", subs:[["draw","Robo"],["rec","Reciclaje"],["sel","Selección"],["tutor","Tutores"]]},
  {k:"eff", es:"Eficiencia", subs:[["fast","Maná rápido"],["ramp","Ramp"],["red","Reductores"]]},
  {k:"inter", es:"Interacción", subs:[["removal","Removal"],["counter","Contrahechizos"],["wipe","Barridos"],["protect","Protección"],["evasion","Evasión"],["control","Otro control"],["stax","Stax"]]},
  {k:"wins", es:"Remates", subs:[["combo","Combos"],["drain","Drenaje"],["tokens","Fichas"],["stompy","Criaturas grandes"],["combat","Combate"],["poison","Veneno"]]},
];
function pillarCards(d, A){
  const cmdTags = new Set(A.cmdMeta.filter(Boolean).flatMap(m=>[...(m.tg||[]), ...(m.rf||[])]));
  const rows = [...A.cmdMeta.filter(Boolean).map(m=>({n:m.n, q:1, m, cmd:true})), ...A.rows.filter(r=>r.m && r.m.t!=="Land")];
  const has = (m,k) => (m.tg||[]).includes(k) || (m.rf||[]).includes(k) || (m.r||[]).includes(k);
  const isInst = m => m.t==="Instant" || has(m,"flash");
  const cheap = m => Math.max(0, 6 - (m.cmc||0));
  const out = {};
  const add = (sub, r, score) => { (out[sub] = out[sub] || []).push({n:r.n, m:r.m, cmd:!!r.cmd, s:Math.round(score*10)/10, syn: !r.cmd && ((r.m.tg||[]).some(k=>cmdTags.has(k)) || (r.m.rf||[]).some(k=>["minusCounters","minusPay","deathDrain"].includes(k) && cmdTags.has(k)))}); };
  for (const r of rows){ const m = r.m;
    if (has(m,"draw")) add("draw", r, 8 + (has(m,"repeat")?6:0) + cheap(m)*0.6);
    if (has(m,"recursion") || has(m,"reanimate")) add("rec", r, 8 + cheap(m)*0.8 + (m.t==="Instant"?1:0));
    if (has(m,"select")) add("sel", r, 5 + cheap(m)*0.5);
    if (has(m,"tutor")) add("tutor", r, (m.tq!=null?m.tq:60)/5 + cheap(m)*0.4);
    if (FAST_MANA.has(r.n.toLowerCase())) add("fast", r, 14 + cheap(m)*0.3);
    else if (has(m,"ramp") || has(m,"landRamp")) add("ramp", r, 6 + cheap(m)*1.1 + ((m.pm||[]).length>2?0.6:0));
    if (has(m,"reducer")) add("red", r, 6 + cheap(m)*0.6);
    const counter = has(m,"counter") || (m.sb||[]).includes("counter");
    if (counter) add("counter", r, 9 + cheap(m)*1.2 + (FREE_INTERACTION.has(r.n.toLowerCase())?4:0));
    else if (has(m,"removal")) add("removal", r, 8 + cheap(m)*1.4 + (isInst(m)?1.5:0) + (FREE_INTERACTION.has(r.n.toLowerCase())?4:0));
    if (has(m,"wipe")) add("wipe", r, 10 + cheap(m)*0.8);
    if (has(m,"protect") || has(m,"protection")) add("protect", r, 6 + cheap(m)*1 + (isInst(m)?1:0));
    if (has(m,"evasion")) add("evasion", r, 5 + cheap(m)*0.5);
    if (has(m,"tax") || has(m,"hoser") || has(m,"edict")) add("control", r, 7 + cheap(m)*0.6);
    if ((m.tg||[]).includes("stax")) add("stax", r, 10 + cheap(m)*0.6);
    if (has(m,"deathDrain") || has(m,"wcDrain")) add("drain", r, 9 + cheap(m)*0.8);
    if (has(m,"token") && m.t!=="Instant" && m.t!=="Sorcery") add("tokens", r, 6 + (has(m,"repeat")?3:0) + cheap(m)*0.4);
    if (m.t==="Creature" && (m.cmc||0)>=6) add("stompy", r, 6 + (m.cmc||0)*0.8);
    if (has(m,"wcCombat") || (m.tg||[]).includes("extraCombat")) add("combat", r, 6 + (has(m,"repeat")?2:0) + cheap(m)*0.4);
    if (has(m,"wcPoison") || has(m,"poison")) add("poison", r, 8);
  }
  for (const k of Object.keys(out)) out[k].sort((a,b)=>b.s-a.s);
  return out;
}
function pillarCardsHTML(d, A){
  const P = pillarCards(d, A);
  const g = PILLAR_GROUPS.find(x=>x.k===(S.rpPil||"cons")) || PILLAR_GROUPS[0];
  const sub = g.subs.some(([k])=>k===S.rpSub) ? S.rpSub : null;
  const seen = new Set(); const list = (sub ? (P[sub]||[]) : g.subs.flatMap(([k])=>P[k]||[])).filter(x=>{ if (seen.has(x.n)) return false; seen.add(x.n); return true; }).sort((a,b)=>b.s-a.s);
  const combosHTML = () => {
    const inc = (d.combos && d.combos.inc) || [];
    if (inc.length) return `<div class="pc-combos">${inc.slice(0,12).map(c=>`<div class="pc-combo">${c.cards.map(n=>`<span class="pill neutral">${cardName(n)}</span>`).join("")}${c.prod&&c.prod.length?`<small class="muted">${esc(c.prod.slice(0,2).join(" · "))}</small>`:""}</div>`).join("")}</div>`;
    const E = powerOf(d, A).E;
    return `<p class="muted" style="margin:0">${E && E.loops ? `Motor de sacrificio detectado: ${E.outlets} salidas, ${E.drains} cartas que drenan y ${E.fodder} cuerpos que vuelven. ` : ""}Para ver los combos exactos, búscalos en Commander Spellbook.</p><button class="btn sm" data-act="combos">Buscar combos</button>`;
  };
  return `<section class="rp-card pc"><h4 class="sc">cartas por pilar</h4>
    <div class="subtabs" role="tablist">${PILLAR_GROUPS.map(x=>`<button class="subtab" role="tab" data-rp-pil="${x.k}" aria-selected="${x.k===g.k}">${x.es}</button>`).join("")}</div>
    <div class="chips">${g.subs.filter(([k])=>(P[k]||[]).length || k==="combo").map(([k,es])=>`<button class="chip" data-rp-sub="${k}" aria-pressed="${sub===k}">${es} <b class="num">${k==="combo" ? ((d.combos&&d.combos.inc||[]).length || "?") : (P[k]||[]).length}</b></button>`).join("")}</div>
    ${sub==="combo" ? combosHTML() : list.length ? `<div class="pc-list">${list.slice(0, 40).map(x=>`<div class="pc-row"><span>${cardName(x.n, x.m)}${x.cmd?` <span class="pill good">comandante</span>`:x.syn?` <span class="pill neutral" title="Comparte mecánica con tu comandante">★ comandante</span>`:""}</span><b class="num">${x.s.toFixed(1)}</b></div>`).join("")}</div>
      <p class="foot">El número es el impacto estimado de la carta en ese pilar (costo, velocidad y si se repite). ★ = trabaja con tu comandante.</p>` : `<p class="muted">Ninguna carta del mazo aporta aquí.</p>`}
  </section>`;
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
  // se guarda el nivel sin calibrar: si cambia la calibración, el historial no inventa un salto
  const p0 = Math.round(P.abs0*10)/10;
  if (last && last.p0==null){ last.p0 = p0; return true; }   // historial antiguo (guardaba el calibrado): se completa sin inventar un cambio
  if (!last || Math.abs(last.p0 - p0) >= 0.05){ h.push({at:Date.now(), p:P.power, p0}); if (h.length>20) h.splice(0, h.length-20); return true; }
  return false;
}

document.addEventListener("click", async ev => {
  const bb = ev.target.closest("[data-rp-base]"); if (bb){ S.rpBase = bb.dataset.rpBase; render(); return; }
  const pl = ev.target.closest("[data-rp-pil]"); if (pl){ S.rpPil = pl.dataset.rpPil; S.rpSub = null; render(); return; }
  const ps = ev.target.closest("[data-rp-sub]"); if (ps){ S.rpSub = S.rpSub===ps.dataset.rpSub ? null : ps.dataset.rpSub; render(); return; }
  const b = ev.target.closest("[data-rp]"); if (!b) return;
  const d = S.data.decks.find(x=>x.id===S.sel[S.view]); if (!d) return;
  const A = analyze(d);
  if (b.dataset.rp==="refresh"){ await fetchCards(allNames(d), {force:true, label:"Actualizando datos de las cartas del mazo"}); bumpAnalysis(); render(); }
  else if (b.dataset.rp==="r0"){ b.disabled = true; try { await rule0Card(d, A); } finally { b.disabled = false; } }
  else if (b.dataset.rp==="r0-text"){ copyText(rule0Text(d, A)); }
  else if (b.dataset.rp==="cs"){ const v = parseFloat(String(($("#rp-cs")||{}).value||"").replace(",", "."));
    if (!(v>=1 && v<=10)){ if (d.csRef){ const {csRef, ...rest} = d; saveDeck(rest, {silent:true, noLog:true}); toast("Referencia de Commandersalt quitada."); } else toast("Escribe el nivel de Commandersalt, entre 1 y 10."); render(); return; }
    saveDeck({...d, csRef:{p:Math.round(v*100)/100, at:Date.now()}}, {silent:true, noLog:true}); toast("Referencia guardada: se ve en la tabla de todos tus mazos."); render(); }
});
