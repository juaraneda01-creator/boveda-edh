// Sal de EDHREC: recorre las páginas hasta que la sal baja de 0,8.
import { buildSalt, slugName } from "../netlify/lib/salt.mjs";
const pages = {
  "https://json.edhrec.com/pages/top/salt.json": {container:{json_dict:{cardlists:[{cardviews:[{name:"Stasis", salt:3.06}, {name:"Rhystic Study", salt:2.73}]}]}}},
  "https://json.edhrec.com/pages/top/salt--1.json": {cardviews:[{name:"Bolas's Citadel", salt:1.71}, {name:"Zur's Weirding", salt:1.43}], more:"top/salt--2.json"},
  "https://json.edhrec.com/pages/top/salt--2.json": {cardviews:[{name:"Deadly Rollick", salt:0.95}, {name:"Sol Ring", salt:0.62}], more:"top/salt--3.json"},
  "https://json.edhrec.com/pages/top/salt--3.json": {cardviews:[{name:"Nunca", salt:0.5}]},
};
let calls = 0;
const d = await buildSalt(async url => { calls++; if (!pages[url]) throw new Error("404"); return pages[url]; });
const ok = d.done && calls === 3 && d.map[slugName("Bolas's Citadel")] === 1.71 && d.map["deadly-rollick"] === 0.95 && d.map["nunca"] === undefined;
if (!ok){ console.error("FALLA sal:", calls, d); process.exit(1); }
console.log("Sal OK: " + d.n + " cartas, se detiene cuando la sal baja de 0,8.");
// por tramos: una página por ejecución, sigue donde quedó, y la lista completa reemplaza a la parcial
import { saltStep, buildSalt as B2 } from "../netlify/lib/salt.mjs";
const M = new Map(), E = new Map(); let en = 0; const store = {async get(k){ const v = M.get(k); return v ? JSON.parse(v) : null; },
  async getWithMetadata(k){ const v = M.get(k); return v ? {data: JSON.parse(v), etag: E.get(k)} : null; },
  async setJSON(k, v, o){ if (o && o.onlyIfNew && M.has(k)) return {modified:false}; if (o && o.onlyIfMatch && E.get(k) !== o.onlyIfMatch) return {modified:false}; M.set(k, JSON.stringify(v)); E.set(k, "e" + (++en)); return {modified:true}; }, async delete(k){ M.delete(k); }};
let n2 = 0; const slow = async url => { n2++; if (!pages[url]) throw new Error("404"); await new Promise(r => setTimeout(r, 30)); return pages[url]; };
let m = await saltStep(store, slow, 1); if (m.done || m.pages !== 1 || !M.has("work")){ console.error("FALLA sal por tramos 1", m); process.exit(1); }
m = await saltStep(store, slow, 1); if (m.pages !== 2 || m.done){ console.error("FALLA sal por tramos 2", m); process.exit(1); }
m = await saltStep(store, slow, 1); if (!m.done || M.has("work") || m.map["deadly-rollick"] !== 0.95 || n2 !== 3){ console.error("FALLA sal por tramos 3", m, n2); process.exit(1); }
m = await saltStep(store, slow, 1); if (n2 !== 3){ console.error("FALLA sal: completa y fresca no se vuelve a pedir"); process.exit(1); }
{ const W = JSON.parse(M.get("map")); M.set("map", JSON.stringify({...W, at: 0})); M.set("work", JSON.stringify({busy: Date.now()})); const n3 = n2; const r = await saltStep(store, slow, 1); if (n2 !== n3 || !r){ console.error("FALLA sal: con otro turno en curso no se descarga de nuevo"); process.exit(1); } M.delete("work"); }
const e = await B2(async () => { throw new Error("500"); }); if (e.done || !e.err){ console.error("FALLA sal: un error no es el final", e); process.exit(1); }
console.log("Sal por tramos OK: sigue donde quedó y un error no la da por terminada.");
