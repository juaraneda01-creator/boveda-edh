/* =========================================================
   Bóveda EDH — Mesa compartida (grupo)
   Un código por grupo. Cada persona se une con su nombre,
   publica sus mazos de Commander (lista, nivel y bracket) y los
   de los demás llegan solos a "Mazos de mis amigos". Una partida
   se anota una vez y queda para todos, con su tabla del grupo.
   Funciona en la versión en vivo (usa /api/group).
   ========================================================= */
S.grp = S.grp || {doc:null, err:"", busy:false, show:false, f:{players:{}, seats:{}, winner:null, turn:7, how:null}, pubHash:""};

function grpState(){ return S.data.group || null; }
async function grpId(code){ const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("boveda-group:" + syNorm(code))); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""); }
async function grpCall(method, body){
  const G = grpState(); if (!G) throw new Error("sin grupo");
  const r = await fetch("/api/group?id=" + await grpId(G.code), method==="GET" ? {cache:"no-store"} : {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({...body, mid:G.mid})});
  const j = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
  return j;
}
function grpMyDecks(){
  return S.data.decks.filter(d=>d.format==="commander" && !d.rival).map(d=>{ const A = analyze(d); const P = powerOf(d, A);
    return {id:d.id, name:d.name, commanders:d.commanders||[], format:"commander", power:P.power, br:[P.official.b, P.real], salt:P.salt, list:deckText(d)}; });
}
async function grpPublish(force){
  const decks = grpMyDecks(); const h = JSON.stringify(decks.map(d=>[d.id, d.name, d.list, d.power]));
  if (!force && h === S.grp.pubHash) return;
  S.grp.doc = await grpCall("POST", {op:"decks", decks}); S.grp.pubHash = h; grpImport();
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
  catch(e){ S.grp.err = e.message==="no existe" ? "Ese grupo ya no existe." : "No se pudo conectar con el grupo. " + e.message; }
  finally { S.grp.busy = false; render(); }
}
// partidas del grupo convertidas al formato de las partidas del mazo (para su récord)
function grpGamesFor(d){
  const G = grpState(), doc = S.grp.doc; if (!G || !doc) return [];
  const key = d.rival ? (d.rival.gkey||null) : G.mid + ":" + d.id; if (!key) return [];
  const deckName = k => ((doc.decks||{})[k]||{}).name || (k.startsWith(G.mid+":") ? (S.data.decks.find(x=>x.id===k.slice(G.mid.length+1))||{}).name : null) || k.split(":").pop();
  return (doc.games||[]).filter(g=>g.players.some(p=>p.deck===key)).map(g=>{ const me = g.players.find(p=>p.deck===key);
    return {id:"g-"+g.id, gid:g.id, group:true, at:g.at, deck:d.id, res:me.res, turn:g.turn, how:g.how||null, seat:me.seat, opp:g.players.filter(p=>p!==me).map(p=>deckName(p.deck)), note:g.note||""}; });
}

function grpHTML(){
  if (typeof LIVE==="undefined" || !LIVE) return `<div class="sec"><h3>Mesa compartida</h3><p class="lede">Para compartir mazos y partidas con tu grupo, usa la versión en vivo: boveda-edh.netlify.app.</p></div>`;
  const G = grpState(), doc = S.grp.doc;
  if (!G) return `<div class="sec grp"><h3>Mesa compartida</h3><p class="lede">Arma tu grupo: cada uno publica sus mazos, las partidas se anotan una sola vez para todos y hay una tabla del grupo.</p>
    <div class="grp-form"><label>Tu nombre<input type="text" id="grp-me" placeholder="Ej: Juan" value="${esc(S.data.settings.nick||"")}" autocomplete="off"></label>
      <div class="grp-two"><div><label>Crear un grupo nuevo<input type="text" id="grp-name" placeholder="Nombre del grupo" autocomplete="off"></label><button class="btn primary" data-grp="create">Crear grupo</button></div>
      <div><label>Unirme con un código<input type="text" id="grp-code" placeholder="XXXX-XXXX-XXXX-XXXX" autocapitalize="characters" autocomplete="off"></label><button class="btn" data-grp="join">Unirme</button></div></div></div>
    ${S.grp.err?`<p class="down">${esc(S.grp.err)}</p>`:""}</div>`;
  if (!doc) return `<div class="sec grp"><h3>Mesa compartida</h3><p class="muted">${S.grp.busy?"Conectando con tu grupo…":S.grp.err?esc(S.grp.err):"Cargando…"}</p><button class="btn sm" data-grp="refresh">Reintentar</button></div>`;
  const members = Object.entries(doc.members||{});
  const decksBy = mid => Object.entries(doc.decks||{}).filter(([,d])=>d.mid===mid);
  const F = S.grp.f;
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
      <button class="btn primary" data-grp="save" ${F.winner?"":"disabled"}>Guardar partida para el grupo</button>`:`<p class="muted" style="margin:0">Elige el mazo de al menos dos jugadores.</p>`}
    </div>

    ${board.length?`<h4 class="td-h">Tabla del grupo</h4><div class="tbl-wrap"><table><thead><tr><th>Jugador</th><th class="n">Partidas</th><th class="n">Victorias</th></tr></thead><tbody>${board.map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${x.n}</td><td class="n">${x.w} · ${Math.round(100*x.w/x.n)}%</td></tr>`).join("")}</tbody></table></div>
      <h4 class="td-h">Por mazo</h4>${[...deckStat.entries()].sort((a,b)=>(b[1].w/b[1].n)-(a[1].w/a[1].n)).slice(0,12).map(([k,x])=>`<div class="rec"><span>${esc(deckName(k))}</span><span class="meta num">${x.w}/${x.n} · ${Math.round(100*x.w/x.n)}%</span></div>`).join("")}
      <h4 class="td-h">Últimas partidas</h4>${(doc.games||[]).slice(-8).reverse().map(g=>{ const w = g.players.find(p=>p.res==="win"); return `<div class="rec gm-item"><span><b>${w?esc((doc.members[w.mid]||{}).name||"?"):"Empate"}</b> ganó con ${w?esc(deckName(w.deck)):"—"}${g.turn?` · turno ${g.turn}`:""}<br><span class="muted" style="font-size:.85rem">${new Date(g.at).toLocaleDateString("es-CL",{day:"numeric",month:"short"})} · ${g.players.map(p=>esc((doc.members[p.mid]||{}).name||"?")).join(", ")}</span></span>${g.by===G.mid||g.players.some(p=>p.mid===G.mid)?`<button class="btn sm ghost" data-grp-del="${esc(g.id)}">Borrar</button>`:""}</div>`; }).join("")}`:""}
    <div class="row" style="margin-top:12px"><button class="btn sm ghost" data-grp="leave">Salir del grupo</button></div>
  </div>`;
}

document.addEventListener("click", async ev => {
  const g = k => ev.target.closest(`[data-grp-${k}]`); const F = S.grp.f; let b;
  if ((b = g("pl"))){ const [mid, key] = b.dataset.grpPl.split("|"); if (key) F.players[mid] = key; else { delete F.players[mid]; delete F.seats[mid]; if (F.winner===mid) F.winner = null; } render(); return; }
  if ((b = g("seat"))){ const [mid, s] = b.dataset.grpSeat.split("|"); for (const k of Object.keys(F.seats)) if (F.seats[k]===+s) delete F.seats[k]; F.seats[mid] = +s; render(); return; }
  if ((b = g("win"))){ F.winner = F.winner===b.dataset.grpWin ? null : b.dataset.grpWin; render(); return; }
  if ((b = g("turn"))){ F.turn = Math.max(1, Math.min(30, F.turn + (+b.dataset.grpTurn))); render(); return; }
  if ((b = g("how"))){ F.how = F.how===b.dataset.grpHow ? null : b.dataset.grpHow; render(); return; }
  if ((b = g("del"))){ try { S.grp.doc = await grpCall("POST", {op:"delgame", gid:b.dataset.grpDel}); toast("Partida borrada del grupo."); } catch(e){ toast(e.message); } render(); return; }
  b = ev.target.closest("[data-grp]"); if (!b) return;
  const act = b.dataset.grp;
  if (act==="create" || act==="join"){
    const me = String(($("#grp-me")||{}).value||"").trim(); if (!me){ toast("Escribe tu nombre para el grupo."); return; }
    const code = act==="create" ? syNewCode() : syNorm(($("#grp-code")||{}).value);
    if (code.replace(/-/g,"").length < 12){ toast("Revisa el código: son 16 letras y números."); return; }
    S.data.settings.nick = me; S.data.group = {code, mid: (S.data.group && S.data.group.mid) || uid(), name: me}; saveData();
    try { S.grp.doc = await grpCall("POST", {op:"join", name:me, group: act==="create" ? String(($("#grp-name")||{}).value||"Mi grupo").trim() : ""}); await grpPublish(true); S.grp.show = act==="create"; toast(act==="create" ? "Grupo creado. Copia la invitación y mándala a tu grupo." : "Te uniste al grupo."); }
    catch(e){ S.data.group = null; saveData(); S.grp.err = e.message==="no existe" ? "No encontré un grupo con ese código." : e.message; }
    render(); return;
  }
  if (act==="refresh"){ await grpRefresh(); return; }
  if (act==="show"){ S.grp.show = !S.grp.show; render(); return; }
  if (act==="link"){ copyText(`Únete a mi grupo en la Bóveda EDH: ${location.origin}/#grupo=${grpState().code.replace(/-/g,"")}`); return; }
  if (act==="leave"){ try { await grpCall("POST", {op:"leave"}); } catch {} S.data.decks = S.data.decks.filter(d=>!(d.rival && d.rival.group)); S.data.group = null; S.grp.doc = null; saveData(); render(); toast("Saliste del grupo."); return; }
  if (act==="save"){
    const G = grpState(); const mids = Object.keys(F.players); if (mids.length < 2 || !F.winner) return;
    const game = {id:uid(), at:Date.now(), turn:F.turn, how:F.how, players: mids.map(mid=>({mid, deck:F.players[mid], seat:F.seats[mid]||null, res: F.winner==="draw" ? "draw" : F.winner===mid ? "win" : "loss"}))};
    try { S.grp.doc = await grpCall("POST", {op:"game", game}); S.grp.f = {players:F.players, seats:{}, winner:null, turn:F.turn, how:null}; toast("Partida guardada para todo el grupo."); }
    catch(e){ toast("No se pudo guardar: " + e.message); }
    render(); return;
  }
});
// invitación por enlace: #grupo=CODIGO (se completa el código y se pide el nombre)
if (typeof LIVE!=="undefined" && LIVE){
  const m = location.hash.match(/^#grupo=([A-Za-z0-9-]{12,})/);
  if (m){ history.replaceState(null, "", location.pathname); S.grpInvite = syNorm(m[1]); setTimeout(()=>{ S.view="commander"; S.showMeta.commander="local"; S.sel.commander=null; render(); const i = $("#grp-code"); if (i) i.value = S.grpInvite; toast("Escribe tu nombre y toca “Unirme”."); }, 300); }
  if (S.data.group) setTimeout(grpRefresh, 1200);
}
