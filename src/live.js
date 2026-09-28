/* =========================================================
   Bóveda EDH — versión en vivo (Netlify)
   - Puente propio (/api/proxy) para sitios que no dejan
     consultarse desde otra página (EDHREC, Spellbook…).
   - Sincronización entre dispositivos con un código personal
     (/api/sync). Cada persona tiene su propio código.
   - Instalación como app en el teléfono.
   ========================================================= */
var LIVE = (() => { try { return isLive(); } catch { return false; } })();

/* ---------- puente propio ---------- */
const PROXY_HOSTS = new Set(["json.edhrec.com","edhrec.com","backend.commanderspellbook.com","edhtop16.com","api2.moxfield.com","archidekt.com","manabox.app","www.mtggoldfish.com","mtggoldfish.com","mtgtop8.com","tappedout.net","deckstats.net","mtgdecks.net","melee.gg"]);
if (LIVE){
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const url = typeof input === "string" ? input : input.url;
      const u = new URL(url, location.href);
      if (PROXY_HOSTS.has(u.hostname)) return nativeFetch("/api/proxy?url=" + encodeURIComponent(u.href), init);
      // los puentes públicos ya no hacen falta: se reemplazan por el propio
      if (/^(corsproxy\.io|api\.allorigins\.win)$/.test(u.hostname)){ const inner = u.searchParams.get("url"); let ih=""; try { ih = new URL(inner).hostname; } catch {} if (inner && PROXY_HOSTS.has(ih)) return nativeFetch("/api/proxy?url=" + encodeURIComponent(inner), init); }
    } catch {}
    return nativeFetch(input, init);
  };
}

/* ---------- sincronización con código ---------- */
const SY_KEY = "boveda-edh:sync";
var SY = {state:"off", code:"", at:0, busy:false, dirty:false, err:"", timer:null, remote:null, show:false};
function syLoad(){ const s = lsGet(SY_KEY, null); if (s && s.code){ SY.code = s.code; SY.at = s.at||0; SY.state = "on"; } }
function sySave(){ lsSet(SY_KEY, {code:SY.code, at:SY.at}); }
const SY_ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function syNewCode(){ const r = crypto.getRandomValues(new Uint8Array(16)); let s=""; for (let i=0;i<16;i++){ s += SY_ABC[r[i] % SY_ABC.length]; if (i%4===3 && i<15) s += "-"; } return s; }
function syNorm(c){ return String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/(.{4})(?=.)/g,"$1-"); }
async function syId(code){ const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("boveda-sync:" + syNorm(code))); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""); }
function syPayload(){ const {_mod, _acc, _syncAt, _syMod, ...d} = S.data; const settings = {...d.settings}; delete settings.aiKey; return {...d, settings}; }
async function gz(text){
  if (typeof CompressionStream === "undefined") return new TextEncoder().encode(text);
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip")); return new Uint8Array(await new Response(s).arrayBuffer());
}
async function ungz(buf){
  const u = new Uint8Array(buf);
  if (u[0]===0x1f && u[1]===0x8b){
    if (typeof DecompressionStream === "undefined") throw new Error("Este navegador no puede leer los datos sincronizados. Actualízalo.");
    const s = new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip")); return await new Response(s).text(); }
  return new TextDecoder().decode(u);
}
async function syPull(){
  const r = await fetch("/api/sync?id=" + await syId(SY.code), {cache:"no-store"});
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("HTTP " + r.status);
  const at = +r.headers.get("x-at") || 0;
  return {d: JSON.parse(await ungz(await r.arrayBuffer())), at};
}
// versión = la asigna el servidor; "sucio" = cambios locales hechos después del último envío o carga (_mod > _syMod, ambos con el reloj de este dispositivo)
const syDirtyLocal = () => (S.data._mod||0) > (S.data._syMod||0);
async function syPush(force=false){
  if (SY.state!=="on" || !SY.code) return;
  if (SY.busy){ SY.dirty = true; return; }
  SY.busy = true; SY.dirty = false; SY.err = ""; accRender();
  let merged = false;
  try {
    const payload = syPayload(); const modSent = S.data._mod || Date.now();
    const r = await fetch("/api/sync?id=" + await syId(SY.code), {method:"PUT", headers:{"content-type":"application/octet-stream", "x-base-at":String(SY.at), ...(force?{"x-force":"1"}:{})}, body: await gz(JSON.stringify(payload))});
    if (r.status === 409){
      const rem = await syPull(); SY.busy = false;
      if ((SY.mergeDepth||0) < 3 && rem){ SY.mergeDepth = (SY.mergeDepth||0) + 1; merged = await syAutoMerge(rem); SY.mergeDepth = 0; }
      if (!merged){ SY.remote = rem; SY.state = "conflict"; ACC.open = true; }
      return;
    }
    else if (r.status === 429){ SY.err = "Muchas sincronizaciones seguidas. Se reintentará en un minuto."; SY.dirty = true; setTimeout(()=>{ SY.err=""; syPush(); }, 60000); }
    else if (!r.ok){ SY.err = r.status===413 ? "Tus datos pasan el máximo de 5 MB para sincronizar." : "No se pudo sincronizar. Se reintentará con el próximo cambio."; SY.dirty = true; }
    else {
      const j = await r.json().catch(()=>({}));
      SY.at = +j.at || SY.at; S.data._syMod = modSent;          // lo cambiado durante el envío sigue pendiente
      lsSet(LS_DATA, S.data, true); if (typeof saveDataIdb==="function") saveDataIdb(); sySave(); syBaseSave(payload);
      if (syDirtyLocal()) SY.dirty = true;
    }
  } catch(e){ SY.err = "Sin conexión: se sincroniza cuando vuelva la señal."; SY.dirty = true; }
  finally { if (!merged) SY.busy = false; accRender(); if (SY.dirty && !SY.err) sySchedule(1500); }
}
function sySchedule(ms=3000){ clearTimeout(SY.timer); SY.timer = setTimeout(()=>syPush(), ms); }
function syncOnSave(){ if (LIVE && SY.state==="on"){ SY.dirty = true; sySchedule(); } }
function syApply(remote){
  const key = S.data.settings && S.data.settings.aiKey;
  lsSet("boveda-edh:antes-de-sincronizar", S.data);
  S.data = loadData(JSON.parse(JSON.stringify(remote.d)));
  if (key) S.data.settings.aiKey = key;
  S.data._mod = S.data._syMod = Date.now(); SY.at = remote.at; sySave(); syBaseSave(remote.d);
  lsSet(LS_DATA, S.data, true); if (typeof saveDataIdb==="function") saveDataIdb();
  for (const f of Object.keys(S.sel)) if (!S.data.decks.some(x=>x.id===S.sel[f])) S.sel[f] = null;
  S.editing = null; render();
}
function syEmpty(d){ return !d.decks.length && !(d.collection.items||[]).length && !(d.binders||[]).length && !(d.wishlist||[]).length; }
// al abrir o volver a la app: si otro dispositivo guardó algo nuevo, se carga
async function syCheck(){
  if (!LIVE || SY.state!=="on" || SY.busy) return;
  try { await S.boot; } catch {}
  try {
    const remote = await syPull();
    if (!remote){ await syPush(true); return; }
    if (remote.at === SY.at){ if (syDirtyLocal()) syPush(); return; }
    const localChanged = syDirtyLocal();
    if (!localChanged || syEmpty(S.data)){ syApply(remote); toast("Se cargaron los cambios de tu otro dispositivo."); }
    else if (!(await syAutoMerge(remote))){ SY.remote = remote; SY.state = "conflict"; ACC.open = true; accRender(); }
  } catch { SY.err = "Sin conexión: se sincroniza cuando vuelva la señal."; accRender(); }
}
async function syConnect(code, isNew){
  try { await S.boot; } catch {}
  SY.code = syNorm(code); SY.at = 0; SY.state = "on"; SY.err = ""; sySave();
  if (isNew){ await syPush(true); toast("Listo: este dispositivo queda sincronizado con tu código."); return; }
  let remote;
  try { remote = await syPull(); }
  catch(e){ SY.err = (e && e.message && /navegador/.test(e.message)) ? e.message : "No se pudo leer tu código ahora. Reintenta con “Sincronizar ahora”."; SY.at = -1; accRender(); return; }   // nunca se sube nada si no se pudo leer
  if (!remote){ await syPush(true); toast("Ese código no tenía datos: se guardaron los de este dispositivo."); return; }
  if (syEmpty(S.data)){ syApply(remote); toast("Tus datos llegaron a este dispositivo."); }
  else { SY.remote = remote; SY.state = "conflict"; ACC.open = true; }
  accRender();
}


/* ---------- unir cambios de dos dispositivos (a tres bandas) ---------- */
// base = lo último que este dispositivo sincronizó; se compara registro por registro
function syBaseSave(d){ try { idb.set("syncBase", JSON.parse(JSON.stringify(d))); } catch {} }
async function syBaseLoad(){ try { return await idb.get("syncBase"); } catch { return null; } }
const syJ = o => JSON.stringify(o===undefined?null:o);
function syMergeList(base, loc, rem, keyOf, newer){
  const B = new Map((base||[]).map(x=>[keyOf(x),x])), L = new Map((loc||[]).map(x=>[keyOf(x),x])), R = new Map((rem||[]).map(x=>[keyOf(x),x]));
  const out = []; let clash = 0;
  const keys = [...new Set([...L.keys(), ...R.keys(), ...B.keys()])];
  for (const k of keys){
    const b = B.get(k), l = L.get(k), r = R.get(k);
    const lc = syJ(l)!==syJ(b), rc = syJ(r)!==syJ(b);
    let v;
    if (!lc) v = r; else if (!rc) v = l;
    else if (syJ(l)===syJ(r)) v = l;
    else { clash++; v = !l ? r : !r ? l : (newer ? newer(l, r) : l); }
    if (v) out.push(v);
  }
  // conserva el orden local y agrega al final lo nuevo del otro dispositivo
  const pos = new Map((loc||[]).map((x,i)=>[keyOf(x),i]));
  out.sort((a,b)=>(pos.has(keyOf(a))?pos.get(keyOf(a)):1e9)-(pos.has(keyOf(b))?pos.get(keyOf(b)):1e9));
  return {list: out, clash};
}
function syMerge(base, loc, rem){
  const byTime = (a,b)=>((b.updated||0) > (a.updated||0) ? b : a);
  const d = syMergeList(base.decks, loc.decks, rem.decks, x=>x.id, byTime);
  const bi = syMergeList(base.binders, loc.binders, rem.binders, x=>x.id, byTime);
  const co = syMergeList(base.collection&&base.collection.items, loc.collection.items, rem.collection.items, x=>collKey(x));
  const wi = syMergeList(base.wishlist, loc.wishlist, rem.wishlist, x=>slug(x.n)+"|"+(x.pk||"")+"|"+(x.finish||""));
  const gm = syMergeList(base.games, loc.games, rem.games, x=>x.id);
  const noKey = o => { const x = {...(o||{})}; delete x.aiKey; return x; };
  const scalar = k => k==="settings" ? (syJ(noKey(loc.settings))!==syJ(noKey(base.settings)) ? loc.settings : rem.settings) : (syJ(loc[k])!==syJ(base[k]) ? loc[k] : rem[k]);
  const out = {...rem, ...loc, decks:d.list, binders:bi.list, collection:{...loc.collection, items:co.list, v:(loc.collection.v||0)+1}, wishlist:wi.list, games:gm.list,
    settings: {...scalar("settings"), aiKey: loc.settings && loc.settings.aiKey}, dismissed: scalar("dismissed"), roles: scalar("roles"), mbLog: scalar("mbLog")};
  return {d: out, clash: d.clash + bi.clash + co.clash + wi.clash};
}
async function syAutoMerge(remote){
  const base = await syBaseLoad();
  if (!base) return false;
  const loc = JSON.parse(JSON.stringify(S.data));
  const m = syMerge(base, loc, JSON.parse(JSON.stringify(remote.d)));
  S.data = loadData(m.d); S.data._mod = Date.now(); S.data._syMod = 0; SY.at = remote.at; sySave();
  lsSet(LS_DATA, S.data, true); if (typeof saveDataIdb==="function") saveDataIdb();
  for (const f of Object.keys(S.sel)) if (!S.data.decks.some(x=>x.id===S.sel[f])) S.sel[f] = null;
  S.editing = null; render();
  toast(m.clash ? `Se unieron los cambios de tus dispositivos. En ${m.clash} registro${m.clash>1?"s":""} cambiado${m.clash>1?"s":""} en ambos se quedó la versión más reciente.` : "Se unieron los cambios de tus dispositivos.");
  SY.busy = false; await syPush();   // sin forzar: si otro dispositivo guardó entremedio, se vuelve a unir
  return true;
}

/* ---------- interfaz del botón de cuenta en la versión en vivo ---------- */
function syncChipHTML(){
  const st = SY.state;
  const label = st==="on" ? (SY.busy ? "Sincronizando…" : SY.err ? "Sin sincronizar" : SY.dirty ? "Cambios por subir" : "Sincronizado") : st==="conflict" ? "Elige qué datos usar" : "Solo este dispositivo";
  const cls = st==="on" && !SY.err && !SY.dirty ? "ok" : st==="conflict" || SY.err ? "warn" : "";
  return `<button class="acc-chip ${cls}" id="acc-chip" aria-expanded="${ACC.open}"><span class="acc-av acc-av0" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/></svg></span><span><b>Mis datos</b><small>${esc(label)}</small></span></button>`;
}
function syncPanelHTML(){
  const st = SY.state;
  let body;
  if (st==="off") body = `<p><b>Tus datos están solo en este dispositivo.</b></p>
    <p class="muted" style="font-size:.9rem">Con un código personal tus mazos, colección, carpetas de venta y lista de búsqueda quedan iguales en tu teléfono y tu computador. Cada persona usa su propio código.</p>
    <button class="btn primary" data-sy="new">Crear mi código</button>
    <div class="field"><label for="sy-code">¿Ya tienes un código de otro dispositivo?</label><div class="row"><input type="text" id="sy-code" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" style="flex:1;min-width:0"><button class="btn" data-sy="join">Conectar</button></div></div>`;
  else if (st==="conflict") body = `<p><b>Este dispositivo y tu código tienen datos distintos</b> (el código se guardó ${SY.remote?ago(SY.remote.at):"antes"}).</p>
    <div class="acc-choice"><button class="btn primary" data-sy="use-remote">Usar los datos del código</button><span class="muted">Reemplaza lo de este dispositivo (queda una copia local por si acaso).</span></div>
    <div class="acc-choice"><button class="btn" data-sy="use-local">Subir los de este dispositivo</button><span class="muted">Reemplaza lo guardado con el código.</span></div>
    <div class="acc-choice"><button class="btn" data-sy="merge">Juntar ambos</button><span class="muted">Suma los mazos y registros que falten en cada lado.</span></div>`;
  else body = `<p><b>Sincronizado con tu código.</b> <span class="muted">Último guardado: ${SY.at?ago(SY.at):"—"}.</span></p>
    ${SY.err?`<p class="down" style="font-size:.9rem">${esc(SY.err)}</p>`:""}
    <div class="sy-code"><span class="num">${SY.show?esc(SY.code):SY.code.replace(/[A-Z0-9]/g,"•")}</span><button class="btn sm ghost" data-sy="show">${SY.show?"Ocultar":"Ver"}</button></div>
    <p class="muted" style="font-size:.88rem">Para tu otro dispositivo, copia el enlace y ábrelo allá (por ejemplo, envíatelo a ti mismo por WhatsApp o correo). Quien tenga el código ve y cambia tus datos: no lo compartas con otras personas; ellas crean el suyo.</p>
    <div class="row"><button class="btn sm primary" data-sy="link">Copiar enlace para otro dispositivo</button><button class="btn sm" data-sy="copy">Copiar código</button></div>
    <div class="row"><button class="btn sm" data-sy="now">Sincronizar ahora</button><button class="btn sm ghost" data-sy="off">Desconectar este dispositivo</button></div>`;
  return `<div class="acc-panel" role="dialog" aria-label="Mis datos">${body}${installCardHTML(true)}</div>`;
}

/* ---------- instalar como app ---------- */
var installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (typeof render==="function" && S.view==="tools") render(); });
function isStandalone(){ return !!(window.matchMedia && (matchMedia("(display-mode: standalone)").matches || navigator.standalone===true)); }
function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1); }
function installCardHTML(compact){
  if (!LIVE || isStandalone()) return "";
  const how = installEvt ? `<button class="btn ${compact?"sm":""} primary" data-sy="install">Instalar la app</button>`
    : isIOS() ? `<span class="muted" style="font-size:.9rem">En Safari toca <b>Compartir</b> y luego <b>Agregar a inicio</b>.</span>`
    : `<span class="muted" style="font-size:.9rem">En el menú del navegador (⋮) elige <b>Instalar app</b> o <b>Agregar a la pantalla de inicio</b>.</span>`;
  return compact ? `<div class="sy-install"><b>Instálala en tu teléfono</b>${how}</div>`
    : `<div class="card-box install-box"><h3>Instala la Bóveda en tu teléfono</h3><p class="muted" style="margin:0">Queda con su ícono en la pantalla de inicio, abre a pantalla completa y funciona sin señal con tus últimos datos y precios.</p><div class="row">${how}</div></div>`;
}

document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-sy]"); if (!b) return;
  switch (b.dataset.sy){
    case "new": await syConnect(syNewCode(), true); SY.show = true; break;
    case "join": { const c = syNorm(($("#sy-code")||{}).value); if (c.replace(/-/g,"").length < 12){ toast("Revisa el código: son 16 letras y números."); return; } await syConnect(c, false); break; }
    case "show": SY.show = !SY.show; break;
    case "copy": copyText(SY.code); break;
    case "link": copyText(location.origin + "/#sync=" + SY.code.replace(/-/g,"")); break;
    case "now": SY.err = ""; await syCheck(); if (SY.state==="on") await syPush(); toast(SY.err || "Sincronizado."); break;
    case "off": SY = Object.assign(SY, {state:"off", code:"", at:0, err:"", show:false}); lsSet(SY_KEY, null); toast("Este dispositivo ya no se sincroniza. Tus datos siguen aquí."); break;
    case "use-remote": { const r = SY.remote; SY.state = "on"; SY.remote = null; ACC.open = false; if (r) syApply(r); toast("Usando los datos de tu código."); break; }
    case "use-local": SY.state = "on"; SY.remote = null; ACC.open = false; await syPush(true); toast("Tus datos de este dispositivo quedaron en el código."); break;
    case "merge": { const r = SY.remote; SY.state = "on"; SY.remote = null; ACC.open = false; if (r) accMerge({d:loadData(JSON.parse(JSON.stringify(r.d)))}); saveData(); render(); await syPush(true); toast("Datos combinados y sincronizados."); break; }
    case "install": if (installEvt){ installEvt.prompt(); const c = await installEvt.userChoice.catch(()=>null); installEvt = null; if (c && c.outcome==="accepted") toast("Bóveda instalada."); render(); } return;
  }
  accRender();
});

if (LIVE){
  syLoad();
  // enlace para otro dispositivo: #sync=CODIGO
  const m = location.hash.match(/^#sync=([A-Za-z0-9-]{12,})/);
  if (m){ history.replaceState(null, "", location.pathname); setTimeout(()=>syConnect(m[1], false), 0); }
  else if (SY.state==="on") setTimeout(syCheck, 0);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState==="visible") syCheck(); else if (SY.dirty) syPush(); });
  window.addEventListener("online", () => { SY.err = ""; syCheck(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
}
