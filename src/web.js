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
  return claudeFill(todo);
}
async function claudeFill(names){
  const sample = await claude.use("sample");
  if (!sample){ toast("Completar con Claude no está disponible en esta vista."); return 0; }
  const B = 35, own = !S.busy; let n = 0;
  if (own) setBusy("Completando datos de las cartas con Claude", names.length);
  try {
    for (let i=0; i<names.length; i+=B){
      const chunk = names.slice(i, i+B);
      const prompt = `You are a Magic: The Gathering card database. For each card name below, give its official Oracle data in English.
Reply with ONLY a JSON array, one object per name, same order, exactly this shape:
{"q":"<name as given>","name":"<official name>","type_line":"Creature — Elf Druid","mana_cost":"{1}{G}","cmc":2,"colors":["G"],"color_identity":["G"],"oracle_text":"<full oracle text>","produced_mana":["G"],"legal":{"commander":"legal","pauper":"not_legal","pioneer":"legal"},"game_changer":false,"known":true}
Rules: produced_mana lists the colors of mana the card can add (empty array if none). legal values are "legal", "not_legal" or "banned". game_changer is true only if the card is on the official Commander Game Changers list. If you are not sure a card exists or do not know its exact text, set "known":false and leave the other fields empty. Never invent cards.
Names:
${chunk.join("\n")}`;
      let arr;
      try { arr = await sample.json(prompt, {modelTier:"default"}); }
      catch(e){
        const c = e && e.code;
        toast(c==="not_granted" ? "Sin permiso para usar Claude en esta página." : c==="rate_limited" ? "Claude está ocupado. Prueba en unos minutos." : c==="session_expired" ? "Tu sesión de claude.ai expiró: vuelve a entrar." : "No se pudieron completar los datos. Prueba de nuevo.");
        break;
      }
      for (const x of Array.isArray(arr) ? arr : []){
        if (!x || !x.known || !x.name || !x.type_line) continue;
        const c = fromScry({name:String(x.name), cmc:+x.cmc||0, type_line:String(x.type_line), mana_cost:String(x.mana_cost||""),
          colors:Array.isArray(x.colors)?x.colors:[], color_identity:Array.isArray(x.color_identity)?x.color_identity:[],
          oracle_text:String(x.oracle_text||""), produced_mana:Array.isArray(x.produced_mana)?x.produced_mana:[],
          legalities:x.legal||{}, game_changer:x.game_changer===true});
        c.est = true; c.at = 1; c.usd = null; c.eur = null; c.img = ""; c.uri = SF_CARD(c.n);
        S.cards[slug(c.n)] = c; if (x.q) S.cards[slug(x.q)] = c; n++;
      }
      stepBusy(Math.min(names.length, i+B));
    }
  } finally { if (own){ S.busy = null; } }
  if (n){ saveCaches(); if (typeof accPushCards==="function") accPushCards(); toast(`Datos de ${n} cartas completados con Claude (sin precios). Revisa los que se vean raros en la ficha de cada carta.`); }
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
