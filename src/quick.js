/* =========================================================
   Bóveda EDH — Chequeo rápido de mesa
   Pegas 2 a 4 enlaces (Moxfield, Archidekt, ManaBox…) o listas
   y la app dice si la mesa está pareja, sin guardar los mazos.
   ========================================================= */
S.qc = S.qc || {in:["","","",""], decks:null, errs:[], busy:false};
const isUrl = s => /^(https?:\/\/)?[\w.-]+\.(com|app|gg|net|org|io|de)\/\S+$/i.test(String(s).trim());
async function qcDeckFrom(raw, i){
  raw = String(raw||"").trim(); if (!raw) return null;
  let r;
  if (isUrl(raw)){
    if (isWebView()) throw new Error("en la versión web los enlaces no se pueden leer: pega la lista");
    r = await importFromLink(raw, "commander");
    if (!r.commanders.length) throw new Error("no encontré el comandante en ese enlace");
    const toL = t => parseList(t).map(c=>({n:c.n, q:c.q}));
    return {id:"qc-"+i, format:"commander", name:r.name || r.commanders.join(" + "), commanders:r.commanders, cards:toL(r.text), side:[], maybe:[], log:[], rival:{owner:`Mazo ${i+1} · ${r.src}`}, qc:true};
  }
  const nx = splitDeck(parseList(/^\s*(commanders?|comandantes?|deck|mainboard)\s*$/im.test(raw) ? raw : textToDeck(raw, "commander")), "commander", []);
  if (!nx.cards.length) throw new Error("no encontré cartas");
  if (!nx.commanders.length) throw new Error("marca el comandante (sección “Commander” o *CMDR*)");
  return {id:"qc-"+i, format:"commander", name:nx.commanders.join(" + "), commanders:nx.commanders, cards:nx.cards, side:[], maybe:[], log:[], rival:{owner:`Mazo ${i+1}`}, qc:true};
}
async function qcRun(){
  const Q = S.qc; if (Q.busy) return;
  Q.in = [0,1,2,3].map(i=>(($("#qc-"+i)||{}).value||""));
  if (Q.in.filter(x=>x.trim()).length < 2){ toast("Pega al menos dos mazos (enlace o lista)."); return; }
  Q.busy = true; Q.errs = []; Q.decks = null; render();
  const decks = [];
  try {
    for (let i=0;i<4;i++){ try { const d = await qcDeckFrom(Q.in[i], i); if (d) decks.push(d); } catch(e){ Q.errs.push(`Mazo ${i+1}: ${e.message||e}`); } }
    if (decks.length) await fetchCards(decks.flatMap(allNames), {quiet:!isWebView(), label:"Trayendo las cartas de la mesa"});
    bumpAnalysis(); Q.decks = decks.length >= 2 ? decks : null;
    if (decks.length < 2) Q.errs.push("Hacen falta al menos dos mazos que se puedan leer.");
  } finally { Q.busy = false; render(); }
}
function quickCheckHTML(){
  const Q = S.qc; const M = Q.decks ? mesaEval(Q.decks) : null;
  const field = i => `<label class="qc-f"><span class="sc muted">Mazo ${i+1}</span><textarea id="qc-${i}" rows="2" spellcheck="false" placeholder="${i<2?"Enlace de Moxfield, Archidekt o ManaBox, o la lista pegada":"Opcional"}">${esc(Q.in[i]||"")}</textarea></label>`;
  return `<div class="sec qc"><h3>Chequeo rápido de mesa</h3><p class="lede">Pega los mazos de la mesa (enlace o lista, 2 a 4) y te digo si está pareja. No se guardan.${isWebView()?" En la versión web pega las listas: los enlaces se leen en la versión en vivo.":""}</p>
    <div class="qc-grid">${[0,1,2,3].map(field).join("")}</div>
    <div class="row"><button class="btn primary" data-qc="run" ${Q.busy?"disabled":""}>${Q.busy?"Revisando…":"Revisar la mesa"}</button>${Q.decks||Q.in.some(x=>x)?`<button class="btn ghost" data-qc="clear" ${Q.busy?"disabled":""}>Limpiar</button>`:""}</div>
    ${Q.errs.length?`<div class="banner bad" style="display:grid;gap:2px">${Q.errs.map(e=>`<span>${esc(e)}</span>`).join("")}</div>`:""}
    ${M?`<div class="banner ${M.verdict.k==="good"?"info":""} mesa-v mesa-${M.verdict.k}"><span><b>${M.verdict.es}.</b> ${esc(M.verdict.s)} <span class="muted">(diferencia de ${M.spread.toFixed(1).replace(".",",")} niveles)</span></span></div>
      ${mesaTableHTML(M)}
      ${M.tips.length?`<ul class="mesa-tips">${M.tips.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>`:""}
      <div class="row"><button class="btn" data-qc="share">Compartir resumen</button><button class="btn" data-qc="save">Guardar en mazos de mis amigos</button></div>`:""}
  </div>`;
}
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-qc]"); if (!b) return;
  const Q = S.qc, act = b.dataset.qc;
  if (act==="run"){ await qcRun(); return; }
  if (act==="clear"){ S.qc = {in:["","","",""], decks:null, errs:[], busy:false}; render(); return; }
  const M = Q.decks && mesaEval(Q.decks); if (!M) return;
  if (act==="share"){ const text = mesaText(M).replace("Mesa de hoy", "Chequeo de mesa"); if (navigator.share){ try { await navigator.share({title:"Chequeo de mesa", text}); return; } catch(e){ if (e && e.name==="AbortError") return; } } copyText(text); return; }
  if (act==="save"){ let n = 0; for (const d of Q.decks){ const {qc, ...x} = d; S.data.decks.push({...x, id:uid(), commanders:[...(x.commanders||[])], cards:(x.cards||[]).map(c=>({...c})), side:[], maybe:[], log:[], rival:{owner:(d.rival.owner||"").replace(/^Mazo \d+( · )?/, "") || "Chequeo"}, created:Date.now(), updated:Date.now()}); n++; }
    Q.decks = null; Q.errs = [];   // ya quedaron guardados: un segundo toque no los duplica
    saveData(); toast(`${n} mazos agregados a “Mazos de mis amigos”.`); render(); return; }
});
document.addEventListener("input", e => { const m = /^qc-(\d)$/.exec(e.target.id||""); if (m) S.qc.in[+m[1]] = e.target.value; });
