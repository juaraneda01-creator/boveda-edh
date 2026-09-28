/* =========================================================
   Bóveda EDH — Partida en vivo
   Contador de vidas para la mesa: vida, veneno, daño de
   comandante y turno, pensado para el teléfono al centro de la
   mesa. Al terminar, la partida queda anotada sola (resultado,
   turno, asientos, cómo terminó) en tus mazos y, si todos los
   mazos son del grupo, también en la Mesa compartida.
   ========================================================= */
const MATCH_KEY = "boveda-edh:partida";
S.match = S.match || (()=>{ try { return lsGet(MATCH_KEY, null); } catch { return null; } })();
function matchSave(){ try { lsSet(MATCH_KEY, S.match); } catch {} }

function matchNew(decks){
  const isC = decks.every(d=>(d.format||"commander")==="commander");
  S.match = {at:Date.now(), turn:1, life:isC?40:20, isC, active:0, log:[], done:null,
    players: decks.map((d, i)=>({deck:d.id, name:d.rival ? (d.rival.owner||"Amigo") : decks.filter(x=>!x.rival).length > 1 ? d.name : (S.data.settings.nick||"Tú"), deckName:d.name, cmd:(d.commanders||[]).join(" + "), life:isC?40:20, poison:0, cd:{}, out:null, seat:i+1}))};
  matchSave(); S.view = "match"; render(); window.scrollTo(0,0);
}
const matchAlive = M => M.players.filter(p=>!p.out);
// quien queda fuera: vida 0, 10 de veneno o 21 de un mismo comandante
function matchCheck(M, by){
  for (const p of M.players){
    if (p.out) continue;
    const cmd = Object.entries(p.cd).find(([,v])=>v>=21);
    const how = p.life<=0 ? "life" : p.poison>=10 ? "poison" : cmd ? "cmdr" : null;
    if (how){ p.out = {how, turn:M.turn, by: how==="cmdr" ? +cmd[0] : by}; M.log.push({t:M.turn, s:`${p.name} queda fuera (${{life:"sin vida",poison:"10 de veneno",cmdr:"21 de comandante"}[how]})`}); }
  }
  const alive = matchAlive(M);
  if (alive.length<=1 && !M.done){
    const w = alive[0] || null;
    // cómo ganó: por lo que sacó al último rival
    const last = M.players.filter(p=>p.out).sort((a,b)=>b.out.turn-a.out.turn)[0];
    M.done = {winner: w ? M.players.indexOf(w) : -1, turn:M.turn, how: last ? ({life:"combat", poison:"alt", cmdr:"cmdr"}[last.out.how]) : null};
  }
}
function matchHTML(){
  const M = S.match;
  if (!M) return `<div class="sec"><h3>Partida en vivo</h3><p class="lede">Elige los mazos en “Mesa de hoy” y toca “Jugar esta mesa”.</p><button class="btn primary" data-home="mesa">Ir a Mesa de hoy</button></div>`;
  const others = i => M.players.map((q,j)=>({q,j})).filter(x=>x.j!==i);
  const card = (p, i) => `<section class="mt-p ${p.out?"out":""} ${M.active===i && !M.done?"act":""}" style="--seat:${i}">
    <div class="mt-h"><b>${esc(p.name)}</b><span class="muted">${esc(p.deckName)}</span></div>
    <div class="mt-life"><button class="mt-b" data-mt="life" data-i="${i}" data-v="-1" aria-label="Menos 1 de vida a ${esc(p.name)}" ${p.out?"disabled":""}>−</button><b class="num" aria-live="polite">${p.life}</b><button class="mt-b" data-mt="life" data-i="${i}" data-v="1" aria-label="Más 1 de vida a ${esc(p.name)}" ${p.out?"disabled":""}>+</button></div>
    <div class="mt-row"><button class="btn sm" data-mt="life" data-i="${i}" data-v="-5" ${p.out?"disabled":""}>−5</button><button class="btn sm" data-mt="life" data-i="${i}" data-v="5" ${p.out?"disabled":""}>+5</button>
      <span class="mt-psn">Veneno <button class="btn sm ghost" data-mt="psn" data-i="${i}" data-v="-1" aria-label="Menos veneno" ${p.out?"disabled":""}>−</button><b class="num">${p.poison}</b><button class="btn sm ghost" data-mt="psn" data-i="${i}" data-v="1" aria-label="Más veneno" ${p.out?"disabled":""}>+</button></span></div>
    ${M.isC?`<div class="mt-cd"><small class="sc">daño de comandante recibido</small>${others(i).map(({q,j})=>`<button class="chip" data-mt="cd" data-i="${i}" data-from="${j}" ${p.out?"disabled":""} title="Toca para sumar 1 del comandante de ${esc(q.name)} (también resta 1 de vida)">${esc(String(q.cmd||q.deckName).split(/[,+]/)[0].trim().slice(0,16))} <b class="num">${p.cd[j]||0}</b></button>`).join("")}
      ${Object.values(p.cd).some(v=>v>0)&&!p.out?`<button class="btn sm ghost" data-mt="cdundo" data-i="${i}" title="Deshacer el último daño de comandante">↶</button>`:""}</div>`:""}
    ${p.out?`<p class="mt-out">Fuera en el turno ${p.out.turn} · ${{life:"sin vida",poison:"veneno",cmdr:"daño de comandante"}[p.out.how]} <button class="btn sm ghost" data-mt="revive" data-i="${i}">Volver</button></p>`:""}
  </section>`;
  const W = M.done && M.done.winner>=0 ? M.players[M.done.winner] : null;
  return `<div class="mt">
    <div class="mt-top"><button class="btn sm ghost" data-mt="exit">← Salir</button>
      <div class="gm-step"><span class="muted">Turno</span><button class="btn sm" data-mt="turn" data-v="-1" aria-label="Turno anterior">−</button><b class="num">${M.turn}</b><button class="btn sm primary" data-mt="turn" data-v="1" aria-label="Siguiente turno">+</button></div>
      <button class="btn sm ghost" data-mt="reset">Reiniciar</button></div>
    ${M.done?`<div class="banner info mt-done"><span>${W?`<b>${esc(W.name)} gana</b> con ${esc(W.deckName)} en el turno ${M.done.turn}.`:"Nadie quedó en pie: empate."} ¿La anoto?</span>
      <div class="row">${matchHowChips(M)}</div>
      <div class="row"><button class="btn primary" data-mt="save" ${M.saved?"disabled":""}>${M.saved?"Anotada":"Anotar partida"}</button>${matchGroupOk(M)?`<span class="muted" style="font-size:.88rem">Todos los mazos son del grupo: queda anotada para todos.</span>`:""}</div></div>`:""}
    <div class="mt-grid n${M.players.length}">${M.players.map(card).join("")}</div>
    ${M.log.length?`<details class="mt-log"><summary class="muted">Historial (${M.log.length})</summary>${M.log.slice(-20).reverse().map(l=>`<div><span class="num muted">T${l.t}</span> ${esc(l.s)}</div>`).join("")}</details>`:""}
    <p class="foot">La partida se guarda en este teléfono mientras juegas: si cierras la app, sigue donde quedó. Toca “+” en Turno al pasar a la siguiente vuelta de la mesa.</p>
  </div>`;
}
function matchHowChips(M){
  const cur = M.done.how;
  return GAME_HOW.map(([k,es])=>`<button class="chip" data-mt="how" data-v="${k}" aria-pressed="${cur===k}">${es}</button>`).join("");
}
// ¿se puede anotar en el grupo? todos los mazos tienen que estar publicados allá
function matchGroupKey(d){
  const G = typeof grpState==="function" ? grpState() : null, doc = S.grp && S.grp.doc; if (!G || !doc) return null;
  const k = d.rival ? (d.rival.gkey||null) : G.mid + ":" + d.id;
  return k && Object.hasOwn(doc.decks||{}, k) ? {k, mid: doc.decks[k].mid} : null;
}
function matchGroupOk(M){
  const ks = M.players.map(p=>{ const d = S.data.decks.find(x=>x.id===p.deck); return d ? matchGroupKey(d) : null; });
  return ks.every(Boolean) && new Set(ks.map(k=>k.mid)).size === ks.length ? ks : null;
}
async function matchSaveGame(){
  const M = S.match; if (!M || !M.done || M.saved) return;
  const res = i => M.done.winner<0 ? "draw" : M.done.winner===i ? "win" : "loss";
  const grp = matchGroupOk(M);
  if (grp){
    const game = {id:uid(), at:M.at, turn:M.done.turn, how:M.done.how, players: M.players.map((p,i)=>({mid:grp[i].mid, deck:grp[i].k, seat:p.seat, res:res(i)}))};
    try { S.grp.doc = await grpCall("POST", {op:"game", game}); M.saved = true; matchSave(); render(); toast("Partida anotada para todo el grupo."); return; }
    catch(e){ toast("No se pudo anotar en el grupo (" + e.message + "). La anoto solo en tus mazos."); }
  }
  // tus mazos: una partida por cada uno que jugó
  let n = 0;
  M.players.forEach((p, i)=>{ const d = S.data.decks.find(x=>x.id===p.deck); if (!d || d.rival) return;
    const opp = M.players.filter((_,j)=>j!==i).map(q=>{ const od = S.data.decks.find(x=>x.id===q.deck); return od ? ((od.commanders||[]).join(" + ") || od.name) : q.deckName; });
    S.data.games = [...(S.data.games||[]), {id:uid(), at:M.at, deck:d.id, res:res(i), turn:M.done.turn, how:M.done.how, seat:p.seat, opp, note:"partida en vivo"}]; n++; });
  M.saved = true; matchSave(); saveData(); render();
  toast(n ? `Partida anotada en ${n} mazo${n>1?"s":""} tuyo${n>1?"s":""}.` : "Ningún mazo es tuyo: la partida no se anotó.");
}

document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-mt]"); if (!b) return;
  const M = S.match; const act = b.dataset.mt; const i = +b.dataset.i, v = +b.dataset.v;
  if (act==="play"){ const decks = typeof mesaDecks==="function" ? mesaDecks() : []; if (decks.length < 2){ toast("Elige al menos dos mazos en Mesa de hoy."); return; }
    if (S.match && !S.match.done && !confirm("Hay una partida en curso. ¿Empezar otra?")) { S.view = "match"; render(); return; }
    matchNew(decks); return; }
  if (act==="resume"){ S.view = "match"; render(); window.scrollTo(0,0); return; }
  if (!M) return;
  const p = M.players[i];
  if (act==="exit"){ S.view = "commander"; S.showMeta.commander = "local"; render(); return; }
  if (act==="reset"){ if (!confirm("¿Borrar esta partida y volver a empezar con los mismos mazos?")) return; const decks = M.players.map(q=>S.data.decks.find(x=>x.id===q.deck)).filter(Boolean); if (decks.length>=2) matchNew(decks); else { S.match = null; matchSave(); render(); } return; }
  if (act==="turn"){ M.turn = Math.max(1, Math.min(40, M.turn + v)); if (M.done && !M.saved) M.done.turn = M.turn; }
  else if (act==="life" && p && !p.out){ p.life += v; if (v<0) M.log.push({t:M.turn, s:`${p.name} ${v} de vida (${p.life})`}); matchCheck(M); }
  else if (act==="psn" && p && !p.out){ p.poison = Math.max(0, p.poison + v); matchCheck(M); }
  else if (act==="cd" && p && !p.out){ const f = +b.dataset.from; p.cd[f] = (p.cd[f]||0) + 1; p.life -= 1; p.cdLast = f; M.log.push({t:M.turn, s:`${M.players[f].name} pega 1 de comandante a ${p.name} (${p.cd[f]})`}); matchCheck(M, f); }
  else if (act==="cdundo" && p && p.cdLast!=null && p.cd[p.cdLast]){ p.cd[p.cdLast]--; p.life++; p.cdLast = null; }
  else if (act==="revive" && p){ p.out = null; if (p.life<=0) p.life = 1; if (p.poison>=10) p.poison = 9; for (const k of Object.keys(p.cd)) if (p.cd[k]>=21) p.cd[k] = 20; if (!M.saved) M.done = null; }
  else if (act==="how" && M.done){ M.done.how = M.done.how===b.dataset.v ? null : b.dataset.v; }
  else if (act==="save"){ await matchSaveGame(); return; }
  matchSave(); render();
});
