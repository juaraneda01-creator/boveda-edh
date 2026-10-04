/* =========================================================
   Bóveda EDH — precios para la versión de claude.ai
   La versión con cuenta no puede consultar Scryfall. La versión
   en vivo descarga un archivo solo con los datos de las cartas
   (precios incluidos); al importarlo en claude.ai quedan en la
   cuenta para todos los dispositivos. La versión de claude.ai
   avisa si no tiene precios o si tienen más de 7 días.
   ========================================================= */
const PRICE_OLD_DAYS = 7;
// cartas que usas (mazos, colección, búsqueda, carpetas) y la fecha del precio más nuevo entre ellas
function priceStatus(){
  const names = new Set();
  for (const d of S.data.decks || []){ for (const n of d.commanders || []) names.add(slug(n)); for (const b of ["cards","side","maybe"]) for (const c of d[b] || []) names.add(slug(c.n)); }
  for (const it of (S.data.collection && S.data.collection.items) || []) names.add(slug(it.n));
  for (const w of S.data.wishlist || []) names.add(slug(w.n));
  for (const b of S.data.binders || []) for (const it of b.items || []) names.add(slug(it.n));
  let used = 0, priced = 0, newest = 0;
  for (const k of names){ if (BASICS.has(k)) continue; used++; const c = S.cards[k]; if (c && (c.usd != null || c.eur != null)){ priced++; if ((c.at||0) > newest) newest = c.at; } }
  return {used, priced, newest, days: newest ? Math.floor((Date.now() - newest) / 864e5) : null};
}
// aviso en Inicio de la versión de claude.ai
function priceBannerHTML(){
  if (!isWebView() || S.busy || !S.pricesReady) return "";
  const P = priceStatus(); if (!P.used) return "";
  const how = `En la <a href="https://boveda-edh.netlify.app" target="_blank" rel="noopener">versión en vivo</a>: Ajustes y respaldo → “Descargar precios para claude.ai”. Aquí: Ajustes y respaldo → “Importar respaldo”.`;
  if (!P.priced) return `<div class="banner" id="price-banner"><span><b>Esta versión no tiene precios.</b> No puede consultar Scryfall, así que los precios se traen con un archivo. ${how}</span></div>`;
  if (P.days > PRICE_OLD_DAYS) return `<div class="banner" id="price-banner"><span><b>Tus precios son de hace ${P.days} días</b> (${new Date(P.newest).toLocaleDateString("es-CL")}). ${how}</span></div>`;
  return "";
}
// fila en Ajustes y respaldo
function pricesFileHTML(){
  if (isWebView()){ const P = priceStatus(); return `<p class="muted" style="margin:0;font-size:.9rem">Precios: ${P.priced ? `los más nuevos son del ${new Date(P.newest).toLocaleDateString("es-CL")} (${P.priced} de ${P.used} cartas).` : "esta versión aún no tiene."} Para actualizarlos, descarga el archivo de precios en la versión en vivo e impórtalo aquí con “Importar respaldo”.</p>`; }
  return `<div class="row"><button class="btn sm ghost" data-act="prices-file">Descargar precios para claude.ai</button></div>
    <p class="muted" style="margin:0;font-size:.85rem">Solo datos de cartas y precios, sin tus mazos ni tu colección. Impórtalo en la versión de claude.ai y quedan en tu cuenta.</p>`;
}
function pricesFile(){
  const cards = {}; let n = 0;
  for (const [k, c] of Object.entries(S.cards || {})) if (c && c.n && !c.est && (c.usd != null || c.eur != null)){ cards[k] = c; n++; }
  if (!n){ toast("Aún no hay precios guardados: actualiza los precios primero."); return; }
  download(`boveda-edh-precios-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({app:"boveda-edh", kind:"precios", version:4, at:Date.now(), cardData:{cards, gc:[...(S.gc||[])], gcAt:S.gcAt||null}}), "application/json");
  toast(`Archivo de precios listo: ${n.toLocaleString("es-CL")} cartas. Impórtalo en la versión de claude.ai.`);
}
// las cartas guardadas (navegador y cuenta) llegan después del primer dibujo: el aviso espera unos segundos
S.boot.then(()=>setTimeout(()=>{ S.pricesReady = true; if (isWebView() && S.view==="home" && !S.editing && !S.modal && !S.settingsOpen) render(); }, 5000));
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-act='prices-file']"); if (!b) return;
  ev.stopPropagation(); pricesFile();
}, true);
