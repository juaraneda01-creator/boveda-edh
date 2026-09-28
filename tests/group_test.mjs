// Mesa compartida: unirse, publicar mazos, anotar partidas, escrituras simultáneas.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "grp-"));
writeFileSync(join(dir, "blobs.mjs"), `const M=new Map(); let n=0; export const race={on:false}; export function getStore(){ return {
  async getWithMetadata(k){ const v=M.get(k); return v?{data:JSON.parse(v.d), etag:v.e}:null; },
  async setJSON(k,val,o){ const v=M.get(k); if (race.on){ race.on=false; M.set(k,{d:JSON.stringify({...JSON.parse(v.d), games:[...JSON.parse(v.d).games, {id:"otro-dispositivo", players:[], by:"x"}]}), e:"e"+(++n)}); }
    const w=M.get(k); if (o.onlyIfNew && w) return {modified:false}; if (o.onlyIfMatch && (!w || w.e!==o.onlyIfMatch)) return {modified:false}; M.set(k,{d:JSON.stringify(val), e:"e"+(++n)}); return {modified:true}; } }; }`);
writeFileSync(join(dir, "group.mjs"), readFileSync(new URL("../netlify/functions/group.mjs", import.meta.url), "utf8").replace("@netlify/blobs", "./blobs.mjs"));
const fn = (await import(join(dir, "group.mjs"))).default; const blobs = await import(join(dir, "blobs.mjs"));
const id = "b".repeat(64), U = "https://x/api/group?id=" + id;
const post = async b => { const r = await fn(new Request(U, {method:"POST", body: JSON.stringify(b)})); return [r.status, await r.json()]; };
const expect = (name, ok, got) => { if (!ok){ console.error(`FALLA ${name}: ${JSON.stringify(got)}`); process.exit(1); } };
expect("sin grupo aún", (await fn(new Request(U))).status === 404, null);
expect("no se puede anotar sin unirse", (await post({op:"game", mid:"juan1", game:{}}))[0] === 404, null);
let [s, d] = await post({op:"join", mid:"juan1", name:"Juan", group:"Los del jueves"});
expect("crear al unirse", s === 200 && d.name === "Los del jueves" && d.members.juan1.name === "Juan", d);
[s, d] = await post({op:"join", mid:"pedro2", name:"Pedro"});
[s, d] = await post({op:"decks", mid:"juan1", decks:[{id:"hk01", name:"Tiritones", commanders:["Hakbal"], power:6.8, br:[3,3], salt:53, list:"1 Sol Ring"}]});
expect("mazos publicados", d.decks["juan1:hk01"].power === 6.8, d.decks);
[s, d] = await post({op:"decks", mid:"pedro2", decks:[{id:"vj01", name:"Voja", commanders:["Voja"], power:8.2, br:[3,4]}]});
expect("mazos de cada uno", Object.keys(d.decks).length === 2, d.decks);
[s] = await post({op:"decks", mid:"intruso", decks:[]});
expect("un extraño no publica", s === 403, s);
blobs.race.on = true;
[s, d] = await post({op:"game", mid:"juan1", game:{id:"g0001", players:[{mid:"juan1", deck:"juan1:hk01", seat:1, res:"win"}, {mid:"pedro2", deck:"pedro2:vj01", seat:2, res:"loss"}], turn:8, how:"combat"}});
expect("escritura simultánea: no se pierde la otra partida", s === 200 && d.games.map(g=>g.id).sort().join() === "g0001,otro-dispositivo", d.games);
[s, d] = await post({op:"delgame", mid:"pedro2", gid:"g0001"});
expect("un jugador de la partida puede borrarla", !d.games.some(g=>g.id==="g0001"), d.games);
console.log("Grupo OK: unirse, mazos, partidas y escrituras simultáneas sin pérdidas.");
