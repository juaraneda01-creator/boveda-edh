"use strict";
/* =========================================================
   Bóveda EDH v3 — núcleo: datos, APIs y análisis
   ========================================================= */

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug = s => String(s||"").split(" // ")[0].split("/")[0].trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const edhSlug = s => String(s||"").split(" // ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/['’,.!?"():]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today = () => Math.floor(Date.now()/864e5);
const WUBRG = ["W","U","B","R","G"];
const COLOR_ES = {W:"Blanco",U:"Azul",B:"Negro",R:"Rojo",G:"Verde"};
const FORMATS = {commander:{name:"Commander", short:"EDH", size:100}, pauper:{name:"Pauper", short:"Pauper", size:60}, pioneer:{name:"Pioneer", short:"Pioneer", size:60}};
const BASICS = new Set(["plains","island","swamp","mountain","forest","wastes","snow-covered-plains","snow-covered-island","snow-covered-swamp","snow-covered-mountain","snow-covered-forest","snow-covered-wastes"]);
const BASIC_CI = {plains:"W",island:"U",swamp:"B",mountain:"R",forest:"G",wastes:""};
const TYPE_ES = {Creature:"Criaturas",Instant:"Instantáneos",Sorcery:"Conjuros",Artifact:"Artefactos",Enchantment:"Encantamientos",Planeswalker:"Planeswalkers",Battle:"Batallas",Land:"Tierras",Unknown:"Sin datos"};
const TYPE_ORDER = ["Creature","Instant","Sorcery","Artifact","Enchantment","Planeswalker","Battle","Land","Unknown"];
const ROLE_ES = {ramp:"ramp",draw:"robo",removal:"removal",wipe:"barrido",tutor:"tutor",protection:"protección",wincon:"remate",recursion:"reciclaje"};
const TARGETS = [
  {k:"land",   n:"Tierras",   d:"fuentes de maná base", lo:35, hi:38, max:45},
  {k:"ramp",   n:"Ramp",      d:"aceleración",          lo:8,  hi:12, max:20},
  {k:"draw",   n:"Robo",      d:"ventaja de cartas",    lo:8,  hi:12, max:20},
  {k:"removal",n:"Removal",   d:"respuestas puntuales", lo:6,  hi:10, max:16},
  {k:"wipe",   n:"Barridos",  d:"limpian la mesa",      lo:2,  hi:4,  max:8},
  {k:"protection",n:"Protección",d:"cuidan tu juego",   lo:2,  hi:6,  max:10},
];
const GC_FALLBACK = ["Ad Nauseam","Ancient Tomb","Aura Shards","Biorhythm","Bolas's Citadel","Braids, Cabal Minion","Chrome Mox","Coalition Victory","Consecrated Sphinx","Crop Rotation","Cyclonic Rift","Demonic Tutor","Drannith Magistrate","Enlightened Tutor","Farewell","Field of the Dead","Fierce Guardianship","Force of Will","Gaea's Cradle","Gamble","Gifts Ungiven","Glacial Chasm","Grand Arbiter Augustin IV","Grim Monolith","Humility","Imperial Seal","Intuition","Jeska's Will","Lion's Eye Diamond","Mana Vault","Mishra's Workshop","Mox Diamond","Mystical Tutor","Narset, Parter of Veils","Natural Order","Necropotence","Notion Thief","Opposition Agent","Orcish Bowmasters","Panoptic Mirror","Rhystic Study","Seedborn Muse","Serra's Sanctum","Smothering Tithe","Survival of the Fittest","Teferi's Protection","Tergrid, God of Fright","Thassa's Oracle","The One Ring","The Tabernacle at Pendrell Vale","Underworld Breach","Vampiric Tutor","Worldly Tutor"];
const ANY_NUMBER = /relentless rats|shadowborn apostle|persistent petitioners|rat colony|dragon's approach|seven dwarves|slime against humanity|hare apparent|templar knight|nazg[uû]l|cid, timeless artificer|tempest hawk/i;
const pipsHTML = ci => { const s = (ci||"").split("").filter(c=>WUBRG.includes(c)); return `<span class="pips" aria-label="Colores ${s.join("")||"incoloro"}">${(s.length?s:["C"]).map(c=>`<i class="pip p-${c}"></i>`).join("")}</span>`; };
let toastT; function toast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,4200); }

/* ---------- almacenamiento ---------- */
const LS_DATA="boveda-edh:data";
function lsGet(k, def){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch{ return def; } }
const isWebView = () => !!(window.claude && typeof window.claude.use==="function");
const offlineMsg = site => isWebView() ? `La versión web no puede conectarse a ${site}. Para eso usa la versión en vivo: boveda-edh.netlify.app.` : `No se pudo conectar con ${site}. Revisa tu conexión a internet.`;
let lsWarned=false;
function lsSet(k, v, quiet){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ if (!quiet && !lsWarned && !(typeof ACC!=="undefined" && ACC.uid)){ lsWarned=true; setTimeout(()=>toast("El navegador no dejó guardar aquí. Inicia sesión con tu cuenta o descarga un respaldo desde Ajustes."),50); } return false; } }
const idb = (()=>{
  let dbp=null;
  const open = () => dbp || (dbp = new Promise((res,rej)=>{ try{ const r=indexedDB.open("boveda-edh",1); r.onupgradeneeded=()=>r.result.createObjectStore("kv"); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }catch(e){ rej(e); } }));
  return {
    async get(k){ try{ const db=await open(); return await new Promise((res,rej)=>{ const q=db.transaction("kv").objectStore("kv").get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); }catch{ return lsGet("boveda-edh:kv:"+k, undefined); } },
    async set(k,v){ try{ const db=await open(); await new Promise((res,rej)=>{ const tx=db.transaction("kv","readwrite"); tx.objectStore("kv").put(v,k); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }catch{ lsSet("boveda-edh:kv:"+k, v); } },
  };
})();

const DEFAULT_SETTINGS = {cur:"usd", clp:"", autoFetch:true, autoRefresh:true, rise:15, drop:10, minMove:1, sellMin:5, lastRefresh:0, aiModel:"claude-sonnet-5", weekly:true, weeklySeen:0};
const S = {
  data: null, cards:{}, prints:{}, versions:{}, hist:{}, edh:{}, ck:null, cedhLive:null, gc:new Set(GC_FALLBACK.map(slug)),
  view:"home", sel:{commander:null,pauper:null,pioneer:null}, showMeta:{commander:false,pauper:false,pioneer:false},
  deckTab:"analisis", editing:null, confirmDel:false, busy:null, modal:null, settingsOpen:false,
  collQ:"", collAvail:false, collMode:null, optBudget:"10", targetBracket:null, mbPreview:null, deckMbPreview:null, marketTab:"alertas",
};
function loadData(raw){
  const d = raw || lsGet(LS_DATA, null) || {};
  d.decks = Array.isArray(d.decks)?d.decks:[];
  const cleanL = a => (Array.isArray(a)?a:[]).filter(c=>c && c.n!=null).map(c=>({...c, n:String(c.n), q:Math.max(1, parseInt(c.q,10)||1)}));
  for (const k of d.decks){ k.format = FORMATS[k.format] ? k.format : "commander"; k.cards=cleanL(k.cards); k.side=cleanL(k.side); k.maybe=cleanL(k.maybe); k.commanders=(Array.isArray(k.commanders)?k.commanders:[]).map(String); k.log=Array.isArray(k.log)?k.log:[]; k.name=String(k.name||"Mazo"); }
  d.collection = d.collection && Array.isArray(d.collection.items) ? d.collection : {items:[]};
  d.wishlist = Array.isArray(d.wishlist)?d.wishlist:[];
  d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings||{});
  d.dismissed = d.dismissed||{};
  d.mbLog = Array.isArray(d.mbLog)?d.mbLog:[];
  d.roles = d.roles||{};
  d.binders = Array.isArray(d.binders)?d.binders:[];
  for (const b of d.binders){ b.items=b.items||[]; b.sales=b.sales||[]; b.pricing=Object.assign({src:"ck", pct:100, min:0, clp:true, round:100, syncColl:true}, b.pricing||{}); if (b.pricing.src==="market") b.pricing.src="ck"; if (!b.pricing.v2){ b.pricing.clp=true; b.pricing.v2=true; } }
  return d;
}
S.data = loadData();
// los datos van a IndexedDB (sin el tope de ~5 MB) y, si caben, también a localStorage
let dataT=null, lsFull=false;
function saveDataIdb(){ clearTimeout(dataT); dataT=setTimeout(async ()=>{ try { await idb.set("data", S.data); } catch { if (lsFull && !lsWarned){ lsWarned=true; toast("El navegador no dejó guardar tus datos. Descarga un respaldo desde Ajustes."); } } }, 250); }
function saveData(){ bumpAnalysis(); S.data._mod = Date.now(); const ok = lsSet(LS_DATA, S.data, true); lsFull = !ok; saveDataIdb(); if (typeof accOnSave==="function") accOnSave(); return true; }
async function loadDataIdb(){ try { const d = await idb.get("data"); if (d && typeof d==="object" && (d._mod||0) > (S.data._mod||0)){ S.data = loadData(JSON.parse(JSON.stringify(d))); return true; } } catch {} return false; }
window.addEventListener("pagehide", ()=>{ if (dataT){ clearTimeout(dataT); idb.set("data", S.data); } });
let cacheT=null;
function saveCaches(){ bumpAnalysis(); clearTimeout(cacheT); cacheT=setTimeout(()=>{ idb.set("cards",S.cards); idb.set("prints",S.prints); idb.set("hist",S.hist); idb.set("versions",S.versions); idb.set("edh",S.edh); },400); }
async function loadCaches(){
  const [cards,prints,hist,versions,edh,gc,ck] = await Promise.all(["cards","prints","hist","versions","edh","gc","ck"].map(k=>idb.get(k)));
  S.cards = cards || lsGet("boveda-edh:cards", {}) || {};
  S.prints = prints||{}; S.hist = hist||{}; S.versions = versions||{}; S.edh = edh || lsGet("boveda-edh:edhrec", {}) || {};
  if (gc && gc.list && gc.list.length>20){ S.gc = new Set(gc.list.map(slug)); S.gcAt = gc.at; }
  S.ck = ck||null;
}

/* ---------- parser de listas ---------- */
function splitCSVLine(l){ const out=[]; let cur="", q=false; for (let i=0;i<l.length;i++){ const ch=l[i]; if (q){ if(ch==='"'&&l[i+1]==='"'){cur+='"';i++;} else if(ch==='"') q=false; else cur+=ch; } else if(ch==='"') q=true; else if(ch===','||ch===';'||ch==='\t'){ out.push(cur); cur=""; } else cur+=ch; } out.push(cur); return out.map(s=>s.trim()); }
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()); if (!lines.length) return null;
  const head = splitCSVLine(lines[0]).map(h=>h.toLowerCase().replace(/^﻿/,""));
  const col = re => head.findIndex(h=>re.test(h));
  const iN=col(/^(name|card name|nombre|card)$/), iQ=col(/^(count|quantity|qty|cantidad|amount)$/), iS=(()=>{ const a=col(/^(set code|edition code)$/); return a>=0?a:col(/^(set|edition|expansion)$/); })(),
        iNum=col(/^(collector number|card number|number|collector #|cn)$/), iF=col(/^(foil|finish|printing)$/), iSid=col(/^scryfall id$/), iL=col(/^(language|lang|idioma)$/),
        iC=col(/^(condition|condición)$/), iBd=col(/^(board|section|zone|zona|category|categories|categoría|tablero)$/), iP=col(/^(purchase price|price bought|precio compra)$/), iPC=col(/^(purchase price currency|purchase currency)$/), iSN=col(/^set name$/), iB=col(/^(binder name|binder|list)$/);
  if (iN<0) return null;
  const out=[];
  for (const l of lines.slice(1)){
    const c=splitCSVLine(l); const n=c[iN]; if(!n) continue;
    const fv=(iF>=0?(c[iF]||""):"").toLowerCase();
    const foil = /etched/.test(fv) ? "etched" : (/foil|true|yes|^1$/.test(fv) && !/non|normal|false|^no$/.test(fv)) ? "foil" : "";
    let set = iS>=0?(c[iS]||""):""; if (set.length>6 && iSN<0) set="";
    const bd=(iBd>=0?(c[iBd]||""):"").toLowerCase();
    const isSide=/side|banquillo/.test(bd), isMaybe=/maybe|consider|probable/.test(bd), isCmd=/commander|comandante/.test(bd);
    out.push({n, q:iQ>=0?(parseInt(c[iQ])||1):1, c:isCmd, side:isSide&&!isMaybe, maybe:isMaybe, foil, set:set.toUpperCase().slice(0,6), num:iNum>=0?(c[iNum]||""):"", sid:iSid>=0?(c[iSid]||"").toLowerCase():"",
      lang:iL>=0?(c[iL]||""):"", cond:iC>=0?(c[iC]||""):"", pp:iP>=0&&c[iP]!==""?parseFloat(String(c[iP]).replace(",",".")):null, ppc:iPC>=0?(c[iPC]||""):"", binder:iB>=0?(c[iB]||""):""});
  }
  return out;
}
function looksCSV(text){ const first=(String(text||"").split(/\r?\n/).find(l=>l.trim())||"").toLowerCase(); return /[,;\t]/.test(first) && /(^|[,;\t"])\s*"?(name|card name|nombre)"?\s*([,;\t]|$)/.test(first); }
function parseList(text, {keepSide=false}={}){
  text = String(text||"");
  if (looksCSV(text)){ const csv=parseCSV(text); if (csv) return mergeParsed(csv, true); }
  const out=[]; let section="main";
  for (let raw of text.split(/\r?\n/)){
    let l = raw.trim(); if(!l){ if (keepSide && section==="main" && out.reduce((a,c)=>a+(c.q||0),0)>=40) section="side-blank"; continue; }
    l = l.replace(/^\/\/\s*/,"");
    const h = l.toLowerCase().replace(/\s*\(\d+\)\s*$/,"").replace(/[:\s]+$/,"");
    if (/^(commanders?|comandantes?)$/.test(h)){section="cmdr";continue;}
    if (/^(deck|mainboard|main|mazo|main deck|companion)$/.test(h)){section="main";continue;}
    if (/^(sideboard|side|banquillo|reserva)$/.test(h)){section="side";continue;}
    if (/^(maybeboard|maybe|considering|quizas|quizás|tal vez|cartas probables|probables|en prueba)$/.test(h)){section="maybe";continue;}
    if (/^(tokens?|acquireboard|attractions|stickers)$/.test(h)){section="skip";continue;}
    if (/^(creatures?|instants?|sorcer(y|ies)|artifacts?|enchantments?|planeswalkers?|lands?|battles?|other|criaturas|tierras|hechizos|spells)$/.test(h)) continue;
    if (section==="skip") continue;
    if (/^(about|name|nombre)\b/i.test(l) && !/^\d/.test(l)) continue;   // cabecera de MTG Arena ("About", "Name …")
    // etiquetas entre corchetes de Archidekt/Moxfield/ManaBox: [Commander{top}], [Sideboard], [Maybeboard{noDeck}]
    const tag = (l.match(/\[([^\]]*)\]/)||[])[1]||"";
    if (tag){ const sec2 = /commander/i.test(tag)?"cmdr":/sideboard/i.test(tag)?"side":/maybe|consider|nodeck/i.test(tag)?"maybe":null;
      if (sec2){ const m3=l.match(/^(\d+)\s*x?\s+(.+)$/i); out.push(clean(m3?m3[2]:l, m3?+m3[1]:1, sec2)); continue; } }
    let q=1, name=l; const m = l.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (m){ q=+m[1]; name=m[2]; }
    else if (/^SB:\s*/i.test(l)){ const m2=l.replace(/^SB:\s*/i,"").match(/^(\d+)\s*x?\s+(.+)$/i); if(m2){ q=+m2[1]; name=m2[2]; out.push(clean(name,q,"side")); continue; } }
    out.push(clean(name,q,section==="side-blank"?"side":section));
  }
  function clean(name,q,sec){
    const isC = /\*CMDR\*/i.test(name) || sec==="cmdr";
    const foil = /\*E\*/i.test(name) ? "etched" : /\*F\*/i.test(name) ? "foil" : "";
    const setM = name.match(/\(([A-Za-z0-9]{2,6})\)\s*([\w★\-]+)?/);
    name = name.replace(/\*[A-Z]+\*/gi,"").replace(/\[[^\]]*\]/g,"").replace(/\^[^^]*\^/g,"")
               .replace(/\s+\([A-Za-z0-9]{2,6}\)(\s+[\w★\-]+)?\s*$/,"").replace(/\s+#.*$/,"").replace(/\s+\/\s+/," // ").trim();
    return {n:name,q,c:isC&&sec!=="maybe",side:sec==="side"||sec==="side-blank",maybe:sec==="maybe",foil,set:setM?setM[1].toUpperCase():"",num:setM&&setM[2]?setM[2]:""};
  }
  return mergeParsed(out.filter(x=>x.n && !/^\d+$/.test(x.n)), false);
}
function mergeParsed(list, keepVersions){
  const map=new Map();
  for (const c of list){ const key=slug(c.n)+(c.c?"#c":"")+(c.side?"#s":"")+(c.maybe?"#m":"")+(keepVersions?`|${c.set}|${c.num}|${c.foil}|${c.sid||""}|${c.lang||""}|${c.cond||""}|${c.binder||""}`:""); const p=map.get(key); if(p) p.q+=c.q; else map.set(key,{...c}); }
  return [...map.values()];
}
const listText = arr => (arr||[]).map(c=>`${c.q} ${c.n}`).join("\n");
function deckText(d){
  const extra = [...(d.side&&d.side.length?["", "Sideboard", listText(d.side)]:[]), ...(d.maybe&&d.maybe.length?["", "Maybeboard", listText(d.maybe)]:[])];
  if (d.format==="commander") return ["Commander", ...(d.commanders||[]).map(n=>`1 ${n}`), "", "Deck", listText(d.cards), ...extra].join("\n");
  return [listText(d.cards), ...extra].join("\n");
}
const boardsOf = d => ({main:(d.cards||[]).map(c=>({...c})), side:(d.side||[]).map(c=>({...c})), maybe:(d.maybe||[]).map(c=>({...c}))});
const mbBase = mb => !mb ? null : Array.isArray(mb.base) ? {main:mb.base, side:[], maybe:[]} : (mb.base||{main:[],side:[],maybe:[]});
function boardDiff(a, b){ const out={}; for (const k of ["main","side","maybe"]) out[k]=diffLists(a[k]||[], b[k]||[]); out.n = ["main","side","maybe"].reduce((s,k)=>s+out[k].add.length+out[k].rem.length,0); return out; }
function allNames(d){ return [...(d.commanders||[]), ...(d.cards||[]).map(c=>c.n), ...(d.side||[]).map(c=>c.n), ...(d.maybe||[]).map(c=>c.n)];
}
function diffLists(a, b){ // a -> b
  const ma=new Map(), mb=new Map(), names=new Map();
  for (const c of a||[]){ const k=slug(c.n); ma.set(k,(ma.get(k)||0)+c.q); names.set(k,c.n); }
  for (const c of b||[]){ const k=slug(c.n); mb.set(k,(mb.get(k)||0)+c.q); names.set(k,c.n); }
  const add=[], rem=[];
  for (const k of new Set([...ma.keys(),...mb.keys()])){ const d=(mb.get(k)||0)-(ma.get(k)||0); if (d>0) add.push({n:names.get(k),q:d}); else if (d<0) rem.push({n:names.get(k),q:-d}); }
  return {add, rem};
}

/* ---------- datos de cartas ---------- */
function mainType(tl){
  const f = String(tl||"").split(" // ")[0];
  if (/\bLand\b/.test(f)) return "Land";
  for (const t of ["Creature","Planeswalker","Battle","Instant","Sorcery","Artifact","Enchantment"]) if (new RegExp("\\b"+t+"\\b").test(f)) return t;
  return "Unknown";
}
function detectRoles(o, t, tl, pm){
  const r=new Set(); if (!o || t==="Land") return [];
  if ((pm||[]).length && /\{t\}[^.]*:\s*add\b/.test(o) && /(artifact|creature|enchantment)/i.test(tl)) r.add("ramp");
  if (/search your library for[^.]*\b(land|forest|plains|island|swamp|mountain)s?\b[^.]*(onto the battlefield|put (it|them|those|one) onto)/.test(o)) r.add("ramp");
  if (/put (a|up to (one|two|three)) lands? cards? from your hand onto the battlefield/.test(o) || /play (an|two) additional lands?/.test(o)) r.add("ramp");
  if (/create (a|an|one|two|three|x|that many) treasure/.test(o) || /^add \{[wubrgc]\}\{[wubrgc]\}\{[wubrgc]\}/m.test(o)) r.add("ramp");
  if (/\bdraws? (a|an|one|two|three|four|five|six|seven|x|that many|\d+) (additional )?cards?\b|draw cards equal/.test(o)) r.add("draw");
  if (/exile the top [^.]*(you may (play|cast))/.test(o)) r.add("draw");
  if (/(destroy|exile) target (\w+ ){0,3}(creature|artifact|enchantment|planeswalker|permanent|nonland|battle)(?! you control)/.test(o)) r.add("removal");
  if (/deals? (\d+|x|that much) damage to (any target|target creature|target creature or planeswalker|target planeswalker)/.test(o)) r.add("removal");
  if (/counter target (\w+ )?spell/.test(o)) r.add("removal");
  if (/return target (nonland |creature |artifact |enchantment )?(permanent|creature)[^.]*to (its|their) owner'?s? hands?/.test(o)) r.add("removal");
  if (/target (player|opponent) sacrifices|fights? (target|another target|up to one target)|target creature gets -\d+\/-\d+|target creature gets -x\/-x/.test(o)) r.add("removal");
  if (/(destroy|exile) all (other )?(creatures|nonland permanents|permanents|artifacts|enchantments|nonland|attacking)|(all|each) (other )?creatures? gets? -|deals (\d+|x) damage to each (creature|other creature)|return all (nonland )?(permanents|creatures) to|each player sacrifices (all|\w+) creatures?/.test(o)) r.add("wipe");
  const tut = o.match(/search your library for (a|an|up to (one|two|three)|any number of) ([^.]*?)card/);
  if (tut && !/\b(basic )?(land|forest|plains|island|swamp|mountain)s?\b/.test(tut[3])) r.add("tutor");
  if (/(creatures|permanents) you control (gain|have|get) [^.]*(hexproof|indestructible|protection|shroud)|target (creature|permanent) you control gains (hexproof|indestructible|protection|shroud)|phase out|can't be countered/.test(o)) r.add("protection");
  if (/return [^.]*from your graveyard to (your hand|the battlefield)|(cast|play) [^.]*from your graveyard/.test(o)) r.add("recursion");
  if (/you win the game|additional combat phase|extra combat|creatures you control (gain [^.]*? and )?get \+(\d|x)\/\+(\d|x)[^.]*(trample|until end of turn)|each opponent loses (x|half)/.test(o)) r.add("wincon");
  return [...r];
}
const num = v => v==null||v===""?null:parseFloat(v);
function sbCats(o, name){
  const s=new Set(); const n=String(name||"").toLowerCase(); o=o||"";
  if (/destroy (target|all|up to \w+ target|each) [^.]*artifact|artifacts? (and|or) enchantments?|exile target artifact|destroy target noncreature artifact/.test(o)) s.add("artifact");
  if (/exile (target player's|each player's|each opponent's|all cards from|target card from a|all graveyards|up to \w+ target cards? from)|graveyards? (can't|are exiled)|cards in graveyards (lose|can't)|would be put into (an opponent's|a) graveyard/.test(o)) s.add("grave");
  if (/(spell|permanent) is blue|target blue|blue spell|blue permanent/.test(o) || /pyroblast|red elemental blast/.test(n)) s.add("antiBlue");
  if (/(spell|permanent) is red|target red|red spell|red permanent/.test(o) || /hydroblast|blue elemental blast/.test(n)) s.add("antiRed");
  if (/gain \d+ life|you gain life|gains? life equal/.test(o)) s.add("life");
  if (/counter target/.test(o)) s.add("counter");
  if (/target (player|opponent) (reveals|discards)|each opponent discards/.test(o)) s.add("discard");
  if (/destroy target (nonbasic )?land|destroy all lands|nonbasic lands? (are|don't)/.test(o)) s.add("lands");
  return [...s];
}
function printFrom(c){
  const f0=(c.card_faces||[])[0]||{}; const p=c.prices||{};
  return {id:c.id, n:c.name, set:(c.set||"").toUpperCase(), sn:c.set_name||"", num:c.collector_number||"", rar:c.rarity||"", rel:c.released_at||"", lang:c.lang||"en",
    img:(c.image_uris&&c.image_uris.normal)||(f0.image_uris&&f0.image_uris.normal)||"", sm:(c.image_uris&&c.image_uris.small)||(f0.image_uris&&f0.image_uris.small)||"", art:(c.image_uris&&c.image_uris.art_crop)||(f0.image_uris&&f0.image_uris.art_crop)||"",
    usd:num(p.usd), usdF:num(p.usd_foil), usdE:num(p.usd_etched), eur:num(p.eur), eurF:num(p.eur_foil), eurE:num(p.eur_etched),
    fin:c.finishes||[], promo:!!c.promo, fx:(c.frame_effects||[]).join(","), full:!!c.full_art, bord:c.border_color||"",
    ck:(c.purchase_uris&&c.purchase_uris.cardkingdom)||"", tcg:(c.purchase_uris&&c.purchase_uris.tcgplayer)||"", cm:(c.purchase_uris&&c.purchase_uris.cardmarket)||"", uri:c.scryfall_uri||"", at:Date.now()};
}
function fromScry(c){
  const f0 = (c.card_faces||[])[0] || {};
  const tl = c.type_line || f0.type_line || "";
  const oracle = (c.oracle_text!=null ? c.oracle_text : (c.card_faces||[]).map(x=>x.oracle_text||"").join("\n"));
  const o = oracle.toLowerCase().split(c.name.toLowerCase()).join("this").split((f0.name||"@@@").toLowerCase()).join("this");
  const cost = (c.card_faces && c.card_faces.length && f0.mana_cost!=null) ? f0.mana_cost : (c.mana_cost||"");
  const t = mainType(tl); const pm = c.produced_mana || []; const lg=c.legalities||{}; const pr=printFrom(c);
  return {
    n:c.name, cmc:c.cmc||0, ci:(c.color_identity||[]).join(""), col:(c.colors||f0.colors||[]).join(""), t, tl:tl.split(" // ")[0], cost, pm,
    r:detectRoles(o,t,tl,pm), sb:sbCats(o,c.name), tg:(typeof detectTags==="function"?detectTags(o,t,tl):[]), gc: c.game_changer===true,
    xt:/take an extra turn/.test(o), mld:/destroy all lands|each player sacrifices (all|\w+) lands|lands don't untap|destroy all permanents/.test(o),
    tap: t==="Land" && /enters( the battlefield)? tapped\./.test(o) && !/unless|if you control|you may pay|you may reveal/.test(o),
    leg:/Legendary/.test(tl), lg:{commander:lg.commander||"", pauper:lg.pauper||"", pioneer:lg.pioneer||""},
    usd:pr.usd!=null?pr.usd:pr.usdF, eur:pr.eur!=null?pr.eur:pr.eurF, img:pr.img, uri:pr.uri, ck:pr.ck,
    rank:c.edhrec_rank||null, rsv:!!c.reserved, rel:c.released_at||"", rar:c.rarity||"", at:Date.now()
  };
}
function cardOf(name){
  const k = slug(name);
  if (BASICS.has(k)){ const b=k.replace("snow-covered-",""); return {n:name,cmc:0,ci:BASIC_CI[b]||"",t:"Land",tl:"Basic Land",r:[],pm:BASIC_CI[b]?[BASIC_CI[b]]:["C"],basic:true,usd:0,eur:0,lg:{commander:"legal",pauper:"legal",pioneer:"legal"}}; }
  const c = S.cards[k]; if (!c) return null;
  const ov = S.data.roles && S.data.roles[k];
  if (!ov && (c.gc || !S.gc.has(k))) return c;
  return {...c, gc: c.gc || S.gc.has(k), ...(ov?{r:ov, rOv:true}:{})};
}
const cur = () => S.data.settings.cur;
function refPrice(m){ if(!m) return null; if (m.basic) return 0; const v = cur()==="eur" ? (m.minE!=null?m.minE:m.eur) : (m.min!=null?m.min:m.usd); return v==null?null:v; }
function priceOf(m){ return refPrice(m); }
function wishPrice(w){
  if (w.pk && S.prints[w.pk]){ const p=S.prints[w.pk], e=cur()==="eur"; const v = w.finish==="etched"?(e?p.eurE:p.usdE):w.finish==="foil"?(e?p.eurF:p.usdF):(e?p.eur:p.usd); if (v!=null) return v; }
  return refPrice(cardOf(w.n));
}
function wishKey(w){ if (w.pk) return histKey("p", w.pk+":"+(w.finish||"n")); return (S.hist[histKey("m",slug(w.n))] && cur()==="usd") ? histKey("m",slug(w.n)) : oracleKey(w.n); }
function pkOf(it){ return it.sid ? it.sid : (it.set && it.num ? (it.set.toLowerCase()+"/"+it.num) : null); }
function itemPrice(it){
  const pk=pkOf(it); const p = pk && S.prints[pk];
  if (p){ const e=cur()==="eur"; const v = it.foil==="etched" ? (e?p.eurE:p.usdE) : it.foil==="foil" ? (e?p.eurF:p.usdF) : (e?p.eur:p.usd); if (v!=null) return v; const alt = e?(p.eur??p.eurF):(p.usd??p.usdF); if (alt!=null) return alt; }
  const m=cardOf(it.n); if (!m) return null; if (m.basic) return 0;
  return cur()==="eur" ? (m.eur??null) : (m.usd??null);
}
function money(v, opts={}){
  if (v==null || isNaN(v)) return "—";
  const sym = cur()==="eur"?"€":"US$";
  const base = sym + (Math.abs(v)>=100?Math.round(v).toLocaleString("es-CL"):v.toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2}));
  const clp = parseFloat(S.data.settings.clp);
  if (opts.clp && clp>0) return `${base} <span class="muted">≈ $${Math.round(v*clp).toLocaleString("es-CL")} CLP</span>`;
  return base;
}
const pct = v => v==null||isNaN(v) ? "—" : (v>0?"+":"")+v.toFixed(Math.abs(v)<10?1:0)+"%";

/* ---------- colección ---------- */
let _ci=null,_ciSig="";
function collIndex(){
  const items=S.data.collection.items||[]; const sig=items.length+":"+(S.data.collection.v||0);
  if (_ci && _ciSig===sig) return _ci;
  _ci=new Map(); for (const it of items){ const k=slug(it.n); const p=_ci.get(k); if(p){ p.q+=it.q; p.items.push(it); } else _ci.set(k,{n:it.n,q:it.q,items:[it]}); }
  _ciSig=sig; return _ci;
}
const touchColl = () => { bumpAnalysis(); S.data.collection.v=(S.data.collection.v||0)+1; };
function ownedOf(name){ const k=slug(name); if (BASICS.has(k)) return Infinity; const it=collIndex().get(k); return it?it.q:0; }
function usedMap(){
  const used = new Map();
  for (const d of S.data.decks){ if (d.rival) continue; for (const c of [...(d.cards||[]),...(d.side||[]),...(d.commanders||[]).map(n=>({n,q:1}))]){ const k=slug(c.n); if(!used.has(k)) used.set(k,[]); used.get(k).push({d:d.name,id:d.id,f:d.format,q:c.q}); } }
  return used;
}
function collKey(it){ return [slug(it.n), (it.set||"").toUpperCase(), it.num||"", it.foil||"", (it.sid||"").toLowerCase(), (it.lang||"").toLowerCase(), (it.cond||"").toLowerCase()].join("|"); }

/* ---------- Scryfall ---------- */
let lastCall=0;
async function sf(url, body){
  const wait = Math.max(0, lastCall+120-Date.now()); if (wait) await sleep(wait); lastCall=Date.now();
  const r = await fetch(url, body ? {method:"POST", headers:{"Content-Type":"application/json", Accept:"application/json"}, body:JSON.stringify(body)} : {headers:{Accept:"application/json"}});
  if (r.status===429){ await sleep(1500); return sf(url, body); }
  return r;
}
function setBusy(label,total){ S.busy={label,done:0,total}; render(); }
function stepBusy(n){ if(S.busy){ S.busy.done=Math.min(S.busy.total,n); renderBusy(); } }
async function fetchCards(names, {force=false, label="Buscando cartas en Scryfall", quiet=false}={}){
  if (isWebView()) return webFetchCards(names, {force, quiet});
  const maxAge = 7*864e5;
  const todo = [...new Map(names.filter(Boolean).map(n=>[slug(n), String(n).trim()])).values()]
    .filter(n=>!BASICS.has(slug(n)) && (force || !S.cards[slug(n)] || Date.now()-(S.cards[slug(n)].at||0) > maxAge));
  if (!todo.length) return 0;
  const own = !S.busy; if (own) setBusy(label, todo.length);
  let found=0; const notFound=[];
  try{
    for (let i=0;i<todo.length;i+=75){
      const chunk = todo.slice(i,i+75);
      const r = await sf("https://api.scryfall.com/cards/collection", {identifiers: chunk.map(n=>({name:n.split(" // ")[0]}))});
      if (!r.ok) throw new Error("Scryfall "+r.status);
      const j = await r.json();
      for (const c of j.data||[]){ const prev=S.cards[slug(c.name)]; const v=fromScry(c); if (prev&&prev.minAt){ v.min=prev.min; v.minE=prev.minE; v.minAt=prev.minAt; v.minP=prev.minP; } S.cards[slug(c.name)] = v; found++; }
      for (const nf of j.not_found||[]) if (nf.name) notFound.push(nf.name);
      if (own) stepBusy(i+chunk.length);
    }
    for (const n of notFound.slice(0,40)){
      const r = await sf("https://api.scryfall.com/cards/named?fuzzy="+encodeURIComponent(n));
      if (r.ok){ const c=await r.json(); const v=fromScry(c); S.cards[slug(c.name)]=v; S.cards[slug(n)]=v; found++; }
    }
    saveCaches();
    const still = notFound.filter(n=>!S.cards[slug(n)]);
    if (still.length && !quiet) toast(`Scryfall no reconoció: ${still.slice(0,5).join(", ")}${still.length>5?"…":""}. Revisa el nombre en inglés.`);
  } catch(e){ S.netErr=(S.netErr||0)+1; saveCaches(); if(!quiet) toast(offlineMsg("Scryfall")); }
  finally { if (own){ S.busy=null; render(); } }
  return found;
}
async function fetchItems(items, {label="Actualizando versiones de tu colección"}={}){
  if (isWebView()) return 0;
  const ids = new Map();
  for (const it of items){ const pk=pkOf(it); if (!pk || ids.has(pk)) continue; ids.set(pk, it.sid ? {id:it.sid} : {set:it.set.toLowerCase(), collector_number:String(it.num)}); }
  const list=[...ids.entries()]; if (!list.length) return;
  const own=!S.busy; if (own) setBusy(label, list.length);
  try{
    for (let i=0;i<list.length;i+=75){
      const chunk=list.slice(i,i+75);
      const r = await sf("https://api.scryfall.com/cards/collection", {identifiers: chunk.map(x=>x[1])});
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      for (const c of j.data||[]){
        const p=printFrom(c); S.prints[c.id]=p; S.prints[(c.set||"").toLowerCase()+"/"+c.collector_number]=p;
        const k=slug(c.name); if (!S.cards[k]) S.cards[k]=fromScry(c);
      }
      if (own) stepBusy(i+chunk.length);
    }
    saveCaches();
  } catch(e){ S.netErr=(S.netErr||0)+1; if (!S.refreshing) toast("No se pudieron actualizar las versiones desde Scryfall."); }
  finally { if (own){ S.busy=null; render(); } }
}
async function fetchVersions(name){
  if (isWebView()) return null;
  const k=slug(name); const v=S.versions[k];
  if (v && Date.now()-v.at < 864e5) return v;
  try{
    const m=cardOf(name); const exact = (m&&m.n)||name;
    let url = "https://api.scryfall.com/cards/search?q="+encodeURIComponent(`!"${exact}" game:paper`)+"&unique=prints&order=released&dir=desc", list=[];
    while (url && list.length<350){ const r=await sf(url); if(!r.ok) break; const j=await r.json(); list.push(...(j.data||[]).map(printFrom)); url = j.has_more ? j.next_page : null; }
    if (!list.length) return null;
    for (const p of list){ S.prints[p.id]=p; S.prints[p.set.toLowerCase()+"/"+p.num]=p; }
    const en = list.filter(p=>p.lang==="en");
    const minOf = key => { const vals=en.map(p=>p[key]).filter(x=>x!=null); return vals.length?Math.min(...vals):null; };
    const out = {at:Date.now(), list};
    S.versions[k]=out;
    if (S.cards[k]){ S.cards[k].min = minOf("usd"); S.cards[k].minE = minOf("eur"); }
    saveCaches(); return out;
  } catch { return null; }
}
async function fetchCheapest(names, {force=false, label="Buscando la versión más barata de cada carta", max=400}={}){
  if (isWebView()){ webBlocked("precios"); return 0; }
  const todo = [...new Map(names.filter(Boolean).map(n=>[slug(n), String(n).trim()])).values()]
    .filter(n=>{ const k=slug(n); const c=S.cards[k]; return !BASICS.has(k) && c && (force || !c.minAt || Date.now()-c.minAt > 20*3600e3); }).slice(0,max);
  if (!todo.length) return 0;
  const own=!S.busy; if (own) setBusy(label, todo.length);
  let i=0;
  try{
    for (const n of todo){
      const k=slug(n); const exact=S.cards[k].n||n;
      const r = await sf("https://api.scryfall.com/cards/search?q="+encodeURIComponent(`!"${exact}" game:paper lang:en`)+"&unique=prints&order=usd&dir=asc");
      if (r.ok){ const j=await r.json(); const ps=(j.data||[]).map(printFrom);
        const u=ps.map(p=>p.usd).filter(x=>x!=null), e=ps.map(p=>p.eur).filter(x=>x!=null);
        S.cards[k].min = u.length?Math.min(...u):null; S.cards[k].minE = e.length?Math.min(...e):null; S.cards[k].minAt=Date.now();
        const best = ps.find(p=>p.usd===S.cards[k].min); if (best) S.cards[k].minP = {set:best.set, sn:best.sn, num:best.num, ck:best.ck};
      }
      if (own) stepBusy(++i);
    }
    saveCaches();
  } catch(e){ S.netErr=(S.netErr||0)+1; saveCaches(); if (!S.refreshing) toast("Se cortó la búsqueda de versiones baratas. Puedes retomarla más tarde."); }
  finally { if (own){ S.busy=null; render(); } }
  return i;
}
async function refreshGC(){
  if (isWebView()) return;
  if (S.gcAt && Date.now()-S.gcAt < 7*864e5) return;
  try{
    let url="https://api.scryfall.com/cards/search?q="+encodeURIComponent("is:gamechanger")+"&unique=cards", list=[];
    while (url){ const r=await sf(url); if(!r.ok) return; const j=await r.json(); list.push(...(j.data||[]).map(c=>c.name)); for (const c of j.data||[]) if(!S.cards[slug(c.name)]) S.cards[slug(c.name)]=fromScry(c); url = j.has_more ? j.next_page : null; }
    if (list.length>20){ S.gcAt=Date.now(); S.gc=new Set(list.map(slug)); idb.set("gc",{at:S.gcAt, list}); saveCaches(); render(); }
  }catch{}
}

/* ---------- historial de precios ---------- */
function histKey(kind, id){ return `${kind}:${cur()}:${id}`; }
function recordHist(key, price){
  bumpAnalysis();
  if (price==null || isNaN(price)) return;
  const d=today(); const h=S.hist[key]||(S.hist[key]=[]);
  if (h.length && h[h.length-1][0]===d) h[h.length-1][1]=price; else h.push([d, Math.round(price*100)/100]);
  if (h.length>200) h.splice(0,h.length-200);
}
function change(key, days){
  const h=S.hist[key]; if (!h || h.length<2) return null;
  const last=h[h.length-1]; const target=last[0]-days;
  let base=null; for (let i=h.length-2;i>=0;i--){ if (h[i][0]<=target){ base=h[i]; break; } }
  if (!base){ base=h[0]; if (last[0]-base[0] < Math.min(days,3)) return null; }
  if (!base[1]) return null;
  return {pct:100*(last[1]-base[1])/base[1], diff:last[1]-base[1], from:base[1], to:last[1], span:last[0]-base[0]};
}
function histRange(key, days){ const h=S.hist[key]||[]; const last=h.length?h[h.length-1][0]:today(); const w=h.filter(x=>x[0]>=last-days); if(!w.length) return null; const v=w.map(x=>x[1]); return {min:Math.min(...v), max:Math.max(...v)}; }
function oracleKey(name){ return histKey("c", slug(name)); }
function itemKey(it){ const pk=pkOf(it); return pk ? histKey("p", pk+":"+(it.foil||"n")) : oracleKey(it.n); }
function snapshotPrices(){
  const names = new Set([...S.data.decks.flatMap(allNames), ...S.data.wishlist.map(w=>w.n), ...(S.data.collection.items||[]).map(i=>i.n)]);
  for (const n of names){ if (BASICS.has(slug(n))) continue; const m=cardOf(n); if (m){ const v = cur()==="eur"?m.eur:m.usd; recordHist(oracleKey(n), v); if (m.min!=null && cur()==="usd") recordHist(histKey("m",slug(n)), m.min); } }
  for (const it of S.data.collection.items||[]){ if (pkOf(it)) recordHist(itemKey(it), itemPrice(it)); }
  for (const w of S.data.wishlist){ if (w.pk) recordHist(wishKey(w), wishPrice(w)); }
  for (const b of S.data.binders) for (const it of b.items){ if (pkOf(it)) recordHist(itemKey(it), itemPrice(it)); else { const m=cardOf(it.n); if (m) recordHist(oracleKey(it.n), cur()==="eur"?m.eur:m.usd); } }
  saveCaches();
}
async function refreshPrices(force=false){
  if (isWebView()){ if (force) webBlocked("precios"); return; }
  const st=S.data.settings;
  if (!force && Date.now()-(st.lastRefresh||0) < 20*3600e3) return;
  const names = [...new Set([...S.data.decks.flatMap(allNames), ...S.data.wishlist.map(w=>w.n), ...(S.data.collection.items||[]).filter(i=>!pkOf(i)).map(i=>i.n), ...binderItems().filter(i=>!pkOf(i)).map(i=>i.n)])];
  const items = [...(S.data.collection.items||[]).filter(i=>pkOf(i)), ...binderItems().filter(i=>pkOf(i)), ...S.data.wishlist.filter(w=>w.pk).map(w=>({n:w.n, sid:w.pk}))];
  const total = names.length + items.length; if (!total) return;
  if (S.refreshing) return; S.refreshing = true; S.netErr = 0;
  setBusy("Actualizando precios del día", total);
  const bz = S.busy;   // otras tareas pueden limpiar S.busy mientras esto corre
  const step = (label, tot, done) => { if (label!=null) bz.label=label; if (tot!=null) bz.total=tot; if (done!=null) bz.done=done; if (S.busy===bz) renderBusy(); };
  try{
    await fetchCards(names, {force:true, quiet:true});
    if (S.netErr){ toast(offlineMsg("Scryfall")); return; }   // sin conexión: no se marca el día como actualizado
    step(null, null, names.length);
    await fetchItems(items);
    const cheapNames = [...new Set([...S.data.wishlist.map(w=>w.n), ...S.data.decks.flatMap(allNames)])];
    step("Buscando la versión más barata", cheapNames.length, 0);
    let ci=0; for (const n of cheapNames){ await fetchCheapest([n],{force:true}); if (S.netErr) break; ci++; if (ci%10===0) step(null, null, ci); }
    snapshotPrices();
    if (!S.netErr){ st.lastRefresh=Date.now(); saveData(); } else toast("La actualización de precios quedó incompleta por la conexión. Se reintentará.");
  } finally { S.refreshing=false; if (S.busy===bz) S.busy=null; render(); }
}

/* ---------- EDHREC ---------- */
async function loadEdhrec(d, force=false){
  if (isWebView()){ webBlocked("edhrec"); return null; }
  const cmds = d.commanders||[]; if (!cmds.length){ toast("El mazo necesita comandante para buscar recomendaciones."); return null; }
  const key = cmds.map(edhSlug).join("-");
  const cached = S.edh[key];
  if (cached && !force && Date.now()-cached.at < 7*864e5) return cached;
  const tries = cmds.length>1 ? [cmds.map(edhSlug).join("-"), [...cmds].reverse().map(edhSlug).join("-")] : [key];
  setBusy("Consultando EDHREC", 1);
  try{
    let j=null, used=null;
    for (const s of tries){ const r = await fetch(`https://json.edhrec.com/pages/commanders/${s}.json`); if (r.ok){ j=await r.json(); used=s; break; } }
    if (!j) throw new Error("no encontrado");
    const jd = (j.container && j.container.json_dict) || {};
    const pool = new Map();
    for (const l of jd.cardlists||[]) for (const v of l.cardviews||[]){
      const pot = v.potential_decks||0; const incl = pot ? (v.num_decks!=null?v.num_decks:(v.inclusion||0))/pot : null;
      const rec = {n:v.name, incl, syn: v.synergy!=null?v.synergy:null};
      const p = pool.get(slug(v.name)); if (!p || (rec.incl||0)>(p.incl||0)) pool.set(slug(v.name), rec);
    }
    const themes = ((j.panels && j.panels.taglinks)||[]).map(t=>({v:t.value, c:t.count, s:t.slug})).slice(0,14);
    const out = {at:Date.now(), slug:used, decks: j.num_decks_avg || (jd.card && jd.card.num_decks) || null, themes, pool:[...pool.values()]};
    S.edh[key]=out; saveCaches(); S.busy=null;
    await fetchCards(out.pool.map(c=>c.n), {label:"Trayendo precios de las recomendaciones"});
    return out;
  } catch(e){ toast(`EDHREC no respondió para “${cmds.join(" + ")}”. Puedes verlo directo en edhrec.com.`); return null; }
  finally { S.busy=null; render(); }
}
const edhOf = d => { const k=(d.commanders||[]).map(edhSlug).join("-"); return S.edh[k]||null; };

/* ---------- Commander Spellbook ---------- */
async function loadCombos(d){
  if (isWebView()){ webBlocked("combos"); return; }
  setBusy("Buscando combos en Commander Spellbook", 1);
  try{
    const r = await fetch("https://backend.commanderspellbook.com/find-my-combos", {method:"POST", headers:{"Content-Type":"application/json", Accept:"application/json"},
      body: JSON.stringify({commanders:(d.commanders||[]).map(n=>({card:n, quantity:1})), main:(d.cards||[]).map(c=>({card:c.n, quantity:c.q}))})});
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json(); const res = j.results || j;
    const norm = v => ({id:v.id, cards:(v.uses||[]).map(u=>(u.card&&u.card.name)||u.card||"").filter(x=>typeof x==="string"&&x),
      prod:(v.produces||[]).map(p=>(p.feature&&p.feature.name)||p.name||"").filter(Boolean), desc:String(v.description||"").slice(0,900), bt:v.bracketTag||null});
    const combos = {at:Date.now(), inc:(res.included||[]).map(norm).slice(0,60), almost:(res.almostIncluded||[]).map(norm).slice(0,60)};
    const cur = S.data.decks.find(x=>x.id===d.id) || d;   // el mazo pudo cambiar mientras se esperaba la respuesta
    saveDeck({...cur, combos}, {silent:true, noLog:true});
  } catch(e){ toast("Commander Spellbook no respondió. Prueba de nuevo o revisa en commanderspellbook.com."); }
  finally { S.busy=null; render(); }
}

/* ---------- EDHTop16 (cEDH) ---------- */
async function loadCedhLive(){
  if (isWebView()){ webBlocked("cedh"); return; }
  setBusy("Consultando EDHTop16", 1);
  const q = `query { commanders(first: 30, sortBy: POPULARITY, timePeriod: THREE_MONTHS) { edges { node { name colorId stats(filters: {timePeriod: THREE_MONTHS}) { count metaShare conversionRate topCuts } } } } }`;
  try{
    const r = await fetch("https://edhtop16.com/api/graphql", {method:"POST", headers:{"Content-Type":"application/json", Accept:"application/json"}, body:JSON.stringify({query:q})});
    const j = await r.json();
    const edges = j && j.data && j.data.commanders && j.data.commanders.edges;
    if (!edges || !edges.length) throw new Error((j.errors&&j.errors[0]&&j.errors[0].message)||"sin datos");
    S.cedhLive = {at:Date.now(), top: edges.map(e=>{ const s=e.node.stats||{}; const ms = s.metaShare!=null ? (s.metaShare<=1? s.metaShare*100 : s.metaShare) : null; const cr = s.conversionRate!=null ? (s.conversionRate<=1? s.conversionRate*100 : s.conversionRate) : null; return [e.node.name, ms, s.count??null, cr, s.topCuts??null, e.node.colorId||""]; })};
    toast("Datos de EDHTop16 actualizados.");
  } catch(e){ toast("EDHTop16 no respondió desde el navegador. Se muestra la foto guardada del "+META_AT+"."); }
  finally { S.busy=null; render(); }
}

/* ---------- Card Kingdom ---------- */
function ckIngest(data){
  const want = new Set([...(S.data.collection.items||[]).map(i=>slug(i.n)), ...binderItems().map(i=>slug(i.n)), ...S.data.wishlist.map(w=>slug(w.n)), ...S.data.decks.flatMap(d=>allNames(d).map(slug))]);
  const byId={}, byName={}, byNE={};
  for (const p of data){
    const k=slug(p.name); if (!want.has(k)) continue;
    const f = p.is_foil==="true"||p.is_foil===true;
    const rec={r:num(p.price_retail), b:num(p.price_buy), qb:+p.qty_buying||0, qr:+p.qty_retail||0, f, u:p.url?("https://www.cardkingdom.com/"+String(p.url).replace(/^\//,"")):"", ed:p.edition||"", v:p.variation||"", sku:p.sku||""};
    if (p.scryfall_id) byId[String(p.scryfall_id).toLowerCase()+(f?":f":"")]=rec;
    const ne = k+"|"+slug(p.edition||"")+(f?"|f":""); if (!byNE[ne] || (rec.r!=null && (byNE[ne].r==null || rec.r<byNE[ne].r))) byNE[ne]=rec;
    const nk = k+(f?"|f":""); const c0=byName[nk]; if (rec.r!=null && (!c0 || rec.r<c0.r)) byName[nk]=rec;
  }
  S.ck={at:Date.now(), byId, byName, byNE, n:Object.keys(byId).length}; idb.set("ck", S.ck);
}
async function loadCK(){
  if (isWebView()){ webBlocked("ck"); return; }
  setBusy("Descargando precios de Card Kingdom (archivo grande)", 1);
  try{
    const r = await fetch("https://api.cardkingdom.com/api/v2/pricelist");
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json(); ckIngest(j.data || j);
    toast("Precios de Card Kingdom cargados.");
  } catch(e){ S.ckFail=true; toast("Card Kingdom no permitió la descarga desde el navegador. Descarga su lista de precios y súbela con “Subir archivo de Card Kingdom”."); }
  finally { S.busy=null; render(); }
}
async function loadCKFile(file){
  setBusy("Leyendo la lista de precios de Card Kingdom", 1);
  try{ const j = JSON.parse(await file.text()); const data = j.data || j; if (!Array.isArray(data) || !data.length || !data[0].name) throw new Error("formato"); ckIngest(data); S.ckFail=false; toast(`Precios de Card Kingdom cargados desde el archivo.`); }
  catch(e){ toast("Ese archivo no parece la lista de precios de Card Kingdom (pricelist en JSON)."); }
  finally { S.busy=null; render(); }
}
// Busca el precio de Card Kingdom de la versión exacta: Scryfall ID + acabado; si no, nombre + edición; si no, el más barato por nombre.
function ckOf(it){
  if (!S.ck) return null; const f = !!it.foil; const k=slug(it.n);
  if (it.sid){ const r=S.ck.byId[it.sid.toLowerCase()+(f?":f":"")]; if (r) return {...r, match:"exacta"}; }
  const pk=pkOf(it); const p = pk && S.prints[pk];
  if (p && p.id){ const r=S.ck.byId[p.id.toLowerCase()+(f?":f":"")]; if (r) return {...r, match:"exacta"}; }
  if (p && p.sn && S.ck.byNE){ const r=S.ck.byNE[k+"|"+slug(p.sn)+(f?"|f":"")]; if (r) return {...r, match:"edición"}; }
  const r = S.ck.byName[k+(f?"|f":"")] || S.ck.byName[k]; return r ? {...r, match:"nombre"} : null;
}

/* ---------- análisis ---------- */
// el análisis de cada mazo se guarda hasta que cambia el mazo, las cartas o la colección
let _anaEpoch = 0; const _anaCache = new WeakMap();
function bumpAnalysis(){ _anaEpoch++; }
function analyze(d){
  const sig = _anaEpoch + "|" + (d.updated||0) + "|" + (S.data.collection.v||0) + "|" + (S.data.collection.items||[]).length + "|" + cur() + "|" + S.gc.size;
  const hit = _anaCache.get(d); if (hit && hit.sig === sig) return hit.A;
  const A = analyzeRaw(d); _anaCache.set(d, {sig, A}); return A;
}
function analyzeRaw(d){
  const fmt = d.format||"commander", isC = fmt==="commander";
  const cmdMeta = (d.commanders||[]).map(cardOf);
  let ci = [...new Set(cmdMeta.flatMap(m => m ? m.ci.split("") : []))];
  const rows = (d.cards||[]).map(c => ({...c, m:cardOf(c.n)}));
  const side = (d.side||[]).map(c => ({...c, m:cardOf(c.n)}));
  const maybe = (d.maybe||[]).map(c => ({...c, m:cardOf(c.n)}));
  const maybeN = maybe.reduce((a,r)=>a+r.q,0);
  const counted = isC ? [] : side; // en Commander el sideboard no cuenta para el mazo
  if (!isC) ci = [...new Set(rows.flatMap(r => r.m ? (r.m.t==="Land"?[]:(r.m.col||r.m.ci).split("")) : []))];
  ci = ci.filter(c=>WUBRG.includes(c)).sort((a,b)=>WUBRG.indexOf(a)-WUBRG.indexOf(b)).join("");
  const main = rows.reduce((a,r)=>a+r.q,0);
  const total = main + (isC?(d.commanders||[]).length:0);
  const sideN = side.reduce((a,r)=>a+r.q,0);
  const missing = [...(d.commanders||[]).filter(n=>!cardOf(n)), ...rows.filter(r=>!r.m).map(r=>r.n), ...side.filter(r=>!r.m).map(r=>r.n), ...maybe.filter(r=>!r.m).map(r=>r.n)];
  const roles = {land:0,ramp:0,draw:0,removal:0,wipe:0,tutor:0,protection:0,wincon:0,recursion:0};
  const types = {}; const curve = [0,0,0,0,0,0,0,0]; let cmcSum=0, spells=0; const gc=[], off=[], dupes=[], illegal=[], xt=[], mld=[], tutors=[];
  let price=0;
  const lim = isC ? 1 : 4;
  const copies = new Map(); for (const r of [...rows, ...counted]){ copies.set(slug(r.n), (copies.get(slug(r.n))||0)+r.q); }
  for (const r of rows){
    const t = r.m ? r.m.t : "Unknown"; types[t]=(types[t]||0)+r.q;
    if (r.m){
      if (t==="Land") roles.land += r.q;
      else { curve[Math.min(7,Math.round(r.m.cmc))] += r.q; cmcSum += r.m.cmc*r.q; spells += r.q; }
      for (const x of r.m.r||[]) if (x in roles && x!=="land") roles[x]+=r.q;
      if (r.m.gc) gc.push(r.n); if (r.m.xt) xt.push(r.n); if (r.m.mld) mld.push(r.n); if ((r.m.r||[]).includes("tutor")) tutors.push(r.n);
      if (isC && cmdMeta.length && cmdMeta.every(Boolean) && (r.m.ci||"").split("").some(c=>WUBRG.includes(c) && !ci.includes(c))) off.push(r.n);
    }
  }
  for (const r of [...rows, ...counted]){
    if (r.m && r.m.lg && r.m.lg[fmt] && r.m.lg[fmt]!=="legal" && r.m.lg[fmt]!=="restricted" && !illegal.includes(r.n)) illegal.push(r.n);
    const p = refPrice(r.m); if (p!=null) price += p*r.q;
  }
  for (const [k,q] of copies){ if (q>lim && !BASICS.has(k) && !(()=>{ const r0=[...rows,...counted].find(x=>slug(x.n)===k); return ANY_NUMBER.test((r0?r0.n:k.replace(/-/g," ")).toLowerCase()); })()) { const r=[...rows,...counted].find(x=>slug(x.n)===k); dupes.push(r?r.n:k); } }
  for (const m of cmdMeta) if (m){ if (m.gc) gc.push(m.n); const p=refPrice(m); if(p!=null) price+=p; if (m.lg && m.lg.commander && m.lg.commander!=="legal") illegal.push(m.n); }
  const all = [...rows, ...counted, ...(d.commanders||[]).map(n=>({n,q:1,m:cardOf(n)}))];
  const needRows = all.filter(r=>!(r.m&&r.m.basic) && !BASICS.has(slug(r.n)));
  const needBy = new Map(); for (const r of needRows){ const k=slug(r.n); const p=needBy.get(k); if(p) p.q+=r.q; else needBy.set(k,{n:r.n,q:r.q,m:r.m}); }
  let ownedCount=0, needCount=0; const missingCards=[];
  for (const x of needBy.values()){ const o=ownedOf(x.n); ownedCount+=Math.min(x.q,o); needCount+=x.q; if (o<x.q) missingCards.push({n:x.n,q:x.q-o,m:x.m}); }
  const hasP = arr => arr.some(x=>x.m && !x.m.basic && refPrice(x.m)!=null);
  const missingCost = missingCards.length && !hasP(missingCards) ? null : missingCards.reduce((a,x)=>a+(refPrice(x.m)||0)*x.q,0);
  const boardInfo = arr => { let price=0, own=0, need=0; const miss=[]; for (const r of arr){ const p=refPrice(r.m); if (p!=null) price+=p*r.q; if (r.m&&r.m.basic) continue; const o=ownedOf(r.n); own+=Math.min(o,r.q); need+=r.q; if (o<r.q) miss.push({n:r.n,q:r.q-o,m:r.m}); } return {price: arr.length && !arr.some(r=>r.m && !r.m.basic && refPrice(r.m)!=null) ? null : price, own, need, miss, cost: miss.length && !miss.some(x=>refPrice(x.m)!=null) ? null : miss.reduce((a,x)=>a+(refPrice(x.m)||0)*x.q,0)}; };
  const sideInfo = boardInfo(side), maybeInfo = boardInfo(maybe);
  return {sideInfo, maybeInfo, maybe, maybeN, fmt,isC,ci,rows,side,main,total,sideN,missing,roles,types,curve,avg:spells?cmcSum/spells:0,spells,gc,off,dupes,illegal,xt,mld,tutors,ownedCount,needCount,missingCards,missingCost,cmdMeta,price: (rows.length && !hasP([...rows, ...cmdMeta.filter(Boolean).map(m=>({m}))])) ? null : price};
}
function status(v,lo,hi){ if (v>=lo && v<=hi) return "good"; if (v<lo*0.7 || v>hi*1.3) return "bad"; return "warn"; }
function karstenLands(A){ const cheap = A.rows.filter(r=>r.m && r.m.t!=="Land" && r.m.cmc<=2 && (r.m.r||[]).some(x=>x==="ramp"||x==="draw")).reduce((a,r)=>a+r.q,0);
  return A.isC ? 31.42 + 3.13*A.avg - 0.28*cheap : 19.59 + 1.90*A.avg - 0.28*cheap; }
function combos2(d){ return (d.combos && d.combos.inc || []).filter(c=>c.cards.length<=2); }
function bracketOf(d,A){
  const c2 = combos2(d).length, gcN = A.gc.length; let b, why=[];
  if (gcN>=4 || A.mld.length || c2){ b=4; if(gcN>=4) why.push(`${gcN} Game Changers (más de 3)`); if(A.mld.length) why.push("destrucción masiva de tierras"); if(c2) why.push(`${c2} combo${c2>1?"s":""} de 2 cartas`); }
  else if (gcN>=1 || A.xt.length>2 || A.tutors.length>3){ b=3; if(gcN) why.push(`${gcN} Game Changer${gcN>1?"s":""}`); if(A.xt.length>2) why.push("varios turnos extra"); if(A.tutors.length>3) why.push(`${A.tutors.length} tutores`); }
  else { b=2; why.push("sin Game Changers"+(d.combos?", sin combos de 2 cartas":"")); if (!A.tutors.length && !A.xt.length) why.push("sin tutores ni turnos extra (podría ser 1 si es temático)"); }
  return {b, why:why.join(" · "), exact:!!d.combos};
}
function health(d,A,sim){
  const checks = A.isC ? [
    {ok:A.total===100, t:`100 cartas exactas (${A.total})`, w:15},
    {ok:!A.off.length && A.cmdMeta.every(Boolean), t:"Todo dentro de la identidad de color", w:10},
    {ok:!A.dupes.length, t:"Singleton sin copias repetidas", w:10},
    {ok:!A.illegal.length, t:"Todas las cartas legales en Commander", w:5},
    ...TARGETS.map(t=>({ok:status(A.roles[t.k],t.lo,t.hi)==="good", t:`${t.n} en rango (${A.roles[t.k]} de ${t.lo}–${t.hi})`, w:8})),
    {ok:A.avg>0 && A.avg<=3.6, t:`Curva razonable (CMC ${A.avg.toFixed(2)} ≤ 3,6)`, w:6},
    {ok:!!sim && sim.pScrew<=0.15, t:`Pocas manos atascadas${sim?` (${Math.round(sim.pScrew*100)}%)`:""}`, w:6},
  ] : [
    {ok:A.main>=60, t:`Mínimo 60 cartas en el main (${A.main})`, w:20},
    {ok:A.sideN<=15, t:`Sideboard de 15 o menos (${A.sideN})`, w:10},
    {ok:!A.dupes.length, t:"Máximo 4 copias por carta", w:15},
    {ok:!A.illegal.length, t:`Todas las cartas legales en ${FORMATS[A.fmt].name}`, w:20},
    {ok:Math.abs(A.roles.land-karstenLands(A))<=2, t:`Tierras acordes a la curva (${A.roles.land}; sugerido ${Math.round(karstenLands(A))})`, w:15},
    {ok:A.sideN>=10, t:"Sideboard armado (10 a 15 cartas)", w:10},
    {ok:A.avg>0 && A.avg<=(A.fmt==="pauper"?2.6:3), t:`Curva ágil (CMC ${A.avg.toFixed(2)})`, w:10},
  ];
  const tot = checks.reduce((a,c)=>a+c.w,0), got = checks.reduce((a,c)=>a+(c.ok?c.w:0),0);
  return {score:Math.round(100*got/tot), checks};
}

/* ---------- simulador ---------- */
const simCache = new Map();
function hyper(N,K,n,k){ const C=(a,b)=>{ if(b<0||b>a) return 0; let r=1; for(let i=1;i<=b;i++) r=r*(a-b+i)/i; return r; }; return C(K,k)*C(N-K,n-k)/C(N,n); }
function atLeast(N,K,n,k){ let s=0; for (let i=k;i<=Math.min(n,K);i++) s+=hyper(N,K,n,i); return s; }
function simulate(d, A){
  const key = JSON.stringify([d.format,d.cards,d.commanders,A.missing.length]);
  if (simCache.has(key)) return simCache.get(key);
  const lib=[]; for (const r of A.rows){ for(let i=0;i<r.q;i++) lib.push({land:!!(r.m&&r.m.t==="Land"), ramp:!!(r.m&&r.m.t!=="Land"&&(r.m.r||[]).includes("ramp")), win:!!(r.m&&(r.m.r||[]).includes("wincon")), cmc:r.m?r.m.cmc:3}); }
  const N = lib.length; if (N<40) return null;
  const L = lib.filter(c=>c.land).length;
  const hyp=[]; for(let k=0;k<=7;k++) hyp.push(hyper(N,L,7,k));
  if (!A.isC){
    const res = {sixty:true, N, L, hyp, keep: hyp.slice(2,6).reduce((a,b)=>a+b,0),
      drops: [2,3,4,5].map(t=>({t, play:atLeast(N,L,7+t-1,t), draw:atLeast(N,L,7+t,t)}))};
    simCache.set(key,res); return res;
  }
  const cmd = A.cmdMeta.filter(Boolean).map(m=>m.cmc); const cmdCmc = cmd.length?Math.min(...cmd):4;
  const G=10000; let mullAny=0, screw=0, flood=0, turnSum=0, turnN=0; const byT={4:0,5:0,6:0};
  const manaT=new Array(11).fill(0); let winSum=0, winN=0; const winBy={6:0,8:0,10:0}; const hasWin = lib.some(c=>c.win);
  const idx = lib.map((_,i)=>i);
  const shuffle=()=>{ for(let i=N-1;i>0;i--){const j=(Math.random()*(i+1))|0; const t=idx[i]; idx[i]=idx[j]; idx[j]=t;} };
  for (let g=0; g<G; g++){
    let m=0, hand;
    while(true){ shuffle(); hand=idx.slice(0,7).map(i=>lib[i]); const Lh=hand.filter(c=>c.land).length; if ((Lh>=2&&Lh<=5)||m>=2) break; m++; }
    if(m) mullAny++;
    let bottom=Math.max(0,m-1);
    while(bottom-- > 0){ const Lh=hand.filter(c=>c.land).length; let k = Lh>4 ? hand.findIndex(c=>c.land) : hand.reduce((bi,c,i)=>(!c.land && (bi<0||c.cmc>hand[bi].cmc))?i:bi,-1); if(k<0)k=0; hand.splice(k,1); }
    let ptr=7, inPlay=0, bonus=0, pending=0, cmdT=null, winT=null, landsSeen=hand.filter(c=>c.land).length;
    for (let t=1;t<=10;t++){
      if (t>1 && ptr<N){ const c=lib[idx[ptr++]]; hand.push(c); if(c.land && t<=6) landsSeen++; }
      const li=hand.findIndex(c=>c.land); if(li>=0){hand.splice(li,1); inPlay++;}
      bonus+=pending; pending=0; let mana=inPlay+bonus; manaT[t]+=mana;
      if (winT===null && hand.some(c=>c.win && c.cmc<=mana)) winT=t;
      if (cmdT===null && mana>=cmdCmc){ cmdT=t; mana-=cmdCmc; }
      const rs = hand.map((c,i)=>[c,i]).filter(([c])=>c.ramp).sort((a,b)=>a[0].cmc-b[0].cmc);
      const used=[]; for (const [c,i] of rs){ if (c.cmc<=mana){ mana-=c.cmc; pending++; used.push(i);} }
      used.sort((a,b)=>b-a).forEach(i=>hand.splice(i,1));
      if (t===4 && inPlay<3) screw++;
    }
    if (landsSeen>=8) flood++;
    if (cmdT!==null){ turnSum+=cmdT; turnN++; for (const k of [4,5,6]) if (cmdT<=k) byT[k]++; }
    if (winT!==null){ winSum+=winT; winN++; for (const k of [6,8,10]) if (winT<=k) winBy[k]++; }
  }
  const res = {G, cmdCmc, pMull:mullAny/G, pScrew:screw/G, pFlood:flood/G, avgTurn:turnN?turnSum/turnN:null, byT:{4:byT[4]/G,5:byT[5]/G,6:byT[6]/G}, hyp, L, N, manaT:manaT.map(v=>v/G), hasWin, winAvg:winN?winSum/winN:null, winP:winN/G, winBy:{6:winBy[6]/G,8:winBy[8]/G,10:winBy[10]/G}};
  simCache.set(key,res); return res;
}

/* ---------- base de maná ---------- */
function manaBase(A){
  const pips={W:0,U:0,B:0,R:0,G:0}, src={W:0,U:0,B:0,R:0,G:0}, rocks={W:0,U:0,B:0,R:0,G:0};
  let lands=0, basics=0; const tapped=[], utility=[];
  const all = [...A.rows, ...A.cmdMeta.filter(Boolean).map(m=>({n:m.n,q:1,m}))];
  for (const r of all){
    const m=r.m; if(!m) continue;
    if (m.t!=="Land"){
      const syms = (m.cost||"").match(/\{[^}]+\}/g)||[];
      for (const s of syms) for (const c of WUBRG) if (s.includes(c)) pips[c]+= (r.q||1);
      if ((m.r||[]).includes("ramp")) for (const c of (m.pm||[])) if (c in rocks) rocks[c]+=r.q;
    } else {
      lands+=r.q; if (m.basic) basics+=r.q;
      if (m.tap) tapped.push(r.n);
      const cols = (m.pm||[]).filter(c=>WUBRG.includes(c));
      for (const c of cols) src[c]+=r.q;
      if (!cols.length && !m.basic) utility.push(r.n);
    }
  }
  const cols = WUBRG.filter(c=>A.ci.includes(c) || pips[c]>0);
  const pipT = cols.reduce((a,c)=>a+pips[c],0)||1;
  return {pips,src,rocks,lands,basics,tapped,utility,cols,pipT};
}

/* ---------- optimizador por EDHREC ---------- */
function optimizeLocal(d, A, E, budget){
  const inDeck = new Set([...A.rows.map(r=>slug(r.n)), ...(d.commanders||[]).map(slug)]);
  const scoreMap = new Map(E.pool.map(p=>[slug(p.n), p]));
  const deficit = TARGETS.filter(t=>t.k!=="land" && A.roles[t.k]<t.lo).map(t=>t.k);
  const surplus = TARGETS.filter(t=>t.k!=="land" && A.roles[t.k]>t.hi).map(t=>t.k);
  const cap = budget==="2"?2:budget==="10"?10:Infinity;
  const adds = E.pool.filter(p=>!inDeck.has(slug(p.n))).map(p=>{
    const m=cardOf(p.n); if (!m || m.t==="Land") return null;
    if (A.ci && (m.ci||"").split("").some(c=>WUBRG.includes(c)&&!A.ci.includes(c))) return null;
    if (m.lg && m.lg.commander && m.lg.commander!=="legal") return null;
    const owned = ownedOf(p.n)>0; const pr = refPrice(m);
    if (budget==="own" && !owned) return null;
    if (!owned && budget!=="own" && pr!=null && pr>cap) return null;
    const fills = (m.r||[]).filter(x=>deficit.includes(x));
    const score = (p.incl||0)*100 + Math.max(0,(p.syn||0))*60 + (owned?25:0) + fills.length*20;
    return {n:m.n, m, incl:p.incl, syn:p.syn, owned, pr, fills, score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
  const cuts = A.rows.filter(r=>r.m && r.m.t!=="Land" && !r.m.basic).map(r=>{
    const s = scoreMap.get(slug(r.n)); const roles=r.m.r||[];
    const protectedRole = roles.some(x=>deficit.includes(x));
    const score = (s?(s.incl||0)*100 + Math.max(0,s.syn||0)*60:0) + (protectedRole?40:0) - (roles.some(x=>surplus.includes(x))?15:0) + (r.m.gc?10:0);
    return {n:r.n, m:r.m, incl:s?s.incl:null, score};
  }).sort((a,b)=>a.score-b.score);
  const out=[]; const usedCuts=new Set();
  for (const a of adds.slice(0,12)){
    const c = cuts.find(x=>!usedCuts.has(x.n) && x.score < a.score);
    if (!c) break; usedCuts.add(c.n);
    const why = [];
    if (a.incl!=null) why.push(`jugada en ${Math.round(a.incl*100)}% de los mazos de este comandante`);
    if (a.syn!=null && a.syn>0.05) why.push(`sinergia +${Math.round(a.syn*100)}%`);
    if (a.fills.length) why.push(`suma ${a.fills.map(x=>ROLE_ES[x]).join(" y ")}, que te falta`);
    why.push(c.incl!=null?`${c.n} aparece solo en ${Math.round(c.incl*100)}%`:`${c.n} casi no aparece en listas de este comandante`);
    out.push({sale:c.n, entra:a.n, owned:a.owned, pr:a.pr, why:why.join(" · ")});
  }
  return out;
}

/* ---------- plan por bracket ---------- */
function bracketPlan(d, A, target){
  const R = BRACKETS[target]; const E = edhOf(d);
  const inDeck = new Set([...A.rows.map(r=>slug(r.n)), ...(d.commanders||[]).map(slug)]);
  const inCI = m => m && !(m.ci||"").split("").some(c=>WUBRG.includes(c)&&!A.ci.includes(c));
  const c2 = combos2(d);
  const checks=[], cuts=[], adds=[];
  const replacementFor = (name) => {
    const m=cardOf(name); const role=(m&&m.r&&m.r[0])||null;
    const pool = (E?E.pool:[]).map(p=>({...p,m:cardOf(p.n)})).filter(p=>p.m && !inDeck.has(slug(p.n)) && !p.m.gc && !p.m.xt && !p.m.mld && p.m.t!=="Land" && inCI(p.m) && (!role || (p.m.r||[]).includes(role)) && !cuts.some(c=>c.rep===p.m.n))
      .sort((a,b)=>(b.incl||0)-(a.incl||0));
    return pool[0] ? pool[0].m.n : null;
  };
  // Game Changers
  if (A.gc.length > R.gc){
    const extra = A.gc.filter(n=>!(d.commanders||[]).some(c=>slug(c)===slug(n)));
    const nCut = A.gc.length - R.gc;
    checks.push({ok:false, t:`Game Changers: tienes ${A.gc.length}, el bracket ${target} permite ${R.gc===0?"ninguno":"hasta "+R.gc}`});
    for (const n of extra.slice(0,nCut)) cuts.push({n, why:"Game Changer", rep:replacementFor(n)});
  } else checks.push({ok:true, t:`Game Changers: ${A.gc.length}${R.gc<99?` de ${R.gc} permitidos`:" (sin límite)"}`});
  // MLD
  if (!R.mld && A.mld.length){ checks.push({ok:false, t:`Destrucción masiva de tierras no permitida: ${A.mld.join(", ")}`}); for (const n of A.mld) cuts.push({n, why:"destrucción masiva de tierras", rep:replacementFor(n)}); }
  else checks.push({ok:true, t: R.mld ? "Destrucción masiva de tierras permitida" : "Sin destrucción masiva de tierras"});
  // Turnos extra
  if (A.xt.length > R.xt){ checks.push({ok:false, t:`Turnos extra: ${A.xt.length} (máximo sugerido ${R.xt})`}); for (const n of A.xt.slice(R.xt)) cuts.push({n, why:"turno extra", rep:replacementFor(n)}); }
  else checks.push({ok:true, t:`Turnos extra: ${A.xt.length}${R.xt<99?` (máximo sugerido ${R.xt})`:""}`});
  // Combos de 2 cartas
  if (!d.combos) checks.push({ok:null, t:"Combos de 2 cartas: sin revisar. Busca combos para verificarlo."});
  else if (!R.combo2 && c2.length){ checks.push({ok:false, t:`Combos de 2 cartas no permitidos: ${c2.map(c=>c.cards.join(" + ")).join(" · ")}`}); for (const c of c2){ const piece = c.cards.find(n=>!(d.commanders||[]).some(x=>slug(x)===slug(n))); if (piece && !cuts.some(x=>x.n===piece)) cuts.push({n:piece, why:"pieza de combo de 2 cartas", rep:replacementFor(piece)}); } }
  else checks.push({ok:true, t:`Combos de 2 cartas: ${c2.length}${R.combo2?" (permitidos)":""}`});
  // Tutores
  if (A.tutors.length > R.tutors){ checks.push({ok:false, t:`Tutores: ${A.tutors.length}, conviene no pasar de ${R.tutors}`}); for (const n of A.tutors.filter(n=>!cuts.some(c=>c.n===n)).slice(0, A.tutors.length-R.tutors)) cuts.push({n, why:"tutor", rep:replacementFor(n)}); }
  else checks.push({ok:true, t:`Tutores: ${A.tutors.length}${R.tutors<99?` (hasta ${R.tutors})`:""}`});
  // Subir de nivel
  const gcPool = [...S.gc].map(k=>S.cards[k]).filter(m=>m && inCI(m) && !inDeck.has(slug(m.n)) && (!m.lg || m.lg.commander==="legal"));
  const rankE = n => { const p = E && E.pool.find(x=>slug(x.n)===slug(n)); return p ? (p.incl||0) : -1; };
  if (target>=3){
    const room = Math.min(R.gc, 99) - A.gc.length;
    const n = target===3 ? Math.max(0, room) : 6;
    gcPool.sort((a,b)=>rankE(b.n)-rankE(a.n) || (a.rank||99999)-(b.rank||99999));
    for (const m of gcPool.slice(0, n)) adds.push({n:m.n, why:"Game Changer en tus colores"+(rankE(m.n)>0?` · ${Math.round(rankE(m.n)*100)}% en EDHREC`:""), owned:ownedOf(m.n)>0, pr:refPrice(m)});
  }
  if (target>=4 && d.combos){
    for (const c of (d.combos.almost||[]).filter(c=>c.cards.length<=3).slice(0,6)){
      const miss = c.cards.filter(n=>!inDeck.has(slug(n)));
      if (miss.length===1 && !adds.some(a=>a.n===miss[0])) adds.push({n:miss[0], why:`completa ${c.cards.join(" + ")}${c.prod.length?" → "+c.prod[0]:""}`, owned:ownedOf(miss[0])>0, pr:refPrice(cardOf(miss[0]))});
    }
  }
  let cedh=null;
  if (target===5){
    const staples = ["C",...A.ci.split("")].flatMap(c=>CEDH_STAPLES[c]||[]).filter((n,i,a)=>a.indexOf(n)===i);
    const missingSt = staples.filter(n=>!inDeck.has(slug(n)));
    for (const n of missingSt.slice(0,20)) if (!adds.some(a=>slug(a.n)===slug(n))) adds.push({n, why:"pieza habitual de cEDH en tus colores", owned:ownedOf(n)>0, pr:refPrice(cardOf(n))});
    const fast = A.rows.filter(r=>FAST_MANA.has(r.n.toLowerCase())).reduce((a,r)=>a+r.q,0);
    const free = A.rows.filter(r=>FREE_INTERACTION.has(r.n.toLowerCase())).reduce((a,r)=>a+r.q,0);
    const cmdName = (d.commanders||[]).join(" / ");
    const top = (S.cedhLive?S.cedhLive.top:META.cedh.top);
    const pos = top.findIndex(t=>(d.commanders||[]).length && (d.commanders||[]).every(c=>String(t[0]).toLowerCase().includes(c.toLowerCase().split(" // ")[0])));
    cedh = {fast, free, lands:A.roles.land, avg:A.avg, tutors:A.tutors.length, c2:c2.length, pos, row:pos>=0?top[pos]:null, cmdName,
      bench:[
        {k:"Maná rápido (Sol Ring, moxes, rituales)", v:fast, goal:"6 o más", ok:fast>=6},
        {k:"Interacción gratis (Force of Will, Pact…)", v:free, goal:"4 o más", ok:free>=4},
        {k:"Tutores", v:A.tutors.length, goal:"6 o más", ok:A.tutors.length>=6},
        {k:"Tierras", v:A.roles.land, goal:"27 a 31", ok:A.roles.land>=26&&A.roles.land<=32},
        {k:"CMC promedio", v:A.avg.toFixed(2), goal:"2,2 o menos", ok:A.avg<=2.2},
        {k:"Combos de 2 cartas", v:d.combos?c2.length:"sin revisar", goal:"1 o más", ok:c2.length>=1},
      ]};
  }
  return {R, checks, cuts, adds, cedh, needGC: gcPool.length===0};
}

/* ---------- meta 60 cartas ---------- */
const _metaParsed = {};
function metaDecks(fmt){
  if (_metaParsed[fmt]) return _metaParsed[fmt];
  const arr = (META[fmt]&&META[fmt].archetypes||[]).map(a=>{ const p=parseList(a.list,{keepSide:true}); return {...a, main:p.filter(x=>!x.side), side:p.filter(x=>x.side)}; });
  return (_metaParsed[fmt]=arr);
}
function metaCoverage(a){
  let own=0, need=0, cost=0; const miss=[];
  const all = new Map(); for (const c of [...a.main, ...a.side]){ const k=slug(c.n); all.set(k, {n:c.n, q:(all.get(k)?all.get(k).q:0)+c.q}); }
  for (const x of all.values()){ if (BASICS.has(slug(x.n))) continue; const o=ownedOf(x.n); own+=Math.min(o,x.q); need+=x.q; if (o<x.q){ const m=cardOf(x.n); const p=refPrice(m); miss.push({n:x.n,q:x.q-o,p}); if (p!=null) cost+=p*(x.q-o); } }
  return {p: need?own/need:1, own, need, cost: miss.length && !miss.some(m=>m.p!=null) ? null : cost, miss};
}
function metaMatch(A){
  const mine = new Map(); for (const r of A.rows) mine.set(slug(r.n), (mine.get(slug(r.n))||0)+r.q);
  return metaDecks(A.fmt).map(a=>{ let hit=0, tot=0; for (const c of a.main){ if (BASICS.has(slug(c.n))) continue; tot+=c.q; hit+=Math.min(c.q, mine.get(slug(c.n))||0); } return {a, score: tot?hit/tot:0}; }).sort((x,y)=>y.score-x.score);
}
const metaCardSet = (() => { let s=null; return () => { if (s) return s; s=new Map(); for (const f of ["pauper","pioneer"]) for (const a of metaDecks(f)) for (const c of [...a.main,...a.side]){ const k=slug(c.n); if(!s.has(k)) s.set(k,new Set()); s.get(k).add(`${FORMATS[f].name} (${a.name})`); } for (const n of Object.values(CEDH_STAPLES).flat()){ const k=slug(n); if(!s.has(k)) s.set(k,new Set()); s.get(k).add("cEDH"); } return s; }; })();

/* ---------- guía de sideboard ---------- */
function sideGuide(A, a){
  const info = (META_VS[A.fmt]||{})[a.name]; if (!info) return null;
  const need = new Set(info.vs);
  const cats = m => new Set([...(m.sb||[]), ...((m.r||[]).filter(x=>x==="removal"||x==="wipe"))]);
  const ins=[]; let nIn=0;
  const side = A.side.filter(r=>r.m).map(r=>({r, hit:[...cats(r.m)].filter(c=>need.has(c))})).filter(x=>x.hit.length).sort((x,y)=>y.hit.length-x.hit.length || info.vs.indexOf(x.hit[0])-info.vs.indexOf(y.hit[0]));
  for (const x of side){ if (nIn>=8) break; const q=Math.min(x.r.q, 8-nIn); ins.push({n:x.r.n, q, why:x.hit.map(c=>SB_ES[c]).join(", ")}); nIn+=q; }
  if (!nIn) return {info, ins, outs:[]};
  const useless = r => { const m=r.m; if (!m || m.t==="Land") return -1; const c=cats(m); let s=0;
    for (const k of ["antiBlue","antiRed","artifact","grave","lands"]) if (c.has(k) && !need.has(k)) s+=3;
    if (info.plan==="aggro" && m.cmc>=4 && !c.has("removal") && !c.has("wipe")) s+=2;
    if (info.plan==="aggro" && c.has("discard")) s+=1;
    if (info.plan==="control" && (c.has("removal")||c.has("wipe")) && m.t!=="Creature") s+=2;
    if (info.plan==="control" && c.has("life")) s+=1;
    if (info.plan==="combo" && (c.has("life")||c.has("wipe")||m.cmc>=4)) s+=2;
    return s; };
  const outs=[]; let nOut=0;
  for (const r of A.rows.filter(r=>useless(r)>0).sort((x,y)=>useless(y)-useless(x))){ if (nOut>=nIn) break; const q=Math.min(r.q, nIn-nOut); outs.push({n:r.n, q}); nOut+=q; }
  return {info, ins, outs, short:nIn-nOut};
}

/* ---------- EDHTop16: staples por comandante ---------- */
async function loadCedhStaples(d){
  if (isWebView()){ webBlocked("cedh"); return; }
  const name = (d.commanders||[]).join(" / "); if (!name) return;
  setBusy("Consultando EDHTop16", 1);
  const queries = [
    `query($name:String!){ commander(name:$name){ name staples(first:60){ edges{ node{ name } } } } }`,
    `query($name:String!){ commander(name:$name){ name staples{ name } } }`,
    `query($name:String!){ commander(name:$name){ name cardWinRateStats(first:60){ edges{ node{ card{ name } } } } } }`,
  ];
  const names=[];
  const walk = (o, depth=0) => { if (!o || depth>8) return; if (Array.isArray(o)) { o.forEach(x=>walk(x,depth+1)); return; } if (typeof o==="object"){ if (typeof o.name==="string" && depth>2) names.push(o.name); for (const v of Object.values(o)) if (v && typeof v==="object") walk(v,depth+1); } };
  try{
    for (const q of queries){
      const r = await fetch("https://edhtop16.com/api/graphql", {method:"POST", headers:{"Content-Type":"application/json", Accept:"application/json"}, body:JSON.stringify({query:q, variables:{name}})});
      if (!r.ok) continue; const j=await r.json(); if (!j.data || !j.data.commander) continue;
      walk(j.data.commander); if (names.length) break;
    }
    const list=[...new Set(names)].filter(n=>!(d.commanders||[]).some(c=>slug(c)===slug(n)));
    if (!list.length) throw new Error("sin datos");
    const cur = S.data.decks.find(x=>x.id===d.id) || d; saveDeck({...cur, cedhStaples:{at:Date.now(), list:list.slice(0,60)}},{silent:true,noLog:true});
    S.busy=null; await fetchCards(list,{quiet:true, label:"Trayendo cartas de EDHTop16"});
  } catch(e){ toast("EDHTop16 no entregó las cartas de este comandante desde el navegador. Revísalas en su página."); }
  finally { S.busy=null; render(); }
}

/* ---------- señales de mercado ---------- */
function forecast(name, key){
  const m = cardOf(name); if (!m || m.basic) return null;
  key = key || oracleKey(name);
  const c7 = change(key,7), c30 = change(key,30);
  const why=[]; let s=0;
  if (c30 && c30.span>=10){ s += Math.max(-2,Math.min(2,c30.pct/20)); why.push(`${pct(c30.pct)} en ${c30.span} días`); }
  if (c7 && c7.span>=3){ s += Math.max(-1.5,Math.min(1.5,c7.pct/15)); if (!c30 || c30.span<10 || Math.abs(c7.pct)>=5) why.push(`${pct(c7.pct)} en ${c7.span} días`); }
  if (m.rank && m.rank<=300){ s+=1; why.push(`muy jugada en Commander (#${m.rank} en EDHREC)`); } else if (m.rank && m.rank<=1500){ s+=0.5; why.push(`popular en Commander (#${m.rank})`); }
  if (m.rsv){ s+=1; why.push("Lista reservada: no se reimprime"); }
  const inMeta = metaCardSet().get(slug(name)); if (inMeta){ s+=0.7; why.push("jugada en el meta: "+[...inMeta].slice(0,2).join(", ")); }
  if (m.gc){ s+=0.3; why.push("Game Changer"); }
  if (m.rel){ const age=(Date.now()-Date.parse(m.rel))/864e5; if (age>=0 && age<75){ s-=1; why.push("impresión reciente: los precios de lanzamiento suelen bajar en las primeras semanas"); } else if (age>3*365 && !m.rsv){ s+=0.4; why.push(`sin reimpresión desde ${m.rel.slice(0,4)} (ojo: podría reimprimirse)`); } }
  const label = s>=1.5 ? "up" : s<=-1 ? "down" : "flat";
  const conf = (c30 && c30.span>=21) ? "media" : "baja";
  return {s, label, why, conf, c7, c30};
}
const FC_ES = {up:"presión al alza", down:"presión a la baja", flat:"estable"};
function alerts(){ const sig=_anaEpoch+'|'+Object.keys(S.data.dismissed||{}).length+'|'+(S.data.wishlist||[]).length; if (alerts._s===sig) return alerts._v; alerts._s=sig; return (alerts._v=alertsRaw()); }
function alertsRaw(){
  const st=S.data.settings; const out=[]; const seen=new Set();
  const dism = S.data.dismissed||{};
  // subidas en tu colección y en tus carpetas de venta
  for (const it of [...(S.data.collection.items||[]), ...binderItems()]){
    if (BASICS.has(slug(it.n))) continue;
    const key=itemKey(it); if (seen.has(key)) continue; seen.add(key);
    const c7=change(key,7), c30=change(key,30); const pr=itemPrice(it);
    const hit = (c7 && c7.pct>=st.rise && c7.diff>=st.minMove) ? c7 : (c30 && c30.pct>=st.rise*1.6 && c30.diff>=st.minMove) ? c30 : null;
    if (hit){ const id="up|"+key+"|"+Math.round(pr||0); if (!dism[id]) out.push({id, kind:"up", n:it.n, it, pr, ch:hit, t:`${it.n} subió ${pct(hit.pct)}`, s:`${money(hit.from)} → ${money(hit.to)} en ${hit.span} días · ${it._binder?`en tu carpeta “${it._binder}” (${it.q})`:`tienes ${it.q}`}${it.set?` (${it.set}${it.foil?" "+it.foil:""})`:""}`}); }
  }
  // bajadas en lista de búsqueda y faltantes de mazos
  const wanted = new Map(); for (const w of S.data.wishlist) wanted.set(slug(w.n)+(w.pk?"|"+w.pk+(w.finish||""):""), {n:w.n, w});
  for (const d of S.data.decks){ if (d.rival) continue; const A=analyze(d); for (const x of A.missingCards) if (!wanted.has(slug(x.n))) wanted.set(slug(x.n), {n:x.n, deck:d.name}); }
  for (const {n,w,deck} of wanted.values()){
    const m=cardOf(n); if (!m) continue; const pr = w ? wishPrice(w) : refPrice(m);
    const key = w ? wishKey(w) : ((S.hist[histKey("m",slug(n))] && cur()==="usd") ? histKey("m",slug(n)) : oracleKey(n));
    const c7=change(key,7), c30=change(key,30);
    if (w && w.target!=null && pr!=null && pr<=w.target){ const id="tg|"+slug(n)+"|"+Math.round(pr*100); if (!dism[id]) out.push({id, kind:"tg", n, pr, t:`${n} llegó a tu precio objetivo`, s:`Ahora ${money(pr)} · objetivo ${money(w.target)}`}); continue; }
    const hit = (c7 && c7.pct<=-st.drop) ? c7 : (c30 && c30.pct<=-st.drop*1.6) ? c30 : null;
    if (hit){ const id="down|"+key+"|"+Math.round((pr||0)*100); if (!dism[id]) out.push({id, kind:"down", n, pr, ch:hit, t:`${n} bajó ${pct(hit.pct)}`, s:`${money(hit.from)} → ${money(hit.to)} en ${hit.span} días · ${w?"en tu lista de búsqueda":"te falta para "+deck}`}); }
  }
  return out.sort((a,b)=>Math.abs((b.ch&&b.ch.pct)||100)-Math.abs((a.ch&&a.ch.pct)||100));
}
function signals(){
  const st=S.data.settings; const used=usedMap(); const sell=[], buy=[];
  const byName = collIndex();
  for (const [k, g] of byName){
    if (BASICS.has(k)) continue;
    const inUse = (used.get(k)||[]).reduce((a,u)=>Math.max(a,u.q),0); // copias necesarias en el mazo que más usa
    let free = g.q - inUse;
    for (const it of [...g.items].sort((a,b)=>(itemPrice(b)||0)-(itemPrice(a)||0))){
      const pr = itemPrice(it); if (pr==null) continue;
      const fc = forecast(it.n, itemKey(it)); const ck = ckOf(it);
      const n = Math.min(it.q, Math.max(0,free));
      if (n>0 && pr>=st.sellMin){
        const why=[`${n} copia${n>1?"s":""} libre${n>1?"s":""} (no la usas en ningún mazo)`];
        if (fc && fc.c30 && fc.c30.pct>=20) why.push(`subió ${pct(fc.c30.pct)} en ${fc.c30.span} días: buen momento para vender`);
        if (fc && fc.label==="down") why.push("señales a la baja: conviene no esperar");
        if (ck && ck.b) why.push(`Card Kingdom compra a ${money(ck.b)} (${Math.round(100*ck.b/pr)}% del precio)`);
        sell.push({kind:"excedente", n:it.n, it, q:n, pr, val:pr*n, why, score:pr*n*(fc&&fc.c30&&fc.c30.pct>0?1.3:1)});
        free -= n;
      }
      const m=cardOf(it.n); const cheap = m && m.min!=null ? m.min : null;
      if (inUse>0 && cur()==="usd" && cheap!=null && pr>=10 && pr>=cheap*2){
        sell.push({kind:"version", n:it.n, it, q:1, pr, val:pr-cheap, why:[`tu versión${it.foil?" "+it.foil:""}${it.set?" ("+it.set+")":""} vale ${money(pr)}; la más barata cuesta ${money(cheap)}`, `si solo la usas para jugar, cambiarla libera ~${money(pr-cheap)}`], score:(pr-cheap)*0.8});
      }
    }
  }
  const wishSet = new Map(S.data.wishlist.map(w=>[slug(w.n),w]));
  const want = new Map(); for (const w of S.data.wishlist) want.set(slug(w.n)+(w.pk?"|"+w.pk+(w.finish||""):""), {n:w.n, w});
  for (const d of S.data.decks){ if (d.rival) continue; const A=analyze(d); for (const x of A.missingCards) if (!want.has(slug(x.n))) want.set(slug(x.n), {n:x.n, deck:d.name, q:x.q}); }
  for (const {n,w,deck,q} of want.values()){
    const m=cardOf(n); if (!m) continue; const pr=w?wishPrice(w):refPrice(m); if (pr==null) continue;
    const key = w ? wishKey(w) : ((S.hist[histKey("m",slug(n))] && cur()==="usd") ? histKey("m",slug(n)) : oracleKey(n));
    const fc=forecast(n, key); const rg=histRange(key,30); const why=[]; let score=0;
    if (w && w.target!=null){ if (pr<=w.target){ why.push(`bajo tu objetivo de ${money(w.target)}`); score+=3; } else why.push(`${money(pr-w.target)} sobre tu objetivo`); }
    if (fc && fc.c7 && fc.c7.pct<=-st.drop){ why.push(`bajó ${pct(fc.c7.pct)} en ${fc.c7.span} días`); score+=2; }
    if (rg && rg.max>rg.min && pr<=rg.min*1.02){ why.push("en su mínimo de los últimos 30 días"); score+=1.5; }
    if (fc && fc.label==="up"){ why.push("señales al alza: comprar antes puede convenir"); score+=1; }
    if (fc && fc.label==="down"){ why.push("señales a la baja: puede convenir esperar"); score-=1; }
    if (w && w.pk && S.prints[w.pk]){ const p=S.prints[w.pk]; why.push(`versión buscada: ${p.sn} (${p.set} #${p.num})${w.finish?" "+w.finish:""}`); }
    else if (m.minP) why.push(`versión más barata: ${m.minP.sn} (${m.minP.set} #${m.minP.num})`);
    const v = !(w&&w.pk) && !m.minP && S.versions[slug(n)]; if (v){ const cheapest = v.list.filter(p=>p.lang==="en" && (cur()==="eur"?p.eur:p.usd)!=null).sort((a,b)=>(cur()==="eur"?a.eur-b.eur:a.usd-b.usd))[0]; if (cheapest) why.push(`versión más barata: ${cheapest.sn} (${cheapest.set} #${cheapest.num}) a ${money(cur()==="eur"?cheapest.eur:cheapest.usd)}`); }
    const ckU = (w&&w.pk&&S.prints[w.pk]&&S.prints[w.pk].ck) || (m.minP&&m.minP.ck) || (S.versions[slug(n)]&&S.versions[slug(n)].list.find(p=>p.ck)||{}).ck || (m.ck||"");
    if (score>0 || (w && w.target!=null && pr<=w.target)) buy.push({n, pr, q:q||1, why:[...(w?["en tu lista de búsqueda"]:[`te falta para ${deck}`]), ...why], score, ck:ckU});
  }
  for (const it of S.data.collection.items||[]){ if (!it.sell) continue; const pr=itemPrice(it); if (!sell.some(x=>x.it===it)) sell.push({kind:"marcada", n:it.n, it, q:it.q, pr, val:(pr||0)*it.q, why:["la marcaste para vender"], score:1e6}); else sell.find(x=>x.it===it).why.unshift("la marcaste para vender"); }
  sell.sort((a,b)=>b.score-a.score); buy.sort((a,b)=>b.score-a.score);
  return {sell:sell.slice(0,40), buy:buy.slice(0,40)};
}

/* ---------- ManaBox ---------- */
function diffCollection(oldItems, newItems){
  const mo=new Map(), mn=new Map();
  for (const it of oldItems){ const k=collKey(it); mo.set(k,{...it, q:(mo.get(k)?mo.get(k).q:0)+it.q}); }
  for (const it of newItems){ const k=collKey(it); mn.set(k,{...it, q:(mn.get(k)?mn.get(k).q:0)+it.q}); }
  const added=[], removed=[], changed=[];
  for (const [k,it] of mn){ const o=mo.get(k); if (!o) added.push(it); else if (o.q!==it.q) changed.push({...it, from:o.q}); }
  for (const [k,it] of mo){ if (!mn.has(k)) removed.push(it); }
  return {added, removed, changed};
}
function toManaBoxCSV(items){
  const e = s => `"${String(s??"").replace(/"/g,'""')}"`;
  const head = "Name,Set code,Collector number,Foil,Quantity,Scryfall ID,Language,Condition,Purchase price,Purchase price currency";
  return head+"\n"+items.map(i=>[e(i.n), e((i.set||"").toLowerCase()), e(i.num||""), e(i.foil||"normal"), i.q, e(i.sid||""), e(i.lang||""), e(i.cond||""), i.pp??"", e(i.ppc||"")].join(",")).join("\n");
}
function saveDeck(d, {silent=false, noLog=false, src="manual"}={}){
  const prev = S.data.decks.find(x=>x.id===d.id);
  if (!noLog && prev){
    const dm = diffLists(prev.cards, d.cards), ds = diffLists(prev.side||[], d.side||[]), dy = diffLists(prev.maybe||[], d.maybe||[]), dc = diffLists((prev.commanders||[]).map(n=>({n,q:1})), (d.commanders||[]).map(n=>({n,q:1})));
    const add=[...dm.add, ...ds.add.map(x=>({...x,side:true})), ...dy.add.map(x=>({...x,maybe:true})), ...dc.add.map(x=>({...x,cmd:true}))], rem=[...dm.rem, ...ds.rem.map(x=>({...x,side:true})), ...dy.rem.map(x=>({...x,maybe:true})), ...dc.rem.map(x=>({...x,cmd:true}))];
    if (add.length || rem.length){
      d.log = [{at:Date.now(), src, add, rem}, ...(d.log||[])].slice(0,80);
      const snap = {at:prev.updated||prev.created||Date.now(), savedAt:Date.now(), src, commanders:[...(prev.commanders||[])], cards:(prev.cards||[]).map(c=>({...c})), side:(prev.side||[]).map(c=>({...c})), maybe:(prev.maybe||[]).map(c=>({...c}))};
      d.versions = [snap, ...(prev.versions||d.versions||[])].slice(0,25);
    }
  }
  d.updated = Date.now();
  const i = S.data.decks.findIndex(x=>x.id===d.id); if(i>=0) S.data.decks[i]=d; else S.data.decks.push(d);
  saveData(); if(!silent) render();
}
function claudePrompt(d, A){
  const inDeck = new Set([...A.rows.map(r=>slug(r.n)), ...(d.commanders||[]).map(slug)]);
  const spare = (S.data.collection.items||[]).filter(it=>!inDeck.has(slug(it.n)) && !BASICS.has(slug(it.n))).map(it=>it.n).filter((n,i,a)=>a.indexOf(n)===i).slice(0,800);
  const budget = {"2":"máximo US$2 por carta nueva","10":"máximo US$10 por carta nueva","inf":"sin límite de precio","own":"solo cartas de mi colección"}[S.optBudget];
  const head = A.isC ? `Comandante(s): ${(d.commanders||[]).join(" + ")}\nIdentidad de color: ${A.ci||"incolora"}\nBracket objetivo: ${S.targetBracket||bracketOf(d,A).b}` : `Formato: ${FORMATS[A.fmt].name}\nColores: ${A.ci||"incoloro"}`;
  return `Eres experto en Magic: The Gathering (${FORMATS[A.fmt].name}). Analiza mi mazo y propón mejoras. Responde en español.

${head}
Presupuesto: ${budget}
Estadísticas: ${A.main} cartas${A.isC?"":` + ${A.sideN} de sideboard`}; tierras ${A.roles.land}; ramp ${A.roles.ramp}; robo ${A.roles.draw}; removal ${A.roles.removal}; barridos ${A.roles.wipe}; CMC promedio ${A.avg.toFixed(2)}; curva 0-7+: ${A.curve.join(", ")}${A.isC?`; Game Changers: ${A.gc.join(", ")||"ninguno"}`:""}.

${typeof synergyPromptText==="function"?synergyPromptText(d,A):""}${A.isC&&typeof powerPromptText==="function"?" "+powerPromptText(d,A):""}

Lista:
${deckText(d)}

Cartas de mi colección que no uso en este mazo (prefiérelas si sirven):
${spare.join("; ")||"(ninguna)"}

Quiero: 1) el plan del mazo y su debilidad principal, 2) ${A.isC?"el bracket estimado (1-5) con la razón":"cómo le va contra el meta actual"}, 3) entre 6 y 12 cambios "sale → entra" con el motivo${A.isC?", respetando identidad de color, singleton y presupuesto":", respetando la legalidad del formato y el presupuesto"}${A.isC?"":", y 4) un plan de sideboard"}.`;
}


/* ---------- carpetas de venta ---------- */
function binderItems(){ const out=[]; for (const b of S.data.binders||[]) for (const it of b.items){ Object.defineProperty(it, "_binder", {value:b.name, enumerable:false, configurable:true, writable:true}); out.push(it); } return out; }
const COND_SHORT = {near_mint:"NM", mint:"M", lightly_played:"LP", excellent:"EX", good:"GD", moderately_played:"MP", played:"PL", heavily_played:"HP", poor:"PO", damaged:"DMG"};
const condShort = c => { if (!c) return ""; const k=String(c).toLowerCase().replace(/[\s-]+/g,"_"); return COND_SHORT[k] || String(c).toUpperCase().slice(0,4); };
const clpRate = () => { const v=parseFloat(S.data.settings.clp); return v>0?v:null; };
const usdClp = () => { const v=parseFloat(S.data.settings.usdClp); if (v>0) return v; const c=parseFloat(S.data.settings.clp); return (cur()==="usd" && c>0) ? c : 750; };
function itemPriceUSD(it){
  const pk=pkOf(it); const p = pk && S.prints[pk];
  if (p){ const v = it.foil==="etched" ? p.usdE : it.foil==="foil" ? p.usdF : p.usd; if (v!=null) return v; const alt=p.usd??p.usdF; if (alt!=null) return alt; }
  const m=cardOf(it.n); if (!m) return null; if (m.basic) return 0; return m.usd??null;
}
const usd = v => v==null||isNaN(v) ? "—" : "US$"+v.toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2});
const clp = (v, step=1) => v==null||isNaN(v) ? "—" : !(v>0) ? "$0" : "$"+Math.max(step, Math.round(v*usdClp()/step)*step).toLocaleString("es-CL");
function binderLine(b, it){
  const P=b.pricing; const ck=ckOf(it); const tcg=itemPriceUSD(it);
  const ckR = ck && ck.r!=null ? ck.r : null;
  let base, from;
  if (P.src==="ckbuy"){ base = ck&&ck.b!=null ? ck.b : null; from="CK compra"; }
  else if (P.src==="tcg"){ base = tcg; from="TCGplayer"; }
  else { base = ckR!=null ? ckR : tcg; from = ckR!=null ? "CK" : (tcg!=null ? "TCG" : ""); }
  let sug = base!=null ? base*(P.pct||100)/100 : null;
  if (sug!=null && P.min) sug = Math.max(sug, +P.min);
  let fin = sug;
  if (it.ask && it.ask.v!=null && !isNaN(it.ask.v)) fin = it.ask.unit==="clp" ? it.ask.v/usdClp() : it.ask.v;
  return {ck, ckR, tcg, market:tcg, base, from, sug, fin, custom: !!(it.ask && it.ask.v!=null)};
}
function showPrice(b, v){ return b.pricing.clp ? clp(v, +b.pricing.round||1) : usd(v); }
function binderTotals(b){
  let cards=0, ck=0, market=0, sug=0, fin=0, ckb=0, noPrice=0, noCk=0, inUse=0; const used=usedMap();
  for (const it of b.items){ const L=binderLine(b,it); cards+=it.q; if (L.ckR!=null) ck+=L.ckR*it.q; else noCk++; if (L.tcg!=null) market+=L.tcg*it.q; if (L.base==null) noPrice++; if (L.sug!=null) sug+=L.sug*it.q; if (L.fin!=null) fin+=L.fin*it.q; if (L.ck&&L.ck.b) ckb+=L.ck.b*it.q; if (used.has(slug(it.n))) inUse++; }
  const sold = b.sales.reduce((a,x)=>a+(x.price||0)*x.q,0);
  return {cards, ck, market, sug, fin, ckb, noPrice, noCk, inUse, sold};
}
function binderColors(b){ const s=new Set(); for (const it of b.items){ const m=cardOf(it.n); if (m) for (const c of (m.ci||"").split("")) if (WUBRG.includes(c)) s.add(c); } return WUBRG.filter(c=>s.has(c)).join(""); }
function priceListText(b){
  const rows = b.items.map(it=>({it, L:binderLine(b,it)})).sort((x,y)=>(y.L.fin||0)-(x.L.fin||0));
  const lines = rows.map(({it,L})=>`${it.q}x ${it.n}${it.set?` [${it.set}${it.num?" #"+it.num:""}]`:""}${it.foil?` (${it.foil})`:""}${it.cond?` ${condShort(it.cond)}`:""}${it.lang&&!/^(en|english)$/i.test(it.lang)?` ${it.lang.toUpperCase()}`:""} — ${showPrice(b, L.fin)}${it.q>1?" c/u":""}`);
  const T=binderTotals(b);
  const note = b.pricing.clp ? `Precios en CLP (1 US$ = $${usdClp().toLocaleString("es-CL")}), referencia Card Kingdom.` : "Precios en US$, referencia Card Kingdom.";
  return [`${b.name} — ${T.cards} cartas`, note, "", ...lines, "", `Total: ${showPrice(b, T.fin)}`].join("\n");
}
function binderCSV(b){
  const e = x => `"${String(x??"").replace(/"/g,'""')}"`; const step=+b.pricing.round||1;
  const toCLP = v => v==null?"":Math.max(step, Math.round(v*usdClp()/step)*step);
  return `Quantity,Name,Set code,Collector number,Foil,Condition,Language,Card Kingdom (USD),Card Kingdom match,TCGplayer (USD),Sale price (USD),Sale price (CLP),Card Kingdom buylist (USD)\n` +
    b.items.map(it=>{ const L=binderLine(b,it); return [it.q, e(it.n), e(it.set||""), e(it.num||""), e(it.foil||""), e(condShort(it.cond)), e(it.lang||""), L.ckR??"", e(L.ck?L.ck.match:""), L.tcg==null?"":Math.round(L.tcg*100)/100, L.fin==null?"":Math.round(L.fin*100)/100, toCLP(L.fin), L.ck&&L.ck.b!=null?L.ck.b:""].join(","); }).join("\n");
}
