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
