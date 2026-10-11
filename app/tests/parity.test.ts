// Paridad con la Bóveda original: el motor nuevo debe dar los mismos resultados que el código
// que ya estaba probado con mazos reales. Si el original no está en el repositorio, se omite.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasLegacy, loadLegacy } from "./legacy.ts";
import {
  MemoryDb, fromScry, parseList, splitParsed, analyze, bracketOf, manaBase, karstenLands, simulateHands, simRun, synergyOf,
  playBracket, swaps, bracketPlan, comboEngine, seeded, slug, GC_FALLBACK,
  type Card, type Deck, type EdhData, type ScryCard,
} from "../src/engine/index.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures");
const scry: ScryCard[] = JSON.parse(fs.readFileSync(path.join(FX, "cards.json"), "utf8"));
const DECKS: [string, string][] = [["hakbal.txt", "Hakbal of the Surging Soul"], ["hapatra.txt", "Hapatra, Vizier of Poisons"], ["callampitas.txt", "Slimefoot and Squee"], ["voja.txt", "Voja, Jaws of the Conclave"]];
const text = (f: string) => fs.readFileSync(path.join(FX, f), "utf8");

const db = new MemoryDb(new Map(), GC_FALLBACK);
for (const c of scry) db.put(fromScry(c));
const mkDeck = (f: string, cmd: string, i: number): Deck => {
  const s = splitParsed(parseList(text(f), { keepSide: true }), [cmd]);
  return { id: "d" + i, name: f.replace(".txt", ""), commanders: s.commanders, cards: s.cards, maybe: s.maybe, kind: "mine", plan: { bracket: null, theme: "", inter: "mid" }, created: 1, updated: 1 };
};
const decks = DECKS.map(([f, c], i) => mkDeck(f, c, i));

// una fuente de EDHREC inventada con las cartas de los otros mazos: sirve para probar sugerencias sin red
const fakePool = (d: Deck): EdhData => {
  const pool = scry.filter(c => !/Basic/.test(c.type_line || "")).map((c, i) => ({ n: c.name, incl: ((i * 37) % 100) / 100, syn: (((i * 53) % 60) - 20) / 100 }));
  return { at: 1, slug: slug(d.commanders[0]), decks: 1000, themes: [], pool };
};

const skip = !hasLegacy();
const L = skip ? null : loadLegacy();
if (L) {
  L.run(`for (const c of ${JSON.stringify(scry)}) S.cards[slug(c.name)] = fromScry(c);`);
  L.run(`var __decks = ${JSON.stringify(DECKS.map(([f, c], i) => ({ f, c, i, t: text(f) })))}.map(x => { const p = parseList(x.t, {keepSide:true}); return {id:"d"+x.i, format:"commander", name:x.f.replace(".txt",""), commanders:[x.c], cards:p.filter(c=>!c.maybe && !c.side && slug(c.n)!==slug(x.c)).map(c=>({n:c.n,q:c.q})), side:[], maybe:p.filter(c=>(c.maybe||c.side) && slug(c.n)!==slug(x.c)).map(c=>({n:c.n,q:c.q})), log:[], created:1, updated:1}; }); S.data.decks.push(...__decks); bumpAnalysis();`);
}
const plain = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

test("cartas: mismos roles, etiquetas y marcas que el original", { skip }, () => {
  const old = L!.run<Record<string, Record<string, unknown>>>(`JSON.parse(JSON.stringify(S.cards))`);
  let n = 0;
  for (const c of scry) {
    const a: Card = fromScry(c), b = old[slug(c.name)];
    if (b.n !== c.name) continue;   // dos entradas de prueba con la misma clave (carta de dos caras y su cara frontal)
    for (const k of ["n", "cmc", "ci", "col", "t", "tl", "cost", "pm", "r", "sb", "tg", "rf", "tq", "gc", "xt", "mld", "tap", "pw", "tu", "leg"] as const) {
      assert.deepEqual(plain((a as unknown as Record<string, unknown>)[k]), b[k], `${c.name} · ${k}`);
    }
    assert.equal(a.legal, (b.lg as Record<string, string>).commander, c.name + " · legalidad");
    n++;
  }
  assert.ok(n > 250);
});

test("lector de listas: mismas cartas y cantidades", { skip }, () => {
  for (const d of decks) {
    const old = L!.run<{ cards: { n: string; q: number }[]; maybe: { n: string; q: number }[] }>(`JSON.parse(JSON.stringify(__decks.find(x=>x.id==="${d.id}")))`);
    assert.deepEqual(d.cards, old.cards, d.name);
    assert.deepEqual(d.maybe, old.maybe, d.name + " · probables");
  }
});

test("análisis, bracket y base de maná iguales", { skip }, () => {
  for (const d of decks) {
    const A = analyze(d, db);
    const old = L!.run<Record<string, unknown>>(`(()=>{ const d=__decks.find(x=>x.id==="${d.id}"); const A=analyze(d); const M=manaBase(A); return JSON.parse(JSON.stringify({ci:A.ci, main:A.main, total:A.total, missing:A.missing, roles:A.roles, types:A.types, curve:A.curve, avg:A.avg, spells:A.spells, gc:A.gc, off:A.off, dupes:A.dupes, illegal:A.illegal, xt:A.xt, mld:A.mld, tutors:A.tutors, br:bracketOf(d,A), k:karstenLands(A), M})); })()`);
    const M = manaBase(A);
    const mine = plain({ ci: A.ci, main: A.main, total: A.total, missing: A.missing, roles: A.roles, types: A.types, curve: A.curve, avg: A.avg, spells: A.spells, gc: A.gc, off: A.off, dupes: A.dupes, illegal: A.illegal, xt: A.xt, mld: A.mld, tutors: A.tutors, br: bracketOf(d, A), k: karstenLands(A), M });
    assert.deepEqual(mine, old, d.name);
    assert.ok(A.main >= 80, d.name + ": mazo cargado");
  }
});

test("sinergias: mismos temas, cohesión y cartas sueltas", { skip }, () => {
  for (const d of decks) {
    const Y = synergyOf(analyze(d, db));
    const old = L!.run<Record<string, unknown>>(`(()=>{ const d=__decks.find(x=>x.id==="${d.id}"); const Y=synergyOf(d, analyze(d)); return JSON.parse(JSON.stringify({th:Y.themes.map(t=>[t.k,t.E,t.P,t.score,t.state,t.cmd,t.need]), tr:Y.tribes.map(t=>[t.s,t.n,t.pay.length]), lonely:Y.lonely.map(r=>r.n), co:Y.cohesion})); })()`);
    const mine = plain({ th: Y.themes.map(t => [t.k, t.E, t.P, t.score, t.state, t.cmd, t.need]), tr: Y.tribes.map(t => [t.s, t.n, t.pay.length]), lonely: Y.lonely.map(r => r.n), co: Y.cohesion });
    assert.deepEqual(mine, old, d.name);
  }
});

test("prueba de manos: con la misma semilla, los mismos números", { skip }, () => {
  for (const d of decks) {
    L!.setRandom(seeded(4242));
    const old = L!.run<Record<string, unknown>>(`(()=>{ const d=__decks.find(x=>x.id==="${d.id}"); return JSON.parse(JSON.stringify(simulate(d, analyze(d)))); })()`);
    const mine = plain(simulateHands(analyze(d, db), seeded(4242)));
    assert.deepEqual(mine, old, d.name);
    assert.ok((mine as { pScrew: number }).pScrew < 0.6);
  }
});

test("bracket por velocidad y deformación igual al original", { skip }, () => {
  for (const d of decks) {
    L!.setRandom(seeded(4242));
    // el original guarda la prueba de manos en memoria: ya quedó calculada con esta semilla en la prueba anterior
    const old = L!.run<Record<string, unknown>>(`(()=>{ const d=__decks.find(x=>x.id==="${d.id}"); const A=analyze(d); const P=powerOf(d,A); return JSON.parse(JSON.stringify({ax:P.axes, E:P.E})); })()`);
    const A = analyze(d, db);
    const ax = playBracket(d, A, simulateHands(A, seeded(4242)), []);
    assert.deepEqual(plain({ ax, E: comboEngine([...A.rows, ...A.cmdMeta.filter(Boolean).map(m => ({ n: m!.n, q: 1, m }))]) }), old, d.name);
  }
});

test("partidas simuladas: con la misma semilla, los mismos resultados", { skip }, async () => {
  const old = await L!.run<Promise<Record<string, unknown>>>(`simRun(__decks.slice(0,3), 300, null, {seed: 777}).then(r => JSON.parse(JSON.stringify({draws:r.draws, decks:r.decks.map(d=>[d.id,d.w,d.avgTurn,d.how,d.seat,d.ci])})))`);
  const r = await simRun(decks.slice(0, 3), db, 300, { seed: 777, pause: false });
  assert.deepEqual(plain({ draws: r.draws, decks: r.decks.map(d => [d.id, d.w, d.avgTurn, d.how, d.seat, d.ci]) }), old);
  const tot = r.decks.reduce((a, d) => a + d.w, 0) + r.draws;
  assert.equal(tot, 300, "todas las partidas cuentan");
  // una mesa de cuatro también coincide
  const old4 = await L!.run<Promise<unknown>>(`simRun(__decks, 200, null, {seed: 31337}).then(r => JSON.parse(JSON.stringify(r.decks.map(d=>[d.id,d.w,d.avgTurn]))))`);
  const r4 = await simRun(decks, db, 200, { seed: 31337, pause: false });
  assert.deepEqual(plain(r4.decks.map(d => [d.id, d.w, d.avgTurn])), old4);
});

test("cambios sugeridos y plan por bracket iguales (sin límite de bracket)", { skip }, () => {
  for (const d of decks) {
    const E = fakePool(d); const A = analyze(d, db);
    L!.run(`S.edh[${JSON.stringify(d.commanders.map(c => c.split(" // ")[0].toLowerCase().normalize("NFD").replace(/['’,.!?"():]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).join("-"))}] = ${JSON.stringify(E)};`);
    const oldS = L!.run<[string, string][]>(`(()=>{ const d=__decks.find(x=>x.id==="${d.id}"); return optimizeLocal(d, analyze(d), edhOf(d), "inf").map(x=>[x.sale, x.entra]); })()`);
    assert.deepEqual(swaps(d, A, E, db, d.plan).map(x => [x.out, x.in]), plain(oldS), d.name + " · cambios");
    for (const target of [2, 3, 4, 5]) {
      const oldP = L!.run<Record<string, unknown>>(`(()=>{ const d=__decks.find(x=>x.id==="${d.id}"); const P=bracketPlan(d, analyze(d), ${target}); return JSON.parse(JSON.stringify({checks:P.checks.map(c=>[c.ok,c.t]), cuts:P.cuts.map(c=>[c.n,c.why,c.rep]), adds:P.adds.map(a=>a.n)})); })()`);
      const P = bracketPlan(d, A, target, db, E);
      assert.deepEqual(plain({ checks: P.checks.map(c => [c.ok, c.t]), cuts: P.cuts.map(c => [c.n, c.why, c.rep]), adds: P.adds.map(a => a.n) }), oldP, `${d.name} · bracket ${target}`);
    }
  }
});
