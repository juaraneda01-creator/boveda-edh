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
  const live = S.salt && S.salt.map && S.salt.map[slug(n)];
  if (live != null) return live;
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
  if ((m.r||[]).includes("tutor")) s += 0.35;
  if ((m.sb||[]).includes("counter")) s += 0.3;
  if ((m.r||[]).includes("wipe")) s += 0.3;
  if (FAST_MANA.has(String(n).toLowerCase())) s += 0.4;
  if (m.gc) s += 0.4;
  return Math.min(1.6, s);
}
async function loadSaltLive(){
  try {
    const r = await fetch("https://json.edhrec.com/pages/top/salt.json"); if (!r.ok) throw 0;
    const j = await r.json(); const list = (((j.container||{}).json_dict||{}).cardlists||[]).flatMap(c=>c.cardviews||[]);
    if (list.length < 50) throw 0;
    S.salt = {at:Date.now(), map:Object.fromEntries(list.filter(c=>c.salt!=null).map(c=>[slug(c.name), +c.salt]))};
    idb.set("salt", S.salt); bumpAnalysis(); render(); toast(`Sal actualizada desde EDHREC (${list.length} cartas).`);
  } catch { toast(typeof offlineMsg==="function" ? offlineMsg("EDHREC") : "EDHREC no respondió."); }
}
idb.get("salt").then(v=>{ if (v && v.map) S.salt = v; });

/* ---------- evaluación ---------- */
const clamp10 = x => Math.max(0, Math.min(10, x));
function powerOf(d, A){
  A = A || analyze(d);
  const sim = simulate(d, A);
  const rows = [...A.rows, ...A.cmdMeta.filter(Boolean).map(m=>({n:m.n, q:1, m, cmd:true}))].filter(r=>r.m);
  const cnt = f => rows.filter(r=>f(r.m, r)).reduce((a,r)=>a+r.q,0);
  const fast = cnt((m,r)=>FAST_MANA.has(r.n.toLowerCase()));
  const cheapRamp = cnt(m=>(m.r||[]).includes("ramp") && m.cmc<=2 && m.t!=="Land");
  const free = cnt((m,r)=>FREE_INTERACTION.has(r.n.toLowerCase()));
  const counters = cnt(m=>(m.sb||[]).includes("counter"));
  const stax = cnt(m=>(m.tg||[]).includes("stax"));
  const c2 = d.combos ? combos2(d).length : null;
  const c3 = d.combos ? (d.combos.inc||[]).filter(c=>c.cards.length===3).length : null;
  const Y = typeof synergyOf==="function" ? synergyOf(d, A) : null;
  const scale = A.isC ? 1 : 0.6;
  const comp = [
    {k:"accel", es:"Aceleración", v:clamp10(fast*1.4 + cheapRamp*0.45/scale), why:`${fast} de maná rápido, ${cheapRamp} ramp de 2 o menos`, w:0.17},
    {k:"tutors", es:"Tutores", v:clamp10(A.tutors.length*1.3/scale), why:`${A.tutors.length} tutores`, w:0.13},
    {k:"interaction", es:"Interacción", v:clamp10((A.roles.removal + A.roles.wipe*1.3 + free*1.5)/1.6/scale), why:`${A.roles.removal} removal, ${A.roles.wipe} barridos, ${free} gratis`, w:0.13},
    {k:"cards", es:"Ventaja de cartas", v:clamp10(A.roles.draw*0.8/scale), why:`${A.roles.draw} fuentes de robo`, w:0.11},
    {k:"efficiency", es:"Eficiencia", v:!A.spells ? null : clamp10(10 - (A.avg-1.9)*3.2 - (sim && sim.pScrew ? sim.pScrew*8 : 0)), why:`CMC promedio ${A.avg.toFixed(2)}${sim?`, ${Math.round((sim.pScrew||0)*100)}% manos atascadas`:""}`, w:0.13},
    {k:"combo", es:"Combos", v:c2==null ? null : clamp10(c2*3.5 + c3*1.2), why:c2==null ? "sin revisar (usa Buscar combos)" : `${c2} de 2 cartas, ${c3} de 3`, w:0.2},
    {k:"synergy", es:"Sinergia", v:Y ? clamp10(Y.cohesion/10) : null, why:Y ? `cohesión ${Y.cohesion}%` : "", w:0.08},
  ];
  const have = comp.filter(c=>c.v!=null);
  const wsum = have.reduce((a,c)=>a+c.w,0) || 1;
  let raw = have.reduce((a,c)=>a+c.v*c.w,0) / wsum;
  raw += Math.min(1.2, A.gc.length*0.2) + Math.min(0.8, stax*0.2) + (A.xt.length ? 0.3 : 0);
  const abs = Math.max(1, Math.min(10, 1 + raw*0.95));
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
  return {power, abs, comp, real, official, cedh, salt, saltLabel, saltTop:salty.slice(0,10), threat, threatCards, sim, c2};
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
      <p class="foot">Sal de 0 a 3 según la votación de EDHREC (${S.salt?`actualizada ${new Date(S.salt.at).toLocaleDateString("es-CL")}`:esc(SALT_AT)}); las demás cartas se estiman por lo que hacen. ${isWebView()?"":`<button class="btn sm ghost" style="padding:0" data-pw="salt">Actualizar desde EDHREC</button>`}</p></div>
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
  return `<div class="sec"><h3>Tabla de poder y sal</h3><p class="lede">Todos tus mazos y los de tus amigos con los mismos criterios. Toca una columna para ordenar.</p>
    <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Mazo</th>${th("power","Nivel")}${th("salt","Sal")}${th("threat","Amenaza")}<th class="n">Bracket</th></tr></thead><tbody>
    ${rows.map((r,i)=>`<tr${r.d.rival?"":' style="background:var(--accent-soft)"'}><td class="num">${i+1}</td><td><b>${esc(r.d.name)}</b><br><span class="muted" style="font-size:.85rem">${esc((r.d.commanders||[]).join(" + "))} · ${r.d.rival?esc(r.d.rival.owner||"amigo"):"tú"}</span></td><td class="n">${r.P.power.toFixed(1)}</td><td class="n">${r.P.salt}</td><td class="n">${r.P.threat.toFixed(1)}</td><td class="n">${r.P.official.b} / ${r.P.real}</td></tr>`).join("")}
    </tbody></table></div><p class="foot">Bracket: oficial / realista.</p></div>`;
}
function powerPromptText(d, A){ const P = powerOf(d, A); return `Nivel estimado por la app: ${P.power}/10 (${PL_ES(P.power)}); sal ${P.salt}/100; bracket oficial ${P.official.b}, realista ${P.real}.`; }

document.addEventListener("click", async ev => {
  const s = ev.target.closest("[data-pw-sort]"); if (s){ S.pwSort = s.dataset.pwSort; render(); return; }
  const b = ev.target.closest("[data-pw]"); if (b && b.dataset.pw==="salt") await loadSaltLive();
});
