/* =========================================================
   Bóveda EDH — Mesa compartida (grupo)
   Un código por grupo. Cada persona se une con su nombre,
   publica sus mazos de Commander (lista, nivel y bracket) y los
   de los demás llegan solos a "Mazos de mis amigos". Una partida
   se anota una vez y queda para todos, con su tabla del grupo.
   Funciona en la versión en vivo (usa /api/group).
   ========================================================= */
const grpForm = turn => ({players:{}, seats:{}, winner:null, turn:turn||7, how:null, gid:null});
S.grp = S.grp || {doc:null, err:"", busy:false, saving:false, show:false, f:grpForm(), pubHash:"", in:{me:"", name:"", code:""}};

// identidad del miembro: fija para esta persona (viaja con sus ajustes a sus otros dispositivos)
function grpIdent(){
  const st = S.data.settings;
  if (!st.grpMid) st.grpMid = (S.data.group && S.data.group.mid) || uid();
  if (!st.grpTok){ const r = crypto.getRandomValues(new Uint8Array(24)); st.grpTok = [...r].map(x=>x.toString(16).padStart(2,"0")).join(""); }
  return {mid: st.grpMid, tok: st.grpTok};
}

function grpState(){ return S.data.group || null; }
async function grpId(code){ const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("boveda-group:" + syNorm(code))); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""); }
async function grpCall(method, body){
  const G = grpState(); if (!G) throw new Error("sin grupo");
  const I = grpIdent(); if (G.mid !== I.mid){ G.mid = I.mid; saveData(); }
  const r = await fetch("/api/group?id=" + await grpId(G.code), method==="GET" ? {cache:"no-store"} : {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({...body, mid:I.mid, tok:I.tok})});
  const j = await r.json().catch(()=>({}));
  if (!r.ok) throw Object.assign(new Error(j.error || ("HTTP " + r.status)), {status:r.status});
  return j;
}
function grpMyDecks(){
  return S.data.decks.filter(d=>d.format==="commander" && !d.rival).map(d=>{ const A = analyze(d); const P = powerOf(d, A);
    return {id:d.id, name:d.name, commanders:d.commanders||[], format:"commander", power:P.power, br:[P.official.b, P.real], salt:P.salt, list:deckText(d), upd:d.updated||d.created||0}; });
}
async function grpPublish(force){
  // solo se publican los cambios; lo borrado se avisa con su id (así un dispositivo atrasado no borra lo de otro)
  const decks = grpMyDecks(), del = (S.data.grpDel||[]).filter(id=>!decks.some(d=>d.id===id));
  const h = JSON.stringify([decks.map(d=>[d.id, d.name, d.list, d.power, d.upd]), del]);
  if (!force && h === S.grp.pubHash) return;
  S.grp.doc = await grpCall("POST", {op:"decks", decks, del}); S.grp.pubHash = h;
  if (del.length){ S.data.grpDel = (S.data.grpDel||[]).filter(id=>!del.includes(id)); saveData(); }
  grpImport();
}
// los mazos de los demás miembros llegan como mazos de amigos (y se actualizan si cambian)
function grpImport(){
  const doc = S.grp.doc, G = grpState(); if (!doc || !G) return;
  let changed = false;
  const keys = new Set();
  for (const [key, gd] of Object.entries(doc.decks||{})){
    if (gd.mid === G.mid) continue; keys.add(key);
    const owner = (doc.members[gd.mid]||{}).name || "Amigo";
    const nx = splitDeck(parseList(gd.list||""), "commander", []);
    const cur = S.data.decks.find(d=>d.rival && d.rival.gkey===key);
    const base = {format:"commander", rival:{owner, group:true, gkey:key}, name:gd.name, commanders:nx.commanders.length?nx.commanders:gd.commanders, cards:nx.cards, side:nx.side, maybe:nx.maybe};
    if (!cur){ S.data.decks.push({id:"g-"+key.replace(/[^\w-]/g,"-"), log:[], created:Date.now(), updated:Date.now(), ...base}); changed = true; }
    else if (JSON.stringify([cur.name, cur.cards, cur.commanders, cur.rival.owner]) !== JSON.stringify([base.name, base.cards, base.commanders, owner])){ Object.assign(cur, base, {updated:Date.now()}); changed = true; }
  }
  const before = S.data.decks.length;
  S.data.decks = S.data.decks.filter(d=>!(d.rival && d.rival.group && !keys.has(d.rival.gkey)));
  if (changed || S.data.decks.length !== before){ saveData(); const names = S.data.decks.filter(d=>d.rival&&d.rival.group).flatMap(allNames).filter(n=>!cardOf(n)); if (names.length) fetchCards(names, {quiet:true}); }
}
async function grpRefresh(){
  if (!grpState() || S.grp.busy) return; S.grp.busy = true; S.grp.err = "";
  try { S.grp.doc = await grpCall("GET"); grpImport(); await grpPublish(false); }
  catch(e){ S.grp.err = e.status===404 ? "Ese grupo ya no existe." : e.status===403 ? "El grupo no reconoce este dispositivo: sal y vuelve a unirte con el código." : "No se pudo conectar con el grupo. " + e.message; }
  finally { S.grp.busy = false; render(); }
}
// sin grupo (p. ej. se salió desde otro dispositivo): se quitan sus mazos y su estado
function grpForget(){ S.grp.doc = null; S.grp.f = grpForm(); S.grp.pubHash = "";
  const n = S.data.decks.length; S.data.decks = S.data.decks.filter(d=>!(d.rival && d.rival.group)); if (S.data.decks.length !== n) saveData(); }
// partidas del grupo convertidas al formato de las partidas del mazo (para su récord)
function grpGamesFor(d){
  const G = grpState(), doc = S.grp.doc; if (!G || !doc) return [];
  const key = d.rival ? (d.rival.gkey||null) : G.mid + ":" + d.id; if (!key) return [];
  const deckName = k => ((doc.decks||{})[k]||{}).name || (k.startsWith(G.mid+":") ? (S.data.decks.find(x=>x.id===k.slice(G.mid.length+1))||{}).name : null) || k.split(":").pop();
  return (doc.games||[]).filter(g=>g.players.some(p=>p.deck===key)).map(g=>{ const me = g.players.find(p=>p.deck===key);
    return {id:"g-"+g.id, gid:g.id, group:true, mine: g.by===G.mid || g.players.some(p=>p.mid===G.mid), at:g.at, deck:d.id, res:me.res, turn:g.turn, how:g.how||null, seat:me.seat, opp:g.players.filter(p=>p!==me).map(p=>deckName(p.deck)), note:g.note||""}; });
}

function grpHTML(){
  if (typeof LIVE==="undefined" || !LIVE) return `<div class="sec"><h3>Mesa compartida</h3><p class="lede">Para compartir mazos y partidas con tu grupo, usa la versión en vivo: boveda-edh.netlify.app.</p></div>`;
  const G = grpState(), doc = S.grp.doc;
  if (!G) return `<div class="sec grp"><h3>Mesa compartida</h3><p class="lede">Arma tu grupo: cada uno publica sus mazos, las partidas se anotan una sola vez para todos y hay una tabla del grupo.</p>
    <div class="grp-form"><label>Tu nombre<input type="text" id="grp-me" placeholder="Ej: Juan" value="${esc(S.grp.in.me||S.data.settings.nick||"")}" autocomplete="off" maxlength="40"></label>
      <div class="grp-two"><div><label>Crear un grupo nuevo<input type="text" id="grp-name" placeholder="Nombre del grupo" value="${esc(S.grp.in.name)}" autocomplete="off" maxlength="60"></label><button class="btn primary" data-grp="create" ${S.grp.busy?"disabled":""}>Crear grupo</button></div>
      <div><label>Unirme con un código<input type="text" id="grp-code" placeholder="XXXX-XXXX-XXXX-XXXX" value="${esc(S.grp.in.code||S.grpInvite||"")}" autocapitalize="characters" autocomplete="off"></label><button class="btn" data-grp="join" ${S.grp.busy?"disabled":""}>Unirme</button></div></div></div>
    ${S.grp.err?`<p class="down">${esc(S.grp.err)}</p>`:""}</div>`;
  if (!doc) return `<div class="sec grp"><h3>Mesa compartida</h3><p class="muted">${S.grp.busy?"Conectando con tu grupo…":S.grp.err?esc(S.grp.err):"Cargando…"}</p><button class="btn sm" data-grp="refresh">Reintentar</button></div>`;
  const members = Object.entries(doc.members||{});
  const decksBy = mid => Object.entries(doc.decks||{}).filter(([,d])=>d.mid===mid);
  const F = S.grp.f;
  // el formulario solo conserva jugadores y mazos que siguen en el grupo
  for (const mid of Object.keys(F.players)){ const k = F.players[mid]; if (!Object.hasOwn(doc.members||{}, mid) || !Object.hasOwn(doc.decks||{}, k) || doc.decks[k].mid!==mid){ delete F.players[mid]; delete F.seats[mid]; if (F.winner===mid) F.winner = null; } }
  // tabla del grupo
  const stat = new Map(); for (const [mid,m] of members) stat.set(mid, {name:m.name, n:0, w:0});
  for (const g of doc.games||[]) for (const p of g.players){ const x = stat.get(p.mid); if (!x) continue; x.n++; if (p.res==="win") x.w++; }
  const board = [...stat.values()].filter(x=>x.n).sort((a,b)=>(b.w/b.n)-(a.w/a.n) || b.n-a.n);
  const deckStat = new Map(); for (const g of doc.games||[]) for (const p of g.players){ const x = deckStat.get(p.deck) || {n:0, w:0}; x.n++; if (p.res==="win") x.w++; deckStat.set(p.deck, x); }
  const deckName = k => ((doc.decks||{})[k]||{}).name || k.split(":").pop();
  const chip = (attr, v, label, on) => `<button class="chip" data-grp-${attr}="${esc(String(v))}" aria-pressed="${!!on}">${label}</button>`;
  const playing = members.filter(([mid])=>F.players[mid]);
  return `<div class="sec grp"><div class="rp-h"><h3>${esc(doc.name||"Mi grupo")}</h3><button class="btn sm ghost" data-grp="refresh" ${S.grp.busy?"disabled":""}>${S.grp.busy?"Actualizando…":"Actualizar"}</button></div>
    ${S.grp.err?`<p class="down">${esc(S.grp.err)}</p>`:""}
    <div class="grp-code"><span class="muted">Código:</span> <span class="num">${S.grp.show?esc(G.code):G.code.replace(/[A-Z0-9]/g,"•")}</span> <button class="btn sm ghost" data-grp="show">${S.grp.show?"Ocultar":"Ver"}</button><button class="btn sm" data-grp="link">Copiar invitación</button></div>
    <h4 class="td-h">Miembros</h4>
    ${members.map(([mid,m])=>`<div class="rec"><span><b>${esc(m.name)}</b>${mid===G.mid?` <span class="pill good">tú</span>`:""}<br><span class="muted" style="font-size:.85rem">${decksBy(mid).map(([,d])=>`${esc(d.name)} ${d.power?`(${Number(d.power).toFixed(1)})`:""}`).join(" · ")||"sin mazos publicados"}</span></span></div>`).join("")}
    <p class="foot">Tus mazos de Commander se publican solos al grupo; los de los demás aparecen abajo, en la tabla y en la Mesa de hoy.</p>

    <h4 class="td-h">Anotar partida del grupo</h4>
    <div class="gm-form">
      ${members.map(([mid,m])=>{ const ds = decksBy(mid); const sel = F.players[mid];
        return `<div class="gm-row"><span class="gm-l">${esc(m.name)}</span><div class="chips">${chip("pl", mid+"|", "No juega", !sel)}${ds.map(([k,d])=>chip("pl", mid+"|"+k, esc(d.name), sel===k)).join("")}</div></div>`; }).join("")}
      ${playing.length>=2?`<div class="gm-row"><span class="gm-l">Asientos</span><div class="grp-seats">${playing.map(([mid,m])=>`<span>${esc(m.name)}</span><div class="chips">${[1,2,3,4].slice(0, Math.max(2, playing.length)).map(s=>chip("seat", mid+"|"+s, String(s), F.seats[mid]===s)).join("")}</div>`).join("")}</div></div>
      <div class="gm-row"><span class="gm-l">Ganó</span><div class="chips">${playing.map(([mid,m])=>chip("win", mid, esc(m.name), F.winner===mid)).join("")}${chip("win", "draw", "Empate", F.winner==="draw")}</div></div>
      <div class="gm-row"><span class="gm-l">Turno</span><div class="gm-step"><button class="btn sm" data-grp-turn="-1">−</button><b class="num">${F.turn}</b><button class="btn sm" data-grp-turn="1">+</button></div></div>
      <div class="gm-row"><span class="gm-l">Cómo terminó</span><div class="chips">${GAME_HOW.map(([k,es])=>chip("how", k, es, F.how===k)).join("")}</div></div>
      <button class="btn primary" data-grp="save" ${F.winner && !S.grp.saving?"":"disabled"}>${S.grp.saving?"Guardando…":"Guardar partida para el grupo"}</button>`:`<p class="muted" style="margin:0">Elige el mazo de al menos dos jugadores.</p>`}
    </div>

    ${board.length?`<h4 class="td-h">Tabla del grupo</h4><div class="tbl-wrap"><table><thead><tr><th>Jugador</th><th class="n">Partidas</th><th class="n">Victorias</th></tr></thead><tbody>${board.map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${x.n}</td><td class="n">${x.w} · ${Math.round(100*x.w/x.n)}%</td></tr>`).join("")}</tbody></table></div>
      <h4 class="td-h">Por mazo</h4>${[...deckStat.entries()].sort((a,b)=>(b[1].w/b[1].n)-(a[1].w/a[1].n)).slice(0,12).map(([k,x])=>`<div class="rec"><span>${esc(deckName(k))}</span><span class="meta num">${x.w}/${x.n} · ${Math.round(100*x.w/x.n)}%</span></div>`).join("")}
      <h4 class="td-h">Últimas partidas</h4>${(doc.games||[]).slice(-8).reverse().map(g=>{ const w = g.players.find(p=>p.res==="win"); return `<div class="rec gm-item"><span><b>${w?esc((doc.members[w.mid]||{}).name||"?"):"Empate"}</b> ganó con ${w?esc(deckName(w.deck)):"—"}${g.turn?` · turno ${g.turn}`:""}<br><span class="muted" style="font-size:.85rem">${new Date(g.at).toLocaleDateString("es-CL",{day:"numeric",month:"short"})} · ${g.players.map(p=>esc((doc.members[p.mid]||{}).name||"?")).join(", ")}</span></span>${g.by===G.mid||g.players.some(p=>p.mid===G.mid)?`<button class="btn sm ghost" data-grp-del="${esc(g.id)}">Borrar</button>`:""}</div>`; }).join("")}`:""}
    <div class="row" style="margin-top:12px"><button class="btn sm ghost" data-grp="leave" ${S.grp.busy?"disabled":""}>Salir del grupo</button></div>
  </div>`;
}

document.addEventListener("click", async ev => {
  const g = k => ev.target.closest(`[data-grp-${k}]`); const F = S.grp.f; let b;
  if ((b = g("pl"))){ const [mid, key] = b.dataset.grpPl.split("|"); if (key) F.players[mid] = key; else { delete F.players[mid]; delete F.seats[mid]; if (F.winner===mid) F.winner = null; } render(); return; }
  if ((b = g("seat"))){ const [mid, s] = b.dataset.grpSeat.split("|"); for (const k of Object.keys(F.seats)) if (F.seats[k]===+s) delete F.seats[k]; F.seats[mid] = +s; render(); return; }
  if ((b = g("win"))){ F.winner = F.winner===b.dataset.grpWin ? null : b.dataset.grpWin; render(); return; }
  if ((b = g("turn"))){ F.turn = Math.max(1, Math.min(30, F.turn + (+b.dataset.grpTurn))); render(); return; }
  if ((b = g("how"))){ F.how = F.how===b.dataset.grpHow ? null : b.dataset.grpHow; render(); return; }
  if ((b = g("del"))){ if (!confirm("¿Borrar esta partida para todo el grupo?")) return; try { S.grp.doc = await grpCall("POST", {op:"delgame", gid:b.dataset.grpDel}); toast("Partida borrada del grupo."); } catch(e){ toast(e.message); } render(); return; }
  b = ev.target.closest("[data-grp]"); if (!b) return;
  const act = b.dataset.grp;
  if (act==="create" || act==="join"){
    if (S.grp.busy) return;
    const me = String(($("#grp-me")||{}).value||"").trim().slice(0, 40); if (!me){ toast("Escribe tu nombre para el grupo."); return; }
    const code = act==="create" ? syNewCode() : syNorm(($("#grp-code")||{}).value);
    if (code.replace(/-/g,"").length < 12){ toast("Revisa el código: son 16 letras y números."); return; }
    const gname = String(($("#grp-name")||{}).value||"").trim().slice(0, 60) || "Mi grupo";
    const prev = S.data.group; S.data.settings.nick = me; S.data.group = {code, mid: grpIdent().mid, name: me}; S.grp.busy = true; S.grp.err = ""; render();
    try { S.grp.doc = await grpCall("POST", {op:act, name:me, group: act==="create" ? gname : ""});
      S.grp.f = grpForm(); S.grp.in = {me:"", name:"", code:""}; S.grpInvite = ""; S.grp.pubHash = ""; saveData();
      S.grp.busy = false; await grpPublish(true).catch(()=>{}); S.grp.show = act==="create"; toast(act==="create" ? "Grupo creado. Copia la invitación y mándala a tu grupo." : "Te uniste al grupo."); }
    catch(e){ S.data.group = prev || null; S.grp.err = e.status===404 ? "No encontré un grupo con ese código." : e.message; }
    finally { S.grp.busy = false; }
    render(); return;
  }
  if (act==="refresh"){ await grpRefresh(); return; }
  if (act==="show"){ S.grp.show = !S.grp.show; render(); return; }
  if (act==="link"){ copyText(`Únete a mi grupo en la Bóveda EDH: ${location.origin}/#grupo=${grpState().code.replace(/-/g,"")}`); return; }
  if (act==="leave"){
    if (S.grp.busy || !confirm("¿Salir del grupo? Tus mazos dejan de verse allá.")) return;
    S.grp.busy = true; render();
    try { await grpCall("POST", {op:"leave"}); }
    catch(e){ if (e.status!==404 && e.status!==403){ S.grp.busy = false; render(); toast("No se pudo salir ahora (sin conexión). Intenta de nuevo."); return; } }
    S.data.decks = S.data.decks.filter(d=>!(d.rival && d.rival.group)); S.data.group = null; S.data.grpDel = []; S.grp.doc = null; S.grp.f = grpForm(); S.grp.pubHash = ""; S.grp.busy = false;
    saveData(); render(); toast("Saliste del grupo."); return; }
  if (act==="save"){
    const mids = Object.keys(F.players); if (mids.length < 2 || !F.winner || S.grp.saving) return;
    F.gid = F.gid || uid();   // el mismo id si se toca dos veces o se reintenta: no se duplica
    const game = {id:F.gid, at:Date.now(), turn:F.turn, how:F.how, players: mids.map(mid=>({mid, deck:F.players[mid], seat:F.seats[mid]||null, res: F.winner==="draw" ? "draw" : F.winner===mid ? "win" : "loss"}))};
    S.grp.saving = true; render();
    try { S.grp.doc = await grpCall("POST", {op:"game", game}); S.grp.f = {...grpForm(F.turn), players:F.players}; toast("Partida guardada para todo el grupo."); }
    catch(e){ toast("No se pudo guardar: " + e.message); }
    finally { S.grp.saving = false; }
    render(); return;
  }
});
// invitación por enlace: #grupo=CODIGO (se completa el código y se pide el nombre)
if (typeof LIVE!=="undefined" && LIVE){
  const m = location.hash.match(/^#grupo=([A-Za-z0-9-]{12,})/);
  if (m){ history.replaceState(null, "", location.pathname); S.grpInvite = syNorm(m[1]); setTimeout(()=>{ S.view="commander"; S.showMeta.commander="local"; S.sel.commander=null; render(); toast("Escribe tu nombre y toca “Unirme”."); }, 300); }
  if (S.data.group) setTimeout(grpRefresh, 1200);
}
// lo escrito en el formulario del grupo sobrevive a los redibujos
document.addEventListener("input", ev => { const t = ev.target; if (!t || !t.id) return;
  if (t.id==="grp-me") S.grp.in.me = t.value; else if (t.id==="grp-name") S.grp.in.name = t.value; else if (t.id==="grp-code") S.grp.in.code = t.value; });
