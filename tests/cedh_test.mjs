// Prueba del meta cEDH con respuestas simuladas de TopDeck.gg.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "cedh-")); mkdirSync(join(dir, "functions")); mkdirSync(join(dir, "lib"));
writeFileSync(join(dir, "blobs.mjs"), `const M=new Map(); export function getStore(){ return {
  async get(k,o){ const v=M.get(k); return v==null?null:(o&&o.type==="json"?JSON.parse(v):v); }, async setJSON(k,v){ M.set(k, JSON.stringify(v)); } }; }`);
const root = new URL("../netlify/", import.meta.url);
writeFileSync(join(dir, "lib/cedh.mjs"), readFileSync(new URL("lib/cedh.mjs", root), "utf8"));
writeFileSync(join(dir, "functions/cedh.mjs"), readFileSync(new URL("functions/cedh.mjs", root), "utf8").replace("@netlify/blobs", "../blobs.mjs"));
// 24 jugadores: 12 Kinnan (4 al top), 12 Thrasios/Tymna; un torneo chico que debe quedar fuera
const player = (i) => { const kin = i % 2 === 0; return {name:"P" + i, id:"p" + i, wins:kin?4:2, draws:1, losses:kin?1:3, winRate:kin?.7:.4,
  deckObj: kin ? {Commanders:{"Kinnan, Bonder Prodigy":{count:1}}, Mainboard:{"Sol Ring":{count:1}, "Basalt Monolith":{count:1}, ...(i<8?{"Rhystic Study":{count:1}}:{})}}
    : null, decklist: kin ? null : "~~Commanders~~\n1 Tymna the Weaver\n1 Thrasios, Triton Hero\n~~Mainboard~~\n1 Sol Ring\n1 Demonic Tutor\n"}; };
const big = {TID:"big-24", tournamentName:"Big cEDH", startDate:1790000000, topCut:4, standings:Array.from({length:24}, (_, i) => player(i)),
  rounds:[{round:1, tables:[{table:1, players:[{id:"p0"},{id:"p1"},{id:"p2"},{id:"p3"}], winner_id:"p0", status:"Completed"}, {table:2, players:[{id:"p4"},{id:"p5"},{id:"p6"},{id:"p7"}], winner_id:"Draw", status:"Completed"}]}]};
const small = {TID:"small", tournamentName:"Chico", startDate:1790000000, topCut:4, standings:Array.from({length:10}, (_, i) => player(i)), rounds:[]};
let calls = [];
globalThis.fetch = async (url, init) => { calls.push([url, init && init.headers && init.headers.Authorization, init && init.body]);
  if (/\/players\//.test(url)) return new Response(JSON.stringify({name:"steez", deckObj:{Commanders:{"Kinnan, Bonder Prodigy":{count:1}}, Mainboard:{"Sol Ring":{count:1}, "Island":{count:10}}}}), {status:200});
  return new Response(JSON.stringify([big, small]), {status:200}); };
const expect = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)){ console.error(`FALLA ${name}: ${JSON.stringify(got)} (esperado ${JSON.stringify(want)})`); process.exit(1); } };
delete process.env.TOPDECK_KEY;
const fn = (await import(join(dir, "functions/cedh.mjs"))).default;
const get = async q => { const r = await fn(new Request("https://x/api/cedh?" + q)); return [r.status, await r.json()]; };
expect("sin clave", (await get("q=data"))[0], 501);
process.env.TOPDECK_KEY = "k-123";
const [s, d] = await get("q=data");
expect("con clave", s, 200);
expect("clave en cabecera", calls[0][1], "k-123");
expect("pide 24+", JSON.parse(calls[0][2]).participantMin, 24);
expect("descarta torneo chico", d.tours.map(t => t.id), ["big-24"]);
expect("comandantes", d.cmds.sort(), ["Kinnan, Bonder Prodigy", "Thrasios, Triton Hero / Tymna the Weaver"]);
expect("asientos (mesas, a1..a4, empates)", d.tours[0].seat, [2, 1, 0, 0, 0, 1]);
expect("listas", d.lists, 24);
const [, c] = await get("q=cmd&name=" + encodeURIComponent("Kinnan, Bonder Prodigy"));
expect("listas de Kinnan", [c.lists, c.top], [12, 2]);
expect("Rhystic en 4 de 12 (33,3%) y 2 de 2 en el top", c.cards.find(x => x[0] === "Rhystic Study"), ["Rhystic Study", 33.3, 100]);
const [, c2] = await get("q=cmd&name=" + encodeURIComponent("Tymna the Weaver / Thrasios, Triton Hero"));
expect("pareja en otro orden", c2.lists, 12);
const [, t] = await get("q=t&id=big-24");
expect("posiciones del torneo", [t.std.length, t.std[0].cmd, t.std[1].list], [24, "Kinnan, Bonder Prodigy", true]);
const [dks, dk] = await get("q=deck&id=big-24/p0"); if (!dk.raw) console.error(dks, dk);
expect("lista importable", dk.raw.split("\n").slice(0, 5), ["Commander", "1 Kinnan, Bonder Prodigy", "", "Deck", "1 Sol Ring"]);
expect("enlace inválido", (await get("q=deck&id=../etc"))[0], 400);
console.log("cEDH OK: TopDeck.gg filtrado a 24+ jugadores, asientos, cartas por comandante y listas.");
