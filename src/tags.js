/* =========================================================
   Bóveda EDH — etiquetas de cartas y sinergias
   Cada carta recibe etiquetas según su texto y tipo. Cada
   tema une etiquetas que "dan" (habilitadores) con etiquetas
   que "aprovechan" (recompensas). Un tema está sano cuando
   el mazo tiene suficientes de ambos lados.
   ========================================================= */

// k: clave · es: nombre · re: texto de la carta (en minúsculas, "this" = la propia carta) · ty: por tipo
const TAG_DEFS = [
  // fichas
  {k:"token", es:"crea fichas", re:/create[s]? (a|an|one|two|three|four|five|x|that many|\d+|a number of) [^.]*?tokens?/},
  {k:"tokenPay", es:"aprovecha fichas", re:/whenever (one or more )?(a |another )?(nontoken )?creatures? (token )?(enters|you control enters)|for each creature you control|creatures you control get \+\d|populate|whenever you create (a|one or more) tokens?|tokens you control (get|have)|creates? twice that many (of those )?tokens|create (one|two) additional tokens?/},
  // sacrificio
  {k:"sacOutlet", es:"sacrifica a voluntad", re:/sacrifice (a|another|an?(?: \w+)?) (creature|artifact|permanent|token)[^.]*?:|, sacrifice (a|another) creature:/},
  {k:"dies", es:"aprovecha muertes", re:/whenever (this or )?(a|another|one or more)( other)?( nontoken)? creatures?( you control| an opponent controls)? (dies|die|is put into a graveyard)|whenever you sacrifice|whenever (a|another) (creature|permanent) you control is put into|a creature dying causes/},
  {k:"sacFodder", es:"deja cuerpos para sacrificar", re:/when (this|this creature) dies,? (create|return|you create)|\bpersist\b|\bundying\b/},
  // contadores
  {k:"counters", es:"pone contadores +1/+1", re:/put (a|one|two|three|x|that many|\d+) \+1\/\+1 counters?|enters with (a|one|two|three|x|\d+) \+1\/\+1 counters?|\bmodular\b|\boutlast\b|\badapt\b|\bbolster\b|\bevolve\b|\bexplores?\b/},
  {k:"countersPay", es:"aprovecha contadores", re:/with (a|one or more) \+1\/\+1 counters? on (it|them)|for each \+1\/\+1 counter|double the number of|twice that many (of those )?counters|(one|two|that many) (additional|more) \+1\/\+1 counters?|if one or more \+1\/\+1 counters would/},
  {k:"proliferate", es:"prolifera", re:/proliferate/},
  // tierras
  {k:"landDrop", es:"tierras extra", re:/play (an|two) additional lands?|put (a|up to (one|two)) lands? cards?[^.]*onto the battlefield|search your library for [^.]*lands?[^.]*onto the battlefield|return (a|target) land[^.]*to (its owner's|your) hand/},
  {k:"landfall", es:"aprovecha tierras (landfall)", re:/landfall|whenever a land (you control )?enters|whenever one or more lands (you control )?enter/},
  // entrar al campo y parpadeo
  {k:"etb", es:"efecto al entrar", re:/when this enters|whenever this enters|when this creature enters/},
  {k:"blink", es:"parpadeo", re:/exile (target|another target|up to one target|any number of other target|two target)[^.]*(creatures?|permanents?|artifacts?)[^.]*?(you control|you own)?[^.]*then return (it|them|that card|those cards) to the battlefield|return (it|that card) to the battlefield under (its owner's|your) control at the beginning of the next end step/},
  {k:"copyPerm", es:"copia permanentes", re:/create a token that's a copy of|becomes a copy of|enter as a copy of/},
  // cementerio
  {k:"selfMill", es:"llena el cementerio", re:/\bmill\b|put the top [^.]* cards? of your library into your graveyard|\bsurveil\b|\bdredge\b|\bentomb\b/},
  {k:"reanimate", es:"reanima", re:/(return|put) (target|a|up to one target|any number of target)? ?[^.]*creature cards? from (your|a) graveyard (to|onto) the battlefield|return target creature card from your graveyard to the battlefield|reanimate/},
  {k:"graveyardPay", es:"aprovecha el cementerio", re:/\bflashback\b|\bescape\b|\bdelve\b|\bunearth\b|\bembalm\b|\beternalize\b|\bdisturb\b|for each (creature )?card in your graveyard|cards? in your graveyard (has|have)|you may cast [^.]*from your graveyard|threshold|delirium/},
  // hechizos
  {k:"spellsPay", es:"aprovecha instantáneos y conjuros", re:/whenever you cast (an|a) (instant|sorcery|noncreature)|instant (and|or) sorcery spells you cast (cost|have)|\bmagecraft\b|\bprowess\b|copy target (instant|sorcery)|whenever you cast or copy/},
  {k:"cantrip", es:"hechizo barato que roba", re:/draw a card\.?$|draws? a card\./, ty:t=>t==="Instant"||t==="Sorcery"},
  {k:"storm", es:"tormenta y copias", re:/\bstorm\b|copy (it|that spell|target spell)/},
  // artefactos y encantamientos
  {k:"artifactMake", es:"crea artefactos (tesoros, pistas…)", re:/create (a|an|one|two|three|x|that many|\d+) (tapped )?(treasure|clue|food|blood|map|powerstone|gold|artifact)/},
  {k:"artifactsPay", es:"aprovecha artefactos", re:/whenever (an|one or more|another) (nontoken )?artifacts? (enters|you control enters|is put into a graveyard)|for each artifact you control|\baffinity for artifacts\b|\bimprovise\b|\bmetalcraft\b|artifacts you control (get|have)|sacrifice an artifact:/},
  {k:"enchantPay", es:"aprovecha encantamientos", re:/\bconstellation\b|whenever (an|another) enchantment (you control )?enters|for each enchantment you control|whenever you cast an enchantment|enchantments you control (get|have)/},
  {k:"aura", es:"aura", ty:(t,tl)=>/\bAura\b/.test(tl)},
  {k:"equipment", es:"equipo", ty:(t,tl)=>/\bEquipment\b/.test(tl)},
  {k:"voltronPay", es:"aprovecha auras y equipos", re:/equipped creature|enchanted creature you control|for each (aura|equipment)|whenever (an aura|an equipment|a creature you control becomes enchanted|equipped)|auras? (and|or) equipment|attach [^.]* to/},
  // vida
  {k:"lifegain", es:"gana vida", re:/you gain (\d+|x|that much|life equal)|\blifelink\b|gain \d+ life/},
  {k:"lifegainPay", es:"aprovecha ganar vida", re:/whenever you gain life|if you would gain life|for each 1 life you gained|you gained (\d+ or more )?life this turn/},
  // robo y descarte
  {k:"drawPay", es:"aprovecha robar", re:/whenever you draw (a|your second) card|for each card you've drawn/},
  {k:"wheel", es:"descarta y roba (rueda)", re:/each player (discards their hand|shuffles their hand)[^.]*draws?|discard your hand, then draw/},
  {k:"discardOut", es:"descarta a voluntad", re:/discard a card:|as an additional cost to cast this spell, discard|\bcycling\b|, discard a card[^.]*:/},
  {k:"discardPay", es:"aprovecha descartar", re:/\bmadness\b|whenever you (discard|cycle)|whenever a player discards/},
  // ataque
  {k:"extraCombat", es:"combate extra", re:/additional combat phase|untap all creatures[^.]*after this (main )?phase/},
  {k:"attackPay", es:"aprovecha atacar", re:/whenever (a creature you control|one or more creatures you control|this) attacks|whenever you attack|\bmelee\b|\bbattalion\b|\braid\b/},
  {k:"evasion", es:"evasión", re:/\bflying\b|can't be blocked|\bmenace\b|\btrample\b|\bshadow\b|\bhorsemanship\b/, ty:t=>t==="Creature"},
  // maná e interacción con el comandante
  {k:"untap", es:"endereza permanentes", re:/untap (target|another target|all|up to \w+ target) (\w+ )?(permanent|creature|artifact|land)/},
  {k:"tapPay", es:"habilidades de girar", re:/\{t\}(, [^:]*)?: (?!add)/},
  {k:"planeswalker", es:"planeswalker", ty:t=>t==="Planeswalker"},
  {k:"stax", es:"restringe a los rivales (stax)", re:/(players|opponents|each player|your opponents) can't (cast|untap|search|draw|activate|attack|play)|don't untap during|spells (your opponents cast )?cost \{\d\} more|can't cast more than one|skip (their|your) (untap|draw)|lands (don't|do not) untap|nonbasic lands are (mountains|islands)/},
  {k:"theft", es:"roba permanentes", re:/gain control of (target|all|each)/},
  {k:"energy", es:"energía", re:/\{e\}|energy counter/},
  {k:"poison", es:"veneno", re:/\binfect\b|\btoxic\b|poison counter/},
];
const TAG_ES = Object.fromEntries(TAG_DEFS.map(d=>[d.k, d.es]));

// temas: qué etiquetas dan y cuáles aprovechan; min = mínimo razonable de cada lado en 100 cartas
const THEMES = [
  {k:"tokens", es:"Fichas", en:["token","artifactMake","copyPerm"], pay:["tokenPay","sacOutlet","dies"], min:[8,4]},
  {k:"aristocrats", es:"Sacrificio (aristócratas)", en:["sacOutlet","token","sacFodder"], pay:["dies"], min:[4,3]},
  {k:"counters", es:"Contadores +1/+1", en:["counters"], pay:["countersPay","proliferate"], min:[8,3]},
  {k:"landfall", es:"Tierras (landfall)", en:["landDrop"], pay:["landfall"], min:[8,4]},
  {k:"blink", es:"Entrar al campo y parpadeo", en:["blink","copyPerm"], pay:["etb"], min:[4,10]},
  {k:"graveyard", es:"Cementerio", en:["selfMill","discardOut","wheel"], pay:["reanimate","graveyardPay"], min:[6,4]},
  {k:"spells", es:"Instantáneos y conjuros", en:["cantrip","storm"], pay:["spellsPay"], min:[10,3], enType:["Instant","Sorcery"]},
  {k:"artifacts", es:"Artefactos", en:["artifactMake"], pay:["artifactsPay"], min:[12,3], enType:["Artifact"]},
  {k:"enchant", es:"Encantamientos", en:["aura"], pay:["enchantPay"], min:[12,3], enType:["Enchantment"]},
  {k:"voltron", es:"Auras y equipos (voltron)", en:["aura","equipment"], pay:["voltronPay","evasion"], min:[8,4]},
  {k:"lifegain", es:"Ganar vida", en:["lifegain"], pay:["lifegainPay"], min:[8,3]},
  {k:"draw", es:"Robar cartas", en:["cantrip","wheel"], pay:["drawPay"], min:[8,2], enRole:"draw"},
  {k:"discard", es:"Descarte (madness)", en:["discardOut","wheel"], pay:["discardPay","graveyardPay"], min:[5,3]},
  {k:"combat", es:"Combate", en:["extraCombat","evasion"], pay:["attackPay"], min:[6,4]},
  {k:"untap", es:"Girar y enderezar", en:["untap"], pay:["tapPay"], min:[3,4]},
  {k:"proliferate", es:"Proliferar", en:["counters","planeswalker","poison","energy"], pay:["proliferate"], min:[6,2]},
];

function detectTags(o, t, tl){
  const out = new Set(); o = o || ""; tl = tl || "";
  for (const d of TAG_DEFS){
    const byRe = d.re ? d.re.test(o) : true;
    const byTy = d.ty ? d.ty(t, tl) : true;
    if (d.re && d.ty ? (byRe && byTy) : d.re ? byRe : byTy) out.add(d.k);
  }
  // tribal: "otros Elfos que controlas", "Elfos que controlas obtienen", "elige un tipo de criatura"
  const STOP = /^(creature|creatures|permanent|permanents|land|lands|artifact|artifacts|enchantment|enchantments|token|tokens|nontoken|player|opponent|other|each|another|it|this|that|and|or|attacking|blocking|tapped|untapped|legendary|nonlegendary|all|the|your|you|of|with|white|blue|black|red|green|colorless|multicolored|card|cards|spell|spells|counter|counters|planeswalker|planeswalkers|basic|forest|forests|island|islands|swamp|swamps|mountain|mountains|plains|treasure|treasures|food|clue|clues|equipment|aura|auras)$/;
  const norm = w => w.replace(/(ves)$/,"f").replace(/s$/,"");
  for (const x of o.matchAll(/(?:other |each )?([a-z]+) (?:creatures )?you control (?:get|have|gain)|whenever (?:a|another) ([a-z]+) (?:you control )?(?:enters|attacks|dies)|(choose a creature type)|(?:number of|for each) ([a-z]+) you control/g)){
    if (x[3]){ out.add("tribe:*"); continue; }
    const w = x[1] || x[2] || x[4];
    if (w && !STOP.test(w)) out.add("tribe:" + norm(w));
  }
  return [...out];
}
// subtipos de criatura desde la línea de tipo
function subtypesOf(m){ if (!m || !/Creature|Kindred|Tribal/.test(m.tl||"")) return []; const p = String(m.tl).split(/—|-/)[1]; return p ? p.trim().toLowerCase().split(/\s+/).map(w=>w.replace(/(ves)$/,"f").replace(/s$/,"")) : []; }

/* ---------- análisis de sinergias de un mazo ---------- */
function synergyOf(d, A){
  A = A || analyze(d);
  const rows = [...A.rows, ...A.cmdMeta.filter(Boolean).map(m=>({n:m.n, q:1, m, cmd:true}))].filter(r=>r.m && !r.m.basic);
  const noTags = rows.filter(r=>!Array.isArray(r.m.tg)).length;
  const has = (r, k) => (r.m.tg||[]).includes(k);
  const enOf = (r, th) => th.en.some(k=>has(r,k)) || (th.enType||[]).includes(r.m.t) || (th.enRole && (r.m.r||[]).includes(th.enRole));
  const payOf = (r, th) => th.pay.some(k=>has(r,k));
  const themes = THEMES.map(th => {
    const en = rows.filter(r=>enOf(r,th)), pay = rows.filter(r=>payOf(r,th));
    const E = en.reduce((a,r)=>a+r.q,0), P = pay.reduce((a,r)=>a+r.q,0);
    const cmd = rows.some(r=>r.cmd && (enOf(r,th)||payOf(r,th)));
    const scale = A.isC ? 1 : 0.6;
    const [me, mp] = th.min.map(x=>Math.max(1, Math.round(x*scale)));
    const score = Math.round(100 * Math.min(1, Math.sqrt((E/me) * (P/mp)) / 1.4));
    const state = E>=me && P>=mp ? "fuerte" : E>=me*0.5 && P>=Math.max(1,mp*0.5) ? "a medias" : P>0 && E>0 ? "débil" : "ausente";
    return {...th, enR:en, payR:pay, E, P, me, mp, score, state, cmd, need: E<me ? "en" : P<mp ? "pay" : null};
  }).filter(t=>t.E+t.P>0).sort((a,b)=>(b.cmd-a.cmd) || b.score-a.score);
  // tribal
  const tribeCount = new Map(); for (const r of rows) for (const s of subtypesOf(r.m)) tribeCount.set(s, (tribeCount.get(s)||0)+r.q);
  const tribePay = rows.filter(r=>(r.m.tg||[]).some(k=>k.startsWith("tribe:")));
  const tribes = [...tribeCount.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([s,n])=>({s, n, pay: tribePay.filter(r=>r.m.tg.includes("tribe:"+s) || r.m.tg.includes("tribe:*"))})).filter(t=>t.n>=5 || t.pay.length);
  // cartas sin interacción con ningún tema activo (candidatas a salir)
  const active = themes.filter(t=>t.state!=="ausente" && t.score>=35);
  const links = new Map();
  for (const r of rows){
    let n = 0; const why = [];
    for (const th of active){
      if (enOf(r,th) && th.P>0){ n += th.P - (payOf(r,th)?r.q:0); why.push(th.es); }
      else if (payOf(r,th) && th.E>0){ n += th.E - (enOf(r,th)?r.q:0); why.push(th.es); }
    }
    for (const t of tribes) if (subtypesOf(r.m).includes(t.s) && t.pay.length) { n += t.pay.length; why.push("tribu " + t.s); }
    links.set(r.n, {n, why:[...new Set(why)]});
  }
  const staple = r => (r.m.r||[]).some(x=>["ramp","draw","removal","wipe","protection","tutor"].includes(x)) || r.m.t==="Land";
  const lonely = rows.filter(r=>!r.cmd && !staple(r) && (links.get(r.n)||{n:0}).n===0);
  const total = rows.filter(r=>!r.cmd && r.m.t!=="Land").length || 1;
  const linked = rows.filter(r=>!r.cmd && r.m.t!=="Land" && (links.get(r.n)||{n:0}).n>0).length;
  return {themes, tribes, lonely, links, noTags, cohesion: Math.round(100*linked/total)};
}
// cartas conocidas (colección, EDHREC o caché) que refuerzan el lado débil de un tema
function synergyAdds(d, A, th, limit=8){
  const want = th.need==="en" ? th.en : th.pay;
  const inDeck = new Set([...A.rows.map(r=>slug(r.n)), ...(d.commanders||[]).map(slug)]);
  const E = typeof edhOf==="function" ? edhOf(d) : null;
  const edhIncl = new Map(((E&&E.pool)||[]).map(c=>[slug(c.n), c.incl||0]));
  const ci = A.ci;
  const legal = m => !m.lg || !m.lg[A.fmt] || m.lg[A.fmt]==="legal";
  const inCI = m => !(m.ci||"").split("").some(c=>WUBRG.includes(c) && !ci.includes(c));
  const out = [];
  for (const [k, m] of Object.entries(S.cards)){
    if (!m || !m.n || inDeck.has(k) || slug(m.n)!==k || m.t==="Land" || !legal(m) || !inCI(m)) continue;
    const tg = m.tg || []; if (!want.some(w=>tg.includes(w)) && !(th.need==="en" && (th.enType||[]).includes(m.t))) continue;
    const both = th.en.some(w=>tg.includes(w)) && th.pay.some(w=>tg.includes(w));
    const own = ownedOf(m.n) > 0; const incl = edhIncl.get(k) || 0;
    out.push({n:m.n, m, own, incl, both, s:(own?3:0) + incl*4 + (both?1.5:0) + (m.rank?Math.max(0, 1-m.rank/20000):0)});
  }
  return out.sort((a,b)=>b.s-a.s).slice(0, limit);
}

/* ---------- vista ---------- */
function synergyHTML(d, A){
  const Y = synergyOf(d, A);
  const bar = (v, max) => `<span class="sy-bar"><i style="width:${Math.min(100, Math.round(100*v/Math.max(1,max)))}%"></i></span>`;
  const tone = s => s==="fuerte"?"good":s==="a medias"?"warn":"bad";
  const cardsList = arr => arr.slice(0,14).map(r=>cardName(r.n,r.m)).join(", ") + (arr.length>14?` y ${arr.length-14} más`:"");
  const themeBox = th => `<div class="sy-th card-box">
      <div class="sy-top"><b>${esc(th.es)}</b>${th.cmd?`<span class="tag">tu comandante</span>`:""}<span class="pill ${tone(th.state)}">${th.state}</span><span class="sy-score num">${th.score}</span></div>
      <div class="sy-sides"><div><div class="sy-lab">Habilitan <span class="num">${th.E}</span> <span class="muted">/ ${th.me}+</span></div>${bar(th.E, th.me)}<div class="sy-cards">${th.enR.length?cardsList(th.enR):`<span class="muted">ninguna</span>`}</div></div>
      <div><div class="sy-lab">Aprovechan <span class="num">${th.P}</span> <span class="muted">/ ${th.mp}+</span></div>${bar(th.P, th.mp)}<div class="sy-cards">${th.payR.length?cardsList(th.payR):`<span class="muted">ninguna</span>`}</div></div></div>
      ${th.need?`<div class="sy-need">Le faltan cartas que <b>${th.need==="en"?"habiliten":"aprovechen"}</b> el tema. <button class="btn sm" data-sy-adds="${th.k}">Ver sugerencias</button></div>${S.syOpen===th.k?synergyAddsHTML(d,A,th):""}`:""}
    </div>`;
  const main = Y.themes.filter(t=>t.state!=="ausente").slice(0,6);
  return `<div class="sec"><h3>Sinergias del mazo</h3><p class="lede">Cada carta recibe etiquetas según lo que hace (${TAG_DEFS.length} tipos: fichas, sacrificio, contadores, cementerio, landfall, parpadeo…). Un tema funciona cuando hay cartas que lo <b>habilitan</b> y cartas que lo <b>aprovechan</b>.</p>
    ${Y.noTags?`<div class="banner"><span><b class="num">${Y.noTags}</b> cartas se guardaron antes de las etiquetas y no cuentan aquí.</span><button class="btn sm primary" data-act="refetch-deck">Actualizar cartas</button></div>`:""}
    <div class="stats"><div class="stat ${Y.cohesion>=70?"good":Y.cohesion>=45?"warn":"bad"}"><div class="k">cohesión</div><div class="v">${Y.cohesion}<small>%</small></div></div><div class="stat"><div class="k">temas fuertes</div><div class="v">${Y.themes.filter(t=>t.state==="fuerte").length}</div></div><div class="stat ${Y.lonely.length>8?"warn":""}"><div class="k">cartas sueltas</div><div class="v">${Y.lonely.length}</div></div></div>
    <p class="foot">Cohesión = porcentaje de cartas que no son tierras que se conectan con al menos un tema activo del mazo.</p></div>
  <div class="sy-grid">${main.map(themeBox).join("") || `<p class="muted">No se detectan temas todavía. Actualiza las cartas o agrega más cartas con un plan común.</p>`}</div>
  ${Y.tribes.length?`<div class="sec"><h3>Tribus</h3>${Y.tribes.map(t=>`<div class="rec"><span><b>${esc(t.s)}</b> · <span class="num">${t.n}</span> criaturas${t.pay.length?` · aprovechan la tribu: ${t.pay.map(r=>cardName(r.n,r.m)).join(", ")}`:` · <span class="muted">ninguna carta aprovecha esta tribu</span>`}</span></div>`).join("")}</div>`:""}
  ${Y.lonely.length?`<div class="sec"><h3>Cartas sueltas · ${Y.lonely.length}</h3><p class="lede">No habilitan ni aprovechan ninguno de tus temas y no son ramp, robo, removal ni protección. Son las primeras candidatas a cambiar por cartas que sumen a un tema.</p><div class="chips">${Y.lonely.map(r=>`<span class="pill neutral" style="font-size:.9rem">${cardName(r.n,r.m)}</span>`).join("")}</div></div>`:""}
  ${Y.themes.filter(t=>t.state==="ausente"||t.score<35).length?`<details class="sec"><summary class="muted" style="cursor:pointer">Temas con poca presencia (${Y.themes.filter(t=>t.state==="ausente"||t.score<35).length})</summary><div class="sy-grid" style="margin-top:10px">${Y.themes.filter(t=>t.state==="ausente"||t.score<35).map(themeBox).join("")}</div></details>`:""}`;
}
function synergyAddsHTML(d, A, th){
  const adds = synergyAdds(d, A, th);
  if (!adds.length) return `<p class="muted" style="font-size:.9rem;margin:6px 0 0">No encontré candidatas entre las cartas conocidas. ${A.isC?"Carga EDHREC en “Recomendaciones” o ":""}actualiza tu colección para tener más opciones.</p>`;
  return `<div class="sy-adds">${adds.map(x=>`<div class="rec"><span>${cardName(x.n,x.m)} ${x.own?`<span class="pill good">tienes</span>`:""}${x.incl?` <span class="tag">${Math.round(x.incl*100)}% en EDHREC</span>`:""}${x.both?` <span class="tag">habilita y aprovecha</span>`:""}<br><span class="muted" style="font-size:.84rem">${(x.m.tg||[]).filter(k=>TAG_ES[k]).slice(0,3).map(k=>esc(TAG_ES[k])).join(" · ")}</span></span><span class="meta row" style="gap:6px">${money(refPrice(x.m))}<button class="btn sm ghost" data-sy-maybe="${esc(x.n)}">probable</button></span></div>`).join("")}</div>`;
}
function tagChipsHTML(m){ const tg = (m && m.tg || []).filter(k=>TAG_ES[k]); return tg.length ? `<div class="chips">${tg.map(k=>`<span class="pill neutral">${esc(TAG_ES[k])}</span>`).join("")}</div>` : ""; }
// resumen de sinergias para la consulta a Claude
function synergyPromptText(d, A){
  const Y = synergyOf(d, A);
  const th = Y.themes.filter(t=>t.state!=="ausente").slice(0,5).map(t=>`${t.es}: ${t.state} (habilitan ${t.E}, aprovechan ${t.P})`).join("; ");
  return `Sinergias detectadas por la app: ${th||"ninguna clara"}. Cohesión ${Y.cohesion}%. Cartas sueltas: ${Y.lonely.map(r=>r.n).slice(0,15).join(", ")||"ninguna"}.`;
}

document.addEventListener("click", ev => {
  const a = ev.target.closest("[data-sy-adds]"); if (a){ S.syOpen = S.syOpen===a.dataset.syAdds ? null : a.dataset.syAdds; render(); return; }
  const m = ev.target.closest("[data-sy-maybe]"); if (m){ const d = curDeck(); if (!d) return; const n = m.dataset.syMaybe;
    if ((d.maybe||[]).some(c=>slug(c.n)===slug(n))){ toast("Ya está en cartas probables."); return; }
    saveDeck({...d, maybe:[...(d.maybe||[]), {n, q:1}]}, {src:"optimizador"}); toast(`${n} agregada a cartas probables.`); }
});
