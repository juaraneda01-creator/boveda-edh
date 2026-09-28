/* =========================================================
   Bóveda EDH — cuenta
   En la versión web se inicia sesión con la cuenta de Claude
   del visitante: los datos se guardan en su espacio privado
   (data/users/<id>/…) y se sincronizan entre dispositivos.
   En el archivo descargado no hay cuenta: se usa el respaldo.
   ========================================================= */
var ACC = {state:"init", db:null, uid:null, name:"", avatar:"", color:"", open:false, busy:false, dirty:false, timer:null, cache:{}, cloudAt:0, syncAt:0, conflict:null, err:"", dl:null};
const WEB_URL = "https://claude.ai/artifact/NQtKCrx1WzVMyRq6RPvJk4";
const LIVE_URL = "https://boveda-edh.netlify.app";
const isLive = () => /netlify\.app$/i.test(location.hostname||"");
const ACC_CHUNK = 1200;         // registros de colección por documento
const ACC_MAX = 240*1024;       // margen bajo el límite de 256 KiB por documento
const hasRuntime = () => !!(window.claude && typeof window.claude.use === "function");

function accRoot(){ return ACC.db.doc(`data/users/${ACC.uid}/boveda`); }
const jsz = o => JSON.stringify(o).length;

// lo que va a la nube: todo menos la clave de IA (secreto) y marcas internas
function accMeta(d){
  const {decks, collection, binders, _mod, _acc, _syncAt, ...rest} = d;
  const settings = {...rest.settings}; delete settings.aiKey;
  const meta = {...rest, settings};
  meta.mbLog = (meta.mbLog||[]).slice(0, 60);
  while (jsz(meta) > ACC_MAX && meta.mbLog.length) meta.mbLog = meta.mbLog.slice(0, Math.floor(meta.mbLog.length/2));
  return meta;
}
function accFit(o){
  // un mazo muy grande pierde primero versiones antiguas y resultados de IA
  const x = JSON.parse(JSON.stringify(o));
  while (jsz(x) > ACC_MAX && (x.versions||[]).length) x.versions = x.versions.slice(0, Math.floor(x.versions.length/2));
  if (jsz(x) > ACC_MAX){ delete x.ai2; delete x.radio; delete x.ai; }
  if (jsz(x) > ACC_MAX) x.log = (x.log||[]).slice(0, 10);
  return x;
}
function accParts(d){
  const parts = {decks:{}, coll:{}, binders:{}};
  for (const k of d.decks) parts.decks[k.id] = accFit(k);
  const items = d.collection.items||[];
  for (let i=0, n=0; i<items.length; i+=ACC_CHUNK, n++) parts.coll["c"+String(n).padStart(3,"0")] = {items:items.slice(i, i+ACC_CHUNK)};
  for (const b of d.binders||[]) parts.binders[b.id] = accFit(b);
  return parts;
}

/* ---------- base de la última sincronización (para unir a tres bandas) ---------- */
function accBaseOf(d){ const {_mod, _acc, _syncAt, _syMod, ...x} = d; const o = JSON.parse(JSON.stringify(x)); if (o.settings) delete o.settings.aiKey; return o; }
function accBaseSave(d){ try { idb.set("accBase", accBaseOf(d)); } catch {} }
async function accBaseLoad(){ try { return await idb.get("accBase"); } catch { return null; } }

/* ---------- subir ---------- */
async function accPush(force){
  if (!ACC.uid || ACC.busy) { if (ACC.uid) ACC.dirty = true; return; }
  ACC.busy = true; ACC.dirty = false; ACC.err = ""; accRender();
  try {
    const root = accRoot();
    // otro dispositivo guardó después de nuestra última sincronización: se combinan antes de subir
    if (!force){
      const snap = await root.get();
      const cloudAt = snap.exists ? (snap.data().savedAt||0) : 0;
      if (cloudAt > (ACC.syncAt||0)){
        const c = await accPull(snap);
        const base = c && await accBaseLoad();
        if (c && base && typeof syMerge==="function"){
          const key = S.data.settings && S.data.settings.aiKey;
          const m = syMerge(base, JSON.parse(JSON.stringify(S.data)), JSON.parse(JSON.stringify(loadData(c.d))));
          S.data = loadData(m.d); if (key) S.data.settings.aiKey = key; S.data._acc = ACC.uid;
          for (const f of Object.keys(S.sel)) if (!S.data.decks.some(x=>x.id===S.sel[f])) S.sel[f] = null;
        } else if (c) accMerge(c);
        if (c){ ACC.cloudAt = cloudAt; S.data._mod = Date.now(); lsSet(LS_DATA, S.data); if (typeof saveDataIdb==="function") saveDataIdb(); if (typeof bumpAnalysis==="function") bumpAnalysis(); render(); toast("Había cambios de otro dispositivo: se combinaron con los tuyos."); }
      }
    }
    const parts = accParts(S.data);
    for (const [col, map] of Object.entries(parts)){
      const c = ACC.cache[col] || (ACC.cache[col] = {});
      for (const [id, body] of Object.entries(map)){ const js = JSON.stringify(body); if (c[id] === js) continue; await root.collection(col).doc(id).set(body); c[id] = js; }
      for (const id of Object.keys(c)) if (!(id in map)){ await root.collection(col).doc(id).delete(); delete c[id]; }
    }
    const at = Date.now();
    await root.set({v:1, savedAt:at, meta:accMeta(S.data), decks:Object.keys(parts.decks), coll:Object.keys(parts.coll), binders:Object.keys(parts.binders), cards:ACC.cardDocs||0, cardsAt:ACC.cardsAt||0});
    ACC.cloudAt = ACC.syncAt = at; S.data._acc = ACC.uid; S.data._syncAt = at; lsSet(LS_DATA, S.data); if (typeof saveDataIdb==="function") saveDataIdb(); accBaseSave(S.data);
  } catch(e){
    ACC.err = e && e.code==="quota_exceeded" ? "Tu cuenta llegó al máximo de documentos guardados." : e && e.code==="invalid_argument" ? "Esta cuenta no tiene permiso para guardar aquí (pide acceso de Colaborador)." : "No se pudo guardar en tu cuenta. Se reintentará con el próximo cambio.";
    ACC.dirty = true;
  } finally { ACC.busy = false; accRender(); if (ACC.dirty && !ACC.err) accSchedule(1500); }
}
// datos de cartas (precios, tipos, funciones) en la cuenta, para que la versión web los tenga
async function accPushCards(){
  if (!ACC.uid || ACC.state!=="on") return;
  const docs=[]; let cur={}, size=16;
  for (const [k,c] of Object.entries(S.cards)){ const s=k.length+JSON.stringify(c).length+6; if (size+s>ACC_MAX && Object.keys(cur).length){ docs.push(cur); cur={}; size=16; } cur[k]=c; size+=s; }
  if (Object.keys(cur).length) docs.push(cur);
  const col = accRoot().collection("cards"); const id = i => "k"+String(i).padStart(3,"0");
  while (ACC.busy) await new Promise(r=>setTimeout(r,300));
  ACC.busy = true; accRender();
  try {
    for (let i=0;i<docs.length;i++) await col.doc(id(i)).set({c:docs[i]});
    for (let i=docs.length;i<(ACC.cardDocs||0);i++) await col.doc(id(i)).delete();
    ACC.cardDocs = docs.length; ACC.cardsAt = Date.now();
  } catch(e){ ACC.err = "No se pudieron guardar los datos de cartas en tu cuenta."; }
  finally { ACC.busy = false; }
  await accPush();
}
function accSchedule(ms=2500){ clearTimeout(ACC.timer); ACC.timer = setTimeout(accPush, ms); }
function accOnSave(){ if (typeof syncOnSave==="function") syncOnSave(); if (ACC && ACC.uid && ACC.state==="on"){ ACC.dirty = true; accSchedule(); accRender(); } }

/* ---------- bajar ---------- */
// datos de cartas de la cuenta: completan lo que falta aquí o reemplazan lo que tiene datos más viejos o incompletos
async function accMergeCards(cm){
  let n=0;
  for (const doc of Object.values(cm||{})) for (const [k,c] of Object.entries((doc&&doc.c)||{})){
    const cur=S.cards[k];
    if (c && (!cur || (c.at||0) > (cur.at||0) || ((c.at||0) === (cur.at||0) && (c.rv||0) >= (cur.rv||0)))){ S.cards[k]=c; n++; }
  }
  if (n){ saveCaches(); render(); }
  return n;
}
async function accPullCards(){
  if (!ACC.db || !ACC.uid) return 0;
  try {
    const q = await accRoot().collection("cards").get(); const m = {}; for (const d of q.docs) m[d.id] = d.data();
    const r = (await accRoot().get()).data() || {}; ACC.cardDocs = r.cards||ACC.cardDocs||0; ACC.cardsAt = Math.max(ACC.cardsAt||0, r.cardsAt||0);
    return await accMergeCards(m);
  } catch { return 0; }
}
async function accPull(rootSnap){
  const root = accRoot(); const r = rootSnap ? rootSnap.data() : (await root.get()).data();
  if (!r) return null;
  const grab = async col => { const q = await root.collection(col).get(); const m = {}; for (const d of q.docs) m[d.id] = d.data(); return m; };
  const [decks, coll, binders] = await Promise.all([grab("decks"), grab("coll"), grab("binders")]);
  if (r.cards && (r.cardsAt||0) > (ACC.cardsAt||0)) await accMergeCards(await grab("cards"));
  ACC.cardDocs = r.cards||0; ACC.cardsAt = r.cardsAt||0;
  ACC.cache = {decks:{}, coll:{}, binders:{}};
  for (const [k,m] of Object.entries({decks, coll, binders})) for (const [id, b] of Object.entries(m)) ACC.cache[k][id] = JSON.stringify(b);
  const d = JSON.parse(JSON.stringify(r.meta||{}));
  d.decks = (r.decks||Object.keys(decks)).map(id=>decks[id]).filter(Boolean).map(x=>JSON.parse(JSON.stringify(x)));
  d.collection = {items: (r.coll||Object.keys(coll).sort()).flatMap(id=>coll[id] ? coll[id].items : []).map(x=>({...x}))};
  d.binders = (r.binders||Object.keys(binders)).map(id=>binders[id]).filter(Boolean).map(x=>JSON.parse(JSON.stringify(x)));
  return {d, at:r.savedAt||0};
}
function accApply(cloud){
  const key = S.data.settings && S.data.settings.aiKey;
  lsSet("boveda-edh:antes-de-cuenta", S.data);
  S.data = loadData(JSON.parse(JSON.stringify(cloud.d)));
  if (key) S.data.settings.aiKey = key;
  S.data._acc = ACC.uid; S.data._syncAt = S.data._mod = cloud.at; ACC.syncAt = ACC.cloudAt = cloud.at; accBaseSave(S.data);
  lsSet(LS_DATA, S.data); if (typeof saveDataIdb==="function") saveDataIdb(); if (typeof bumpAnalysis==="function") bumpAnalysis();
  for (const f of Object.keys(S.sel)) if (!S.data.decks.some(x=>x.id===S.sel[f])) S.sel[f] = null;
  S.editing = null; render();
}
const isEmptyData = d => !d.decks.length && !(d.collection.items||[]).length && !(d.binders||[]).length && !(d.wishlist||[]).length;

/* ---------- inicio de sesión ---------- */
async function accInit(){
  if (!hasRuntime()){ ACC.state = "file"; accRender(); return; }
  ACC.state = "connecting"; accRender();
  try { await S.boot; } catch {}
  const dl = await claude.use("downloads"); ACC.dl = dl;
  const user = await claude.use("user");
  const db = await claude.use("db");
  if (!user || !db){ ACC.state = "unavailable"; accRender(); return; }
  const me = await user.me();
  if (!me.id){ ACC.state = "guest"; accRender(); return; }
  Object.assign(ACC, {db, uid:me.id, name:me.name, avatar:me.avatarUrl, color:me.color});
  try {
    const snap = await accRoot().get();
    if (snap.exists && (snap.data().cards||0)) await accPullCards();   // las cartas no generan conflicto: se traen siempre
    if (!snap.exists){ ACC.state = "on"; await accPush(); toast("Sesión iniciada: tus datos quedaron guardados en tu cuenta."); }
    else {
      const cloudAt = snap.data().savedAt||0; ACC.cloudAt = cloudAt;
      const mine = S.data._acc === ACC.uid;
      const localChanged = (S.data._mod||0) > (S.data._syncAt||0);
      if (isEmptyData(S.data) || (mine && !localChanged)){ ACC.state = "on"; if (!mine || cloudAt > (S.data._syncAt||0)) accApply(await accPull(snap)); else { await accPull(snap); ACC.syncAt = cloudAt; if (!(await accBaseLoad())) accBaseSave(S.data); } }
      else if (mine && cloudAt <= (S.data._syncAt||0)){ ACC.state = "on"; await accPull(snap); ACC.syncAt = cloudAt; await accPush(); }
      else { ACC.state = "conflict"; ACC.conflict = {cloudAt, snap}; ACC.open = true; }
    }
    accWatch();
  } catch(e){ ACC.state = "error"; ACC.err = "No se pudo conectar con tu cuenta."; }
  accRender();
}
// otro dispositivo guardó: si aquí no hay cambios pendientes, se carga solo
function accWatch(){
  try {
    accRoot().onSnapshot(async s => {
      if (!s.exists || s.metadata.hasPendingWrites) return;
      const at = s.data().savedAt||0; if (at <= ACC.syncAt) return;
      ACC.cloudAt = at;
      if (ACC.state==="on" && !ACC.dirty && !ACC.busy){ accApply(await accPull(s)); toast("Se cargaron cambios hechos en otro dispositivo."); }
      else accRender();
    }, () => {});
  } catch {}
}

/* ---------- descarga de archivos en la versión web ---------- */
function accDownload(filename, text, type){
  if (!hasRuntime()) return false;
  if (!ACC.dl){ toast("Esta vista no permite descargar archivos. Copia el contenido o usa el archivo descargado."); return true; }
  ACC.dl.save({filename, data: text instanceof Blob ? text : new Blob([text], {type:type+";charset=utf-8"})}).then(()=>toast("Archivo guardado.")).catch(e=>{ if (!e || e.code!=="cancelled" && e.code!=="declined") toast("No se pudo guardar el archivo."); });
  return true;
}

/* ---------- interfaz ---------- */
const ago = t => { const s = Math.round((Date.now()-t)/1000); return s<45?"recién":s<3600?`hace ${Math.round(s/60)} min`:s<86400?`hace ${Math.round(s/3600)} h`:new Date(t).toLocaleDateString("es-CL"); };
function accChipHTML(){
  if (ACC.state==="file" && isLive() && typeof syncChipHTML==="function") return syncChipHTML();
  const st = ACC.state;
  const av = ACC.avatar ? `<img class="acc-av" src="${esc(ACC.avatar)}" alt="">` : `<span class="acc-av acc-av0" aria-hidden="true">${ACC.name?esc(ACC.name.slice(0,1).toUpperCase()):`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>`}</span>`;
  const label = st==="on" ? (ACC.busy?"Guardando…":ACC.dirty?"Cambios sin subir":ACC.err?"Sin sincronizar":"Sincronizado")
    : st==="conflict" ? "Elige qué datos usar" : st==="connecting"||st==="init" ? "Conectando…" : st==="file" ? (isLive() ? "Datos en este navegador" : "Iniciar sesión") : st==="guest" ? "Sin sesión" : st==="error" ? "Sin conexión" : "Sin cuenta";
  const who = st==="on"||st==="conflict" ? (ACC.name||"Tu cuenta") : "Cuenta";
  return `<button class="acc-chip ${st==="on"&&!ACC.err&&!ACC.dirty?"ok":st==="conflict"||ACC.err?"warn":""}" id="acc-chip" aria-expanded="${ACC.open}">${av}<span><b>${esc(who)}</b><small>${esc(label)}</small></span></button>`;
}
function accPanelHTML(){
  if (ACC.state==="file" && isLive() && typeof syncPanelHTML==="function") return syncPanelHTML();
  const st = ACC.state;
  let body = "";
  if (st==="on") body = `<p><b>${esc(ACC.name||"Sesión iniciada")}</b><br><span class="muted">Tus mazos, colección, carpetas de venta y lista de búsqueda se guardan en tu cuenta y aparecen en cualquier dispositivo donde abras esta página con la misma cuenta. Solo tú los ves.</span></p>
    <p class="muted" style="font-size:.88rem">Último guardado: ${ACC.syncAt?ago(ACC.syncAt):"—"}. Datos de cartas en tu cuenta: ${Object.keys(S.cards).length} cartas${ACC.cardsAt?`, actualizados ${ago(ACC.cardsAt)}`:""}. La clave de API de Claude no se sube: queda solo en este navegador.</p>
    ${ACC.err?`<p class="down" style="font-size:.9rem">${esc(ACC.err)}</p>`:""}
    <p class="muted" style="font-size:.88rem">Esta versión no puede conectarse a Scryfall. Para traer precios y datos de cartas: abre la <a href="${LIVE_URL}" target="_blank" rel="noopener">versión en vivo</a> (o el archivo descargado), trae los precios y usa “Ajustes y respaldo → Descargar respaldo”; luego aquí “Importar respaldo”. Quedan guardados en tu cuenta.</p>
    <div class="row"><button class="btn sm primary" data-acc="push">Guardar ahora</button><button class="btn sm" data-acc="pull">Volver a cargar desde la cuenta</button></div>`;
  else if (st==="conflict") body = `<p><b>Tu cuenta ya tiene datos</b> (guardados ${ago(ACC.conflict.cloudAt)}), y este navegador también tiene mazos o colección que no están en la cuenta.</p>
    <div class="acc-choice"><button class="btn primary" data-acc="use-cloud">Usar los datos de mi cuenta</button><span class="muted">Reemplaza lo de este navegador (se guarda una copia local por si acaso).</span></div>
    <div class="acc-choice"><button class="btn" data-acc="use-local">Subir los datos de este navegador</button><span class="muted">Reemplaza lo guardado en la cuenta.</span></div>
    <div class="acc-choice"><button class="btn" data-acc="merge">Juntar ambos</button><span class="muted">Suma los mazos y registros que falten en cada lado.</span></div>`;
  else if (st==="file") body = `<p><b>${isLive() ? "Versión en vivo (Netlify)." : "Estás usando el archivo descargado."}</b> Aquí los datos viven solo en este navegador${isLive() ? ", y Scryfall, EDHREC e importar por enlace funcionan en vivo" : ""}.</p>
    <p class="muted">Para iniciar sesión con tu cuenta de Claude y tener tus datos en todos tus dispositivos, usa la versión de claude.ai. Para pasar datos entre versiones: en una, “Ajustes y respaldo → Descargar respaldo”; en la otra, “Importar respaldo”. El respaldo incluye precios y datos de las cartas.</p>
    <div class="row"><a class="btn sm primary" href="${WEB_URL}" target="_blank" rel="noopener">Versión con cuenta (claude.ai)</a>${isLive() ? "" : `<a class="btn sm" href="${LIVE_URL}" target="_blank" rel="noopener">Versión en vivo</a>`}<button class="btn sm" data-act="backup">Descargar respaldo</button></div>`;
  else if (st==="guest") body = `<p><b>No hay una sesión de Claude en esta vista.</b></p><p class="muted">Entra a claude.ai con tu cuenta y vuelve a abrir esta página. Mientras tanto, lo que hagas queda solo en este navegador.</p>`;
  else if (st==="unavailable") body = `<p><b>La cuenta no está disponible en esta vista.</b></p><p class="muted">Abre la página desde claude.ai con tu sesión iniciada. Mientras tanto, lo que hagas queda solo en este navegador.</p>`;
  else if (st==="error") body = `<p><b>${esc(ACC.err||"No se pudo conectar con tu cuenta.")}</b></p><div class="row"><button class="btn sm primary" data-acc="retry">Reintentar</button></div>`;
  else body = `<p class="muted">Conectando con tu cuenta…</p>`;
  return `<div class="acc-panel" role="dialog" aria-label="Cuenta">${body}</div>`;
}
function accRender(){
  if (!ACC) return;
  const host = document.querySelector(".top-right"); if (!host) return;
  let box = document.getElementById("acc");
  if (!box){ box = document.createElement("div"); box.id = "acc"; box.className = "acc"; host.prepend(box); }
  box.innerHTML = accChipHTML() + (ACC.open ? accPanelHTML().replace(/<\/div>\s*$/, `<div class="acc-foot"><button class="btn sm" data-open-settings="1">Ajustes y respaldo</button></div></div>`) : "");
  const sync = document.getElementById("sync");
  if (sync && !S.busy && ACC.state==="on") sync.textContent = S.data.settings.lastRefresh ? `Precios del ${new Date(S.data.settings.lastRefresh).toLocaleDateString("es-CL")}` : "Guardado en tu cuenta";
}
function accMerge(cloud){
  const d = S.data;
  const ids = new Set(d.decks.map(x=>x.id)); for (const k of cloud.d.decks) if (!ids.has(k.id)) d.decks.push(k);
  const key = i => (typeof collKey==="function" ? collKey(i) : i.n+"|"+(i.set||"")+"|"+(i.foil||""));
  const idx = new Map(d.collection.items.map((x,i)=>[key(x),i]));
  for (const it of cloud.d.collection.items){ const k=key(it); if (idx.has(k)){ const x=d.collection.items[idx.get(k)]; x.q=Math.max(x.q, it.q); } else d.collection.items.push(it); }
  for (const w of cloud.d.wishlist||[]) if (!d.wishlist.some(x=>slug(x.n)===slug(w.n) && (x.pk||"")===(w.pk||""))) d.wishlist.push(w);
  const bid = new Set(d.binders.map(b=>b.id)); for (const b of cloud.d.binders||[]) if (!bid.has(b.id)) d.binders.push(b);
  const gid = new Set((d.games||[]).map(g=>g.id)); for (const g of cloud.d.games||[]) if (!gid.has(g.id)) (d.games = d.games||[]).push(g);
}

document.addEventListener("click", async ev=>{
  if (ev.target.closest("[data-open-settings]")){ ACC.open=false; accRender(); const bs=document.getElementById("btn-settings"); if (bs) bs.click(); return; }
  const chip = ev.target.closest("#acc-chip");
  if (chip){ ACC.open = !ACC.open; accRender(); return; }
  const b = ev.target.closest("[data-acc]");
  if (!b){ if (ACC.open && !ev.target.closest("#acc") && ACC.state!=="conflict" && !(typeof SY!=="undefined" && SY.state==="conflict")){ ACC.open=false; accRender(); } return; }
  switch(b.dataset.acc){
    case "push": ACC.err=""; await accPush(); toast(ACC.err||"Guardado en tu cuenta."); break;
    case "pull": { const c = await accPull(); if (c){ accApply(c); toast("Datos cargados desde tu cuenta."); } break; }
    case "use-cloud": { ACC.state="on"; const c = await accPull(ACC.conflict.snap); ACC.conflict=null; ACC.open=false; accApply(c); toast("Usando los datos de tu cuenta."); break; }
    case "use-local": { ACC.state="on"; await accPull(ACC.conflict.snap); ACC.conflict=null; ACC.open=false; await accPush(true); render(); toast("Tus datos de este navegador quedaron en tu cuenta."); break; }
    case "merge": { ACC.state="on"; const c = await accPull(ACC.conflict.snap); ACC.conflict=null; ACC.open=false; accMerge(c); saveData(); render(); await accPush(true); toast("Datos combinados y guardados en tu cuenta."); break; }
    case "retry": accInit(); break;
  }
  accRender();
});
window.addEventListener("pagehide", ()=>{ if (ACC.dirty && ACC.uid) accPush(); });
setTimeout(accInit, 0);

/* aviso de la versión web: se puede cerrar y no vuelve a aparecer en este navegador */
(function(){
  const n = document.getElementById("art-note"); if (!n) return;
  if (lsGet("boveda-edh:aviso-web", false)){ n.hidden = true; return; }
  const b = document.createElement("button"); b.className = "btn sm"; b.textContent = "Entendido";
  b.addEventListener("click", ()=>{ n.hidden = true; lsSet("boveda-edh:aviso-web", true); });
  n.append(b);
})();
