/* =========================================================
   Bóveda EDH — Descargar cada sección del mazo como imagen
   Copia la sección con sus estilos calculados dentro de un SVG
   (foreignObject), lo dibuja en un canvas y entrega un PNG.
   Sin librerías externas: funciona igual en la versión en vivo,
   en el archivo descargado y en claude.ai.
   ========================================================= */
const SNAP_PX = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const snapCache = new Map();   // imagen → data URL (o null si no se pudo leer)
async function snapDataURL(url){
  if (!url || url.startsWith("data:")) return url;
  if (snapCache.has(url)) return snapCache.get(url);
  let out = null;
  try {
    const ctl = new AbortController(); const t = setTimeout(()=>ctl.abort(), 6000);
    const r = await fetch(url, {mode:"cors", signal:ctl.signal}); clearTimeout(t);
    if (r.ok){ const b = await r.blob(); out = await new Promise(res=>{ const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b); }); }
  } catch {}
  snapCache.set(url, out); return out;
}
// fuentes de la app (Google Fonts) incrustadas, solo el subconjunto latino; si no se pueden traer, se usan las del sistema
let snapFontsCSS = null;
async function snapFonts(){
  if (snapFontsCSS !== null) return snapFontsCSS;
  snapFontsCSS = "";
  try {
    const link = document.querySelector('link[href*="fonts.googleapis.com/css"]'); if (!link) return "";
    const css = await (await fetch(link.href)).text();
    const blocks = css.split("@font-face").slice(1).filter(b=>/unicode-range:[^;]*U\+0000-00FF/i.test(b));
    const out = [];
    for (const b of blocks){ const m = b.match(/url\((https:[^)]+)\)/); if (!m) continue; const d = await snapDataURL(m[1]); if (d) out.push("@font-face" + b.replace(m[1], d)); }
    snapFontsCSS = out.join("\n");
  } catch {}
  return snapFontsCSS;
}
// copia el árbol con los estilos calculados de cada elemento
function snapClone(src){
  const clone = src.cloneNode(true);
  const S0 = [src, ...src.querySelectorAll("*")], C0 = [clone, ...clone.querySelectorAll("*")];
  for (let i=0; i<S0.length; i++){
    const s = S0[i], c = C0[i]; if (!c || c.nodeType !== 1) continue;
    const cs = getComputedStyle(s);
    let txt = ""; for (let k=0; k<cs.length; k++){ const p = cs[k]; txt += `${p}:${cs.getPropertyValue(p)};`; }
    c.setAttribute("style", txt);
    c.removeAttribute("class"); c.removeAttribute("id");
    if (s.tagName === "TEXTAREA") c.textContent = s.value;
    else if (s.tagName === "INPUT"){ if (/checkbox|radio/.test(s.type)){ if (s.checked) c.setAttribute("checked", ""); } else c.setAttribute("value", s.value); }
    else if (s.tagName === "SELECT"){ const o = s.options[s.selectedIndex]; const span = document.createElement("span"); span.setAttribute("style", txt); span.textContent = o ? o.text : ""; c.replaceWith(span); C0[i] = span; }
    else if (s.tagName === "CANVAS"){ try { const im = document.createElement("img"); im.src = s.toDataURL(); im.setAttribute("style", txt); c.replaceWith(im); C0[i] = im; } catch {} }
  }
  // lo que es solo para usar la pantalla (botones de acción, subir archivos) no va en la imagen
  for (const el of [...clone.querySelectorAll("input[type=file], script")]) el.remove();
  for (const [i, s] of S0.entries()){ if (s.matches && s.matches(".btn:not(.chip), .actions") && C0[i] && C0[i].parentNode) C0[i].remove(); }
  return clone;
}
async function nodeToPng(node, {title="", sub=""} = {}){
  const width = Math.ceil(Math.max(node.scrollWidth, node.getBoundingClientRect().width));
  const body = snapClone(node);
  for (const im of body.querySelectorAll("img")){ const d = await snapDataURL(im.currentSrc || im.getAttribute("src")); im.setAttribute("src", d || SNAP_PX); im.removeAttribute("srcset"); im.removeAttribute("loading"); }
  const fonts = await snapFonts();
  const css = getComputedStyle(document.body), bg = css.backgroundColor || "#fff", ink = css.color || "#111";
  const wrap = document.createElement("div");
  wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  const W = width + 44;   // la sección conserva su ancho y el margen va por fuera
  wrap.setAttribute("style", `width:${W}px;box-sizing:border-box;background:${bg};color:${ink};font-family:${css.fontFamily};padding:20px 22px;`);
  const head = document.createElement("div");
  head.setAttribute("style", `display:flex;justify-content:space-between;gap:16px;align-items:baseline;border-bottom:2px solid ${getComputedStyle(document.documentElement).getPropertyValue("--accent")||"#1F5C4A"};padding-bottom:8px;margin-bottom:14px;font-family:Alegreya,Georgia,serif`);
  head.innerHTML = `<div><div style="font-size:24px;font-weight:700">${esc(title)}</div><div style="font-size:14px;opacity:.75">${esc(sub)}</div></div><div style="font-size:13px;opacity:.7;white-space:nowrap">Bóveda EDH · ${new Date().toLocaleDateString("es-CL")}</div>`;
  wrap.append(head, body);
  // se mide la altura real con la copia puesta fuera de la pantalla
  const probe = document.createElement("div"); probe.setAttribute("style", "position:fixed;left:-100000px;top:0;"); probe.append(wrap); document.body.append(probe);
  const height = Math.ceil(wrap.getBoundingClientRect().height); probe.remove();
  const scale = Math.max(1, Math.min(2, 15000 / Math.max(height, 1)));
  const xhtml = new XMLSerializer().serializeToString(wrap);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${fonts?`<style xmlns="http://www.w3.org/1999/xhtml">${fonts}</style>`:""}${xhtml}</foreignObject></svg>`;
  const img = new Image();
  await new Promise((res, rej)=>{ img.onload = res; img.onerror = () => rej(new Error("no se pudo dibujar la sección")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  const cv = document.createElement("canvas"); cv.width = Math.round(W*scale); cv.height = Math.round(height*scale);
  const g = cv.getContext("2d"); g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height); g.scale(scale, scale); g.drawImage(img, 0, 0);
  const blob = await new Promise(res=>cv.toBlob(res, "image/png"));
  if (!blob) throw new Error("el navegador no entregó la imagen");
  return {blob, width:cv.width, height:cv.height};
}
// nombre de la sección abierta del mazo (la etiqueta de su pestaña)
function snapSectionName(){
  const chip = document.querySelector('#deck-pane .subchips .chip[aria-pressed="true"]');
  const tab = document.querySelector('#deck-pane .subtabs .subtab[aria-selected="true"]');
  return ((chip || tab || {}).textContent || "Sección").trim();
}
/* ---------- .zip sin compresión (las PNG ya vienen comprimidas) ---------- */
const CRC_T = (()=>{ const t = new Uint32Array(256); for (let n=0;n<256;n++){ let c=n; for (let k=0;k<8;k++) c = c&1 ? 0xEDB88320 ^ (c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
function crc32(u8){ let c = 0xFFFFFFFF; for (let i=0;i<u8.length;i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files){   // [{name, data:Uint8Array}]
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  const d = new Date(), dt = ((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1)) & 0xFFFF, dd = (((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()) & 0xFFFF;
  for (const f of files){
    const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0,0x04034b50,true); h.setUint16(4,20,true); h.setUint16(6,0x0800,true); h.setUint16(8,0,true); h.setUint16(10,dt,true); h.setUint16(12,dd,true); h.setUint32(14,crc,true); h.setUint32(18,n,true); h.setUint32(22,n,true); h.setUint16(26,name.length,true); h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer), name, f.data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0x0800,true); c.setUint16(10,0,true); c.setUint16(12,dt,true); c.setUint16(14,dd,true); c.setUint32(16,crc,true); c.setUint32(20,n,true); c.setUint32(24,n,true); c.setUint16(28,name.length,true); c.setUint32(42,off,true);
    cen.push(new Uint8Array(c.buffer), name); off += 30 + name.length + n;
  }
  const cenSize = cen.reduce((a,x)=>a+x.length,0);
  const e = new DataView(new ArrayBuffer(22)); e.setUint32(0,0x06054b50,true); e.setUint16(8,files.length,true); e.setUint16(10,files.length,true); e.setUint32(12,cenSize,true); e.setUint32(16,off,true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], {type:"application/zip"});
}
// secciones de cada mazo, en el orden de sus pestañas
const SNAP_TABS = {
  commander: [["analisis","Análisis"],["nivel","Ficha y nivel"],["mana","Base de maná"],["lista","Lista"],["sinergias","Sinergias"],["mejorar","Recomendaciones"],["brackets","Brackets"],["combos","Combos"],["partidas","Partidas"],["radiografia","Cómo se juega"],["precio","Valor"],["versiones","Versiones"]],
  other: [["analisis","Análisis"],["mana","Base de maná"],["lista","Lista"],["sinergias","Sinergias"],["meta","Contra el meta"],["partidas","Partidas"],["radiografia","Cómo se juega"],["precio","Valor"],["versiones","Versiones"]],
};
async function snapDeckAll(btn){
  const d = curDeck(); if (!d) return;
  const tabs = SNAP_TABS[d.format==="commander" ? "commander" : "other"], back = S.deckTab;
  if (btn){ btn.disabled = true; btn.dataset.t0 = btn.textContent; }
  const files = [];
  try {
    for (const [i, [k, es]] of tabs.entries()){
      if (btn) btn.textContent = `Creando ${i+1} de ${tabs.length}…`;
      S.deckTab = k; render(); await new Promise(r=>setTimeout(r, 60));
      const node = document.querySelector("#deck-pane .pane-body"); if (!node) continue;
      try { const {blob} = await nodeToPng(node, {title:d.name, sub:`${es} · ${d.format==="commander" ? ((d.commanders||[]).join(" + ") || "Commander") : FORMATS[d.format].name}`});
        files.push({name:`${String(i+1).padStart(2,"0")}-${slug(es)}.png`, data:new Uint8Array(await blob.arrayBuffer())}); } catch {}
    }
    S.deckTab = back; render();
    if (!files.length){ toast("No se pudo crear ninguna imagen."); return; }
    download(`${slug(d.name)||"mazo"}-secciones.zip`, zipStore(files), "application/zip");
    if (!(typeof isWebView==="function" && isWebView())) toast(`${files.length} secciones descargadas en un .zip.`);
  } finally { S.deckTab = back; if (btn){ btn.disabled = false; btn.textContent = btn.dataset.t0 || "Todas (.zip)"; } render(); }
}
const canShareImg = () => { try { return !!(navigator.canShare && typeof File==="function" && navigator.canShare({files:[new File([new Blob(["x"])], "x.png", {type:"image/png"})]}) && matchMedia("(hover: none)").matches); } catch { return false; } };
async function snapDeckSection(btn, share=false){
  const d = curDeck(); const node = document.querySelector("#deck-pane .pane-body"); if (!d || !node) return;
  const sec = snapSectionName();
  if (btn){ btn.disabled = true; btn.dataset.t0 = btn.textContent; btn.textContent = "Creando imagen…"; }
  try {
    const sub = `${sec} · ${d.format==="commander" ? ((d.commanders||[]).join(" + ") || "Commander") : FORMATS[d.format].name}`;
    const {blob} = await nodeToPng(node, {title:d.name, sub});
    const name = `${slug(d.name)||"mazo"}-${slug(sec)||"seccion"}.png`;
    const file = typeof File==="function" ? new File([blob], name, {type:"image/png"}) : null;
    if (share && file && navigator.canShare && navigator.canShare({files:[file]})){ try { await navigator.share({files:[file], title:`${d.name} · ${sec}`}); return; } catch(e){ if (e && e.name==="AbortError") return; } }
    download(name, blob, "image/png"); if (!(typeof isWebView==="function" && isWebView())) toast(`Imagen de “${sec}” descargada.`);
  } catch(e){ toast("No se pudo crear la imagen: " + ((e && e.message) || "error")); }
  finally { if (btn){ btn.disabled = false; btn.textContent = btn.dataset.t0 || "Descargar imagen"; } }
}
// "Descargar imagen" baja el archivo directo; en el teléfono, "Compartir" abre el menú para mandarlo
document.addEventListener("click", ev => { const b = ev.target.closest('[data-act="snap"],[data-act="snap-share"],[data-act="snap-all"]'); if (!b) return;
  if (b.dataset.act==="snap-all") snapDeckAll(b); else snapDeckSection(b, b.dataset.act==="snap-share"); });
