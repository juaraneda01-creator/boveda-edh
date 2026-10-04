// Prueba del meta de Pauper y Pioneer armado en el servidor, con páginas simuladas de MTGTop8 y Pauper World.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { parseDate, parseFormat, parseArchetype, parseList, parsePauperWorld, buildFormat, refreshMeta, refreshMetaLocked, takeBuildLock, metaSig } from "../netlify/lib/meta.mjs";

const NOW = Date.UTC(2026, 9, 1, 12);   // 1 de octubre de 2026
const day = n => { const d = new Date(NOW - n*864e5); return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${String(d.getUTCFullYear()).slice(2)}`; };

/* ---------- páginas simuladas ---------- */
// 9 arquetipos con % distinto y dos empatados en el último puesto (4 %), más "Other" y uno bajo el corte
const ARCH = {pauper:[["Kuldotha Red",14,"aggro"],["Mono Blue Terror",12,"aggro"],["Affinity",11,"aggro"],["Jund Wildfire",9,"control"],["Familiars",8,"control"],["Golgari Gardens",7,"control"],["Elves",6,"combo"],["Walls Combo",5,"combo"],["Balustrade Spy",4,"combo"],["Aura Aggro",4,"aggro"],["Red Deck Wins",4,"aggro"],["Tron",2,"control"]],
  pioneer:[["UR Aggro",20,"aggro"],["Rakdos Midrange",13,"control"],["Greasefang",10,"combo"],["UW Control",9,"control"],["Izzet Control",8,"control"],["Selesnya Company",7,"aggro"],["Lotus Field",6,"combo"],["Mono Green",5,"aggro"],["Niv to Light",3,"control"]]};
const idOf = (fmt, i) => (fmt==="pauper" ? 100 : 500) + i;
function formatPage(fmt){
  const f = fmt==="pauper" ? "PAU" : "PI"; let out = `<html><body><div>Last 2 Weeks</div><div>351 decks</div><table>`;
  for (const cat of ["aggro","control","combo"]){
    out += `<tr><td colspan=2><b>${cat.toUpperCase()}</b></td><td>40 %</td></tr>`;
    ARCH[fmt].forEach(([n, s, c], i) => { if (c===cat) out += `<tr><td><a href="archetype?a=${idOf(fmt,i)}&amp;meta=1&amp;f=${f}">${n}</a></td><td>${s} %</td></tr>`; });
    out += `<tr><td><a href="archetype?a=9${cat.length}&amp;f=${f}">Other - ${cat}</a></td><td>3 %</td></tr>`;
  }
  return out + `</table></body></html>`;
}
// cada arquetipo: una lista vieja primero (MTGTop8 no ordena por fecha) y la más nueva después
function archetypePage(fmt, i){
  const f = fmt==="pauper" ? "PAU" : "PI", id = idOf(fmt, i);
  const row = (d, e, name, rank, date) => `<tr><td><a href=event?e=${e}&d=${d}&f=${f}>${name}</a></td><td>Jugador ${d}</td><td>Liga ${e}</td><td>${rank}</td><td>${date}</td></tr>`;
  return `<table>${row(id*10+1, 7000+i, "Lista vieja", "5-8", day(40))}${row(id*10+2, 7100+i, "Lista nueva", "1", day(3+i))}${row(id*10+3, 7050+i, "Lista media", "2", day(20))}</table>`;
}
const LIST = n => `4 Lightning Bolt\r\n4 Carta ${n}\r\n4 Fire / Ice\r\n4 Delver of Secrets\r\n4 Counterspell\r\n20 Island\r\n20 Mountain\r\n\r\nSideboard\r\n3 Pyroblast\r\n2 Hydroblast\r\n`;
const PW = `<html><h1>Metagame</h1><p>Sep 17 - 30, 2026</p><p>1,095 decks across 42 events</p><table><tr><th>#</th><th>Archetype</th><th>Share</th><th>Decks</th></tr>${
  [["Mono Blue Terror",11.2,123],["Kuldotha Red",10.1,111],["Affinity",9,99],["Jund Wildfire",8.2,90],["Familiars",6,66],["Golgari Gardens",5.5,60],["Elves",5,55],["Bogles",4.1,45],["Balustrade Spy",3.2,35],["Tron",2,22]]
    .map(([n,p,d],i)=>`<tr><td>${i+1}</td><td><a href="/a/${i}">${n}</a></td><td>${String(p).replace(".",",")}%</td><td>${d}</td></tr>`).join("")}</table></html>`;

const seen = []; let fail = null;
const get = async url => {
  seen.push(url);
  if (fail && fail.test(url)) throw new Error(url + " → 500");
  const u = new URL(url);
  if (u.hostname==="pauperworld.com") return PW;
  if (u.pathname==="/format") return formatPage(u.searchParams.get("f")==="PAU" ? "pauper" : "pioneer");
  if (u.pathname==="/archetype"){ const a = +u.searchParams.get("a"); return a >= 500 ? archetypePage("pioneer", a-500) : archetypePage("pauper", a-100); }
  if (u.pathname==="/mtgo") return LIST(u.searchParams.get("d"));
  throw new Error("URL inesperada " + url);
};

/* ---------- lectores ---------- */
assert.equal(parseDate("28/09/26"), Date.UTC(2026, 8, 28, 12));
assert.equal(parseDate("sin fecha"), null);
const PF = parseFormat(formatPage("pauper"));
assert.equal(PF.total, 351);
assert.equal(PF.archetypes.length, 12, "12 arquetipos, sin los Other");
assert.deepEqual(PF.archetypes.find(a=>a.name==="Elves"), {id:"106", name:"Elves", share:6, cat:"combo", arch:"https://mtgtop8.com/archetype?a=106&meta=1&f=PAU"});
assert.equal(PF.archetypes.find(a=>a.name==="Jund Wildfire").cat, "control");
// una dirección con comillas escondidas en entidades nunca se guarda tal cual
const bad = parseFormat(`<b>AGGRO</b> 50 % <a href="archetype?a=77&quot;onmouseover=&quot;alert(1)">Mazo Raro</a> 9 %`);
assert.equal(bad.archetypes[0].arch, "https://mtgtop8.com/archetype?a=77");
assert.ok(!/["'<> ]/.test(bad.archetypes[0].arch));
const PA = parseArchetype(archetypePage("pauper", 0), NOW);
assert.equal(PA.rows.length, 3);
assert.equal(PA.newest.name, "Lista nueva", "la lista más reciente, no la primera de la página");
assert.equal(PA.newest.d, "1002"); assert.equal(PA.newest.event, "Liga 7100"); assert.equal(PA.newest.rank, "1");
assert.equal(PA.recent, 1, "solo una lista dentro de las últimas 2 semanas");
const PL = parseList(LIST(1));
assert.equal(PL.n, 60); assert.equal(PL.ns, 5);
assert.ok(PL.text.includes("4 Fire // Ice"), "cartas partidas con //");
assert.ok(PL.text.includes("\nSideboard\n3 Pyroblast"));
assert.equal(parseList("4 Lightning Bolt\n"), null, "una lista incompleta se descarta");
const PWp = parsePauperWorld(PW);
assert.equal(PWp.rows.length, 10); assert.deepEqual(PWp.rows[0], {name:"Mono Blue Terror", pct:11.2, decks:123});
assert.equal(PWp.total, 1095); assert.equal(PWp.events, 42); assert.equal(PWp.period, "Sep 17 - 30, 2026");

/* ---------- armar un formato ---------- */
const BF = await buildFormat("pauper", get, {pause:0, now:NOW});
assert.equal(BF.at, NOW); assert.equal(BF.total, 351);
assert.equal(BF.archetypes.length, 11, "los 9 del top más los empatados en el último puesto");
assert.ok(BF.archetypes.some(a=>a.name==="Aura Aggro") && BF.archetypes.some(a=>a.name==="Red Deck Wins"));
assert.ok(!BF.archetypes.some(a=>a.name==="Tron"), "bajo el corte queda fuera");
const k0 = BF.archetypes[0];
assert.equal(k0.name, "Kuldotha Red"); assert.equal(k0.cat, "aggro"); assert.equal(k0.recent, 1);
assert.equal(k0.deck, "https://mtgtop8.com/event?e=7100&d=1002&f=PAU");
assert.equal(k0.sample, `Lista nueva · Liga 7100 (1) · ${day(3)}`);
assert.equal(k0.date, parseDate(day(3)));
assert.ok(k0.list.startsWith("4 Lightning Bolt\n4 Carta 1002"));
await assert.rejects(buildFormat("pauper", async u => u.includes("/format") ? "<html>nada</html>" : get(u), {pause:0, now:NOW}), /solo 0 arquetipos/);

/* ---------- guardar, y conservar lo anterior si una fuente falla ---------- */
const M = new Map();
const store = { async get(k, o){ const v = M.get(k); return v==null ? null : (o && o.type==="json" ? JSON.parse(v) : v); }, async setJSON(k, v){ M.set(k, JSON.stringify(v)); } };
const R1 = await refreshMeta(store, get, {pause:0, now:NOW});
assert.equal(R1.errors.length, 0);
assert.equal(R1.pioneer.archetypes.length, 8); assert.equal(R1.pw.rows.length, 10);
assert.equal(R1.pioneer.archetypes[0].deck, "https://mtgtop8.com/event?e=7100&d=5002&f=PI");
fail = /f=PI|pauperworld/;
const R2 = await refreshMeta(store, get, {pause:0, now:NOW + 864e5});
assert.equal(R2.errors.length, 2, "Pioneer y Pauper World fallaron");
assert.equal(R2.pauper.at, NOW + 864e5, "Pauper se renovó");
assert.equal(R2.pioneer.at, NOW, "Pioneer conserva lo anterior");
assert.equal(R2.pw.rows.length, 10, "Pauper World conserva lo anterior");
fail = /./;
await assert.rejects(refreshMeta({ async get(){ return null; }, async setJSON(){ throw new Error("no debe guardar"); } }, get, {pause:0}), /ninguna fuente respondió/);
fail = null;

/* ---------- funciones: /api/meta y la reconstrucción en segundo plano ---------- */
const LIB = new URL("../netlify/lib/", import.meta.url).href;
const dir = mkdtempSync(join(tmpdir(), "meta-")); mkdirSync(join(dir, "functions"));
writeFileSync(join(dir, "blobs.mjs"), `const S=globalThis.__metaStores||(globalThis.__metaStores=new Map()); export function getStore(o){ const n=o.name; if(!S.has(n)) S.set(n,new Map()); const M=S.get(n); return {
  async get(k,o){ const v=M.get(k); return v==null?null:(o&&o.type==="json"?JSON.parse(v):v); },
  async getWithMetadata(k){ const v=M.get(k); return v==null?null:{data:JSON.parse(v), etag:"e"+JSON.stringify(v).length+":"+v.length+":"+(M.__n||0)}; },
  async setJSON(k,v,o){ if (o && o.onlyIfNew && M.has(k)) return {modified:false}; if (o && o.onlyIfMatch){ const cur=await this.getWithMetadata(k); if (!cur || cur.etag!==o.onlyIfMatch) return {modified:false}; } M.__n=(M.__n||0)+1; M.set(k, JSON.stringify(v)); return {modified:true}; },
  async delete(k){ M.delete(k); } }; }`);
const { getStore: testStore } = await import(join(dir, "blobs.mjs"));
const live = () => testStore({name:"boveda-meta"});
const root = new URL("../netlify/", import.meta.url);
for (const f of ["meta", "meta-refresh", "meta-refresh-background"])
  writeFileSync(join(dir, `functions/${f}.mjs`), readFileSync(new URL(`functions/${f}.mjs`, root), "utf8").replace("@netlify/blobs", "../blobs.mjs").replace(/\.\.\/lib\//g, LIB));
const api = (await import(join(dir, "functions/meta.mjs"))).default;
const apiCfg = (await import(join(dir, "functions/meta.mjs"))).config;
const daily = await import(join(dir, "functions/meta-refresh.mjs"));
const bg = (await import(join(dir, "functions/meta-refresh-background.mjs"))).default;
assert.equal(apiCfg.path, "/api/meta"); assert.equal(daily.config.schedule, "@daily");

const kicks = [];
globalThis.fetch = async (url, init) => {
  url = String(url);
  if (url.includes("meta-refresh-background")){ kicks.push(init.headers["x-boveda-refresh"]); return new Response("", {status:202}); }
  try { return new Response(await get(url), {status:200}); } catch { return new Response("", {status:500}); }
};
const req = (path, h = {}) => new Request("https://boveda-edh.netlify.app" + path, {headers:{"sec-fetch-site":"same-origin", "x-nf-client-connection-ip":"1.2.3.4", ...h}});
const stores = () => globalThis.__metaStores.get("boveda-meta");

let r = await api(req("/api/meta"));
assert.equal(r.status, 503, "sin datos: avisa que se está armando");
assert.equal((await r.json()).code, "building");
assert.equal(kicks.length, 1, "pide armarlo en segundo plano");
const SIG = await metaSig(live());
assert.ok(/^[0-9a-f]{64}$/.test(SIG), "la firma es un secreto al azar guardado en el almacén");
assert.equal(kicks[0], SIG); assert.equal(await metaSig(live()), SIG, "la firma no cambia entre llamadas");
r = await api(req("/api/meta")); assert.equal(kicks.length, 1, "no vuelve a pedirlo mientras el candado esté vigente");

for (const h of [{"x-boveda-refresh":"firma-falsa"}, {"x-boveda-refresh":""}, {}])
  await bg(new Request("https://x/.netlify/functions/meta-refresh-background", {method:"POST", headers:h}));
assert.ok(!stores().has("meta"), "sin la firma correcta no arma nada");
// una reconstrucción en curso bloquea a la segunda; al terminar (bien o mal) el candado se libera
assert.equal(await takeBuildLock(live()), true); assert.equal(await takeBuildLock(live()), false, "candado atómico");
assert.equal(await refreshMetaLocked(live(), get, {pause:0}), "ocupado"); assert.ok(!stores().has("meta"));
await live().setJSON("building", {at:0});
fail = /./; assert.match(await refreshMetaLocked(live(), get, {pause:0}), /^error: ninguna fuente respondió/); fail = null;
assert.equal(JSON.parse(stores().get("building")).at, 0, "un intento fallido libera el candado");
// con la firma correcta arma y guarda (las pausas reales entre páginas son de 300 ms: se acortan para la prueba)
const realTimeout = globalThis.setTimeout; globalThis.setTimeout = (fn, ms, ...a) => realTimeout(fn, Math.min(ms, 1), ...a);
await bg(new Request("https://x/.netlify/functions/meta-refresh-background", {method:"POST", headers:{"x-boveda-refresh": SIG}}));
globalThis.setTimeout = realTimeout;
assert.ok(stores().has("meta"), "con la firma correcta guarda el meta");
assert.equal(JSON.parse(stores().get("building")).at, 0, "al terminar libera el candado");

r = await api(req("/api/meta")); assert.equal(r.status, 200);
const D = await r.json();
assert.equal(D.v, 1); assert.equal(D.pauper.archetypes.length, 11); assert.equal(D.pioneer.archetypes.length, 8); assert.ok(D.pw.rows.length >= 8);
assert.match(r.headers.get("cache-control"), /max-age=1800/);
r = await api(req("/api/meta?q=status")); const St = await r.json();
assert.ok(St.at && St.pauper && St.pioneer && St.pw); assert.deepEqual(St.errors, []);

// datos de más de 30 horas: se sirven igual y se pide renovarlos
const old = JSON.parse(stores().get("meta")); old.at = Date.now() - 31*3600e3; stores().set("meta", JSON.stringify(old)); stores().delete("lock");
r = await api(req("/api/meta")); assert.equal(r.status, 200); assert.equal(kicks.length, 2, "meta viejo: pide renovarlo");
stores().delete("lock"); await api(req("/api/meta?refresh=0")); assert.equal(kicks.length, 2, "refresh=0 no pide nada");
stores().delete("lock"); await daily.default(); assert.equal(kicks.length, 3, "la tarea diaria pide renovarlo");
r = await api(req("/api/meta", {"sec-fetch-site":"cross-site", origin:"https://otro.sitio"})); assert.equal(r.status, 403, "solo desde la Bóveda");

/* ---------- la foto guardada en la app: cada arquetipo de Pauper tiene pareja en la matriz o está marcado sin datos ---------- */
const ctx = {}; vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../src/meta.js", import.meta.url), "utf8") + "\n;globalThis.META=META;globalThis.PAUPER_MU=PAUPER_MU;globalThis.META_VS=META_VS;globalThis.META_AT=META_AT;", ctx);
for (const l of readFileSync(new URL("../src/pauper.js", import.meta.url), "utf8").split("\n")) if (/^PAUPER_MU\.alias\[/.test(l)) vm.runInContext(l, ctx);
const { META, PAUPER_MU, META_VS } = ctx;
assert.equal(META.pauper.archetypes.length, 9); assert.equal(META.pioneer.archetypes.length, 8);
for (const a of META.pauper.archetypes){
  const n = PAUPER_MU.alias[a.name] || a.name;
  assert.ok(PAUPER_MU.arch.includes(n) || (PAUPER_MU.noMu || []).includes(a.name), `“${a.name}” de MTGTop8 no tiene pareja en la matriz de Paupergeddon ni está en PAUPER_MU.noMu`);
}
for (const n of PAUPER_MU.noMu || []) assert.ok(!PAUPER_MU.arch.includes(PAUPER_MU.alias[n] || n), `“${n}” está marcado sin datos pero sí tiene matriz`);
for (const fmt of ["pauper", "pioneer"]) for (const a of META[fmt].archetypes){
  assert.ok(META_VS[fmt][a.name], `falta el plan de sideboard de “${a.name}” (${fmt})`);
  const p = parseList(a.list); assert.ok(p && p.n >= 60, `la lista de “${a.name}” tiene menos de 60 cartas`);
  assert.match(a.sample, /\d{2}\/\d{2}\/\d{2}\s*$/, `la muestra de “${a.name}” no termina con su fecha`);
}
for (const [k, v] of Object.entries(PAUPER_MU.pwAlias || {})) assert.ok(PAUPER_MU.arch.includes(k) || (PAUPER_MU.noMu||[]).includes(k), `pwAlias “${k}” → “${v}” no corresponde a un arquetipo conocido`);

console.log("Meta en el servidor OK: lectores, lista más reciente, empates, fuentes caídas, /api/meta y foto guardada.");
