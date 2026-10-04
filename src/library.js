/* =========================================================
   Bóveda EDH — Biblioteca por bracket
   Todos los mazos de Commander que conoces (tuyos, de amigos,
   del grupo, de torneos y listas típicas de torneo) filtrados
   por bracket, nivel, fuente y comandante.
   ========================================================= */
S.lib = S.lib || {q:"", br:0, src:"all", td:[], busy:false};
function libSrc(d){ if (d.libTd) return "torneo"; if (!d.rival) return "tuyos"; if (d.rival.group) return "grupo"; if (/^torneo/i.test(d.rival.owner||"")) return "torneo"; return "amigos"; }
const LIB_SRC = [["all","Todos"],["tuyos","Tuyos"],["grupo","Grupo"],["amigos","Amigos"],["torneo","Torneo"]];
function libRows(){
  const decks = [...S.data.decks.filter(d=>d.format==="commander"), ...(S.lib.td||[])];
  const q = S.lib.q.trim().toLowerCase();
  return decks.map(d=>{ const A = analyze(d); const P = powerOf(d, A); return {d, A, P, src:libSrc(d), rec: typeof gameRecord==="function" && !d.libTd ? gameRecord(d) : null}; })
    .filter(r=>(!S.lib.br || r.P.real===S.lib.br) && (S.lib.src==="all" || r.src===S.lib.src) && (!q || r.d.name.toLowerCase().includes(q) || (r.d.commanders||[]).join(" ").toLowerCase().includes(q) || String(r.d.rival&&r.d.rival.owner||"").toLowerCase().includes(q)))
    .sort((a,b)=>b.P.power-a.P.power);
}
async function libLoadTd(){
  if (typeof LIVE==="undefined" || !LIVE){ toast("Las listas de torneo se traen en la versión en vivo: boveda-edh.netlify.app"); return; }
  if (S.lib.busy) return; S.lib.busy = true; render();
  try {
    if (!S.td.data) await tdLoad(false);
    const A = tdAgg(); if (!A){ toast("No se pudieron cargar los torneos."); return; }
    const top = [...A.cmds].filter(c=>c.n>=8).sort((a,b)=>b.n-a.n).slice(0, 10); const out = [];
    for (const c of top){
      try { const r = await fetch("/api/cedh?q=cmd&name="+encodeURIComponent(c.name)); if (!r.ok) continue; const j = await r.json();
        const cards = (j.cards||[]).filter(x=>x[1]>=25).slice(0, 99); if (cards.length < 70) continue;
        out.push({id:"lt-"+slug(c.name), libTd:true, format:"commander", name:`${c.name} (lista típica)`, commanders:c.name.split(" / "), cards:cards.map(x=>({n:x[0], q:1})), side:[], maybe:[], log:[], rival:{owner:`Torneo · ${j.lists||c.n} listas, ${Math.round(c.conv*100)}% al top`}}); } catch {}
    }
    S.lib.td = out;
    if (out.length) await fetchCards(out.flatMap(allNames), {quiet:true, label:"Trayendo cartas de las listas de torneo"});
    bumpAnalysis(); toast(out.length ? `${out.length} listas típicas de torneo agregadas a la biblioteca (no se guardan).` : "No hubo listas suficientes.");
  } finally { S.lib.busy = false; render(); }
}
function libraryHTML(){
  const rows = libRows(); const L = S.lib;
  const chip = (k, v, l, cur) => `<button class="chip" data-lib-${k}="${v}" aria-pressed="${cur===v}">${l}</button>`;
  const srcEs = {tuyos:"tuyo", grupo:"grupo", amigos:"amigo", torneo:"torneo"};
  return `<div class="pane"><div class="pane-head"><div><h2>Biblioteca por bracket</h2><div class="sub">Tus mazos, los de tus amigos y del grupo, y listas de torneo, con los mismos criterios.</div></div></div>
    <div class="pane-body">
      <div class="field"><label>Bracket realista</label><div class="chips">${[[0,"Todos"],[1,"1"],[2,"2"],[3,"3"],[4,"4"],[5,"5 · cEDH"]].map(([v,l])=>chip("br", v, l, L.br)).join("")}</div></div>
      <div class="field"><label>Fuente</label><div class="chips">${LIB_SRC.map(([v,l])=>chip("src", v, l, L.src)).join("")}</div></div>
      <div class="row"><input type="search" id="lib-q" placeholder="Buscar comandante, mazo o dueño…" value="${esc(L.q)}" style="flex:1;min-width:200px">
        ${typeof LIVE!=="undefined" && LIVE ? `<button class="btn sm" data-lib="td" ${L.busy?"disabled":""}>${L.busy?"Trayendo…":L.td.length?"Actualizar listas de torneo":"Traer listas típicas de torneo"}</button>` : ""}</div>
      ${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Mazo</th><th class="n">Nivel</th><th class="n">Bracket</th><th class="n">Sal</th><th class="n">Récord</th><th></th></tr></thead><tbody>
        ${rows.map(r=>`<tr${r.src==="tuyos"?' class="td-mine"':""}><td><b>${esc(r.d.name)}</b><br><span class="muted" style="font-size:.82rem">${esc((r.d.commanders||[]).join(" + "))} · ${esc(r.d.rival ? (r.d.rival.owner||"amigo") : "tú")} <span class="tag">${srcEs[r.src]}</span></span></td>
          <td class="n">${r.P.power.toFixed(1)}</td><td class="n">${r.P.official.b}/${r.P.real}</td><td class="n">${r.P.salt}</td><td class="n">${r.rec?`${r.rec.w}-${r.rec.l}`:"—"}</td>
          <td style="white-space:nowrap">${r.d.libTd?"":`<button class="btn sm ghost" data-open="${esc(r.d.id)}">Ver</button>`}${r.src!=="tuyos"?`<button class="btn sm ghost" data-lib-copy="${esc(r.d.id)}">Copiar como mío</button>`:""}${r.d.libTd?`<button class="btn sm ghost" data-lib-keep="${esc(r.d.id)}">Guardar en amigos</button>`:""}</td></tr>`).join("")}
      </tbody></table></div><p class="foot">${rows.length} mazo${rows.length>1?"s":""}. Bracket: oficial / realista (se filtra por el realista). Las listas típicas de torneo usan las cartas que juega al menos el 25 % de las listas de ese comandante en TopDeck.gg.</p>`
      : `<p class="muted">No hay mazos con ese filtro.</p>`}
    </div></div>`;
}
document.addEventListener("click", async ev => {
  const g = k => ev.target.closest(`[data-lib-${k}]`); let b;
  if ((b = g("br"))){ S.lib.br = +b.dataset.libBr; render(); return; }
  if ((b = g("src"))){ S.lib.src = b.dataset.libSrc; render(); return; }
  if ((b = g("copy")) || (b = g("keep"))){ const id = b.dataset.libCopy || b.dataset.libKeep; const d = [...S.data.decks, ...S.lib.td].find(x=>x.id===id); if (!d) return;
    const {rival, libTd, sim, pwHist, ...x} = d; const copy = !!b.dataset.libCopy;
    const sameList = o => o.format===d.format && o.name===d.name && (o.commanders||[]).join("|")===(d.commanders||[]).join("|") && (o.cards||[]).length===(d.cards||[]).length;
    if (!copy && S.data.decks.some(o=>o.rival && o.id!==d.id && sameList(o))){ toast("Esa lista ya está en “Mazos de mis amigos”."); return; }
    const nd = {...x, commanders:[...(x.commanders||[])], cards:(x.cards||[]).map(c=>({...c})), side:(x.side||[]).map(c=>({...c})), maybe:(x.maybe||[]).map(c=>({...c})), id:uid(), name: copy ? `${d.name.replace(/ \(lista típica\)$/,"")} (copia)` : d.name, log:[], versions:[], created:Date.now(), updated:Date.now(), ...(copy ? {} : {rival:{owner:rival && rival.owner || "Torneo"}})};
    S.data.decks.push(nd); saveData();
    if (copy){ S.view="commander"; S.sel.commander=nd.id; S.showMeta.commander=false; S.deckTab="analisis"; toast("Copia creada en tus mazos."); } else toast("Lista guardada en “Mazos de mis amigos”.");
    render(); return; }
  if ((b = ev.target.closest("[data-lib]")) && b.dataset.lib==="td"){ await libLoadTd(); return; }
  if ((b = ev.target.closest("[data-act='show-lib']"))){ S.view="commander"; S.showMeta.commander="lib"; S.editing=null; render(); window.scrollTo(0,0); }
});
document.addEventListener("input", e => { if (e.target.id==="lib-q"){ S.lib.q = e.target.value; const pos = e.target.selectionStart; clearTimeout(S._libT); S._libT = setTimeout(()=>{ render(); const el=$("#lib-q"); if (el){ el.focus(); el.setSelectionRange(pos,pos); } }, 200); } });
