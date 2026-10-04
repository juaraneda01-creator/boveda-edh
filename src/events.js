/* =========================================================
   Bóveda EDH v3 — eventos y arranque
   ========================================================= */
const pv = () => $("#preview");
document.addEventListener("mouseover", e=>{ const t=e.target.closest("[data-img]"); if(!t || S.modal || matchMedia("(hover: none)").matches) return; const p=pv(); p.src=t.dataset.img; p.hidden=false; });
document.addEventListener("mousemove", e=>{ const p=pv(); if (p.hidden) return; const w=244, h=340; let x=e.clientX+18, y=e.clientY-h/2; if (x+w>innerWidth-8) x=e.clientX-w-18; y=Math.max(8,Math.min(innerHeight-h-8,y)); p.style.left=x+"px"; p.style.top=y+"px"; });
document.addEventListener("mouseout", e=>{ if (e.target.closest("[data-img]")) pv().hidden=true; });

const curDeck = () => { const f=fmtOfView(); return f ? S.data.decks.find(x=>x.id===S.sel[f]) : null; };
function applySwap(d, out, inn, src){
  const has = k => (d[k]||[]).some(c=>slug(c.n)===slug(out));
  const key = has("cards") ? "cards" : has("side") ? "side" : "maybe";
  const cards = (d[key]||[]).map(c=>({...c}));
  const k = cards.findIndex(c=>slug(c.n)===slug(out)); if (k<0){ toast(`"${out}" ya no está en la lista.`); return; }
  if (cards[k].q>1) cards[k].q--; else cards.splice(k,1);
  const j = cards.findIndex(c=>slug(c.n)===slug(inn)); if (j>=0) cards[j].q++; else cards.push({n:inn,q:1});
  saveDeck({...d, [key]:cards}, {src}); toast(`Cambiado: ${out} → ${inn}.`);
  if (!cardOf(inn)) fetchCards([inn],{quiet:true});
}
// datos de cartas (Scryfall) que trae un respaldo: se quedan los más recientes de cada carta
function mergeCardData(cd){
  if (!cd || typeof cd!=="object") return 0; let n=0;
  for (const [k,c] of Object.entries(cd.cards||{})){ if (!c || !c.n) continue; const cur=S.cards[k]; if (!cur || (c.at||0) >= (cur.at||0)){ S.cards[k]=c; n++; } }
  for (const [k,h] of Object.entries(cd.hist||{})){ if (!Array.isArray(h)) continue; const m=new Map(h.filter(x=>Array.isArray(x)&&x.length===2)); for (const [d,v] of (S.hist[k]||[])) m.set(d,v); S.hist[k]=[...m.entries()].sort((a,b)=>a[0]<b[0]?-1:1).slice(-200); }
  if (Array.isArray(cd.gc) && cd.gc.length>20 && (!S.gcAt || (cd.gcAt||0) > S.gcAt)){ S.gc = new Set(cd.gc); S.gcAt = cd.gcAt||Date.now(); try{ idb.set("gc",{at:S.gcAt, list:cd.gc}); }catch{} }
  if (n) saveCaches();
  return n;
}
function download(filename, text, type="text/plain"){
  if (typeof accDownload==="function" && accDownload(filename, text, type)) return;
  const url = URL.createObjectURL(text instanceof Blob ? text : new Blob([text],{type:type+";charset=utf-8"}));
  const a = document.createElement("a"); a.href=url; a.download=filename; document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
async function copyText(t){ try{ await navigator.clipboard.writeText(t); toast("Copiado."); }catch{ const ta=document.createElement("textarea"); ta.value=t; document.body.append(ta); ta.select(); try{document.execCommand("copy"); toast("Copiado.");}catch{toast("No se pudo copiar.");} ta.remove(); } }
function addWish(name, target, pk, finish){
  if (!name) return false;
  if (S.data.wishlist.some(w=>slug(w.n)===slug(name) && (w.pk||"")===(pk||"") && (w.finish||"")===(finish||""))){ toast(`${name} ya está en tu lista de búsqueda.`); return false; }
  const w = {n:name, target: target!=null && target!=="" && !isNaN(target) ? +target : null, added:Date.now()};
  if (pk){ w.pk=pk; if (finish && finish!=="normal") w.finish=finish; }
  S.data.wishlist.push(w); saveData(); return true;
}
const deckNames = allNames;
function moveCard(d, name, from, to){
  const src=(d[from]||[]).map(c=>({...c})), dst=(d[to]||[]).map(c=>({...c}));
  const k=src.findIndex(c=>slug(c.n)===slug(name)); if (k<0) return;
  const {q, n:nm}=src[k]; src.splice(k,1);
  const j=dst.findIndex(c=>slug(c.n)===slug(name)); if (j>=0) dst[j].q+=q; else dst.push({n:nm, q});
  saveDeck({...d, [from]:src, [to]:dst}); toast(`${name} movida a ${{cards:"main",side:"sideboard",maybe:"maybeboard"}[to]}.`);
}

/* ---------- carpetas de venta ---------- */
function newBinder(name, items){ return {id:uid(), name:name||"Carpeta de venta", items, sales:[], pricing:{src:"ck", pct:100, min:0, clp:true, round:100, syncColl:true, v2:true}, created:Date.now(), updated:Date.now()}; }
function parseBinder(text){ return parseList(text).filter(c=>!c.maybe).map(c=>({...cleanItem(c), _bn:c.binder||""})); }
async function afterBinderImport(items){
  if (!S.data.settings.autoFetch || !items.length) return;
  await fetchItems(items.filter(i=>pkOf(i)), {label:"Trayendo precios de la carpeta"});
  await fetchCards(items.map(i=>i.n), {label:"Trayendo datos de las cartas", quiet:true});
  snapshotPrices(); render();
}
async function importBinderFiles(files){
  const created=[]; const all=[];
  for (const f of files){
    const items = parseBinder(await f.text()); if (!items.length) continue;
    const groups = new Map(); for (const it of items){ const k=it._bn||""; if(!groups.has(k)) groups.set(k,[]); const {_bn, ...clean}=it; groups.get(k).push(clean); }
    const base = f.name.replace(/\.(csv|txt)$/i,"");
    for (const [bn, arr] of groups){ const b=newBinder(bn || base, arr); S.data.binders.push(b); created.push(b); all.push(...arr); }
  }
  if (!created.length){ toast("No encontré cartas en los archivos."); return; }
  S.binderSel = created[0].id; saveData(); render();
  toast(created.length>1 ? `Se crearon ${created.length} carpetas: ${created.map(b=>b.name).join(", ")}.` : `Carpeta “${created[0].name}” creada con ${created[0].items.reduce((a,i)=>a+i.q,0)} cartas.`);
  await afterBinderImport(all);
}
function sellOne(b, i){
  const it=b.items[i]; if (!it) return;
  const L=binderLine(b,it);
  const sale={n:it.n, set:it.set||"", num:it.num||"", foil:it.foil||"", cond:it.cond||"", lang:it.lang||"", sid:it.sid||"", q:1, price:L.fin, at:Date.now()};
  if (b.pricing.syncColl){
    const items=S.data.collection.items; const k=collKey(it);
    let j=items.findIndex(x=>collKey(x)===k);
    if (j<0) j=items.findIndex(x=>slug(x.n)===slug(it.n) && (x.set||"")===(it.set||"") && (x.foil||"")===(it.foil||""));
    if (j<0) j=items.findIndex(x=>slug(x.n)===slug(it.n));
    if (j>=0){ sale.coll={...items[j], q:1}; items[j].q--; if (items[j].q<=0) items.splice(j,1); touchColl(); }
  }
  it.q--; if (it.q<=0) b.items.splice(i,1);
  b.sales.unshift(sale); b.updated=Date.now(); saveData();
  toast(`Vendida: ${sale.n} a ${showPrice(b, sale.price)}.${sale.coll?" Se descontó de tu colección.":""}`); render();
}
function undoSale(b){
  const s0=b.sales.shift(); if (!s0) return;
  const back={n:s0.n, q:1}; for (const k of ["set","num","foil","cond","lang","sid"]) if (s0[k]) back[k]=s0[k];
  const j=b.items.findIndex(x=>collKey(x)===collKey(back)); if (j>=0) b.items[j].q++; else b.items.push(back);
  if (s0.coll){ const items=S.data.collection.items; const k=collKey(s0.coll); const c=items.findIndex(x=>collKey(x)===k); if (c>=0) items[c].q++; else items.push({...s0.coll}); touchColl(); }
  saveData(); toast(`Venta deshecha: ${s0.n} volvió a la carpeta.`); render();
}

document.addEventListener("click", async ev=>{
  if (ev.target.classList.contains("modal-bg") || ev.target.closest("button[data-close]")){ S.modal=null; renderModal(); return; }
  const cn = ev.target.closest(".cn[data-card]");
  if (cn){ pv().hidden=true; openCard(cn.dataset.card); return; }
  if (S.settingsOpen && !ev.target.closest("#settings") && ev.target.id!=="btn-settings"){ S.settingsOpen=false; renderSettings(); }
  const b = ev.target.closest("button"); if(!b) return;
  if (b.id==="btn-settings"){ S.settingsOpen=!S.settingsOpen; renderSettings(); return; }
  if (b.dataset.view){ S.view=b.dataset.view; S.editing=null; S.confirmDel=false; render(); window.scrollTo(0,0); return; }
  if (b.dataset.cur){ S.data.settings.cur=b.dataset.cur; saveData(); render(); return; }
  if (b.dataset.deck){ const f=fmtOfView(); S.sel[f]=b.dataset.deck; S.showMeta[f]=false; S.editing=null; S.confirmDel=false; S.targetBracket=null; render(); return; }
  if (b.dataset.open){ const d=S.data.decks.find(x=>x.id===b.dataset.open); if(!d) return; S.view=d.format; S.sel[d.format]=d.id; S.showMeta[d.format]=false; S.deckTab="lista"; render(); return; }
  if (b.dataset.sub){ S.deckTab=b.dataset.sub; render(); return; }
  if (b.dataset.mtab){ S.marketTab=b.dataset.mtab; render(); return; }
  if (b.dataset.budget){ S.optBudget=b.dataset.budget; render(); return; }
  if (b.dataset.bracket){ S.targetBracket=+b.dataset.bracket; render(); return; }
  if (b.dataset.dismiss){ S.data.dismissed[b.dataset.dismiss]=Date.now(); saveData(); render(); return; }
  if (b.dataset.wishv){ const n=S.modal&&S.modal.name; const m=cardOf(n); if (addWish(m?m.n:n, null, b.dataset.wishv, b.dataset.fin)){ const w=S.data.wishlist[S.data.wishlist.length-1]; recordHist(wishKey(w), wishPrice(w)); saveCaches(); toast("Versión agregada a tu lista de búsqueda. Ponle un precio objetivo en Mercado."); } renderModal(); render(); return; }
  if (b.dataset.role){ const n=S.modal&&S.modal.name; const m=cardOf(n); if(!m) return; const k=slug(m.n); const cur0=new Set(m.r||[]); cur0.has(b.dataset.role)?cur0.delete(b.dataset.role):cur0.add(b.dataset.role); S.data.roles[k]=[...cur0]; if (slug(n)!==k) S.data.roles[slug(n)]=[...cur0]; saveData(); simCache.clear(); renderModal(); render(); return; }
  if (b.dataset.bulk){ const sel=[...(S.picked||[])].filter(i=>S.data.collection.items.includes(i)); const act=b.dataset.bulk;
    if (act==="sell"||act==="unsell"){ for (const it of sel){ if (act==="sell") it.sell=true; else delete it.sell; } saveData(); toast(act==="sell"?`${sel.length} marcadas para vender. Aparecen primero en Mercado → Comprar y vender.`:"Marca quitada."); }
    else if (act==="del") S.bulkDel=true;
    else if (act==="del-no") S.bulkDel=false;
    else if (act==="del-ok"){ const set=new Set(sel); S.data.collection.items=S.data.collection.items.filter(i=>!set.has(i)); touchColl(); saveData(); S.picked=new Set(); S.bulkDel=false; toast(`${sel.length} registros eliminados de la colección.`); }
    else if (act==="none"){ S.picked=new Set(); S.bulkDel=false; }
    render(); return; }
  if (b.dataset.binder){ S.binderSel=b.dataset.binder; S.bDel=false; S.bReplace=null; render(); return; }
  { const bn=S.data.binders.find(x=>x.id===S.binderSel);
    if (b.dataset.bview){ S.bView=b.dataset.bview; render(); return; }
    if (bn && b.dataset.bedit!=null){ S.bEdit = S.bEdit===+b.dataset.bedit ? null : +b.dataset.bedit; render(); const el=document.querySelector(`[data-bask="${b.dataset.bedit}"]`); if (el) el.focus(); return; }
    if (bn && b.dataset.bsrc){ bn.pricing.src=b.dataset.bsrc; saveData(); render(); return; }
    if (bn && b.dataset.bsold!=null){ sellOne(bn, +b.dataset.bsold); return; }
    if (bn && b.dataset.bdel!=null){ bn.items.splice(+b.dataset.bdel,1); bn.updated=Date.now(); saveData(); render(); return; } }
  if (b.dataset.wdel!=null){ S.data.wishlist.splice(+b.dataset.wdel,1); saveData(); render(); return; }
  const d = curDeck();
  if (b.dataset.move && d){ const [from,to]=b.dataset.move.split(">"); moveCard(d, b.dataset.card2, from, to); return; }
  if (b.dataset.swapOut && d){ applySwap(d, b.dataset.swapOut, b.dataset.swapIn, S.deckTab==="brackets"?"bracket":"optimizador"); return; }
  if (b.dataset.dq!=null){
    const items=S.data.collection.items; const i=+b.dataset.dq; if (!items[i]) return;
    items[i].q+=+b.dataset.d; if(items[i].q<=0) items.splice(i,1);
    touchColl(); saveData(); render(); return;
  }
  const f = fmtOfView();
  switch(b.dataset.act){
    case "coll-more": S.collShow=(S.collShow||150)+150; render(); break;
    case "new": S.editing={format:f||"commander", name:"", commanders:[], text:""}; S.showMeta[f]=false; render(); $("#f-name")&&$("#f-name").focus(); break;
    case "show-meta": S.showMeta[f]=true; S.editing=null; render(); break;
    case "edit": S.editing={id:d.id, format:d.format, name:d.name, commanders:d.commanders||[], text:listText(d.cards), side:listText(d.side), maybe:listText(d.maybe)}; S.confirmDel=false; render(); break;
    case "cancel": S.editing=null; render(); break;
    case "askdel": S.confirmDel=true; render(); break;
    case "nodel": S.confirmDel=false; render(); break;
    case "del": if (S.data.group && !d.rival) S.data.grpDel=[...new Set([...(S.data.grpDel||[]), d.id])].slice(-200); S.data.decks=S.data.decks.filter(x=>x.id!==d.id); S.sel[f]=null; S.confirmDel=false; saveData(); render(); break;
    case "fetch": await fetchCards(deckNames(d)); break;
    case "refresh-deck": await fetchCards(deckNames(d), {force:true, label:"Actualizando precios"}); snapshotPrices(); render(); break;
    case "combos": if (d) await loadCombos(d); break;
    case "edhrec": await loadEdhrec(d, !!edhOf(d)); break;
    case "load-gc": await fetchCards(GC_FALLBACK, {label:"Trayendo Game Changers"}); break;
    case "prompt": copyText(claudePrompt(d, analyze(d))); break;
    case "copylist": copyText(deckText(d)); break;
    case "copyside": copyText(listText(d.side)); break;
    case "copymaybe": copyText(listText(d.maybe)); break;
    case "wish-maybe": { let n=0; for (const m of analyze(d).maybeInfo.miss){ if (addWish(m.n,null)) n++; } toast(`${n} cartas del maybeboard agregadas a tu lista de búsqueda.`); render(); break; }
    case "dllist": download(`${d.name}.txt`, deckText(d)); break;
    case "copymiss": copyText(analyze(d).missingCards.map(m=>`${m.q} ${m.n}`).join("\n")); break;
    case "wish-missing": { const miss=analyze(d).missingCards; let n=0; for (const m of miss){ if (!S.data.wishlist.some(w=>slug(w.n)===slug(m.n))){ S.data.wishlist.push({n:m.n,target:null,added:Date.now()}); n++; } } saveData(); toast(`${n} cartas agregadas a tu lista de búsqueda.`); render(); break; }
    case "fetch-meta": { const a=metaDecks(d.format).find(x=>x.name===b.dataset.arch); if (a) await fetchCards([...a.main,...a.side].map(c=>c.n),{label:"Trayendo cartas del meta"}); break; }
    case "fetch-meta-all": await fetchCards(metaDecks(f).flatMap(a=>[...a.main,...a.side].map(c=>c.n)),{label:"Trayendo cartas del meta"}); break;
    case "meta-create": { const a=metaDecks(f).find(x=>x.name===b.dataset.arch); if(!a) break; const nd={id:uid(), format:f, name:`${a.name} (meta)`, commanders:[], cards:a.main.map(c=>({n:c.n,q:c.q})), side:a.side.map(c=>({n:c.n,q:c.q})), maybe:[], log:[{at:Date.now(),src:"meta",add:[...a.main,...a.side].map(c=>({n:c.n,q:c.q})),rem:[]}], created:Date.now()}; saveDeck(nd,{silent:true,noLog:true}); S.sel[f]=nd.id; S.showMeta[f]=false; S.deckTab="analisis"; render(); if (S.data.settings.autoFetch){ await fetchCards(deckNames(nd)); await fetchCheapest(deckNames(nd)); } break; }
    case "cedh-live": await loadCedhLive(); break;
    case "fetch-staples": await fetchCards(Object.values(CEDH_STAPLES).flat(),{label:"Trayendo piezas de cEDH"}); break;
    case "coll-fetch": { const items=S.data.collection.items; await fetchItems(items.filter(i=>pkOf(i))); await fetchCards(items.map(i=>i.n),{label:"Trayendo datos de tu colección"}); snapshotPrices(); render(); break; }
    case "coll-add": { const p=parseList($("#coll-text").value); if(!p.length){toast("No encontré cartas en el texto.");break;}
      const base=S.data.collection.items;
      for (const c of p){ const k=base.findIndex(i=>collKey(i)===collKey(c)); if(k>=0) base[k].q+=c.q; else base.push(cleanItem(c)); }
      touchColl(); saveData(); $("#coll-text").value=""; toast(`Agregadas ${p.reduce((a,c)=>a+c.q,0)} cartas.`); render();
      if (S.data.settings.autoFetch){ await fetchItems(p.filter(i=>pkOf(i))); await fetchCards(p.map(c=>c.n),{label:"Trayendo datos de las cartas nuevas"}); snapshotPrices(); render(); } break; }
    case "mb-sync": { const t=$("#coll-text").value; const p=parseList(t); if(!p.length){ toast("Pega o abre primero el CSV exportado de ManaBox."); break; }
      S.mbPreview={items:p.map(cleanItem), diff:diffCollection(S.data.collection.items, p.map(cleanItem))}; render(); break; }
    case "mb-sync-no": S.mbPreview=null; render(); break;
    case "mb-sync-ok": { const mp=S.mbPreview; if(!mp) break;
      const sell = new Set((S.data.collection.items||[]).filter(i=>i.sell).map(collKey)); for (const it of mp.items) if (sell.has(collKey(it))) it.sell = true;
      S.data.collection={items:mp.items, v:(S.data.collection.v||0)+1}; bumpAnalysis();
      S.data.mbLog.unshift({at:Date.now(), a:mp.diff.added.reduce((a,x)=>a+x.q,0), r:mp.diff.removed.reduce((a,x)=>a+x.q,0), c:mp.diff.changed.length}); S.data.mbLog=S.data.mbLog.slice(0,50);
      S.mbPreview=null; saveData(); toast("Colección sincronizada con ManaBox."); render();
      if (S.data.settings.autoFetch){ await fetchItems(mp.items.filter(i=>pkOf(i))); await fetchCards(mp.items.map(i=>i.n),{label:"Trayendo datos de tu colección"}); snapshotPrices(); render(); } break; }
    case "coll-mb-csv": download("boveda-coleccion-manabox.csv", toManaBoxCSV(S.data.collection.items), "text/csv"); break;
    case "coll-dl": download("coleccion.txt", (S.data.collection.items||[]).map(i=>`${i.q} ${i.n}${i.set?` (${i.set})${i.num?" "+i.num:""}`:""}${i.foil==="foil"?" *F*":i.foil==="etched"?" *E*":""}`).join("\n")); break;
    case "mb-deck-compare": { const t=$("#mb-deck-text").value; const p=parseList(t,{keepSide:d.format!=="commander"}); if(!p.length){ toast("Pega o abre primero la exportación del mazo."); break; }
      const next = splitDeck(p, d.format, d.commanders);
      const bd = boardDiff(boardsOf(d), {main:next.cards, side:next.side, maybe:next.maybe});
      const dc = diffLists((d.commanders||[]).map(n=>({n,q:1})), (next.commanders.length?next.commanders:d.commanders).map(n=>({n,q:1})));
      S.deckMbPreview={id:d.id, next, bd, cmd:dc}; render(); break; }
    case "mb-deck-cancel": S.deckMbPreview=null; render(); break;
    case "mb-deck-apply": { const pvw=S.deckMbPreview; if(!pvw) break; const nd={...d, cards:pvw.next.cards, side:pvw.next.side, maybe:pvw.next.maybe, commanders:pvw.next.commanders.length?pvw.next.commanders:d.commanders};
      nd.mb={at:(d.mb&&d.mb.at)||Date.now(), sync:Date.now(), base:boardsOf(nd)};
      saveDeck(nd, {src:"manabox"});
      S.deckMbPreview=null; toast("Mazo actualizado desde ManaBox."); if (S.data.settings.autoFetch) await fetchCards(allNames(nd),{quiet:true}); render(); break; }
    case "mb-copy-changes": { const bd=boardDiff(mbBase(d.mb), boardsOf(d)); const L={main:"Main",side:"Sideboard",maybe:"Maybeboard"}; const out=[];
      for (const k of ["main","side","maybe"]){ const x=bd[k]; if (!x.add.length && !x.rem.length) continue; out.push(`== ${L[k]} ==`); if (x.add.length) out.push("Agregar:", ...x.add.map(c=>`${c.q} ${c.n}`)); if (x.rem.length) out.push("Quitar:", ...x.rem.map(c=>`${c.q} ${c.n}`)); out.push(""); }
      copyText(out.join("\n").trim()); break; }
    case "mb-mark-synced": saveDeck({...d, mb:{...d.mb, sync:Date.now(), base:boardsOf(d)}}, {noLog:true}); toast("Marcado como sincronizado con ManaBox."); break;
    case "mb-link-now": saveDeck({...d, mb:{at:Date.now(), sync:Date.now(), base:boardsOf(d)}}, {noLog:true}); break;
    case "load-ck": await loadCK(); break;
    case "binder-paste": { const t=$("#binder-text").value; const items=parseBinder(t).map(({_bn,...c})=>c); if(!items.length){ toast("No encontré cartas en la lista."); break; }
      const bn=newBinder(($("#binder-name").value||"").trim()||"Carpeta de venta", items); S.data.binders.push(bn); S.binderSel=bn.id; saveData(); render(); toast(`Carpeta “${bn.name}” creada.`); await afterBinderImport(items); break; }
    case "binder-del": S.bDel=true; render(); break;
    case "binder-del-no": S.bDel=false; render(); break;
    case "binder-del-ok": S.data.binders=S.data.binders.filter(x=>x.id!==S.binderSel); S.binderSel=null; S.bDel=false; saveData(); render(); break;
    case "binder-fetch": { const bn=S.data.binders.find(x=>x.id===S.binderSel); if (bn) await afterBinderImport(bn.items); break; }
    case "binder-refresh": { const bn=S.data.binders.find(x=>x.id===S.binderSel); if (!bn) break; await fetchItems(bn.items.filter(i=>pkOf(i)), {label:"Actualizando precios de la carpeta"}); await fetchCards(bn.items.map(i=>i.n), {force:true, quiet:true}); snapshotPrices(); render(); break; }
    case "binder-copy": { const bn=S.data.binders.find(x=>x.id===S.binderSel); if (bn) copyText(priceListText(bn)); break; }
    case "binder-txt": { const bn=S.data.binders.find(x=>x.id===S.binderSel); if (bn) download(`${bn.name} - precios.txt`, priceListText(bn)); break; }
    case "binder-csv": { const bn=S.data.binders.find(x=>x.id===S.binderSel); if (bn) download(`${bn.name}.csv`, binderCSV(bn), "text/csv"); break; }
    case "binder-mb": { const bn=S.data.binders.find(x=>x.id===S.binderSel); if (bn) download(`${bn.name} - manabox.csv`, toManaBoxCSV(bn.items), "text/csv"); break; }
    case "binder-undo": { const bn=S.data.binders.find(x=>x.id===S.binderSel); if (bn) undoSale(bn); break; }
    case "binder-replace-no": S.bReplace=null; render(); break;
    case "binder-replace-ok": { const bn=S.data.binders.find(x=>x.id===S.binderSel); if (!bn||!S.bReplace) break; const asks=new Map(bn.items.filter(i=>i.ask).map(i=>[collKey(i),i.ask]));
      bn.items=S.bReplace.items.map(i=>asks.has(collKey(i))?{...i, ask:asks.get(collKey(i))}:i); bn.updated=Date.now(); const its=bn.items; S.bReplace=null; saveData(); render(); toast("Carpeta actualizada."); await afterBinderImport(its); break; }
    case "cheapest": await fetchCheapest(deckNames(d), {force:true}); snapshotPrices(); render(); break;
    case "refetch-deck": await fetchCards(deckNames(d), {force:true, label:"Volviendo a traer datos"}); render(); break;
    case "cedh-staples": await loadCedhStaples(d); break;
    case "role-reset": { const n=S.modal&&S.modal.name; const m=cardOf(n); if (m){ delete S.data.roles[slug(m.n)]; delete S.data.roles[slug(n)]; saveData(); simCache.clear(); renderModal(); render(); } break; }
    case "refresh-all": S.settingsOpen=false; await refreshPrices(true); break;
    case "backup": download(`boveda-edh-respaldo-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({app:"boveda-edh", version:4, at:Date.now(), ...S.data, cardData:{cards:S.cards, hist:S.hist, gc:[...S.gc], gcAt:S.gcAt||null}}), "application/json"); break;
    case "restore": $("#file-backup").click(); break;
    case "clear-cache": S.cards={}; S.edh={}; S.versions={}; S.prints={}; saveCaches(); simCache.clear(); toast("Caché de cartas borrada. El historial de precios se conserva."); render(); break;
    case "modal-wish": { const n=S.modal&&S.modal.name; addWish(cardOf(n)?cardOf(n).n:n, $("#modal-target")&&$("#modal-target").value); toast("Agregada a tu lista de búsqueda."); renderModal(); render(); break; }
  }
});
function cleanItem(c){ const o={n:c.n, q:c.q}; for (const k of ["set","num","foil","sid","lang","cond","ppc","binder"]) if (c[k]) o[k]=c[k]; if (c.pp!=null && !isNaN(c.pp)) o.pp=c.pp; return o; }
function splitDeck(parsed, format, prevCmds){
  if (format==="commander"){
    const cmds = parsed.filter(c=>c.c).map(c=>c.n);
    const useC = cmds.length ? cmds : (prevCmds||[]);
    const cs = new Set(useC.map(slug));
    return {commanders:cmds, cards:parsed.filter(c=>!c.c && !c.side && !c.maybe && !cs.has(slug(c.n))).map(c=>({n:c.n,q:c.q})), side:parsed.filter(c=>c.side).map(c=>({n:c.n,q:c.q})), maybe:parsed.filter(c=>c.maybe).map(c=>({n:c.n,q:c.q}))};
  }
  return {commanders:[], cards:parsed.filter(c=>!c.side&&!c.maybe).map(c=>({n:c.n,q:c.q})), side:parsed.filter(c=>c.side).map(c=>({n:c.n,q:c.q})), maybe:parsed.filter(c=>c.maybe).map(c=>({n:c.n,q:c.q}))};
}
document.addEventListener("keydown", e=>{
  if (e.key==="Escape"){ if (S.modal){ S.modal=null; renderModal(); } if(S.settingsOpen){S.settingsOpen=false;renderSettings();} }
  if ((e.key==="Enter"||e.key===" ") && e.target.matches && e.target.matches(".cn[data-card]")){ e.preventDefault(); openCard(e.target.dataset.card); }
});
document.addEventListener("change", async e=>{
  const st=S.data.settings; const id=e.target.id;
  if (id==="set-clp"){ st.clp=e.target.value; saveData(); render(); }
  if (id==="set-rise"){ st.rise=Math.max(1,+e.target.value||15); saveData(); render(); }
  if (id==="set-drop"){ st.drop=Math.max(1,+e.target.value||10); saveData(); render(); }
  if (id==="set-min"){ st.minMove=Math.max(0,+e.target.value||0); saveData(); render(); }
  if (id==="set-sell"){ st.sellMin=Math.max(0,+e.target.value||0); saveData(); render(); }
  if (id==="set-auto"){ st.autoFetch=e.target.checked; saveData(); }
  if (id==="set-autorefresh"){ st.autoRefresh=e.target.checked; saveData(); }
  { const bn=S.data.binders.find(x=>x.id===S.binderSel);
    if (id==="binder-files" && e.target.files.length){ await importBinderFiles([...e.target.files]); e.target.value=""; return; }
    if (bn && id==="binder-add-file" && e.target.files[0]){ const items=parseBinder(await e.target.files[0].text()).map(({_bn,...c})=>c); for (const it of items){ const j=bn.items.findIndex(x=>collKey(x)===collKey(it)); if (j>=0) bn.items[j].q+=it.q; else bn.items.push(it); } bn.updated=Date.now(); saveData(); render(); toast(`Agregadas ${items.reduce((a,i)=>a+i.q,0)} cartas a “${bn.name}”.`); e.target.value=""; await afterBinderImport(items); return; }
    if (bn && id==="binder-replace-file" && e.target.files[0]){ const items=parseBinder(await e.target.files[0].text()).map(({_bn,...c})=>c); if (!items.length){ toast("No encontré cartas en el archivo."); return; } S.bReplace={items, diff:diffCollection(bn.items, items)}; e.target.value=""; render(); return; }
    if (id==="ck-file" && e.target.files[0]){ await loadCKFile(e.target.files[0]); e.target.value=""; return; }
    if (id==="vx-rate"){ const v=+e.target.value; if (v>0){ S.data.settings.usdClp=v; saveData(); render(); } return; }
    if (bn && id==="b-pct"){ bn.pricing.pct=Math.max(1,+e.target.value||100); saveData(); render(); return; }
    if (bn && id==="b-min"){ bn.pricing.min=Math.max(0,+e.target.value||0); saveData(); render(); return; }
    if (bn && id==="b-clp"){ bn.pricing.clp=e.target.checked; saveData(); render(); return; }
    if (bn && id==="b-round"){ bn.pricing.round=+e.target.value||500; saveData(); render(); return; }
    if (bn && id==="b-sync"){ bn.pricing.syncColl=e.target.checked; saveData(); return; }
    if (bn && id==="b-sort"){ S.bSort=e.target.value; render(); return; }
    if (bn && id==="binder-rename"){ const v=e.target.value.trim(); if (v){ bn.name=v; saveData(); render(); } return; }
    if (bn && e.target.dataset.bask!=null){ const it=bn.items[+e.target.dataset.bask]; if (it){ if (e.target.value===""){ delete it.ask; } else it.ask={v:+e.target.value, unit:bn.pricing.clp?"clp":"base"}; saveData(); render(); } return; } }
  if (e.target.dataset.pick!=null){ const it=S.data.collection.items[+e.target.dataset.pick]; S.picked=S.picked||new Set(); if (it){ e.target.checked?S.picked.add(it):S.picked.delete(it); } S.bulkDel=false; render(); return; }
  if (id==="pick-all"){ S.picked=S.picked||new Set(); const boxes=[...document.querySelectorAll("[data-pick]")]; for (const bx of boxes){ const it=S.data.collection.items[+bx.dataset.pick]; if (it) e.target.checked?S.picked.add(it):S.picked.delete(it); } render(); return; }
  if (id==="bulk-cond" && e.target.value){ const sel=[...(S.picked||[])].filter(i=>S.data.collection.items.includes(i)); for (const it of sel) it.cond=e.target.value; touchColl(); saveData(); toast(`Condición actualizada en ${sel.length} registros.`); render(); return; }
  if (e.target.dataset.wtarget!=null){ const w=S.data.wishlist[+e.target.dataset.wtarget]; if (w){ w.target = e.target.value===""?null:+e.target.value; saveData(); render(); } }
  if ((id==="coll-file"||id==="mb-deck-file") && e.target.files[0]){ const t=await e.target.files[0].text(); const ta=$(id==="coll-file"?"#coll-text":"#mb-deck-text"); if (ta) ta.value=t; toast("Archivo cargado."); }
  if (id==="file-backup" && e.target.files[0]){
    try{
      const j = JSON.parse(await e.target.files[0].text());
      if (j && j.kind==="precios"){
        const nP = mergeCardData(j.cardData); S.settingsOpen=false; render(); e.target.value="";
        toast(nP ? `Precios importados: datos de ${nP} cartas${typeof ACC!=="undefined"&&ACC.state==="on"?", guardados en tu cuenta para todos tus dispositivos":""}.` : "Ese archivo no trae precios más nuevos que los que ya tienes.");
        if (nP && typeof accPushCards==="function") accPushCards();
        return;
      }
      const decks = Array.isArray(j.decks)?j.decks:[]; const items = (j.collection&&Array.isArray(j.collection.items))?j.collection.items:[];
      const ids = new Set(S.data.decks.map(x=>x.id)); let added=0;
      for (const dk of decks){ if (!dk || !Array.isArray(dk.cards)) continue; if (ids.has(dk.id)) continue;
        S.data.decks.push({...dk, id:dk.id||uid(), format:dk.format||"commander", name:String(dk.name||"Mazo importado"), commanders:(dk.commanders||[]).map(String), cards:dk.cards.map(c=>({n:String(c.n),q:+c.q||1})), side:(dk.side||[]).map(c=>({n:String(c.n),q:+c.q||1})), maybe:(dk.maybe||[]).map(c=>({n:String(c.n),q:+c.q||1})), log:dk.log||[], mb:dk.mb||null, combos:dk.combos, created:dk.created||Date.now(), updated:Date.now()}); added++; }
      if (items.length){ if (!S.data.collection.items.length) S.data.collection={items:items.map(cleanItem)}; else for (const it of items){ const k=S.data.collection.items.findIndex(x=>collKey(x)===collKey(it)); if(k>=0) S.data.collection.items[k].q=Math.max(S.data.collection.items[k].q, it.q); else S.data.collection.items.push(cleanItem(it)); } touchColl(); }
      const wk = w => slug(w.n)+"|"+(w.pk||"")+"|"+(w.finish||"");
      for (const w of j.wishlist||[]) if (w && w.n && !S.data.wishlist.some(x=>wk(x)===wk(w))) S.data.wishlist.push(w);
      for (const bn of j.binders||[]) if (bn && Array.isArray(bn.items) && !S.data.binders.some(x=>x.id===bn.id)) S.data.binders.push({...newBinder(bn.name, bn.items), ...bn, sales:bn.sales||[]});
      if (j.settings) S.data.settings=Object.assign(S.data.settings, j.settings);
      const nCards = mergeCardData(j.cardData);
      saveData(); S.settingsOpen=false; render(); toast(`Respaldo importado: ${added} mazos, ${items.length} registros de colección${nCards?` y datos de ${nCards} cartas`:""}.`);
      if (nCards && typeof accPushCards==="function") accPushCards();
      if (S.data.settings.autoFetch && !isWebView()){ await fetchCards([...decks.flatMap(x=>[...(x.commanders||[]), ...(x.cards||[]).map(c=>c.n), ...(x.side||[]).map(c=>c.n), ...(x.maybe||[]).map(c=>c.n)]), ...items.map(i=>i.n)], {label:"Trayendo datos de las cartas"}); }
    }catch{ toast("Ese archivo no es un respaldo válido de la Bóveda."); }
    e.target.value="";
  }
});
document.addEventListener("submit", async ev=>{
  ev.preventDefault();
  if (ev.target.id==="wish-form"){ const n=$("#w-name").value.trim(); if(!n) return; addWish(n, $("#w-target").value); render(); await fetchCards([n],{quiet:true}); await fetchVersions(n); snapshotPrices(); render(); return; }
  if (ev.target.id!=="deck-form") return;
  const e=S.editing; const format=e.format;
  const name=$("#f-name").value.trim(); if(!name){toast("Ponle un nombre al mazo.");return;}
  distributeEditor();
  const next = editorSplit(format);
  if (!next.cards.length){ toast("No encontré cartas en el Deck."); return; }
  const prev = e.id ? S.data.decks.find(x=>x.id===e.id) : null;
  const d = {...(prev||{log:[]}), id: prev?prev.id:uid(), format, name, commanders:next.commanders, cards:next.cards, side:next.side, maybe:next.maybe, created: prev&&prev.created||Date.now()};
  if (prev && (JSON.stringify(prev.cards)!==JSON.stringify(d.cards) || JSON.stringify(prev.commanders||[])!==JSON.stringify(d.commanders||[]))){ delete d.combos; delete d.cedhStaples; }
  if (!prev && $("#f-mb") && $("#f-mb").checked) d.mb = {at:Date.now(), sync:Date.now(), base:boardsOf(d)};
  if (!prev) d.log=[{at:Date.now(), src:"manual", add:[...d.cards, ...d.side.map(c=>({...c,side:true})), ...d.maybe.map(c=>({...c,maybe:true}))], rem:[]}];
  S.editing=null; S.sel[format]=d.id; S.showMeta[format]=false; S.deckTab="analisis";
  saveDeck(d, {noLog:!prev});
  if (S.data.settings.autoFetch){
    await fetchCards(deckNames(d));
    await fetchCheapest(deckNames(d));
    const cur1 = S.data.decks.find(x=>x.id===d.id);
    if (format==="commander" && cur1 && cur1.commanders.length && !cur1.combos) await loadCombos(cur1);
  }
});
/* ---------- editor: reparto en Deck / Sideboard / Maybeboard ---------- */
function editorSplit(format){
  const parsed = parseList(($("#f-list")||{}).value||"", {keepSide:format!=="commander"});
  const extraSide = parseList(($("#f-side")||{}).value||"").map(c=>({...c, c:false, side:true, maybe:false}));
  const extraMaybe = parseList(($("#f-maybe")||{}).value||"").map(c=>({...c, c:false, side:false, maybe:true}));
  const all = mergeParsed([...parsed, ...extraSide, ...extraMaybe], false);
  let next = splitDeck(all, format, []);
  if (format==="commander"){
    let cmds = (($("#f-cmd")||{}).value||"").split("+").map(s=>s.trim()).filter(Boolean);
    if (!cmds.length) cmds = next.commanders;
    const cs=new Set(cmds.map(slug)); next = {...next, commanders:cmds, cards:all.filter(c=>!c.c && !c.side && !c.maybe && !cs.has(slug(c.n))).map(c=>({n:c.n,q:c.q}))};
  }
  return next;
}
// Si el cuadro Deck trae secciones de banquillo o cartas probables, las pasa a sus cuadros
function distributeEditor(){
  const ta=$("#f-list"); if (!ta || !S.editing) return false;
  const format=S.editing.format;
  const parsed = parseList(ta.value, {keepSide:format!=="commander"});
  const side = parsed.filter(c=>c.side), maybe = parsed.filter(c=>c.maybe), cmds = parsed.filter(c=>c.c);
  if (!side.length && !maybe.length && !(format==="commander" && cmds.length)) return false;
  const main = parsed.filter(c=>!c.side && !c.maybe && !c.c);
  const add = (id, arr) => { if (!arr.length) return; const el=$(id); const cur0=el.value.trim(); el.value = (cur0?cur0+"\n":"") + listText(arr); };
  ta.value = listText(main);
  add("#f-side", side); add("#f-maybe", maybe);
  // la sección Commander pegada manda: reemplaza lo que había en el campo
  if (format==="commander" && cmds.length && $("#f-cmd")) $("#f-cmd").value = cmds.map(c=>c.n).join(" + ");
  const q = arr => arr.reduce((a,c)=>a+c.q,0);
  toast(`Separé la lista: ${q(main)} en Deck${cmds.length&&format==="commander"?`, ${cmds.length} comandante${cmds.length>1?"s":""}`:""}, ${q(side)} en Sideboard y ${q(maybe)} en Maybeboard.`);
  return true;
}
let prevT=null;
function renderEditorPreview(){
  const box=$("#f-preview"); if (!box || !S.editing) return;
  const e=S.editing, format=e.format, isC=format==="commander";
  const next = editorSplit(format);
  const q = arr => arr.reduce((a,c)=>a+c.q,0);
  const nMain=q(next.cards)+(isC?next.commanders.length:0), nSide=q(next.side), nMaybe=q(next.maybe);
  const setOf = arr => new Set(arr.map(c=>slug(c.n)));
  const sM=setOf([...next.cards, ...next.commanders.map(n=>({n}))]), sS=setOf(next.side), sY=setOf(next.maybe);
  const both = (a,b) => [...a].filter(k=>b.has(k));
  const nm = k => ([...next.cards,...next.side,...next.maybe,...next.commanders.map(n=>({n}))].find(c=>slug(c.n)===k)||{n:k}).n;
  const warns=[];
  if (isC && nMain && nMain!==100) warns.push(`El Deck tiene ${nMain} cartas contando al comandante (deben ser 100).`);
  if (!isC && nMain && nMain<60) warns.push(`El Deck tiene ${nMain} cartas (mínimo 60).`);
  if (!isC && nSide>15) warns.push(`El Sideboard tiene ${nSide} cartas (máximo 15).`);
  if (isC && !next.commanders.length && nMain) warns.push("No detecté comandante: escríbelo arriba o márcalo en la lista.");
  const dMS=both(sM,sS), dMY=both(sM,sY), dSY=both(sS,sY);
  if (dMS.length) warns.push(`Están en Deck y Sideboard a la vez: ${dMS.map(nm).join(", ")}.`);
  if (dMY.length) warns.push(`Están en Deck y Maybeboard a la vez: ${dMY.map(nm).join(", ")}.`);
  if (dSY.length) warns.push(`Están en Sideboard y Maybeboard a la vez: ${dSY.map(nm).join(", ")}.`);
  const prev = e.id ? S.data.decks.find(x=>x.id===e.id) : null;
  const bd = prev ? boardDiff(boardsOf(prev), {main:next.cards, side:next.side, maybe:next.maybe}) : null;
  const col = (key, title, sub, arr, n, extra) => `<div class="pv-col board-${key}"><div class="pv-h"><b>${title}</b> <span class="num">${n}</span></div><div class="muted" style="font-size:.82rem">${sub}</div>
      ${extra||""}<div class="pv-list">${arr.length?arr.slice(0,80).map(c=>`<div><span class="num muted">${c.q}</span> ${esc(c.n)}</div>`).join("")+(arr.length>80?`<div class="muted">… y ${arr.length-80} más</div>`:""):`<div class="muted">Vacío</div>`}</div>
      ${bd&&(bd[key==="main"?"main":key].add.length||bd[key==="main"?"main":key].rem.length)?`<div class="diff" style="margin-top:6px"><div class="sc" style="font-size:.8rem">cambios</div>${bd[key==="main"?"main":key].add.map(x=>`<span class="a">+ ${x.q} ${esc(x.n)}</span>`).join("")}${bd[key==="main"?"main":key].rem.map(x=>`<span class="r">− ${x.q} ${esc(x.n)}</span>`).join("")}</div>`:""}</div>`;
  box.innerHTML = (nMain||nSide||nMaybe) ? `<div class="pv-title"><b>Así quedará tu lista</b>${prev?` <span class="muted">· con los cambios respecto a la versión guardada</span>`:""}</div>
    ${warns.length?`<div class="banner" style="margin-bottom:10px;display:grid;gap:2px">${warns.map(w=>`<span>${esc(w)}</span>`).join("")}</div>`:""}
    <div class="pv-grid">
      ${col("main", isC?"Deck":"Deck (main)", isC?"Comandante + 99. Es lo que juegas.":"Lo que juegas en el game 1.", next.cards, nMain, isC&&next.commanders.length?`<div style="margin:4px 0"><span class="sc" style="font-size:.82rem">comandante:</span> ${next.commanders.map(esc).join(" + ")}</div>`:"")}
      ${col("side", "Sideboard (banquillo)", isC?"Cambios según la mesa. No cuenta para las 100.":"Hasta 15 para cambiar entre partidas.", next.side, nSide)}
      ${col("maybe", "Maybeboard (cartas probables)", "Cartas que estás evaluando. No cuentan para el mazo.", next.maybe, nMaybe)}
    </div>` : `<p class="muted" style="margin:0">Pega tu lista y aquí verás cómo se reparte entre Deck, Sideboard y Maybeboard.</p>`;
}
document.addEventListener("paste", ev=>{ if (ev.target && ev.target.id==="f-list") setTimeout(()=>{ distributeEditor(); renderEditorPreview(); }, 0); });
document.addEventListener("focusout", ev=>{ if (ev.target && ev.target.id==="f-list"){ if (distributeEditor()) renderEditorPreview(); } });
document.addEventListener("input", ev=>{
  if (["f-list","f-side","f-maybe","f-cmd"].includes(ev.target.id)){ clearTimeout(prevT); prevT=setTimeout(renderEditorPreview, 250); }
  if (ev.target.id==="b-q"){ S.bQ=ev.target.value; const pos=ev.target.selectionStart; render(); const el=$("#b-q"); if (el){ el.focus(); el.setSelectionRange(pos,pos); } return; }
  if (ev.target.id==="coll-q"){ S.collQ=ev.target.value; S.collShow=150; clearTimeout(S._cqT); S._cqT=setTimeout(()=>{ const pos=ev.target.selectionStart; render(); const el=$("#coll-q"); if (el){ el.focus(); el.setSelectionRange(pos,pos); } }, 180); }
});

/* ---------- arranque ---------- */
// S.boot: la cuenta y la sincronización esperan a que termine de cargar lo guardado en el navegador,
// así lo que llega de la nube no queda pisado por la copia local más antigua.
S.boot = (async ()=>{
  render();
  if (await loadDataIdb()) render();
  await loadCaches();
  render();
})();
S.boot.then(()=>{ refreshGC(); if (S.data.settings.autoRefresh) refreshPrices(false); });
