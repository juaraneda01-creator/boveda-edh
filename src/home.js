/* =========================================================
   Bóveda EDH — Inicio personal y bienvenida
   ========================================================= */
function homeWelcomeHTML(){
  const st = S.data.settings; if (st.onboarded) return "";
  const hasData = S.data.decks.some(d=>!d.rival) || (S.data.collection.items||[]).length;
  const live = typeof LIVE!=="undefined" && LIVE;
  const synced = (live && typeof SY!=="undefined" && SY.state==="on") || (typeof ACC!=="undefined" && ACC.state==="on");
  const installed = typeof isStandalone==="function" && isStandalone();
  const step = (done, n, title, text, actions) => `<li class="wz-step ${done?"done":""}"><span class="wz-n" aria-hidden="true">${done?"✓":n}</span><div><b>${title}</b><p>${text}</p>${done?"":`<div class="row">${actions}</div>`}</div></li>`;
  const syncText = live ? "Crea tu código personal para tener lo mismo en el teléfono y el computador. Cada persona usa el suyo."
    : (typeof ACC!=="undefined" && ACC.state!=="file") ? "Entra con tu cuenta de Claude (arriba a la derecha) para guardar tus datos en todos tus dispositivos."
    : "Para sincronizar entre dispositivos, usa la versión en vivo: boveda-edh.netlify.app.";
  return `<section class="card-box wz"><h3>Bienvenido a la Bóveda</h3><p class="muted" style="margin:0">Tres pasos y queda lista para usar desde el teléfono.</p>
    <ol class="wz-list">
      ${step(hasData, 1, "Trae tus cartas", "Importa un mazo o tu colección desde ManaBox: exporta la lista como texto o CSV y pégala.", `<button class="btn sm primary" data-home="new-deck">Nuevo mazo</button><button class="btn sm" data-home="coll">Subir colección</button>`)}
      ${step(synced, 2, "Guarda tus datos", syncText, live ? `<button class="btn sm primary" data-home="sync">Crear mi código</button>` : (typeof ACC!=="undefined" && ACC.state!=="file") ? `<button class="btn sm" data-home="sync">Ver mi cuenta</button>` : `<a class="btn sm" href="https://boveda-edh.netlify.app" target="_blank" rel="noopener">Abrir la versión en vivo</a>`)}
      ${live ? step(installed, 3, "Instálala en tu teléfono", "Queda con su ícono, abre a pantalla completa y funciona sin señal.", typeof installEvt!=="undefined" && installEvt ? `<button class="btn sm primary" data-sy="install">Instalar la app</button>` : `<span class="muted" style="font-size:.9rem">${typeof isIOS==="function" && isIOS() ? "En Safari: Compartir → Agregar a inicio." : "Menú del navegador (⋮) → Instalar app."}</span>`) : ""}
    </ol>
    <div class="row"><button class="btn sm ghost" data-home="done">Ocultar esta guía</button></div></section>`;
}
function homeHTML(){
  const decks = S.data.decks.filter(d=>!d.rival).sort((a,b)=>(b.updated||0)-(a.updated||0));
  const al = alerts();
  const W = weeklyData();
  const deckCard = d => { const A = analyze(d); const m = d.commanders && d.commanders[0] ? cardOf(d.commanders[0]) : null;
    return `<button class="home-deck" data-home-deck="${esc(d.id)}">${m && m.img ? `<img src="${esc(artOf(m))}" alt="" loading="lazy">` : `<span class="home-deck-ph">${pipsHTML(A.ci)}</span>`}<span class="hd-t"><b>${esc(d.name)}</b><small>${esc(FORMATS[d.format].name)} · ${money(A.price)}</small></span></button>`; };
  const alertRow = a => `<div class="alert"><span class="ic ${a.kind==="up"?"up":a.kind==="down"?"down":"tg"}" aria-hidden="true">${a.kind==="up"?"↑":a.kind==="down"?"↓":"★"}</span><div><div class="t">${cardName(a.n)} ${a.kind==="up"?`<span class="up">${pct(a.ch.pct)}</span>`:a.kind==="down"?`<span class="down">${pct(a.ch.pct)}</span>`:""}</div><div class="s">${esc(a.s||"")}</div></div></div>`;
  const week = W.delta || W.changes.length || W.sales.length || W.up.length || W.down.length;
  return `${S.sharedPreview && typeof sharedImportHTML==="function" ? sharedImportHTML(S.sharedPreview) : ""}
  ${typeof installCardHTML==="function" && S.data.settings.onboarded ? installCardHTML(false) : ""}
  <div class="home">
    ${homeWelcomeHTML()}
    <section class="home-sec"><div class="home-h"><h2>Tus mazos</h2><button class="btn sm primary" data-home="new-deck">+ Nuevo mazo</button></div>
      ${decks.length ? `<div class="home-decks">${decks.slice(0,6).map(deckCard).join("")}</div>` : `<p class="muted">Aún no tienes mazos. Crea uno o impórtalo desde ManaBox.</p>`}</section>
    <section class="home-sec"><div class="home-h"><h2>Alertas de precio</h2>${al.length ? `<button class="btn sm ghost" data-home="market">Ver las ${al.length}</button>` : ""}</div>
      ${al.length ? al.slice(0,3).map(alertRow).join("") : `<p class="muted">Sin alertas por ahora. Aparecen cuando una carta tuya sube o una que buscas baja.</p>`}</section>
    <section class="home-sec"><div class="home-h"><h2>Esta semana</h2><button class="btn sm ghost" data-home="weekly">Ver resumen</button></div>
      ${week ? `<div class="stats home-stats"><div class="stat"><div class="k">tu colección</div><div class="v ${W.delta>0?"up":W.delta<0?"down":""}">${W.base?pct(100*W.delta/W.base):"—"}</div></div><div class="stat"><div class="k">mazos con cambios</div><div class="v">${W.changes.length}</div></div><div class="stat"><div class="k">ventas</div><div class="v">${W.sales.length}</div></div></div>` : `<p class="muted">Todavía no hay movimientos esta semana.</p>`}</section>
    <section class="home-sec"><div class="home-h"><h2>Atajos</h2></div>
      <div class="home-quick">
        <button class="btn" data-home="coll">Mi colección</button><button class="btn" data-home="venta">Carpetas de venta</button>
        <button class="btn" data-home="pauper-meta">Meta de Pauper</button><button class="btn" data-home="tools">Todas las herramientas</button>
      </div></section>
  </div>`;
}
function artOf(m){ return (m.art || m.img || "").replace("/normal/","/art_crop/"); }

document.addEventListener("click", ev => {
  const dk = ev.target.closest("[data-home-deck]");
  if (dk){ const d = S.data.decks.find(x=>x.id===dk.dataset.homeDeck); if (!d) return; S.view=d.format; S.sel[d.format]=d.id; S.showMeta[d.format]=false; S.editing=null; S.deckTab="analisis"; render(); window.scrollTo(0,0); return; }
  const b = ev.target.closest("[data-home]"); if (!b) return;
  const go = v => { S.view=v; S.editing=null; render(); window.scrollTo(0,0); };
  switch (b.dataset.home){
    case "new-deck": S.view="commander"; S.showMeta.commander=false; S.editing={format:"commander", name:"", commanders:[], text:""}; render(); window.scrollTo(0,0); break;
    case "coll": go("coll"); break;
    case "venta": go("venta"); break;
    case "market": go("market"); break;
    case "weekly": go("weekly"); break;
    case "tools": go("tools"); break;
    case "pauper-meta": S.showMeta.pauper=true; go("pauper"); break;
    case "sync": ACC.open = true; accRender(); window.scrollTo(0,0); break;
    case "done": S.data.settings.onboarded = true; saveData(); render(); break;
  }
});
