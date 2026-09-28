/* =========================================================
   Bóveda EDH — versión web (claude.ai)
   Aquí la página no puede conectarse a Scryfall, EDHREC ni
   otros sitios. En vez de mostrar errores:
   - los datos de cartas (tipo, coste, colores, texto, legalidad)
     se completan con Claude, a pedido;
   - los precios llegan con el respaldo del archivo descargado;
   - cada carta y comandante enlaza a su página de EDHREC y Scryfall.
   ========================================================= */

document.addEventListener("click", e => { const b = e.target.closest("button,a"); S._clickAt = Date.now(); S._clickLabel = b ? (b.textContent||"").trim() : ""; }, true);
function userAsked(){ return Date.now() - (S._clickAt||0) < 2000; }
function EDH_CMD(d){ return "https://edhrec.com/commanders/" + (d.commanders||[]).map(edhSlug).join("-"); }
function EDH_CARD(n){ return "https://edhrec.com/cards/" + edhSlug(n); }
function SF_CARD(n){ return "https://scryfall.com/search?q=" + encodeURIComponent(`!"${String(n).split(" // ")[0]}"`) + "&unique=prints"; }
function CK_CARD(n){ return "https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=" + encodeURIComponent(String(n).split(" // ")[0]); }

// funciones que necesitan internet: en la web se explican en vez de fallar
function webBlocked(what){
  if (!userAsked()) return;
  const msg = {
    precios: "Los precios no se pueden consultar desde la versión web. Tráelos en la versión en vivo (boveda-edh.netlify.app) y pásalos con “Importar respaldo”.",
    edhrec: "EDHREC no se puede consultar desde aquí. Abre la página del comandante en EDHREC con el enlace.",
    combos: "La búsqueda de combos funciona en la versión en vivo, boveda-edh.netlify.app (Commander Spellbook no se puede consultar desde aquí).",
    cedh: "EDHTop16 no se puede consultar desde aquí. Usa el enlace para verlo en su página.",
    versiones: "Las versiones y sus precios se ven en Scryfall o Card Kingdom con los enlaces de la ficha.",
    novedades: "Las novedades funcionan en la versión en vivo: boveda-edh.netlify.app.",
    ck: "La lista de Card Kingdom se carga en la versión en vivo (boveda-edh.netlify.app), o sube aquí su archivo JSON.",
  }[what] || "Esta función está en la versión en vivo: boveda-edh.netlify.app.";
  toast(msg);
}

/* ---------- completar datos de cartas con Claude ---------- */
async function webFetchCards(names, {force=false, quiet=false}={}){
  if (quiet || !userAsked()) return 0;
  if (/precio/i.test(S._clickLabel) && !/datos/i.test(S._clickLabel)){ webBlocked("precios"); return 0; }
  const todo = [...new Map(names.filter(Boolean).map(n=>[slug(n), String(n).trim()])).values()]
    .filter(n => !BASICS.has(slug(n)) && (force ? true : !S.cards[slug(n)]));
  if (!todo.length){ toast("Estas cartas ya tienen datos. Los precios se actualizan con “Importar respaldo” desde el archivo."); return 0; }
  // primero lo guardado en tu cuenta de Claude (sin gastar uso de Claude)
  if (typeof accPullCards==="function" && ACC.uid){
    const got = await accPullCards();
    const left = todo.filter(n => !S.cards[slug(n)]);
    if (got && !left.length){ toast(`Datos de las cartas traídos desde tu cuenta.`); render(); return got; }
    if (left.length < todo.length){ toast(`Traje ${todo.length-left.length} cartas desde tu cuenta; completo las otras ${left.length} con Claude.`); return got + await claudeFill(left); }
  }
  return claudeFill(todo);
}
async function claudeFill(names){
  const sample = await claude.use("sample");
  if (!sample){ toast("Completar con Claude no está disponible en esta vista. Abre la Bóveda en boveda-edh.netlify.app para traer los datos desde Scryfall."); return 0; }
  const B = 12, own = !S.busy; let n = 0, done = 0, fatal = "";
  const missing = new Set(names.map(slug));
  if (own) setBusy("Completando datos de las cartas con Claude", names.length);
  const prompt = chunk => `You are a Magic: The Gathering card database. For each card name below, give its official Oracle data in English.
Reply with ONLY a JSON array (no wrapper object), one object per name, same order, exactly this shape:
{"q":"<name as given>","name":"<official name>","type_line":"Creature — Elf Druid","mana_cost":"{1}{G}","cmc":2,"colors":["G"],"color_identity":["G"],"oracle_text":"<full oracle text>","produced_mana":["G"],"legal":{"commander":"legal","pauper":"not_legal","pioneer":"legal"},"game_changer":false,"known":true}
Rules: produced_mana lists the colors of mana the card can add (empty array if none). legal values are "legal", "not_legal" or "banned". game_changer is true only if the card is on the official Commander Game Changers list. For double-faced cards use the front face's type_line and mana_cost and join both faces' oracle text with "\n//\n". If you are not sure a card exists or do not know its exact text, set "known":false and leave the other fields empty.
Names:
${chunk.join("\n")}`;
  const take = arr => {
    if (arr && !Array.isArray(arr) && typeof arr === "object") arr = Object.values(arr).find(Array.isArray) || [arr];
    for (const x of Array.isArray(arr) ? arr : []){
      if (!x || x.known===false || !x.name || !x.type_line) continue;
      const c = fromScry({name:String(x.name), cmc:+x.cmc||0, type_line:String(x.type_line), mana_cost:String(x.mana_cost||""),
        colors:Array.isArray(x.colors)?x.colors:[], color_identity:Array.isArray(x.color_identity)?x.color_identity:[],
        oracle_text:String(x.oracle_text||""), produced_mana:Array.isArray(x.produced_mana)?x.produced_mana:[],
        legalities:x.legal||{}, game_changer:x.game_changer===true});
      c.est = true; c.at = 1; c.usd = null; c.eur = null; c.img = ""; c.uri = SF_CARD(c.n);
      S.cards[slug(c.n)] = c; if (x.q) S.cards[slug(x.q)] = c;
      missing.delete(slug(c.n)); if (x.q) missing.delete(slug(x.q)); n++;
    }
  };
  // un lote que se corta por largo se divide en dos (una sola vez por mitad)
  const run = async (chunk, depth=0) => {
    if (fatal) return;
    try { take(await sample.json(prompt(chunk), {modelTier:"default"})); }
    catch(e){
      const c = e && e.code;
      if (c==="not_granted"){ fatal = "Sin permiso para usar Claude en esta página. Acepta el aviso de Claude al tocar el botón."; return; }
      if (c==="session_expired"){ fatal = "Tu sesión de claude.ai expiró: vuelve a entrar."; return; }
      if (c==="rate_limited"){ fatal = "Claude está ocupado. Prueba de nuevo en unos minutos: se completarán solo las cartas que falten."; return; }
      if (chunk.length > 1 && depth < 2){ const h = Math.ceil(chunk.length/2); await run(chunk.slice(0,h), depth+1); await run(chunk.slice(h), depth+1); return; }
    }
    if (depth===0){ done += chunk.length; stepBusy(Math.min(names.length, done)); }
  };
  try {
    const chunks = []; for (let i=0; i<names.length; i+=B) chunks.push(names.slice(i, i+B));
    let next = 0;
    const worker = async () => { while (next < chunks.length && !fatal){ const c = chunks[next++]; await run(c); } };
    await Promise.all([worker(), worker()]);   // dos lotes a la vez, como permite Claude
  } finally { if (own){ S.busy = null; } }
  if (n){ saveCaches(); bumpAnalysis(); if (typeof accPushCards==="function") accPushCards(); }
  const left = [...missing].length;
  toast(fatal ? `${n ? `Datos de ${n} cartas completados. ` : ""}${fatal}`
    : left ? `Datos de ${n} cartas completados con Claude. Faltan ${left}: vuelve a tocar el botón para intentarlo solo con esas.`
    : `Datos de ${n} cartas completados con Claude (sin precios). Revisa los que se vean raros en la ficha de cada carta.`);
  render(); return n;
}

/* ---------- ficha de carta: enlaces a EDHREC, Scryfall y Card Kingdom ---------- */
function webCardLinksHTML(n){
  return `<div class="web-links"><a class="btn sm primary" href="${EDH_CARD(n)}" target="_blank" rel="noopener">Ver en EDHREC</a><a class="btn sm" href="${SF_CARD(n)}" target="_blank" rel="noopener">Versiones en Scryfall</a><a class="btn sm" href="${CK_CARD(n)}" target="_blank" rel="noopener">Precio en Card Kingdom</a></div>`;
}

/* ---------- ajustes de la interfaz en la web ---------- */
if (isWebView()){
  document.body.classList.add("web");
  const relabel = () => { for (const b of document.querySelectorAll("#main button, #modal button")) if (/^Actualizar cartas$/.test(b.textContent.trim())) b.textContent = "Completar datos con Claude"; };
  new MutationObserver(relabel).observe(document.getElementById("main"), {childList:true, subtree:true});
  new MutationObserver(relabel).observe(document.getElementById("modal"), {childList:true, subtree:true});
}
