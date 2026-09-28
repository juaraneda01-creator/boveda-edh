/* =========================================================
   Bóveda EDH — herramientas (estilo EDH Optimizer)
   Hub, IA con clave propia, radiografía, probar mano,
   constructor guiado, mesa local, versiones, compartir,
   informe PDF, novedades y resumen semanal.
   ========================================================= */

/* ---------- hub ---------- */
const ICON = {
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  xray:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  hand:'<rect x="3" y="7" width="8" height="12" rx="1.5" transform="rotate(-12 7 13)"/><rect x="9" y="5" width="8" height="12" rx="1.5"/><rect x="14" y="6" width="8" height="12" rx="1.5" transform="rotate(12 18 12)"/>',
  dice:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2"/><circle cx="16" cy="16" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="16" cy="8" r="1.2"/><circle cx="8" cy="16" r="1.2"/>',
  tool:'<path d="M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9a4 4 0 0 0-2-2z"/>',
  box:'<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  people:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.5 3-6 6-6s6 2.5 6 6M14 20c.3-2.6 1.9-4.5 4-4.5s3.7 1.9 4 4.5"/>',
  scale:'<path d="M12 3v18M5 7h14M5 7l-3 7h6zM19 7l-3 7h6zM8 21h8"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  file:'<path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5M9 13h7M9 17h7"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  star:'<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
};
const icon = k => `<svg class="ti" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[k]||""}</svg>`;
const TOOLS = [
  {k:"analisis", i:"chart", t:"Análisis", d:"Mecánicas, curva, bracket, combos e interacción de tu mazo."},
  {k:"ia", i:"spark", t:"Optimizar con IA", d:"Qué cortar, qué añadir y por qué, adaptado a tu mazo, tu colección y tu presupuesto."},
  {k:"radiografia", i:"xray", t:"Cómo se juega", d:"El informe completo: cómo se juega, mulligan, debilidades y matchups."},
  {k:"mano", i:"hand", t:"Probar mano", d:"Tablero de solitario con mulligan, scry y vidas de los oponentes."},
  {k:"simulador", i:"dice", t:"Simulador", d:"Diez mil manos Monte Carlo: consistencia, maná por turno y reloj de victoria."},
  {k:"constructor", i:"tool", t:"Constructor", d:"Crea un mazo desde cero: guiado con EDHREC y tu colección, o libre."},
  {k:"coleccion", i:"box", t:"Colección", d:"Guarda tus cartas y optimiza usando lo que ya tienes."},
  {k:"local", i:"people", t:"Meta local", d:"Compara la velocidad de tu mazo con los de tus amigos."},
  {k:"versiones", i:"scale", t:"Comparar versiones", d:"El antes y el después de cada cambio, con sus números."},
  {k:"compartir", i:"link", t:"Compartir", d:"Enlace o código de solo lectura, página del mazo y lista para copiar."},
  {k:"pdf", i:"file", t:"Exportar informe PDF", d:"Decklist y análisis listos para imprimir o guardar como PDF."},
  {k:"vigilancias", i:"bell", t:"Vigilancias de precio", d:"Te avisa cuando una carta baja al precio que le pongas. Sin límite."},
  {k:"novedades", i:"star", t:"Novedades para tus mazos", d:"Qué cartas de los sets nuevos encajan en cada uno de tus mazos."},
  {k:"semanal", i:"mail", t:"Resumen semanal", d:"Subidas, bajadas, cambios y novedades de la semana, para leer o enviarte por correo."},
];
function toolsHubHTML(){
  const nDecks = S.data.decks.filter(d=>!d.rival).length, nAl = alerts().length;
  const shared = S.sharedPreview;
  return `${shared?sharedImportHTML(shared):""}
  ${typeof installCardHTML==="function"?installCardHTML(false):""}
  <div class="fmt-head"><h2>Herramientas</h2><span class="muted">${nDecks} mazo${nDecks===1?"":"s"} · ${(S.data.collection.items||[]).length} registros en tu colección${nAl?` · ${nAl} alerta${nAl>1?"s":""} de precio`:""}</span></div>
  <div class="tool-grid">${TOOLS.map(t=>`<button class="tool-card" data-tool="${t.k}">${icon(t.i)}<span><b>${t.t}</b><span>${t.d}</span></span></button>`).join("")}</div>
  <div style="margin-top:22px">${linkBoxHTML("hub")}</div>
  <div class="card-box" style="margin-top:14px"><h3>Importar un mazo compartido</h3><p class="muted" style="margin:0">Pega el código o el enlace que te enviaron desde otra Bóveda.</p>
    <div class="row"><input type="text" id="share-code" placeholder="Código o enlace #mazo=…" style="flex:1;min-width:220px"><button class="btn sm primary" data-t="share-preview">Ver mazo</button></div></div>`;
}
function currentDeckForTool(){
  for (const f of ["commander","pauper","pioneer"]){ const d=S.data.decks.find(x=>x.id===S.sel[f] && !x.rival); if (d && S.view===f) return d; }
  const all=S.data.decks.filter(d=>!d.rival).sort((a,b)=>(b.updated||0)-(a.updated||0)); return all[0]||null;
}
function openTool(k){
  const TABS = {analisis:"analisis", ia:"ia", radiografia:"radiografia", mano:"mano", simulador:"analisis", versiones:"versiones", compartir:"compartir", pdf:"compartir"};
  const deckTab = Object.prototype.hasOwnProperty.call(TABS, k) ? TABS[k] : null;
  if (deckTab){
    const d=currentDeckForTool();
    if (!d){ S.view="commander"; S.editing={format:"commander", name:"", commanders:[], text:""}; render(); toast("Primero crea o importa un mazo."); return; }
    S.view=d.format; S.sel[d.format]=d.id; S.showMeta[d.format]=false; S.editing=null; S.deckTab=deckTab; render();
    if (k==="simulador") setTimeout(()=>{ const el=document.getElementById("sim"); if (el) el.scrollIntoView({behavior:"smooth"}); },50);
    if (k==="pdf") printReport(d);
    window.scrollTo(0,0); return;
  }
  if (k==="constructor"){ S.view="commander"; S.editing={format:"commander", name:"", commanders:[], text:""}; S.showMeta.commander=false; render(); setTimeout(()=>{ const el=$("#bld-cmd"); if (el) el.focus(); },50); return; }
  if (k==="coleccion"){ S.view="coll"; render(); return; }
  if (k==="local"){ S.view="commander"; S.showMeta.commander="local"; S.editing=null; render(); return; }
  if (k==="vigilancias"){ S.view="market"; S.marketTab="busqueda"; render(); return; }
  if (k==="novedades"){ S.view="news"; render(); return; }
  if (k==="semanal"){ S.view="weekly"; render(); return; }
}

/* ---------- Claude (API con clave propia) ---------- */
async function askClaude(prompt, {max=4000}={}){
  if (isWebView()){ // en claude.ai se usa la sesión del visitante, sin clave de API
    const sm = await claude.use("sample"); if (!sm) throw {code:"net", message:"Claude no está disponible en esta vista."};
    try { const r = await sm(prompt, {modelTier:"complex"}); return r.text; }
    catch(e){ throw {code:e&&e.code, message: e&&e.code==="not_granted" ? "Sin permiso para usar Claude en esta página." : e&&e.code==="rate_limited" ? "Claude está ocupado; prueba en unos minutos." : "No se pudo completar la respuesta de Claude."}; }
  }
  const st=S.data.settings; if (!st.aiKey) throw {code:"nokey", message:"Falta la clave de API"};
  let r;
  try{
    r = await fetch("https://api.anthropic.com/v1/messages", {method:"POST", headers:{"content-type":"application/json", "x-api-key":st.aiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true"},
      body: JSON.stringify({model: st.aiModel||"claude-sonnet-5", max_tokens:max, messages:[{role:"user", content:prompt}]})});
  }catch(e){ throw {code:"net", message:"No se pudo conectar con la API de Anthropic."}; }
  const j = await r.json().catch(()=>({}));
  if (!r.ok) throw {code:r.status, message:(j.error&&j.error.message)||("Error "+r.status)};
  return (j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("");
}
function parseJSONLoose(t){
  try{ return JSON.parse(t); }catch{}
  const m=String(t).match(/```(?:json)?\s*([\s\S]*?)```/); if (m){ try{ return JSON.parse(m[1]); }catch{} }
  const a=t.indexOf("{"), b=t.lastIndexOf("}"); if (a>=0 && b>a){ try{ return JSON.parse(t.slice(a,b+1)); }catch{} }
  return null;
}
const aiErrText = e => e.code==="nokey" ? "Agrega tu clave de API de Anthropic para usar la IA." : e.code===401 ? "La clave de API no es válida. Revísala en Ajustes." : e.code===429 ? "Llegaste al límite de uso de tu cuenta de Anthropic. Prueba más tarde." : e.code==="net" ? e.message : ("Claude no pudo responder: "+(e.message||e.code));
function mdLite(t){ // títulos, viñetas y negritas simples
  return esc(t).split(/\n/).map(l=>{ if (/^#{1,3}\s/.test(l)) return `<h4 class="md-h">${l.replace(/^#{1,3}\s/,"")}</h4>`; if (/^\s*[-*•]\s/.test(l)) return `<li>${l.replace(/^\s*[-*•]\s/,"")}</li>`; if (!l.trim()) return ""; return `<p>${l}</p>`; }).join("").replace(/(<li>.*?<\/li>)+/g, m=>`<ul>${m}</ul>`).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
}
function aiKeyBox(){ return `<div class="card-box"><h3>Conecta Claude</h3><p class="muted" style="margin:0">Pega una clave de la API de Anthropic. La obtienes en <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>. Se guarda solo en este navegador y el uso se cobra en tu cuenta de Anthropic.</p>
  <div class="row"><input type="password" id="ia-key" autocomplete="off" placeholder="sk-ant-…" style="flex:1;min-width:220px"><button class="btn sm primary" data-t="ia-save-key">Guardar clave</button></div>
  <p class="foot" style="margin:0">¿Prefieres no usar una clave? <button class="btn sm ghost" style="padding:0" data-act="prompt">Copia el resumen del mazo</button> y pégalo en claude.ai.</p></div>`; }

/* ---------- IA con el chat de Claude (sin clave ni costo extra) ---------- */
function chatBoxHTML(kind){
  const what = kind==="ia" ? "los cambios sugeridos" : "la radiografía";
  return `<div class="card-box chat-box"><h3>Con tu chat de Claude <span class="pill good">sin costo extra</span></h3>
    <ol class="steps">
      <li>Toca <b>Abrir en Claude</b>: se copia la consulta con tu mazo y se abre un chat nuevo. Si el chat aparece vacío, mantén presionado y elige <b>Pegar</b>.</li>
      <li>Cuando Claude termine, toca <b>Copiar</b> bajo su respuesta.</li>
      <li>Vuelve aquí, pégala abajo y toca <b>Aplicar</b>: verás ${what} dentro de la Bóveda.</li>
    </ol>
    <div class="row"><a class="btn primary" data-chat-open="${kind}" href="https://claude.ai/new" target="_blank" rel="noopener">Abrir en Claude</a><button class="btn sm ghost" data-t="chat-copy" data-v="${kind}">Solo copiar la consulta</button></div>
    <div class="field"><label for="chat-ans-${kind}">Respuesta de Claude</label><textarea id="chat-ans-${kind}" style="min-height:110px" spellcheck="false" placeholder="Pega aquí la respuesta completa de Claude"></textarea></div>
    <div class="row"><button class="btn" data-t="chat-apply" data-v="${kind}">Aplicar respuesta</button></div></div>`;
}
function chatPromptOf(kind, d){ return kind==="ia" ? iaPrompt(d) : radioPrompt(d); }
function claudeChatURL(prompt){ const q = encodeURIComponent(prompt); return q.length <= 7000 ? "https://claude.ai/new?q=" + q : "https://claude.ai/new"; }
function apiDetailsHTML(){ return `<details class="api-adv"><summary class="muted">Opción avanzada: usar una clave de API (se cobra aparte por uso)</summary>${aiKeyBox()}</details>`; }

/* ---------- Optimizar con IA ---------- */
function iaHTML(d,A){
  const st=S.data.settings; const r=d.ai2; const busy=S.iaBusy===d.id;
  const goals=[["casual","Casual (bracket 2)"],["enfocado","Mejorado (bracket 3)"],["optimizado","Optimizado (bracket 4)"],["cedh","cEDH (bracket 5)"]];
  const budgets=[["own","Solo mi colección"],["2","Hasta US$2"],["10","Hasta US$10"],["inf","Sin límite"]];
  S.iaGoal = S.iaGoal || "enfocado";
  const form = `<div class="sec"><h3>Optimizar con IA</h3><p class="lede">Claude revisa tu lista con sus números (roles, curva, bracket, simulador), tu colección y tu presupuesto, y propone qué cortar y qué añadir, con el motivo de cada cambio.</p>
    <div style="display:grid;gap:12px;margin-top:12px">
      ${A.isC?`<div class="field"><label>Nivel de mesa</label><div class="chips">${goals.map(([k,l])=>`<button class="chip" data-t="ia-goal" data-v="${k}" aria-pressed="${S.iaGoal===k}">${l}</button>`).join("")}</div></div>`:""}
      <div class="field"><label>Presupuesto por carta nueva</label><div class="chips">${budgets.map(([k,l])=>`<button class="chip" data-budget="${k}" aria-pressed="${S.optBudget===k}">${l}</button>`).join("")}</div></div>
      <div class="field"><label for="ia-notes">Qué quieres mejorar (opcional)</label><input type="text" id="ia-notes" value="${esc(S.iaNotes||"")}" placeholder="${A.isC?"Ej.: más interacción, menos dependencia del comandante":"Ej.: mejorar el matchup contra UR Aggro"}"></div>
      ${isWebView()||st.aiKey?`<div class="row">${busy?`<span class="muted">Claude está analizando tu mazo; suele tardar entre 20 y 60 segundos…</span>`:`<button class="btn primary" data-t="ia-run">${r?"Volver a optimizar":"Optimizar con IA"}</button>`}${isWebView()?`<span class="foot">Usa tu sesión de Claude, sin costo extra.</span>`:`<span class="foot">Con tu clave de API · modelo ${esc(st.aiModel||"claude-sonnet-5")}</span>`}</div>`:""}
    </div>
    ${isWebView()?"":chatBoxHTML("ia")}
    ${isWebView()||st.aiKey?"":apiDetailsHTML()}</div>`;
  if (!r) return form;
  const inDeck = new Set([...A.rows,...A.side].map(x=>slug(x.n)));
  return form + `<div class="sec"><div class="foot">Resultado del ${new Date(r.at).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"})} · ${esc(r.model||"")}</div>
    <p style="font-size:1.05rem;max-width:72ch">${esc(r.resumen||"")}</p>
    ${r.bracket?`<div class="bracket"><span class="b">${esc(String(r.bracket).slice(0,3))}</span><div><div class="sc">bracket estimado por Claude</div><div class="bt">${esc(r.bracket_razon||"")}</div></div></div>`:""}
    <h3 style="margin-top:16px">Cambios sugeridos</h3>
    <div class="swaps">${(r.cambios||[]).map(c=>{ const done=!inDeck.has(slug(c.sale)) && inDeck.has(slug(c.entra)); const m=cardOf(c.entra);
      return `<div class="swap ${done?"applied":""}"><div><div class="mv"><span class="out">${esc(c.sale)}</span><span aria-hidden="true">→</span><span class="in">${cardName(c.entra,m)}</span>${ownedOf(c.entra)>0?`<span class="pill good">en tu colección</span>`:m?`<span class="pill neutral">${money(refPrice(m))}</span>`:""}${c.seccion==="sideboard"?`<span class="tag">sideboard</span>`:""}</div><div class="why">${esc(c.motivo||"")}</div></div>
      <div>${done?`<span class="pill good">aplicado</span>`:`<button class="btn sm primary" data-swap-out="${esc(c.sale)}" data-swap-in="${esc(c.entra)}">Aplicar</button>`}</div></div>`; }).join("")}</div>
    ${(r.notas||[]).length?`<h3 style="margin-top:16px">Notas</h3><ul>${r.notas.map(n=>`<li>${esc(n)}</li>`).join("")}</ul>`:""}</div>`;
}
function iaPrompt(d){
  const A=analyze(d); const sim=simulate(d,A);
  const goal = {casual:"casual, bracket 2",enfocado:"mejorado, bracket 3",optimizado:"optimizado, bracket 4",cedh:"cEDH, bracket 5"}[S.iaGoal||"enfocado"];
  const extra = `${A.isC?`Nivel de mesa buscado: ${goal}.`:""}
${S.iaNotes?`Lo que quiero mejorar: ${S.iaNotes}`:""}
${sim&&!sim.sixty?`Simulador: comandante en mesa en turno ${sim.avgTurn?sim.avgTurn.toFixed(1):"?"}, mulligan ${Math.round(sim.pMull*100)}%, atascado ${Math.round(sim.pScrew*100)}%.`:""}

Devuelve SOLO un objeto JSON con esta forma:
{"resumen":"2 o 3 frases: plan del mazo y su debilidad principal",
 "bracket": número 1-5 o null,
 "bracket_razon":"una frase",
 "cambios":[{"sale":"carta que está en la lista","entra":"carta nueva","motivo":"una frase","seccion":"deck" o "sideboard"}],
 "notas":["2 a 4 consejos cortos de juego o construcción"]}
Entre 6 y 12 cambios. Cada "sale" debe estar en la lista; cada "entra" debe ser legal en el formato, respetar identidad de color y presupuesto, y no estar ya en el mazo. Nombres de cartas en inglés.`;
  return claudePrompt(d,A)+"\n\n"+extra;
}
async function runIA(d){
  const A=analyze(d);
  S.iaBusy=d.id; render();
  try{
    const txt = await askClaude(iaPrompt(d), {max:4000});
    const j = parseJSONLoose(txt); if (!j || !Array.isArray(j.cambios)) throw {code:"fmt", message:"La respuesta no vino en el formato esperado. Intenta de nuevo."};
    const cur1=S.data.decks.find(x=>x.id===d.id); cur1.ai2={at:Date.now(), model:S.data.settings.aiModel, ...j}; saveDeck(cur1,{silent:true,noLog:true});
    S.iaBusy=null; render();
    fetchCards(j.cambios.map(c=>c.entra),{quiet:true}).then(render);
  }catch(e){ S.iaBusy=null; render(); toast(aiErrText(e)); }
}

/* ---------- Radiografía ---------- */
function radioLocal(d,A){
  const sim=simulate(d,A); const out={plan:[], juego:[], mull:[], deb:[], match:[]};
  const cnt = f => A.rows.filter(r=>r.m && f(r.m)).reduce((a,r)=>a+r.q,0);
  const names = f => A.rows.filter(r=>r.m && f(r.m)).map(r=>r.n);
  const wins = names(m=>(m.r||[]).includes("wincon"));
  const creatures = A.types.Creature||0;
  const E = A.isC ? edhOf(d) : null;
  // plan
  const tags=[];
  if (A.roles.ramp>=12) tags.push("ramp pesado"); if (A.roles.removal+A.roles.wipe>=14) tags.push("control e interacción");
  if (combos2(d).length || A.roles.tutor>=5) tags.push("combo y tutores"); if (A.avg<=2.6 && creatures>=(A.isC?25:16)) tags.push("agresivo de curva baja");
  if (creatures>=(A.isC?30:20)) tags.push("basado en criaturas"); if (A.roles.draw>=12) tags.push("ventaja de cartas constante");
  out.plan.push(tags.length?`Perfil: ${tags.join(", ")}.`:"Perfil equilibrado, sin un eje dominante claro.");
  if (E && E.themes.length) out.plan.push(`Temas habituales de este comandante en EDHREC: ${E.themes.slice(0,4).map(t=>t.v).join(", ")}.`);
  out.plan.push(wins.length?`Cómo gana: ${wins.slice(0,6).join(", ")}${wins.length>6?"…":""}.`:"No detecté cartas de remate claras: revisa cómo cierra las partidas (marca los remates en la ficha de cada carta).");
  const c2=combos2(d); if (c2.length) out.plan.push(`Combos de 2 cartas en la lista: ${c2.slice(0,3).map(c=>c.cards.join(" + ")).join(" · ")}.`);
  // cómo se juega
  const early = cnt(m=>m.t!=="Land" && m.cmc<=2), rampEarly = cnt(m=>m.t!=="Land" && m.cmc<=2 && (m.r||[]).includes("ramp"));
  out.juego.push(`Turnos 1–3: tienes ${early} jugadas de coste 2 o menos (${rampEarly} de ramp). ${rampEarly>=6?"Prioriza el ramp para acelerar.":"Tus primeros turnos dependen de tierras; juega lo más barato que tengas."}`);
  if (A.isC && sim && sim.avgTurn) out.juego.push(`Turnos 4–6: el comandante llega a mesa en promedio en el turno ${sim.avgTurn.toFixed(1)} (${Math.round(sim.byT[5]*100)}% a más tardar en el turno 5).`);
  if (sim && sim.winAvg) out.juego.push(`Cierre: tienes un remate lanzable en promedio en el turno ${sim.winAvg.toFixed(1)}, sin contar interacción rival.`);
  out.juego.push(`Curva: coste promedio ${A.avg.toFixed(2)}; pico en coste ${A.curve.indexOf(Math.max(...A.curve))===7?"7+":A.curve.indexOf(Math.max(...A.curve))}.`);
  // mulligan
  if (sim){
    const keep = sim.hyp.slice(2,6).reduce((a,b)=>a+b,0);
    const N=sim.N, rampN=cnt(m=>m.t!=="Land"&&(m.r||[]).includes("ramp")), drawN=cnt(m=>m.t!=="Land"&&(m.r||[]).includes("draw"));
    const pRamp=1-hyper(N,rampN,7,0), pDraw=1-hyper(N,drawN,7,0);
    out.mull.push(`${Math.round(keep*100)}% de las manos iniciales traen entre 2 y 5 tierras.`);
    out.mull.push(`${Math.round(pRamp*100)}% traen al menos un ramp y ${Math.round(pDraw*100)}% al menos una fuente de robo.`);
    out.mull.push(A.isC ? "Conserva manos con 3 o 4 tierras, o 2 tierras más un ramp de coste 1–2. Haz mulligan con 0–1 o 6–7 tierras: el primero es gratis." : "Conserva manos con 2 a 4 tierras y jugadas para los primeros turnos; con 0–1 o 5+ tierras, mulligan.");
  }
  // debilidades
  for (const t of TARGETS) if (A.isC && t.k!=="land" && A.roles[t.k]<t.lo) out.deb.push(`Poco ${t.n.toLowerCase()}: ${A.roles[t.k]} (sugerido ${t.lo}–${t.hi}).`);
  if (A.avg>(A.isC?3.6:3)) out.deb.push(`Curva alta (${A.avg.toFixed(2)}): el mazo puede ir lento contra rivales rápidos.`);
  const instInt = cnt(m=>m.t==="Instant" && (m.r||[]).some(x=>x==="removal"||x==="wipe"));
  if (instInt<(A.isC?4:3)) out.deb.push(`Poca interacción instantánea (${instInt}): cuesta responder en el turno rival.`);
  const allCards=[...A.rows, ...A.side];
  if (!allCards.some(r=>r.m&&(r.m.sb||[]).includes("grave"))) out.deb.push("Sin respuestas al cementerio (reanimación, Underworld Breach, recursión).");
  if (allCards.filter(r=>r.m&&(r.m.sb||[]).includes("artifact")).length<2) out.deb.push("Pocas respuestas a artefactos o encantamientos.");
  if (A.isC && A.roles.protection<2) out.deb.push("Tu comandante está poco protegido.");
  const M=manaBase(A); if (M.tapped.length>(A.isC?6:3)) out.deb.push(`${M.tapped.length} tierras entran giradas: frena los primeros turnos.`);
  if (sim && !sim.sixty && sim.pScrew>0.15) out.deb.push(`Te atascas de maná en ${Math.round(sim.pScrew*100)}% de las partidas.`);
  if (!out.deb.length) out.deb.push("Sin debilidades estructurales evidentes. Revisa los matchups.");
  // matchups
  const R = k => A.roles[k]; const has = c => allCards.filter(r=>r.m&&(r.m.sb||[]).includes(c)).reduce((a,r)=>a+r.q,0);
  const rate = s => s>=2 ? ["good","favorable"] : s>=1 ? ["warn","parejo"] : ["bad","difícil"];
  if (A.isC){
    const mm = [
      ["Aggro y tokens (go-wide)", (R("wipe")>=3?1:0)+(has("life")>=3?0.5:0)+(A.avg<=3?0.5:0), `${R("wipe")} barridos · ${has("life")} de ganar vida`],
      ["Combo rápido", (has("counter")>=3?1:0)+(A.tutors.length>=3?0.5:0)+(has("grave")>=1?0.5:0)+(A.avg<=2.8?0.5:0), `${has("counter")} contrahechizos · ${has("grave")} contra cementerio`],
      ["Control", (R("draw")>=10?1:0)+(R("protection")>=3?0.5:0)+(R("recursion")>=3?0.5:0), `${R("draw")} robo · ${R("protection")} protección · ${R("recursion")} reciclaje`],
      ["Stax y castigo de maná", (R("ramp")>=10?1:0)+(A.avg<=3?0.5:0)+(has("artifact")>=3?0.5:0), `${R("ramp")} ramp · ${has("artifact")} contra artefactos`],
      ["Voltron y comandante grande", (R("removal")>=8?1:0)+(has("counter")>=2?0.5:0), `${R("removal")} removal puntual`],
    ];
    for (const [n,s,why] of mm){ const [c,l]=rate(s); out.match.push({n, c, l, why}); }
  } else {
    for (const a of metaDecks(A.fmt)){ const g=sideGuide(A,a); if (!g) continue; const useful=g.ins.reduce((x,y)=>x+y.q,0); const [c,l]=rate(useful>=6?2:useful>=3?1:0); out.match.push({n:a.name, c, l, why:`${useful} cartas útiles en tu banquillo · ${a.share}% del meta`}); }
  }
  return out;
}
function radioHTML(d,A){
  const R=radioLocal(d,A); const st=S.data.settings; const ai=d.radio; const busy=S.radioBusy===d.id;
  const list = arr => `<ul class="rx-list">${arr.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
  return `<div class="sec"><h3>Cómo se juega este mazo</h3><p class="lede">Informe calculado con el análisis, el simulador y la función de cada carta. Con Claude conectado puedes pedir además una lectura estratégica escrita.</p></div>
    <div class="rx-grid">
      <div class="card-box"><h3>Plan de juego</h3>${list(R.plan)}</div>
      <div class="card-box"><h3>Cómo se juega</h3>${list(R.juego)}</div>
      <div class="card-box"><h3>Mulligan</h3>${list(R.mull)}</div>
      <div class="card-box"><h3>Debilidades</h3>${list(R.deb)}</div>
    </div>
    <div class="sec"><h3>Matchups</h3><div class="tbl-wrap"><table><thead><tr><th>Contra</th><th>Pronóstico</th><th>Por qué</th></tr></thead><tbody>${R.match.map(m=>`<tr><td><b>${esc(m.n)}</b></td><td><span class="pill ${m.c}">${m.l}</span></td><td class="muted">${esc(m.why)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="sec"><h3>Lectura estratégica con Claude</h3>
      ${st.aiKey||isWebView()?`<div class="row">${busy?`<span class="muted">Claude está escribiendo la radiografía…</span>`:`<button class="btn ${ai?"":"primary"}" data-t="radio-run">${ai?"Volver a generar":"Generar con IA"}</button>`}</div>`:""}
      ${isWebView()?"":chatBoxHTML("radio")}
      ${ai?`<p class="foot">Lectura del ${new Date(ai.at).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"})}</p>`:""}
      ${ai?`<div class="md">${mdLite(ai.text)}</div>`:""}</div>`;
}
function radioPrompt(d){
  const A=analyze(d); const R=radioLocal(d,A);
  return claudePrompt(d,A) + `

Datos calculados por la app:
Plan: ${R.plan.join(" ")}
Cómo se juega: ${R.juego.join(" ")}
Mulligan: ${R.mull.join(" ")}
Debilidades: ${R.deb.join(" ")}
Matchups: ${R.match.map(m=>`${m.n}: ${m.l}`).join("; ")}

En vez de la lista de cambios, escribe una radiografía del mazo en español con estos títulos (usa "## " para cada título y viñetas "- "):
## Plan de juego
## Cómo pilotarlo turno a turno
## Guía de mulligan
## Debilidades y cómo cubrirlas
## Matchups
Sé concreto: nombra cartas de la lista. Máximo 450 palabras.`;
}
async function runRadio(d){
  const prompt = radioPrompt(d);
  S.radioBusy=d.id; render();
  try{ const txt=await askClaude(prompt,{max:2500}); const cur1=S.data.decks.find(x=>x.id===d.id); cur1.radio={at:Date.now(), text:txt}; saveDeck(cur1,{silent:true,noLog:true}); }
  catch(e){ toast(aiErrText(e)); }
  finally{ S.radioBusy=null; render(); }
}

/* ---------- Probar mano (solitario) ---------- */
function gfNew(d){
  const lib=[]; let u=0; for (const c of d.cards) for (let i=0;i<c.q;i++) lib.push({n:c.n, u:u++});
  for (let i=lib.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [lib[i],lib[j]]=[lib[j],lib[i]]; }
  const hand=lib.splice(0,7);
  S.gf={id:d.id, isC:d.format==="commander", lib, hand, bf:[], gy:[], cz:[...(d.commanders||[])], turn:1, mull:0, phase:"mull", pick:new Set(), scry:null, life:d.format==="commander"?40:20, opps:d.format==="commander"?[40,40,40]:[20], land:false};
}
function gfShuffleBack(){ const g=S.gf; g.lib.push(...g.hand); g.hand=[]; for (let i=g.lib.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [g.lib[i],g.lib[j]]=[g.lib[j],g.lib[i]]; } g.hand=g.lib.splice(0,7); }
function gfCard(c, opts={}){
  const m=cardOf(c.n); const img=m&&m.img;
  return `<button class="gf-card ${opts.tapped?"tapped":""} ${opts.sel?"sel":""}" ${opts.attr||""} title="${esc(c.n)}">${img?`<img src="${esc(img)}" alt="${esc(c.n)}" loading="lazy">`:`<span class="gf-name">${esc(c.n)}</span>`}${opts.badge||""}</button>`;
}
function manoHTML(d,A){
  if (!S.gf || S.gf.id!==d.id) gfNew(d);
  const g=S.gf; const isLand = n => { const m=cardOf(n); return m && m.t==="Land"; };
  const lands=g.bf.filter(c=>isLand(c.n)), perms=g.bf.filter(c=>!isLand(c.n));
  const manaUp = lands.filter(c=>!c.t).length + perms.filter(c=>!c.t && (cardOf(c.n)||{r:[]}).r.includes("ramp")).length;
  const bottomN = g.phase==="bottom" ? (g.isC ? Math.max(0,g.mull-1) : g.mull) : 0;
  const handH = g.hand.map((c,i)=>gfCard(c,{attr:`data-gfh="${i}"`, sel:g.pick.has(i)})).join("");
  return `<div class="sec"><h3>Probar mano</h3><p class="lede">Solitario para practicar: roba, haz mulligan de Londres${g.isC?" (el primero es gratis)":""}, mira la carta de arriba con scry, juega tierras y hechizos y lleva las vidas de la mesa. Haz clic en una carta de la mano para jugarla y en una del campo para girarla.</p>
    <div class="gf-bar">
      <div class="gf-stat"><span>Turno</span><b>${g.turn}</b></div><div class="gf-stat"><span>Biblioteca</span><b>${g.lib.length}</b></div><div class="gf-stat"><span>Mano</span><b>${g.hand.length}</b></div><div class="gf-stat"><span>Cementerio</span><b>${g.gy.length}</b></div><div class="gf-stat"><span>Maná disponible</span><b>${manaUp}</b></div>
      <div class="row" style="margin-left:auto"><button class="btn sm" data-gf="new">Nueva partida</button>${g.phase==="mull"?`<button class="btn sm primary" data-gf="keep">Quedarme con esta mano</button><button class="btn sm" data-gf="mull">Mulligan${g.mull?` (${g.mull})`:""}</button>`:g.phase==="play"?`<button class="btn sm" data-gf="draw">Robar</button><button class="btn sm" data-gf="scry">Scry 1</button><button class="btn sm primary" data-gf="next">Siguiente turno</button>`:""}</div>
    </div>
    ${g.phase==="bottom"?`<div class="banner info"><span>Elige ${bottomN} carta${bottomN>1?"s":""} para poner al fondo de la biblioteca (${g.pick.size}/${bottomN}).</span><button class="btn sm primary" data-gf="bottom" ${g.pick.size===bottomN?"":"disabled"}>Confirmar</button></div>`:""}
    ${g.scry?`<div class="banner info"><span>Arriba de tu biblioteca:</span>${gfCard(g.scry)}<button class="btn sm" data-gf="scry-top">Dejar arriba</button><button class="btn sm" data-gf="scry-bottom">Mandar al fondo</button></div>`:""}
    <div class="gf-life"><div class="gf-p me"><span>Tú</span><button class="btn sm ghost" data-gfl="me:-1">−</button><b>${g.life}</b><button class="btn sm ghost" data-gfl="me:1">+</button></div>
      ${g.opps.map((v,i)=>`<div class="gf-p"><span>Rival ${i+1}</span><button class="btn sm ghost" data-gfl="${i}:-1">−</button><b>${v}</b><button class="btn sm ghost" data-gfl="${i}:1">+</button></div>`).join("")}</div>
    ${g.isC&&g.cz.length?`<div class="gf-zone"><div class="gf-lbl">Zona de mando</div><div class="gf-row">${g.cz.map((n,i)=>gfCard({n},{attr:`data-gfc="${i}"`, badge:`<span class="gf-tip">jugar</span>`})).join("")}</div></div>`:""}
    <div class="gf-zone"><div class="gf-lbl">Campo · permanentes</div><div class="gf-row">${perms.map(c=>gfCard(c,{attr:`data-gfb="${c.u}"`, tapped:c.t, badge:`<span class="gf-x" data-gfg="${c.u}" title="Al cementerio">✕</span>`})).join("")||`<span class="muted">Vacío</span>`}</div></div>
    <div class="gf-zone"><div class="gf-lbl">Campo · tierras (${lands.length})</div><div class="gf-row">${lands.map(c=>gfCard(c,{attr:`data-gfb="${c.u}"`, tapped:c.t, badge:`<span class="gf-x" data-gfg="${c.u}" title="Al cementerio">✕</span>`})).join("")||`<span class="muted">Vacío</span>`}</div></div>
    <div class="gf-zone gf-hand"><div class="gf-lbl">Mano</div><div class="gf-row">${handH||`<span class="muted">Sin cartas</span>`}</div></div>
    ${g.gy.length?`<div class="gf-zone"><div class="gf-lbl">Cementerio</div><div class="gf-row">${g.gy.map(c=>gfCard(c)).join("")}</div></div>`:""}
    ${A.missing.length?`<p class="foot">${A.missing.length} cartas sin datos se muestran con su nombre. <button class="btn sm ghost" style="padding:0" data-act="fetch">Actualizar cartas</button></p>`:""}`;
}
function gfAct(a){
  const g=S.gf; const d=curDeck(); if (!g || !d) return;
  if (a==="new"){ gfNew(d); }
  else if (a==="mull"){ g.mull++; g.scry=null; gfShuffleBack(); g.pick=new Set(); }
  else if (a==="keep"){ const n = g.isC ? Math.max(0,g.mull-1) : g.mull; g.phase = n>0 ? "bottom" : "play"; g.pick=new Set(); }
  else if (a==="bottom"){ const idx=[...g.pick].sort((x,y)=>y-x); const moved=idx.map(i=>g.hand.splice(i,1)[0]); g.lib.push(...moved); g.pick=new Set(); g.phase="play"; }
  else if (a==="draw"){ g.scry=null; if (g.lib.length) g.hand.push(g.lib.shift()); }
  else if (a==="scry"){ if (g.lib.length) g.scry=g.lib[0]; }
  else if (a==="scry-top"){ g.scry=null; }
  else if (a==="scry-bottom"){ if (g.lib.length && g.lib[0]===g.scry){ g.lib.push(g.lib.shift()); } g.scry=null; }
  else if (a==="next"){ g.scry=null; g.turn++; for (const c of g.bf) c.t=false; g.land=false; if (g.lib.length) g.hand.push(g.lib.shift()); }
  render();
}

/* ---------- Constructor guiado ---------- */
function builderBlockHTML(){
  const b=S.bldBudget||"10";
  return `<div class="card-box bld"><h3>Constructor guiado</h3>
    <p class="muted" style="margin:0">Escribe el comandante y arma un borrador de 99 cartas con lo que más se juega en EDHREC: 10 de ramp, 10 de robo, 8 de removal, 3 barridos, 3 de protección, el resto de sinergia y 36 tierras. Prioriza lo que ya tienes y respeta tu presupuesto. Después puedes editarlo antes de guardar.</p>
    <div class="row" style="align-items:flex-end">
      <div class="field" style="flex:1;min-width:220px"><label for="bld-cmd">Comandante</label><input type="text" id="bld-cmd" placeholder="Ej.: Atraxa, Praetors' Voice" value="${esc(S.bldCmd||"")}"></div>
      <label class="row" style="gap:6px;padding-bottom:8px"><input type="checkbox" id="bld-own" ${S.bldOwn===false?"":"checked"}> Priorizar mi colección</label>
    </div>
    <div class="field"><label>Presupuesto por carta</label><div class="chips">${[["own","Solo mi colección"],["2","Hasta US$2"],["10","Hasta US$10"],["inf","Sin límite"]].map(([k,l])=>`<button type="button" class="chip" data-t="bld-budget" data-v="${k}" aria-pressed="${b===k}">${l}</button>`).join("")}</div></div>
    <div class="row"><button type="button" class="btn primary" data-t="bld-run" ${S.busy?"disabled":""}>Armar borrador</button><span class="foot">O escribe tu lista a mano abajo (constructor libre).</span></div></div>`;
}
async function runBuilder(){
  const cmd=($("#bld-cmd").value||"").trim(); S.bldCmd=cmd; S.bldOwn=$("#bld-own").checked;
  if (!cmd){ toast("Escribe el nombre del comandante."); return; }
  await fetchCards([cmd],{label:"Buscando el comandante"});
  const cm=cardOf(cmd); if (!cm){ toast("No encontré ese comandante en Scryfall. Revisa el nombre en inglés."); return; }
  const ci=cm.ci||""; const tmp={commanders:[cm.n]};
  const E=await loadEdhrec(tmp,false); if (!E){ return; }
  const budget=S.bldBudget||"10", cap=budget==="2"?2:budget==="10"?10:Infinity, own=S.bldOwn!==false;
  const inCI = m => !(m.ci||"").split("").some(c=>WUBRG.includes(c)&&!ci.includes(c));
  const pool = E.pool.map(p=>({...p, m:cardOf(p.n)})).filter(p=>p.m && !p.m.basic && inCI(p.m) && (!p.m.lg || p.m.lg.commander==="legal") && slug(p.m.n)!==slug(cm.n)).map(p=>{
    const has=ownedOf(p.n)>0, pr=refPrice(p.m);
    const okBudget = budget==="own" ? has : (has || pr==null || pr<=cap);
    return {...p, has, pr, ok:okBudget, score:(p.incl||0)*100 + Math.max(0,p.syn||0)*60 + (own&&has?30:0)};
  }).filter(p=>p.ok).sort((a,b)=>b.score-a.score);
  const chosen=new Map(); const take = p => { if (!chosen.has(slug(p.m.n))) chosen.set(slug(p.m.n), p); };
  const spells=pool.filter(p=>p.m.t!=="Land");
  for (const [role,n] of [["ramp",10],["draw",10],["removal",8],["wipe",3],["protection",3]]){ let k=0; for (const p of spells){ if (k>=n) break; if ((p.m.r||[]).includes(role) && !chosen.has(slug(p.m.n))){ take(p); k++; } } }
  for (const p of spells){ if (chosen.size>=63) break; take(p); }
  const nonbasic = pool.filter(p=>p.m.t==="Land").slice(0, ci.length<=1?6:14);
  const landsN=36, basicsN=Math.max(0, landsN-nonbasic.length);
  const pips={W:0,U:0,B:0,R:0,G:0}; for (const p of chosen.values()) for (const s of (p.m.cost||"").match(/\{[^}]+\}/g)||[]) for (const c of WUBRG) if (s.includes(c)) pips[c]++;
  const cols=ci.split("").filter(c=>WUBRG.includes(c)); const BN={W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest"};
  const tot=cols.reduce((a,c)=>a+(pips[c]||1),0)||1; const basics=[]; let left=basicsN;
  cols.forEach((c,i)=>{ const q = i===cols.length-1 ? left : Math.round(basicsN*(pips[c]||1)/tot); basics.push([BN[c],q]); left-=q; });
  if (!cols.length) basics.push(["Wastes",basicsN]);
  const lines=[...[...chosen.values()].map(p=>`1 ${p.m.n}`), ...nonbasic.map(p=>`1 ${p.m.n}`), ...basics.filter(b=>b[1]>0).map(([n,q])=>`${q} ${n}`)];
  $("#f-list").value=lines.join("\n"); if ($("#f-cmd")) $("#f-cmd").value=cm.n; if (!$("#f-name").value.trim()) $("#f-name").value=`${cm.n.split(",")[0]} (borrador)`;
  const nOwn=[...chosen.values(), ...nonbasic].filter(p=>p.has).length; const cost=[...chosen.values(), ...nonbasic].filter(p=>!p.has).reduce((a,p)=>a+(p.pr||0),0);
  renderEditorPreview();
  toast(`Borrador listo: ${chosen.size} hechizos y ${landsN} tierras. ${nOwn} ya las tienes; comprar el resto cuesta ~${money(cost)}.${chosen.size<63?" EDHREC no tenía suficientes cartas en tu presupuesto: completa a mano.":""}`);
}

/* ---------- Mesa local ---------- */
function localMetaHTML(){
  const mine=S.data.decks.filter(d=>d.format==="commander" && !d.rival), rivals=S.data.decks.filter(d=>d.rival);
  const rows=[...mine.map(d=>({d,own:true})), ...rivals.map(d=>({d,own:false}))].map(x=>{ const A=analyze(x.d); const s=simulate(x.d,A); const B=bracketOf(x.d,A);
    const fast=A.rows.filter(r=>FAST_MANA.has(r.n.toLowerCase())).reduce((a,r)=>a+r.q,0);
    const speed=(s&&s.avgTurn?s.avgTurn:8)+(s&&s.winAvg?s.winAvg*0.5:5);
    return {...x, A, s, B, fast, speed}; }).sort((a,b)=>a.speed-b.speed);
  const missing = rivals.some(d=>analyze(d).missing.length);
  return `<div class="pane"><div class="pane-head"><div><h2>Mazos de mis amigos</h2><div class="sub">Compara la velocidad de tus mazos con los de tus amigos, con el mismo simulador y los mismos criterios.</div></div></div>
    <div class="pane-body">
      ${typeof grpHTML==="function"?grpHTML():""}
      ${typeof mesaHTML==="function"?mesaHTML():""}
      ${typeof powerBoardHTML==="function"?powerBoardHTML():""}
      ${missing&&!S.busy?`<div class="banner"><span>Hay cartas de tus amigos sin datos.</span><button class="btn sm primary" data-t="local-fetch">Actualizar cartas</button></div>`:""}
      ${rows.length?`<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Mazo</th><th>De</th><th class="n">Bracket</th><th class="n">Comandante en mesa</th><th class="n">Reloj de victoria</th><th class="n">Interacción</th><th class="n">Ramp</th><th class="n">Maná rápido</th><th class="n">Tutores</th><th class="n">CMC</th><th></th></tr></thead><tbody>
        ${rows.map((r,i)=>`<tr${r.own?' style="background:var(--accent-soft)"':""}><td class="num">${i+1}</td><td><b>${esc(r.d.name)}</b><br><span class="muted" style="font-size:.85rem">${esc((r.d.commanders||[]).join(" + "))}</span></td><td>${r.own?"Tú":esc(r.d.rival.owner||"Amigo")}</td>
          <td class="n">${r.B.b}</td><td class="n">${r.s&&r.s.avgTurn?"T"+r.s.avgTurn.toFixed(1):"—"}</td><td class="n">${r.s&&r.s.winAvg?"T"+r.s.winAvg.toFixed(1):"—"}</td><td class="n">${r.A.roles.removal+r.A.roles.wipe}</td><td class="n">${r.A.roles.ramp}</td><td class="n">${r.fast}</td><td class="n">${r.A.tutors.length}</td><td class="n">${r.A.avg.toFixed(2)}</td>
          <td style="white-space:nowrap"><button class="btn sm ghost" data-open="${esc(r.d.id)}">Ver</button>${r.own?"":` <button class="btn sm ghost danger" data-t="local-del" data-v="${esc(r.d.id)}">Quitar</button>`}</td></tr>`).join("")}</tbody></table></div>
        <p class="foot">Ordenados del más rápido al más lento según el turno en que baja el comandante y el reloj de victoria. En verde, tus mazos.</p>`:`<p class="muted">Agrega los mazos de tus amigos para comparar.</p>`}
      <div class="card-box"><h3>Agregar el mazo de un amigo</h3>
        <div class="row"><div class="field" style="flex:1;min-width:160px"><label for="lr-owner">Amigo</label><input type="text" id="lr-owner" placeholder="Ej.: Nico"></div><div class="field" style="flex:2;min-width:200px"><label for="lr-name">Nombre del mazo</label><input type="text" id="lr-name" placeholder="Ej.: Atraxa superfriends"></div></div>
        <div class="field"><label for="lr-list">Lista (con su comandante en la sección “Commander” o marcado *CMDR*)</label><textarea id="lr-list" style="min-height:140px" spellcheck="false"></textarea></div>
        <div class="row"><button class="btn sm primary" data-t="local-add">Agregar a la mesa</button></div></div>
    </div></div>`;
}

/* ---------- Versiones ---------- */
function versionStats(d, v){
  const tmp={...d, cards:v.cards, side:v.side||[], maybe:v.maybe||[], commanders:v.commanders||d.commanders};
  const A=analyze(tmp); const s=simulate(tmp,A); const H=health(tmp,A,s);
  return {A, s, H, B: A.isC?bracketOf(tmp,A).b:null};
}
function versionesHTML(d,A){
  const vs=d.versions||[];
  if (!vs.length) return `<div class="sec"><h3>Comparar versiones</h3><p class="lede">Cada vez que cambias la lista (a mano, con el optimizador, con la IA o desde ManaBox), la Bóveda guarda la versión anterior. Aquí vas a poder comparar el antes y el después con sus números y volver a cualquier versión.</p><p class="muted">Todavía no hay versiones anteriores de este mazo.</p></div>`;
  const opts=[{i:-1, at:d.updated, label:"Actual"}, ...vs.map((v,i)=>({i, at:v.savedAt||v.at, label:`${new Date(v.savedAt||v.at).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"})} · antes de ${({manual:"edición",optimizador:"optimizador",bracket:"plan de bracket",manabox:"ManaBox",version:"restaurar"}[v.src]||v.src)}`}))];
  const a = S.vA!=null ? S.vA : 0, b = S.vB!=null ? S.vB : -1;
  const pick = i => i===-1 ? {cards:d.cards, side:d.side, maybe:d.maybe, commanders:d.commanders} : vs[i];
  const VA=pick(a), VB=pick(b); if (!VA||!VB){ S.vA=0; S.vB=-1; return versionesHTML(d,A); }
  const SA=versionStats(d,VA), SB=versionStats(d,VB);
  const row = (label, x, y, fmt=(v=>v), better="up") => { const dv = (typeof x==="number" && typeof y==="number") ? y-x : null; const cls = better==="none"||dv==null||Math.abs(dv)<1e-9 ? "" : ((dv>0)===(better==="up") ? "up" : "down");
    return `<tr><td>${label}</td><td class="n">${fmt(x)}</td><td class="n">${fmt(y)}</td><td class="n ${cls}">${dv==null||Math.abs(dv)<1e-9?"=":(dv>0?"+":"")+(Math.abs(dv)<1?dv.toFixed(2):Math.round(dv*100)/100)}</td></tr>`; };
  const bd = boardDiff({main:VA.cards, side:VA.side||[], maybe:VA.maybe||[]}, {main:VB.cards, side:VB.side||[], maybe:VB.maybe||[]});
  const lines = x => `${x.add.map(c=>`<span class="a">+ ${c.q} ${esc(c.n)}</span>`).join("")}${x.rem.map(c=>`<span class="r">− ${c.q} ${esc(c.n)}</span>`).join("")}`;
  const sel = (id,v) => `<select id="${id}">${opts.map(o=>`<option value="${o.i}" ${o.i===v?"selected":""}>${esc(o.label)}</option>`).join("")}</select>`;
  return `<div class="sec"><h3>Comparar versiones</h3><p class="lede">El antes y el después de cada cambio. Elige dos versiones para ver cómo cambiaron los números y las cartas.</p>
    <div class="row" style="align-items:flex-end"><div class="field" style="flex:1;min-width:220px"><label for="v-a">Antes</label>${sel("v-a",a)}</div><div class="field" style="flex:1;min-width:220px"><label for="v-b">Después</label>${sel("v-b",b)}</div></div></div>
  <div class="two">
    <div class="sec"><h3>Números</h3><div class="tbl-wrap"><table><thead><tr><th></th><th class="n">Antes</th><th class="n">Después</th><th class="n">Cambio</th></tr></thead><tbody>
      ${row("Salud", SA.H.score, SB.H.score)}
      ${A.isC?row("Bracket", SA.B, SB.B, v=>v, "none"):""}
      ${row("CMC promedio", SA.A.avg, SB.A.avg, v=>v.toFixed(2), "down")}
      ${row("Tierras", SA.A.roles.land, SB.A.roles.land, v=>v, "none")}
      ${row("Ramp", SA.A.roles.ramp, SB.A.roles.ramp)}
      ${row("Robo", SA.A.roles.draw, SB.A.roles.draw)}
      ${row("Removal + barridos", SA.A.roles.removal+SA.A.roles.wipe, SB.A.roles.removal+SB.A.roles.wipe)}
      ${A.isC&&SA.s&&SB.s?row("Comandante en mesa (turno)", SA.s.avgTurn||0, SB.s.avgTurn||0, v=>v?v.toFixed(1):"—", "down"):""}
      ${SA.s&&SB.s&&!SA.s.sixty?row("Manos atascadas", SA.s.pScrew*100, SB.s.pScrew*100, v=>Math.round(v)+"%", "down"):""}
      ${row("Valor", SA.A.price, SB.A.price, v=>money(v), "none")}
    </tbody></table></div></div>
    <div class="sec"><h3>Cartas</h3>${bd.n?["main","side","maybe"].filter(k=>bd[k].add.length||bd[k].rem.length).map(k=>`<div style="margin-bottom:10px"><div class="sc" style="font-size:.9rem">${{main:"deck",side:"sideboard (banquillo)",maybe:"maybeboard (cartas probables)"}[k]}</div><div class="diff">${lines(bd[k])}</div></div>`).join(""):`<p class="muted">Mismas cartas.</p>`}</div>
  </div>
  <div class="sec"><h3>Historial de versiones</h3>${vs.map((v,i)=>`<div class="rec"><span>${esc(opts[i+1].label)} · <span class="num">${v.cards.reduce((x,c)=>x+c.q,0)}</span> cartas</span><span class="meta"><button class="btn sm ghost" data-t="v-restore" data-v="${i}">Restaurar</button></span></div>`).join("")}
    <p class="foot">Restaurar guarda primero la versión actual, así nunca pierdes nada.</p></div>`;
}

/* ---------- Compartir e informe PDF ---------- */
const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g,"+").replace(/_/g,"/"))));
function shareCode(d){ return b64u(JSON.stringify({v:1, n:d.name, f:d.format, c:d.commanders||[], m:(d.cards||[]).map(c=>[c.q,c.n]), s:(d.side||[]).map(c=>[c.q,c.n]), y:(d.maybe||[]).map(c=>[c.q,c.n])})); }
function readShare(text){
  const t=String(text||"").trim(); const m=t.match(/#mazo=([A-Za-z0-9_-]+)/); const code = m ? m[1] : t;
  try{ const o=JSON.parse(unb64u(code)); if (!o || typeof o!=="object" || !Array.isArray(o.m)) return null;
    // se limpia todo lo que viene de afuera: cantidades numéricas y nombres como texto
    const L = a => Array.isArray(a) ? a.filter(c=>Array.isArray(c) && typeof c[1]==="string" && c[1].trim()).map(c=>[Math.min(99, Math.max(1, parseInt(c[0],10)||1)), c[1].slice(0,150)]) : [];
    return {n:String(o.n||"Mazo compartido").slice(0,120), f:Object.prototype.hasOwnProperty.call(FORMATS,o.f)?o.f:"commander", c:Array.isArray(o.c)?o.c.filter(x=>typeof x==="string").map(x=>x.slice(0,150)).slice(0,2):[], m:L(o.m), s:L(o.s), y:L(o.y)}; }catch{ return null; }
}
function sharedImportHTML(o){
  const q=a=>a.reduce((x,c)=>x+c[0],0);
  return `<div class="card-box" style="margin-bottom:18px;border-color:var(--accent)"><h3>Mazo compartido: ${esc(o.n)}</h3>
    <p style="margin:0">${esc(FORMATS[o.f]?FORMATS[o.f].name:o.f)}${o.c&&o.c.length?` · ${esc(o.c.join(" + "))}`:""} · deck ${q(o.m)}${o.s.length?` · sideboard ${q(o.s)}`:""}${o.y.length?` · maybeboard ${q(o.y)}`:""}</p>
    <details><summary class="muted" style="cursor:pointer">Ver lista</summary><div class="list-groups" style="margin-top:8px">${o.m.map(c=>`<div>${c[0]} ${esc(c[1])}</div>`).join("")}</div></details>
    <div class="row"><button class="btn sm primary" data-t="share-import">Importar a mi Bóveda</button><button class="btn sm ghost" data-t="share-dismiss">Descartar</button><button class="btn sm ghost" data-t="share-rival">Agregar a mazos de mis amigos</button></div></div>`;
}
function compartirHTML(d,A){
  const code=shareCode(d); const hosted=/^https?:$/.test(location.protocol);
  const link = hosted ? location.origin+location.pathname+"#mazo="+code : "";
  return `<div class="sec"><h3>Compartir</h3><p class="lede">Formas de mostrar este mazo sin que puedan modificarlo.</p></div>
  <div class="rx-grid">
    <div class="card-box"><h3>Enlace o código</h3>
      ${hosted?`<p class="muted" style="margin:0">Cualquiera con el enlace ve el mazo y puede importarlo a su propia Bóveda.</p><div class="row"><input type="text" readonly value="${esc(link)}" id="share-link" style="flex:1;min-width:200px"><button class="btn sm primary" data-t="copy-link">Copiar enlace</button></div>`
      :`<p class="muted" style="margin:0">Estás usando la Bóveda como archivo, así que no hay enlace web. Comparte este código: quien lo pegue en Herramientas → “Importar un mazo compartido” verá tu mazo. Si publicas la Bóveda en GitHub Pages o Netlify, aquí aparecerá un enlace.</p>
        <textarea readonly id="share-code-out" style="min-height:80px">${esc(code)}</textarea><div class="row"><button class="btn sm primary" data-t="copy-code">Copiar código</button></div>`}
    </div>
    <div class="card-box"><h3>Página del mazo</h3><p class="muted" style="margin:0">Un archivo HTML de solo lectura con la lista, las imágenes y el análisis, para enviar por WhatsApp o correo.</p><div class="row"><button class="btn sm primary" data-t="dl-page">Descargar página</button></div></div>
    <div class="card-box"><h3>Informe PDF</h3><p class="muted" style="margin:0">Decklist y análisis en formato para imprimir. En la ventana de impresión elige “Guardar como PDF”.</p><div class="row"><button class="btn sm primary" data-t="pdf">Exportar informe PDF</button></div></div>
    <div class="card-box"><h3>Lista en texto</h3><p class="muted" style="margin:0">Para pegar en Moxfield, Archidekt, ManaBox o un mensaje.</p><div class="row"><button class="btn sm primary" data-act="copylist">Copiar lista</button><button class="btn sm" data-act="dllist">Descargar .txt</button></div></div>
  </div>`;
}
function deckReportHTML(d, {print=false}={}){
  const A=analyze(d); const sim=simulate(d,A); const H=health(d,A,sim); const Bk=A.isC?bracketOf(d,A):null;
  const groups={}; for (const r of A.rows){ const t=r.m?r.m.t:"Unknown"; (groups[t]=groups[t]||[]).push(r); }
  const cm = (d.commanders||[]).map(cardOf).filter(Boolean);
  const listCol = TYPE_ORDER.filter(t=>groups[t]).map(t=>`<div class="g"><h4>${TYPE_ES[t]} · ${groups[t].reduce((a,r)=>a+r.q,0)}</h4>${groups[t].sort((a,b)=>(a.m?a.m.cmc:99)-(b.m?b.m.cmc:99)||a.n.localeCompare(b.n)).map(r=>`<div>${r.q} ${esc(r.n)}</div>`).join("")}</div>`).join("");
  const extra = (title, arr) => arr.length ? `<div class="g"><h4>${title} · ${arr.reduce((a,r)=>a+r.q,0)}</h4>${arr.map(r=>`<div>${r.q} ${esc(r.n)}</div>`).join("")}</div>` : "";
  const R=radioLocal(d,A);
  const css = `:root{--line:#d9ddd6;--accent:#1F5C4A;--muted:#5B6761;--ink:#18201D;--mC:#AAA59B}
  *{box-sizing:border-box} body{font-family:Georgia,"Times New Roman",serif;color:#18201D;margin:0;padding:28px;max-width:960px;margin-inline:auto;background:#fff}
  h1{font-size:28px;margin:0} h2{font-size:18px;margin:22px 0 8px;border-bottom:2px solid #1F5C4A;padding-bottom:4px} h4{font-family:Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#5B6761;margin:10px 0 4px}
  .meta{color:#5B6761;font-family:Arial,sans-serif;font-size:13px;margin-top:4px} .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:14px;font-family:Arial,sans-serif}
  .st{border:1px solid #d9ddd6;border-radius:8px;padding:8px}.st b{display:block;font-size:20px}.st span{font-size:11px;color:#5B6761;text-transform:uppercase}
  .cols{columns:3 220px;column-gap:24px;font-family:Arial,sans-serif;font-size:12.5px;line-height:1.5}.g{break-inside:avoid}
  ul{font-family:Arial,sans-serif;font-size:13px;margin:4px 0 0;padding-left:18px} table{border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12.5px} td,th{border-bottom:1px solid #d9ddd6;padding:4px 6px;text-align:left}
  .head{display:flex;gap:18px;align-items:flex-start} .head img{width:150px;border-radius:8px}
  svg text{font-family:Arial,sans-serif;font-size:11px;fill:#5B6761} svg .lbl{fill:#18201D}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:20px} .foot{font-family:Arial,sans-serif;font-size:11px;color:#5B6761;margin-top:26px}
  @media print{body{padding:0}h2{break-after:avoid}.two,.g,table{break-inside:avoid}}`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.name)} · Bóveda EDH</title><style>${css}</style></head><body>
  <div class="head">${cm[0]&&cm[0].img?`<img src="${esc(cm[0].img)}" alt="${esc(cm[0].n)}">`:""}<div><h1>${esc(d.name)}</h1><div class="meta">${esc(FORMATS[A.fmt].name)}${A.isC?` · ${esc((d.commanders||[]).join(" + "))}`:""} · colores ${A.ci||"incoloro"} · ${new Date().toLocaleDateString("es-CL")}</div>
    <div class="stats"><div class="st"><span>cartas</span><b>${A.isC?A.total:A.main}</b></div><div class="st"><span>salud</span><b>${H.score}</b></div><div class="st"><span>${A.isC?"bracket":"sideboard"}</span><b>${A.isC?Bk.b:A.sideN}</b></div><div class="st"><span>cmc prom.</span><b>${A.avg.toFixed(2)}</b></div><div class="st"><span>valor</span><b>${money(A.price)}</b></div></div></div></div>
  <h2>Lista</h2>${cm.length?`<div class="cols"><div class="g"><h4>Comandante</h4>${cm.map(m=>`<div>1 ${esc(m.n)}</div>`).join("")}</div></div>`:""}<div class="cols">${listCol}${extra("Sideboard (banquillo)",A.side)}${extra("Maybeboard (cartas probables)",A.maybe)}</div>
  <h2>Análisis</h2><div class="two"><div><h4>Curva de maná</h4>${barsSVG(A.curve.map((v,i)=>({v,l:i===7?"7+":String(i)})),"Curva de maná")}</div>
    <div><h4>Estructura</h4><table><tbody>${[["Tierras","land"],["Ramp","ramp"],["Robo","draw"],["Removal","removal"],["Barridos","wipe"],["Protección","protection"],["Tutores","tutor"],["Remates","wincon"]].map(([l,k])=>`<tr><td>${l}</td><td>${A.roles[k]}</td></tr>`).join("")}</tbody></table></div></div>
  ${sim?`<h4>Simulador</h4><ul>${sim.sixty?`<li>Mano inicial jugable: ${Math.round(sim.keep*100)}%</li>${sim.drops.map(x=>`<li>Tierra del turno ${x.t} a tiempo: ${Math.round(x.play*100)}% en la mano / ${Math.round(x.draw*100)}% robando</li>`).join("")}`:`<li>Comandante en mesa: turno ${sim.avgTurn?sim.avgTurn.toFixed(1):"—"} en promedio</li><li>Mulligan: ${Math.round(sim.pMull*100)}% · atascado: ${Math.round(sim.pScrew*100)}% · inundado: ${Math.round(sim.pFlood*100)}%</li>${sim.winAvg?`<li>Reloj de victoria: turno ${sim.winAvg.toFixed(1)}</li>`:""}`}</ul>`:""}
  ${A.isC?`<h4>Bracket</h4><ul><li>${Bk.b} · ${esc(BRACKETS[Bk.b].name)}: ${esc(Bk.why)}</li></ul>`:""}
  <h2>Cómo se juega</h2><div class="two"><div><h4>Plan de juego</h4><ul>${R.plan.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><h4>Mulligan</h4><ul>${R.mull.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div><div><h4>Debilidades</h4><ul>${R.deb.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><h4>Matchups</h4><ul>${R.match.map(m=>`<li>${esc(m.n)}: ${m.l}</li>`).join("")}</ul></div></div>
  ${d.radio?`<h2>Lectura de Claude</h2><div style="font-family:Arial,sans-serif;font-size:13px">${mdLite(d.radio.text)}</div>`:""}
  <div class="foot">Generado con Bóveda EDH · datos de Scryfall, EDHREC y Commander Spellbook · precios ${cur()==="eur"?"Cardmarket (€)":"TCGplayer (US$)"}.</div>
  ${print?`<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>`:""}</body></html>`;
  return html;
}
function printReport(d){
  const html=deckReportHTML(d,{print:true});
  const w=window.open("", "_blank");
  if (!w){ download(`${d.name} - informe.html`, html, "text/html"); toast("El navegador bloqueó la ventana. Descargué el informe: ábrelo e imprímelo como PDF."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/* ---------- Novedades ---------- */
async function loadNews(){
  if (isWebView()){ webBlocked("novedades"); return; }
  setBusy("Buscando sets nuevos en Scryfall", 1);
  try{
    const r=await sf("https://api.scryfall.com/sets"); if (!r.ok) throw 0; const j=await r.json();
    const today0=new Date().toISOString().slice(0,10), from=new Date(Date.now()-130*864e5).toISOString().slice(0,10);
    const sets=(j.data||[]).filter(s=>s.released_at && s.released_at<=today0 && s.released_at>=from && ["expansion","core","commander","masters","draft_innovation"].includes(s.set_type) && !s.digital).slice(0,6).map(s=>({code:s.code, name:s.name, rel:s.released_at, type:s.set_type}));
    if (!sets.length) throw 0;
    S.news={at:Date.now(), sets}; idb.set("news", S.news);
    const decks=S.data.decks.filter(d=>!d.rival);
    S.busy.total=decks.length; S.busy.label="Buscando novedades para tus mazos";
    let i=0;
    for (const d of decks){
      const A=analyze(d); const colors=A.ci||"c";
      const q = `(${sets.map(s=>"e:"+s.code).join(" or ")}) ${A.isC?`id<=${colors} legal:commander`:`c<=${colors} legal:${A.fmt}`} -t:basic game:paper`;
      const rr=await sf("https://api.scryfall.com/cards/search?q="+encodeURIComponent(q)+"&order=edhrec&unique=cards");
      if (rr.ok){ const jj=await rr.json(); const inDeck=new Set(allNames(d).map(slug));
        const list=(jj.data||[]).filter(c=>!inDeck.has(slug(c.name))).slice(0,18).map(c=>{ S.cards[slug(c.name)]=S.cards[slug(c.name)]||fromScry(c); return {n:c.name, set:(c.set||"").toUpperCase(), rank:c.edhrec_rank||null}; });
        d.news={at:Date.now(), list}; }
      else d.news={at:Date.now(), list:[]};
      S.busy.done=++i; renderBusy();
    }
    saveData(); saveCaches(); toast("Novedades actualizadas.");
  }catch(e){ toast("No se pudieron buscar las novedades en Scryfall."); }
  finally{ S.busy=null; render(); }
}
function newsHTML(){
  const N=S.news; const decks=S.data.decks.filter(d=>!d.rival);
  return `<div class="fmt-head"><h2>Novedades para tus mazos</h2><span class="muted">Cartas de los sets de los últimos meses que encajan en cada mazo, ordenadas por lo que más se juega en EDHREC.</span></div>
  ${busyBanner()}
  <div class="row" style="margin-bottom:14px"><button class="btn primary" data-t="news-run" ${S.busy?"disabled":""}>${N?"Actualizar novedades":"Buscar novedades"}</button>${N?`<span class="foot">Sets revisados: ${N.sets.map(s=>`${esc(s.name)} (${s.rel.slice(0,7)})`).join(", ")}</span>`:""}</div>
  ${decks.map(d=>{ const E=d.format==="commander"?edhOf(d):null; const L=(d.news&&d.news.list)||[];
    return `<div class="pane" style="margin-bottom:16px"><div class="pane-head"><div><h2 style="font-size:1.3rem">${esc(d.name)}</h2><div class="sub">${esc(FORMATS[d.format].name)}${d.format==="commander"?` · ${esc((d.commanders||[]).join(" + "))}`:""}</div></div></div>
      <div class="pane-body">${d.news?(L.length?`<div class="nw-grid">${L.map(x=>{ const m=cardOf(x.n); const p=E&&E.pool.find(q=>slug(q.n)===slug(x.n));
        return `<div class="nw"><div class="nw-img cn" data-card="${esc(x.n)}" role="button" tabindex="0">${m&&m.img?`<img src="${esc(m.img)}" alt="${esc(x.n)}" loading="lazy">`:`<span class="bl-noimg">${esc(x.n)}</span>`}</div>
          <div class="nw-n">${esc(x.n)}</div><div class="bl-sub">${esc(x.set)} · ${money(refPrice(m))}${p&&p.incl!=null?` · EDHREC ${Math.round(p.incl*100)}%`:""}${ownedOf(x.n)>0?` · <span class="own y">tienes</span>`:""}</div>
          <button class="btn sm" data-t="news-maybe" data-v="${esc(d.id)}" data-n="${esc(x.n)}">→ maybeboard</button></div>`; }).join("")}</div>`:`<p class="muted">Nada nuevo que encaje en este mazo.</p>`):`<p class="muted">Pulsa “Buscar novedades”.</p>`}</div></div>`; }).join("")||`<p class="muted">Aún no tienes mazos.</p>`}`;
}

/* ---------- Resumen semanal ---------- */
function weeklyData(){ const sig=_anaEpoch+'|'+(S.data._mod||0); if (weeklyData._s===sig) return weeklyData._v; weeklyData._s=sig; return (weeklyData._v=weeklyDataRaw()); }
function weeklyDataRaw(){
  const since=Date.now()-7*864e5; const moves=[]; let delta=0, base=0;
  for (const it of [...(S.data.collection.items||[]), ...binderItems()]){ if (BASICS.has(slug(it.n))) continue; const ch=change(itemKey(it),7); if (!ch) continue; delta+=ch.diff*it.q; base+=ch.from*it.q; moves.push({n:it.n, set:it.set, pct:ch.pct, diff:ch.diff, q:it.q, to:ch.to}); }
  moves.sort((a,b)=>b.pct-a.pct);
  const up=moves.filter(m=>m.pct>0).slice(0,5), down=moves.filter(m=>m.pct<0).slice(-5).reverse();
  const changes=S.data.decks.filter(d=>!d.rival).map(d=>({d, e:(d.log||[]).filter(e=>e.at>=since)})).filter(x=>x.e.length);
  const sales=(S.data.binders||[]).flatMap(b=>b.sales.filter(s=>s.at>=since).map(s=>({...s, b:b.name})));
  const targets=alerts().filter(a=>a.kind==="tg");
  const news=S.data.decks.filter(d=>!d.rival && d.news && d.news.at>=since && d.news.list.length);
  return {delta, base, up, down, changes, sales, targets, news, al:alerts().length};
}
function weeklyText(W){
  const L=[`Resumen semanal de la Bóveda EDH — ${new Date().toLocaleDateString("es-CL")}`, ""];
  if (W.base) L.push(`Tu colección ${W.delta>=0?"subió":"bajó"} ${money(Math.abs(W.delta))} (${pct(100*W.delta/W.base)}) esta semana.`);
  if (W.up.length){ L.push("", "Subidas:"); for (const m of W.up) L.push(`- ${m.n}${m.set?` (${m.set})`:""}: ${pct(m.pct)}, ahora ${money(m.to)}`); }
  if (W.down.length){ L.push("", "Bajadas:"); for (const m of W.down) L.push(`- ${m.n}${m.set?` (${m.set})`:""}: ${pct(m.pct)}, ahora ${money(m.to)}`); }
  if (W.targets.length){ L.push("", "Precios objetivo alcanzados:"); for (const a of W.targets) L.push(`- ${a.n}: ${money(a.pr)}`); }
  if (W.changes.length){ L.push("", "Cambios en tus mazos:"); for (const x of W.changes) L.push(`- ${x.d.name}: ${x.e.reduce((a,e)=>a+e.add.length,0)} cartas agregadas, ${x.e.reduce((a,e)=>a+e.rem.length,0)} quitadas`); }
  if (W.sales.length){ L.push("", "Ventas:"); for (const s of W.sales) L.push(`- ${s.q}× ${s.n} (${s.b})`); }
  if (W.news.length){ L.push("", "Novedades para tus mazos:"); for (const d of W.news) L.push(`- ${d.name}: ${d.news.list.slice(0,4).map(x=>x.n).join(", ")}`); }
  return L.join("\n");
}
function weeklyHTML(){
  const W=weeklyData(); const txt=weeklyText(W); S.data.settings.weeklySeen=Date.now(); saveData();
  const mv = m => `<div class="rec"><span>${cardName(m.n)} ${m.set?`<span class="tag">${esc(m.set)}</span>`:""}</span><span class="meta ${m.pct>0?"up":"down"}">${pct(m.pct)} · ${money(m.to)}</span></div>`;
  return `<div class="fmt-head"><h2>Resumen semanal</h2><span class="muted">Lo que pasó en los últimos 7 días con tus cartas, mazos y carpetas.</span></div>
  <div class="stats" style="margin-bottom:16px"><div class="stat ${W.delta>=0?"good":"bad"}"><div class="k">tu colección esta semana</div><div class="v" style="font-size:1.15rem">${W.base?(W.delta>=0?"+":"−")+money(Math.abs(W.delta)):"—"}</div></div>
    <div class="stat"><div class="k">alertas activas</div><div class="v">${W.al}</div></div><div class="stat"><div class="k">mazos con cambios</div><div class="v">${W.changes.length}</div></div><div class="stat"><div class="k">ventas</div><div class="v">${W.sales.reduce((a,s)=>a+s.q,0)}</div></div></div>
  <div class="grid-2">
    <div class="card-box"><h3>Subidas</h3>${W.up.map(mv).join("")||`<p class="muted">Sin subidas registradas. El historial se arma con los días en que abres la Bóveda.</p>`}</div>
    <div class="card-box"><h3>Bajadas</h3>${W.down.map(mv).join("")||`<p class="muted">Sin bajadas registradas.</p>`}</div>
    <div class="card-box"><h3>Cambios en tus mazos</h3>${W.changes.map(x=>`<div class="rec"><span>${esc(x.d.name)}</span><span class="meta">+${x.e.reduce((a,e)=>a+e.add.length,0)} −${x.e.reduce((a,e)=>a+e.rem.length,0)}</span></div>`).join("")||`<p class="muted">Sin cambios esta semana.</p>`}</div>
    <div class="card-box"><h3>Novedades y objetivos</h3>${W.targets.map(a=>`<div class="rec"><span>★ ${esc(a.n)}</span><span class="meta">${money(a.pr)}</span></div>`).join("")}${W.news.map(d=>`<div class="rec"><span>${esc(d.name)}</span><span class="meta">${d.news.list.length} novedades</span></div>`).join("")||(W.targets.length?"":`<p class="muted">Busca novedades en Herramientas → Novedades.</p>`)}</div>
  </div>
  <div class="row" style="margin-top:16px"><button class="btn primary" data-t="weekly-copy">Copiar resumen</button><a class="btn" href="mailto:?subject=${encodeURIComponent("Resumen semanal Bóveda EDH")}&body=${encodeURIComponent(txt.slice(0,1800))}">Enviar por correo</a><button class="btn ghost" data-t="refresh">Actualizar precios ahora</button></div>
  <p class="foot">“Enviar por correo” abre tu aplicación de correo con el resumen listo para enviarte. Puedes activar o desactivar que se muestre cada lunes en Ajustes.</p>`;
}

/* ---------- eventos de las herramientas ---------- */
document.addEventListener("click", async ev=>{
  const tc = ev.target.closest("[data-tool]"); if (tc){ openTool(tc.dataset.tool); return; }
  const co = ev.target.closest("[data-chat-open]");
  if (co){ const d=curDeck(); if (!d){ ev.preventDefault(); return; } S.iaNotes=($("#ia-notes")||{}).value||S.iaNotes||"";
    const p=chatPromptOf(co.dataset.chatOpen, d); co.href=claudeChatURL(p);
    try { navigator.clipboard.writeText(p).then(()=>toast("Consulta copiada. Si el chat de Claude aparece vacío, pégala.")).catch(()=>{}); } catch {}
    return; }
  const gb = ev.target.closest("[data-gfg]"); if (gb && S.gf){ ev.stopPropagation(); const u=+gb.dataset.gfg; const i=S.gf.bf.findIndex(c=>c.u===u); if (i>=0) S.gf.gy.push(S.gf.bf.splice(i,1)[0]); render(); return; }
  const b = ev.target.closest("button"); if (!b) return;
  if (b.dataset.act==="show-local"){ S.showMeta.commander="local"; S.editing=null; S.view="commander"; render(); return; }
  if (b.dataset.gf){ gfAct(b.dataset.gf); return; }
  if (b.dataset.gfh!=null && S.gf){ const g=S.gf, i=+b.dataset.gfh;
    if (g.phase==="bottom"){ g.pick.has(i)?g.pick.delete(i):g.pick.add(i); render(); return; }
    if (g.phase!=="play") return; const c=g.hand.splice(i,1)[0]; g.bf.push({...c, t:false}); render(); return; }
  if (b.dataset.gfb!=null && S.gf){ const c=S.gf.bf.find(x=>x.u===+b.dataset.gfb); if (c) c.t=!c.t; render(); return; }
  if (b.dataset.gfc!=null && S.gf){ const n=S.gf.cz.splice(+b.dataset.gfc,1)[0]; S.gf.bf.push({n, u:-1-Math.random(), t:false}); render(); return; }
  if (b.dataset.gfl && S.gf){ const [who,dv]=b.dataset.gfl.split(":"); if (who==="me") S.gf.life+= +dv; else S.gf.opps[+who]+= +dv; render(); return; }
  const t=b.dataset.t; if (!t) return;
  const d=curDeck();
  switch(t){
    case "ia-save-key": { const v=($("#ia-key")||{}).value||""; if (!v.trim()){ toast("Pega tu clave de API."); break; } S.data.settings.aiKey=v.trim(); saveData(); toast("Clave guardada en este navegador."); render(); break; }
    case "ia-goal": S.iaGoal=b.dataset.v; render(); break;
    case "ia-run": S.iaNotes=($("#ia-notes")||{}).value||""; if (d) await runIA(d); break;
    case "radio-run": if (d) await runRadio(d); break;
    case "chat-copy": if (d){ S.iaNotes=($("#ia-notes")||{}).value||S.iaNotes||""; copyText(chatPromptOf(b.dataset.v, d)); } break;
    case "chat-apply": { if (!d) break; const kind=b.dataset.v; const txt=(($("#chat-ans-"+kind)||{}).value||"").trim();
      if (!txt){ toast("Pega primero la respuesta de Claude."); break; }
      const cur1=S.data.decks.find(x=>x.id===d.id);
      if (kind==="ia"){ const j=parseJSONLoose(txt); if (!j || !Array.isArray(j.cambios)){ toast("No encontré la lista de cambios en ese texto. Copia la respuesta completa de Claude."); break; }
        cur1.ai2={at:Date.now(), model:"chat de Claude", ...j}; saveDeck(cur1,{silent:true,noLog:true}); render(); toast(`${j.cambios.length} cambios listos para aplicar.`); fetchCards(j.cambios.map(c=>c.entra),{quiet:true}).then(render); }
      else { cur1.radio={at:Date.now(), text:txt.replace(/^[^#]*?(?=##)/s,"")}; saveDeck(cur1,{silent:true,noLog:true}); render(); toast("Radiografía guardada en el mazo."); }
      break; }
    case "bld-budget": S.bldBudget=b.dataset.v; for (const x of document.querySelectorAll('[data-t="bld-budget"]')) x.setAttribute("aria-pressed", x.dataset.v===S.bldBudget); break;
    case "bld-run": await runBuilder(); break;
    case "local-fetch": await fetchCards(S.data.decks.filter(x=>x.rival).flatMap(allNames),{label:"Trayendo datos de los mazos de tus amigos"}); break;
    case "local-del": S.data.decks=S.data.decks.filter(x=>x.id!==b.dataset.v); saveData(); render(); break;
    case "local-add": { const list=$("#lr-list").value; const p=parseList(list); const nx=splitDeck(p,"commander",[]);
      if (!nx.cards.length){ toast("Pega la lista del mazo de tu amigo."); break; }
      if (!nx.commanders.length){ toast("Marca el comandante con la sección “Commander” o *CMDR*."); break; }
      const nd={id:uid(), format:"commander", rival:{owner:($("#lr-owner").value||"Amigo").trim()}, name:($("#lr-name").value||nx.commanders.join(" + ")).trim(), commanders:nx.commanders, cards:nx.cards, side:nx.side, maybe:nx.maybe, log:[], created:Date.now(), updated:Date.now()};
      S.data.decks.push(nd); saveData(); render(); toast(`Mazo de ${nd.rival.owner} agregado a la mesa.`); await fetchCards(allNames(nd),{label:"Trayendo datos del mazo"}); break; }
    case "v-restore": { if (!d) break; const v=(d.versions||[])[+b.dataset.v]; if (!v) break; saveDeck({...d, cards:v.cards.map(c=>({...c})), side:(v.side||[]).map(c=>({...c})), maybe:(v.maybe||[]).map(c=>({...c})), commanders:[...(v.commanders||d.commanders||[])]}, {src:"version"}); S.vA=0; S.vB=-1; toast("Versión restaurada. La anterior quedó guardada en el historial."); break; }
    case "copy-link": copyText(($("#share-link")||{}).value||""); break;
    case "copy-code": copyText(($("#share-code-out")||{}).value||""); break;
    case "dl-page": if (d) download(`${d.name}.html`, deckReportHTML(d), "text/html"); break;
    case "pdf": if (d) printReport(d); break;
    case "share-preview": { const o=readShare(($("#share-code")||{}).value); if (!o){ toast("Ese código o enlace no es válido."); break; } S.sharedPreview=o; render(); window.scrollTo(0,0); break; }
    case "share-dismiss": S.sharedPreview=null; if (location.hash.startsWith("#mazo=")) history.replaceState(null,"",location.pathname); render(); break;
    case "share-import": case "share-rival": { const o=S.sharedPreview; if (!o) break; const toL=a=>a.map(c=>({n:c[1], q:c[0]}));
      const nd={id:uid(), format:FORMATS[o.f]?o.f:"commander", name:o.n||"Mazo compartido", commanders:o.c||[], cards:toL(o.m), side:toL(o.s||[]), maybe:toL(o.y||[]), log:[], created:Date.now(), updated:Date.now()};
      if (t==="share-rival") nd.rival={owner:"Compartido"};
      S.data.decks.push(nd); S.sharedPreview=null; if (location.hash.startsWith("#mazo=")) history.replaceState(null,"",location.pathname); saveData();
      if (t==="share-rival"){ S.view="commander"; S.showMeta.commander="local"; } else { S.view=nd.format; S.sel[nd.format]=nd.id; S.showMeta[nd.format]=false; S.deckTab="analisis"; }
      render(); toast("Mazo importado."); await fetchCards(allNames(nd)); break; }
    case "news-run": await loadNews(); break;
    case "news-maybe": { const dk=S.data.decks.find(x=>x.id===b.dataset.v); if (!dk) break; const n=b.dataset.n; if ((dk.maybe||[]).some(c=>slug(c.n)===slug(n))){ toast("Ya está en su maybeboard."); break; } saveDeck({...dk, maybe:[...(dk.maybe||[]), {n, q:1}]}); toast(`${n} agregada al maybeboard de ${dk.name}.`); break; }
    case "weekly-copy": copyText(weeklyText(weeklyData())); break;
    case "refresh": await refreshPrices(true); break;
  }
});
document.addEventListener("change", e=>{
  const id=e.target.id, st=S.data.settings;
  if (id==="set-ai-key"){ st.aiKey=e.target.value.trim(); saveData(); toast(st.aiKey?"Clave guardada en este navegador.":"Clave eliminada."); }
  if (id==="set-ai-model"){ st.aiModel=e.target.value; saveData(); }
  if (id==="set-weekly"){ st.weekly=e.target.checked; saveData(); }
  if (id==="v-a"){ S.vA=+e.target.value; render(); }
  if (id==="v-b"){ S.vB=+e.target.value; render(); }
});
document.addEventListener("input", e=>{ if (e.target.id==="ia-notes") S.iaNotes=e.target.value; if (e.target.id==="bld-cmd") S.bldCmd=e.target.value; });

/* ---------- arranque de las herramientas ---------- */
(function(){
  if (location.hash.startsWith("#mazo=")){ const o=readShare(location.hash); if (o){ S.sharedPreview=o; S.view="home"; } }
  else S.view="home";
  idb.get("news").then(n=>{ if (n) S.news=n; });
  render();
})();
