/* =========================================================
   Bóveda EDH — Preguntar al juez
   Dudas de reglas con respuesta anclada en las Reglas Completas
   (con número de regla) y en los fallos oficiales de cada carta
   que publica Scryfall. En la versión web usa tu sesión de Claude;
   en la versión en vivo, tu clave de API o el chat de Claude.
   ========================================================= */
S.judge = S.judge || {q:"", cards:"", busy:false, ctx:null};

// cartas que se nombran en la pregunta: las escritas en el campo, más las que están entre comillas o [[corchetes]]
function judgeCards(q, extra){
  const out = new Set(String(extra||"").split(/[,;\n]/).map(x=>x.trim()).filter(Boolean));
  for (const m of String(q).matchAll(/\[\[([^\]]{2,60})\]\]|["“]([^"”]{2,60})["”]/g)) out.add((m[1]||m[2]).trim());
  return [...out].slice(0, 6);
}
// texto oficial y fallos de Scryfall (en la versión web no se puede: se usa lo que se sabe de cada carta)
async function judgeContext(names){
  const out = [];
  for (const n of names){
    const c = {n, oracle:"", rulings:[]};
    if (!isWebView()){
      try { const r = await sf("https://api.scryfall.com/cards/named?fuzzy=" + encodeURIComponent(n)); if (r.ok){ const j = await r.json(); c.n = j.name;
        c.oracle = j.oracle_text != null ? j.oracle_text : (j.card_faces||[]).map(f=>`${f.name}: ${f.oracle_text||""}`).join("\n//\n"); c.type = j.type_line;
        if (j.rulings_uri){ const rr = await sf(j.rulings_uri); if (rr.ok){ const jr = await rr.json(); c.rulings = (jr.data||[]).slice(0, 12).map(x=>({d:x.published_at, t:x.comment})); } } } } catch {}
    }
    out.push(c);
  }
  return out;
}
function judgePrompt(q, ctx){
  return `Eres un juez de Magic: The Gathering (nivel 2) que responde en español de Chile, claro y breve.
Pregunta del jugador:
${q}

${ctx.length ? `Cartas involucradas${ctx.some(c=>c.oracle) ? " (texto Oracle y fallos oficiales de Scryfall)" : ""}:
${ctx.map(c=>`### ${c.n}${c.type?` — ${c.type}`:""}\n${c.oracle||"(usa el texto Oracle que conoces)"}${c.rulings.length?`\nFallos:\n${c.rulings.map(r=>`- (${r.d}) ${r.t}`).join("\n")}`:""}`).join("\n\n")}
` : ""}
Responde con este formato (usa "## " para los títulos):
## Respuesta corta
Una o dos frases con la respuesta directa.
## Por qué
La explicación paso a paso, en el orden en que ocurren las cosas (pila, prioridad, efectos de reemplazo, capas si aplica).
## Reglas citadas
Viñetas con el número exacto de las Reglas Completas (por ejemplo 903.9a, 704.5k, 613.1) y qué dice cada una en una línea.
## Fallos de las cartas
Solo si alguno de los fallos de arriba aplica, cítalo con su fecha.
Si en Commander hay una regla especial (zona de mando, daño de comandante, identidad de color), menciónala. Si la respuesta depende de algo que falta en la pregunta, dilo y responde los casos. No inventes números de regla: si no estás seguro de uno, dilo.`;
}
function judgeHTML(){
  const J = S.judge, hist = (S.data.judgeLog||[]);
  const canRun = isWebView() || S.data.settings.aiKey;
  return `<div class="fmt-head"><h2>Preguntar al juez</h2><span class="muted">Dudas de reglas respondidas con los números de las Reglas Completas y los fallos oficiales de cada carta.</span></div>
  <div class="sec jz">
    <div class="field"><label for="jz-q">Tu pregunta</label><textarea id="jz-q" style="min-height:110px" placeholder="Ej.: Si mi comandante va al exilio con Swords to Plowshares, ¿puedo devolverlo a la zona de mando? ¿Cuánto cuesta lanzarlo otra vez?">${esc(J.q)}</textarea></div>
    <div class="field"><label for="jz-cards">Cartas involucradas (opcional)</label><input type="text" id="jz-cards" placeholder="Separadas por coma, en inglés: Swords to Plowshares, Hakbal of the Surging Soul" value="${esc(J.cards)}" autocomplete="off">
      <span class="foot">También reconozco las que escribas entre comillas o [[corchetes]]. ${isWebView()?"":"Traigo su texto Oracle y sus fallos desde Scryfall."}</span></div>
    <div class="row">${canRun ? `<button class="btn primary" data-jz="ask" ${J.busy?"disabled":""}>${J.busy?"El juez está pensando…":"Preguntar"}</button>` : ""}
      ${isWebView() ? "" : `<a class="btn ${canRun?"":"primary"}" data-jz="chat" href="https://claude.ai/new" target="_blank" rel="noopener">Abrir en Claude</a><button class="btn sm ghost" data-jz="copy">Solo copiar la consulta</button>`}</div>
    ${!canRun && !isWebView() ? `<p class="foot">“Abrir en Claude” copia la pregunta con el texto y los fallos de las cartas y abre un chat nuevo (sin costo extra). Con una clave de API en Ajustes, la respuesta aparece aquí.</p>` : ""}
  </div>
  ${hist.length ? `<div class="sec"><h3>Respuestas</h3>${hist.map((h,i)=>`<details class="jz-a" ${i===0?"open":""}><summary><b>${esc(h.q.slice(0,120))}${h.q.length>120?"…":""}</b> <span class="muted" style="font-size:.85rem">${new Date(h.at).toLocaleDateString("es-CL",{day:"numeric",month:"short"})}</span></summary>
      <div class="md">${mdLite(h.a)}</div>${h.cards && h.cards.length ? `<p class="foot">Cartas: ${h.cards.map(n=>`<a href="${SF_CARD(n)}" target="_blank" rel="noopener">${esc(n)}</a>`).join(", ")}</p>` : ""}
      <div class="row"><button class="btn sm ghost" data-jz="del" data-i="${i}">Borrar</button></div></details>`).join("")}
    <p class="foot">Las respuestas las escribe Claude a partir de las reglas: en un torneo, el juez presente tiene la última palabra. Reglas Completas: <a href="https://magic.wizards.com/es/rules" target="_blank" rel="noopener">magic.wizards.com/rules</a>.</p></div>` : ""}`;
}
async function judgeRun(mode, link){
  const J = S.judge; J.q = (($("#jz-q")||{}).value||"").trim(); J.cards = (($("#jz-cards")||{}).value||"").trim();
  if (J.q.length < 8){ toast("Escribe la pregunta de reglas."); return null; }
  const names = judgeCards(J.q, J.cards);
  if (mode === "chat" || mode === "copy"){
    // el enlace se abre al tocar: se copia la consulta con lo que ya se sabe (sin esperar a Scryfall)
    const ctx = names.map(n=>({n, oracle:"", rulings:[]}));
    const p = judgePrompt(J.q, ctx); if (link) link.href = claudeChatURL(p);
    try { await navigator.clipboard.writeText(p); toast(mode==="chat" ? "Consulta copiada. Si el chat aparece vacío, pégala." : "Consulta copiada."); } catch { if (mode==="copy") copyText(p); }
    return null;
  }
  J.busy = true; render();
  try {
    const ctx = await judgeContext(names);
    const a = await askClaude(judgePrompt(J.q, ctx), {max:2000});
    S.data.judgeLog = [{at:Date.now(), q:J.q, a, cards:ctx.map(c=>c.n)}, ...(S.data.judgeLog||[])].slice(0, 15); saveData();
    J.q = ""; J.cards = "";
  } catch(e){ toast(typeof aiErrText==="function" ? aiErrText(e) : "El juez no pudo responder."); }
  finally { J.busy = false; render(); }
}
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-jz]"); if (!b) return;
  const act = b.dataset.jz;
  if (act==="ask"){ await judgeRun("ask"); return; }
  if (act==="chat"){ await judgeRun("chat", b); return; }
  if (act==="copy"){ await judgeRun("copy"); return; }
  if (act==="del"){ const i = +b.dataset.i; S.data.judgeLog = (S.data.judgeLog||[]).filter((_,j)=>j!==i); saveData(); render(); return; }
});
document.addEventListener("input", e => { if (e.target.id==="jz-q") S.judge.q = e.target.value; if (e.target.id==="jz-cards") S.judge.cards = e.target.value; });
