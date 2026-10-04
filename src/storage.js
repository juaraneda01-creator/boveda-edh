/* =========================================================
   Bóveda EDH — Almacenamiento: cuánto ocupan tus datos y cuántos
   mazos más caben en cada lugar donde se guardan.
   ========================================================= */
const KB = n => n >= 1048576 ? (n/1048576).toFixed(1).replace(".",",")+" MB" : Math.max(1, Math.round(n/1024))+" KB";
async function gzLen(text){
  try { if (typeof CompressionStream==="undefined") return null; const s = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip")); return (await new Response(s).arrayBuffer()).byteLength; } catch { return null; }
}
async function storageReport(){
  const D = S.data, json = JSON.stringify(D), bytes = new Blob([json]).size, gz = await gzLen(json);
  const mine = D.decks.filter(d=>!d.rival), all = D.decks;
  const deckSizes = all.map(d=>new Blob([JSON.stringify(d)]).size);
  // tamaño por mazo: el promedio de los tuyos, o el de un mazo de Commander con 10 cambios y 10 versiones (≈ 58 KB) si aún no hay
  const avg = deckSizes.length ? deckSizes.reduce((a,x)=>a+x,0)/deckSizes.length : 58000;
  const avgGz = gz && bytes ? Math.max(1500, avg * gz / bytes) : avg / 8;
  const cache = new Blob([JSON.stringify(S.cards||{})]).size + new Blob([JSON.stringify(S.hist||{})]).size;
  let est = null, persisted = null;
  try { if (navigator.storage && navigator.storage.estimate) est = await navigator.storage.estimate(); } catch {}
  try { if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted(); } catch {}
  const rows = [];
  // navegador (IndexedDB): el límite lo pone el navegador según el espacio libre del equipo
  if (est && est.quota){ const free = Math.max(0, est.quota - (est.usage||0)); rows.push({where:"Este navegador (IndexedDB)", used:est.usage||0, cap:est.quota, more:Math.floor(free/avg), note:persisted ? "protegido: el navegador no lo borra por falta de espacio" : "puede borrarse si el equipo se queda sin espacio o (en iPhone) tras semanas sin abrir la Bóveda: protégelo o usa la sincronización"}); }
  // copia rápida en localStorage (~5 MB): si se llena, todo sigue guardado en IndexedDB
  rows.push({where:"Copia rápida (localStorage)", used:bytes, cap:5*1048576, more:Math.max(0, Math.floor((5*1048576 - bytes)/avg)), note:"si se llena no pasa nada: los datos siguen en IndexedDB"});
  if (typeof LIVE!=="undefined" && LIVE) rows.push({where:"Sincronización con código", used:gz||bytes/8, cap:5*1048576, more:Math.max(0, Math.floor((5*1048576 - (gz||bytes/8))/avgGz)), note:"máximo 5 MB comprimido; los mazos se comprimen muy bien" + (typeof SY!=="undefined" && SY.state==="on" ? "" : " (no la estás usando)")});
  if (typeof ACC!=="undefined" && ACC.state && ACC.state!=="file") rows.push({where:"Tu cuenta de claude.ai", used:null, cap:null, more:null, note:"un documento por mazo, de hasta 256 KB (un mazo muy grande pierde primero sus versiones antiguas); el número total de documentos lo limita la plataforma y la app avisa si se llega"});
  rows.push({where:"Mesa compartida (grupo)", used:null, cap:null, more:Math.max(0, 25 - Math.min(25, mine.filter(d=>d.format==="commander").length)), note:"se publican tus 25 mazos de Commander más recientes; 16 personas y 3.000 partidas por grupo"});
  return {bytes, gz, decks:all.length, mine:mine.length, avg, avgGz, cache, rows, persisted, canPersist: !!(navigator.storage && navigator.storage.persist) && !persisted, at:Date.now()};
}
function storageHTML(){
  const R = S.storage;
  if (!R) return `<div class="row"><button class="btn sm ghost" data-act="storage">Almacenamiento: ¿cuántos mazos caben?</button></div>`;
  const pctBar = r => r.cap ? `<span class="rp-track sm" style="display:block;margin-top:3px"><i style="width:${Math.min(100, 100*r.used/r.cap).toFixed(1)}%"></i></span>` : "";
  return `<div class="card-box" style="gap:8px;padding:12px"><b>Almacenamiento</b>
    <span class="muted" style="font-size:.88rem">${R.decks} mazo${R.decks===1?"":"s"} (${R.mine} tuyo${R.mine===1?"":"s"}) · tus datos: ${KB(R.bytes)}${R.gz?` (${KB(R.gz)} comprimidos)`:""} · un mazo promedio ocupa ${KB(R.avg)} · datos de cartas y precios: ${KB(R.cache)}</span>
    ${R.rows.map(r=>`<div style="font-size:.88rem"><b>${esc(r.where)}</b>${r.cap?` · ${KB(r.used)} de ${KB(r.cap)}`:""}${r.more!=null?` · <span class="num">caben ~${r.more.toLocaleString("es-CL")}</span> mazo${r.more===1?"":"s"} más`:""}${pctBar(r)}<div class="muted">${esc(r.note)}</div></div>`).join("")}
    <div class="row">${R.canPersist?`<button class="btn sm primary" data-act="storage-persist">Proteger los datos de este navegador</button>`:""}<button class="btn sm ghost" data-act="storage">Volver a medir</button></div></div>`;
}
document.addEventListener("click", async ev => {
  const b = ev.target.closest('[data-act="storage"],[data-act="storage-persist"]'); if (!b) return;
  ev.stopPropagation();
  if (b.dataset.act==="storage-persist"){ let ok = false; try { ok = await navigator.storage.persist(); } catch {} toast(ok ? "Listo: el navegador no borrará tus datos por falta de espacio." : "El navegador no lo permitió. Instala la app o usa la sincronización para no perder datos."); }
  S.storage = await storageReport(); renderSettings();
}, true);
