// Pruebas del motor nuevo: casillas, borrador, comparación A contra B, comparación con el meta y lector de listas.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MemoryDb, fromScry, parseList, splitParsed, textToDeck, deckText, diffLists, analyze, bracketOf, synergyOf, slotGoals, buildSlots, nextStep,
  completeDeck, slotSuggestions, swaps, metaCompare, compareVersions, simulateHands, hyper, gameStats, winTurnOf, playBracket, seeded, slug,
  slotsOfCard, supportCount, isCounter,
  GC_FALLBACK, type Deck, type EdhData, type Game, type Plan, type ScryCard,
} from "../src/engine/index.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures");
const scry: ScryCard[] = JSON.parse(fs.readFileSync(path.join(FX, "cards.json"), "utf8"));
const text = (f: string) => fs.readFileSync(path.join(FX, f), "utf8");
const card = (name: string, type_line: string, oracle_text: string, extra: Partial<ScryCard> = {}): ScryCard =>
  ({ name, type_line, oracle_text, mana_cost: "{2}{G}", cmc: 3, color_identity: ["G"], colors: ["G"], legalities: { commander: "legal" }, ...extra });
// cartas inventadas para probar los límites por bracket
const EXTRA: ScryCard[] = [
  card("Test Changer A", "Sorcery", "Draw two cards.", { game_changer: true }),
  card("Test Changer B", "Sorcery", "Draw two cards.", { game_changer: true }),
  card("Test Changer C", "Sorcery", "Draw two cards.", { game_changer: true }),
  card("Test Changer D", "Sorcery", "Draw two cards.", { game_changer: true }),
  card("Test Changer Land", "Land", "{T}: Add {G}{G}.", { game_changer: true, mana_cost: "", cmc: 0, produced_mana: ["G"] }),
  card("Test Time Walk", "Sorcery", "Take an extra turn after this one."),
  card("Test Armageddon", "Sorcery", "Destroy all lands."),
  card("Test Red Card", "Creature — Goblin", "Haste", { color_identity: ["R"], colors: ["R"], mana_cost: "{R}", cmc: 1 }),
  card("Test Banned", "Sorcery", "Draw two cards.", { legalities: { commander: "banned" } }),
];
const db = new MemoryDb(new Map(), GC_FALLBACK);
for (const c of [...scry, ...EXTRA]) db.put(fromScry(c));

const plan = (bracket: number | null = null, inter: Plan["inter"] = "mid"): Plan => ({ bracket, theme: "", inter });
const mkDeck = (f: string, cmd: string, id = "d"): Deck => {
  const s = splitParsed(parseList(text(f), { keepSide: true }), [cmd]);
  return { id, name: f.replace(".txt", ""), commanders: s.commanders, cards: s.cards, maybe: s.maybe, kind: "mine", plan: plan(), created: 1, updated: 1 };
};
const hakbal = mkDeck("hakbal.txt", "Hakbal of the Surging Soul", "hak");
const hapatra = mkDeck("hapatra.txt", "Hapatra, Vizier of Poisons", "hap");
const slimefoot = mkDeck("callampitas.txt", "Slimefoot and Squee", "sli");
// una fuente de EDHREC inventada: todas las cartas de prueba, con popularidad decreciente
const pool: EdhData = { at: 1, slug: "x", decks: 5000, themes: [], pool: [...EXTRA, ...scry].filter(c => !/Basic/.test(c.type_line || "")).map((c, i) => ({ n: c.name, incl: Math.max(0.01, 0.95 - i * 0.003), syn: ((i * 7) % 40 - 10) / 100 })) };
const total = (cards: { q: number }[]) => cards.reduce((a, c) => a + c.q, 0);

test("lector de listas: formatos de Moxfield, Archidekt, Arena y marcas de comandante", () => {
  const p = parseList("1x Sol Ring (CMM) 400 *F*\n1 Atraxa, Praetors' Voice *CMDR*\n2 Forest\nSideboard\n1 Naturalize\nMaybeboard\n1 Rhystic Study");
  assert.deepEqual(p.map(c => [c.n, c.q, c.c, c.side, c.maybe]), [["Sol Ring", 1, false, false, false], ["Atraxa, Praetors' Voice", 1, true, false, false], ["Forest", 2, false, false, false], ["Naturalize", 1, false, true, false], ["Rhystic Study", 1, false, false, true]]);
  const a = parseList("1 Sol Ring [Ramp]\n1 Kinnan, Bonder Prodigy [Commander{top}]\n1 Brainstorm [Maybeboard{noDeck}]");
  assert.deepEqual(a.map(c => [c.n, c.c, c.maybe]), [["Sol Ring", false, false], ["Kinnan, Bonder Prodigy", true, false], ["Brainstorm", false, true]]);
  const s = splitParsed(p);
  assert.deepEqual(s.commanders, ["Atraxa, Praetors' Voice"]);
  assert.deepEqual(s.maybe.map(c => c.n), ["Naturalize", "Rhystic Study"], "en Commander el banquillo pasa a cartas probables");
  assert.ok(!s.cards.some(c => c.n.startsWith("Atraxa")), "el comandante no queda dentro de las 99");
  // dos bloques: el último, de una línea, es el comandante
  const t = textToDeck("1 Sol Ring\n1 Forest\n\n1 Hakbal of the Surging Soul");
  assert.deepEqual(splitParsed(parseList(t)).commanders, ["Hakbal of the Surging Soul"]);
  // ida y vuelta
  const back = splitParsed(parseList(deckText(hakbal)));
  assert.deepEqual(back.commanders, hakbal.commanders); assert.equal(total(back.cards), total(hakbal.cards));
  assert.deepEqual(diffLists(hakbal.cards, back.cards), { add: [], rem: [] });
});

test("lector de listas: CSV con columnas de cantidad, nombre y tablero", () => {
  const p = parseList("Quantity,Name,Board\n1,\"Hakbal of the Surging Soul\",Commander\n3,Island,Main\n1,Counterspell,Maybeboard");
  assert.deepEqual(p.map(c => [c.n, c.q, c.c, c.maybe]), [["Hakbal of the Surging Soul", 1, true, false], ["Island", 3, false, false], ["Counterspell", 1, false, true]]);
});

test("casillas: las metas siguen al plan y cada carta cae en alguna", () => {
  const g3 = new Map(slotGoals(plan(3)).map(g => [g.k, g])), g5 = new Map(slotGoals(plan(5)).map(g => [g.k, g]));
  assert.ok(g5.get("land")!.hi < g3.get("land")!.lo, "cEDH lleva menos tierras");
  assert.ok(g5.get("tutor")!.lo > g3.get("tutor")!.lo);
  assert.ok(slotGoals(plan(3, "high")).find(g => g.k === "removal")!.lo > slotGoals(plan(3, "low")).find(g => g.k === "removal")!.hi - 3);
  const A = analyze(hakbal, db); const slots = buildSlots(A, synergyOf(A), hakbal.plan);
  const by = new Map(slots.map(s => [s.k, s]));
  assert.equal(by.get("land")!.count, A.roles.land);
  assert.equal(by.get("ramp")!.count, A.roles.ramp);
  assert.equal(by.get("draw")!.count, A.roles.draw);
  const placed = new Set(slots.flatMap(s => s.rows.map(r => r.n)));
  for (const r of A.rows) assert.ok(placed.has(r.n), r.n + " quedó sin casilla");
  for (const r of by.get("other")!.rows) assert.equal(slots.filter(s => s.rows.includes(r)).length, 1, r.n + ": 'sin casilla' es exclusiva");
  assert.match(nextStep(slots, A, 99), /mazo|Faltan|Sobran/);
});

test("borrador desde cero: 99 cartas, en colores, legales y sin lo que se excluyó", () => {
  const input = { commanders: hakbal.commanders, cards: [], plan: plan(null), exclude: ["Counterspell"] };
  const R = completeDeck(input, pool, db);
  assert.equal(total(R.cards), 99); assert.equal(R.short, 0);
  const A = analyze({ commanders: hakbal.commanders, cards: R.cards }, db);
  assert.deepEqual(A.off, [], "nada fuera de la identidad de color");
  assert.deepEqual(A.illegal, [], "nada prohibido");
  assert.deepEqual(A.dupes, [], "singleton");
  assert.ok(!R.cards.some(c => slug(c.n) === "counterspell"));
  assert.ok(!R.cards.some(c => c.n === "Test Red Card" || c.n === "Test Banned"));
  const goals = new Map(slotGoals(input.plan).map(g => [g.k, g]));
  assert.ok(A.roles.land >= goals.get("land")!.lo && A.roles.land <= goals.get("land")!.hi, `tierras ${A.roles.land}`);
  assert.ok(A.roles.ramp >= goals.get("ramp")!.lo, `ramp ${A.roles.ramp}`);
  assert.ok(A.roles.draw >= goals.get("draw")!.lo, `robo ${A.roles.draw}`);
});

test("borrador: respeta el bracket buscado", () => {
  const at = (b: number | null) => analyze({ commanders: hakbal.commanders, cards: completeDeck({ commanders: hakbal.commanders, cards: [], plan: plan(b) }, pool, db).cards }, db);
  const A2 = at(2); assert.deepEqual([A2.gc, A2.xt, A2.mld], [[], [], []], "bracket 2: sin Game Changers, turnos extra ni destrucción de tierras");
  assert.ok(bracketOf({ commanders: hakbal.commanders, cards: [] }, A2).b <= 2);
  const A3 = at(3); assert.ok(A3.gc.length <= 3, `bracket 3: hasta 3 Game Changers (${A3.gc.length})`); assert.deepEqual([A3.xt, A3.mld], [[], []]);
  assert.ok(A3.gc.length >= 1, "el bracket 3 sí aprovecha los Game Changers más jugados");
  const A4 = at(4); assert.ok(A4.gc.length > 3, "bracket 4: sin tope");
});

test("completar: no quita nada de lo que hay y no agrega si ya está completo", () => {
  const half = hakbal.cards.slice(0, 40);
  const R = completeDeck({ commanders: hakbal.commanders, cards: half, plan: plan(3) }, pool, db);
  assert.equal(total(R.cards), 99);
  for (const c of half) assert.ok((R.cards.find(x => slug(x.n) === slug(c.n)) || { q: 0 }).q >= c.q, c.n + " se mantuvo");
  const again = completeDeck({ commanders: hakbal.commanders, cards: R.cards, plan: plan(3) }, pool, db);
  assert.deepEqual(again.added, []); assert.equal(total(again.cards), 99);
  // un mazo ya pasado de cartas no crece más
  const over = completeDeck({ commanders: hakbal.commanders, cards: [...R.cards, { n: "Forest", q: 5 }], plan: plan(3) }, pool, db);
  assert.deepEqual(over.added, []);
});

test("sugerencias por casilla: del rol pedido, fuera del mazo y dentro del bracket", () => {
  const A = analyze(hapatra, db);
  for (const k of ["ramp", "draw", "removal", "wipe"] as const) {
    const S = slotSuggestions(k, hapatra, A, pool, db, plan(2), 8);
    for (const s of S) {
      assert.ok(k === "removal" ? ((s.m.r as string[]).includes("removal") || s.m.rf.includes("counter") || s.m.sb.includes("counter")) : (s.m.r as string[]).includes(k), `${s.n} no es ${k}`);
      assert.ok(!A.rows.some(r => slug(r.n) === slug(s.n)), s.n + " ya está en el mazo");
      assert.ok(!s.m.gc && !s.m.xt && !s.m.mld, s.n + " no cabe en bracket 2");
      assert.ok(!s.m.ci.split("").some(c => !A.ci.includes(c)), s.n + " fuera de color");
    }
  }
  assert.ok(slotSuggestions("land", hapatra, A, pool, db, plan(), 5).every(s => s.m.t === "Land"));
  assert.deepEqual(slotSuggestions("ramp", hapatra, A, null, db, plan()), [], "sin datos de EDHREC no hay sugerencias");
  // con el cupo de Game Changers lleno, no se proponen más
  const full = { ...hapatra, cards: [...hapatra.cards.slice(0, 90), { n: "Test Changer A", q: 1 }, { n: "Test Changer B", q: 1 }, { n: "Test Changer C", q: 1 }] };
  const Af = analyze(full, db);
  assert.ok(swaps(full, Af, pool, db, plan(3)).every(s => !db.get(s.in)!.gc), "bracket 3 con 3 Game Changers: ningún cambio mete un cuarto");
});

test("comparación con el meta: mide parecido y separa lo que falta de lo poco jugado", () => {
  const A = analyze(hakbal, db); const M = metaCompare(hakbal, A, pool, db, synergyOf(A));
  assert.ok(M.score >= 0 && M.score <= 100);
  for (const m of M.missing) assert.ok(!A.rows.some(r => slug(r.n) === slug(m.n)), m.n);
  assert.ok(M.missing.every(m => m.incl >= 0.3));
  assert.ok(!M.missing.some(m => m.n === "Test Red Card" || m.n === "Test Banned"), "lo que falta respeta colores y legalidad");
  assert.ok(M.rare.every(r => r.incl == null || r.incl < 0.05));
  // un mazo armado solo con lo más jugado se parece más a la lista típica
  const typical = completeDeck({ commanders: hakbal.commanders, cards: [], plan: plan(null) }, pool, db).cards;
  const At = analyze({ commanders: hakbal.commanders, cards: typical }, db);
  assert.ok(metaCompare(hakbal, At, pool, db, synergyOf(At)).score > M.score);
});

test("A contra B: la misma lista empata y el resultado se repite con la misma semilla", async () => {
  const a = { ...hakbal, name: "A" }, b = { ...hakbal, name: "B" };
  const C = await compareVersions({ a, b, rivals: [hapatra, slimefoot], n: 120, seed: 99 }, db);
  assert.equal(C.verdict, "tie"); assert.equal(C.diff, 0); assert.deepEqual([C.add, C.rem], [[], []]);
  assert.equal(C.mirror, false); assert.deepEqual(C.rivals, ["hapatra", "callampitas"]);
  const C2 = await compareVersions({ a, b, rivals: [hapatra, slimefoot], n: 120, seed: 99 }, db);
  assert.deepEqual([C2.a.win, C2.b.win, C2.a.hands && C2.a.hands.pScrew], [C.a.win, C.b.win, C.a.hands && C.a.hands.pScrew]);
  const M = await compareVersions({ a, b, rivals: [], n: 120, seed: 5 }, db);
  assert.equal(M.mirror, true); assert.ok(M.a.win + M.b.win <= 1.0001);
  assert.equal(M.verdict, "tie", "dos copias iguales en espejo no deben dar un ganador claro");
});

test("A contra B: una versión sin tierras suficientes pierde, y se informa qué cambió", async () => {
  const lands = hakbal.cards.filter(c => { const m = db.get(c.n); return m && m.t === "Land"; });
  const cut = new Set(lands.slice(0, lands.length - 3).map(c => slug(c.n)));   // deja muy pocas tierras
  const filler = scry.filter(c => /Creature/.test(c.type_line || "") && (c.cmc || 0) >= 5 && !hakbal.cards.some(x => slug(x.n) === slug(c.name))).slice(0, 12);
  const bCards = [...hakbal.cards.filter(c => !cut.has(slug(c.n))).map(c => /^(Island|Forest)$/.test(c.n) ? { ...c, q: 1 } : c), ...filler.map(c => ({ n: c.name, q: 1 }))];
  const C = await compareVersions({ a: { ...hakbal, name: "Actual" }, b: { ...hakbal, name: "Sin tierras", cards: bCards }, rivals: [hapatra, slimefoot], n: 300, seed: 7 }, db);
  assert.ok(C.b.A.roles.land < C.a.A.roles.land - 10);
  assert.ok(C.b.hands!.pScrew > C.a.hands!.pScrew + 0.2, "se atasca mucho más");
  assert.equal(C.verdict, "a", C.text);
  assert.ok(C.rem.length > 0 && C.add.length > 0);
  assert.match(C.text, /Actual rinde mejor/);
});

test("probabilidades de la mano inicial suman 1 y la prueba de manos es estable", () => {
  let s = 0; for (let k = 0; k <= 7; k++) s += hyper(99, 36, 7, k);
  assert.ok(Math.abs(s - 1) < 1e-9);
  const A = analyze(hakbal, db);
  const a = simulateHands(A, seeded(1), 3000)!, b = simulateHands(A, seeded(2), 3000)!;
  assert.ok(Math.abs(a.pScrew - b.pScrew) < 0.04, "dos corridas distintas dan casi lo mismo");
  assert.equal(simulateHands(analyze({ commanders: hakbal.commanders, cards: hakbal.cards.slice(0, 10) }, db)), null, "con menos de 40 cartas no se simula");
});

test("partidas reales: estadísticas y turno de victoria ajustado", () => {
  const g = (res: Game["res"], turn: number, seat: number, opp: string[], how: string | null = null): Game => ({ id: String(Math.random()), deckId: "hak", at: 1, res, turn, how, seat, opp, note: "" });
  const games = [g("win", 8, 1, ["Atraxa"], "combat"), g("win", 10, 2, ["Atraxa", "Kinnan"], "combo"), g("loss", 0, 3, ["Kinnan"]), g("draw", 0, 4, [])];
  const st = gameStats(games);
  assert.deepEqual([st.n, st.w, st.l, st.dr, st.pct, st.avgTurn], [4, 2, 1, 1, 0.5, 9]);
  assert.deepEqual(st.opp.find(o => o.k === "Atraxa"), { k: "Atraxa", n: 2, w: 2 });
  const A = analyze(hakbal, db); const sim = simulateHands(A, seeded(3), 3000)!;
  const W = winTurnOf(games, sim);
  assert.equal(W.n, 2); assert.ok(Math.abs(W.w - 2 / 12) < 1e-9, "dos victorias pesan 2 de 12");
  assert.ok(W.t! > Math.min(W.sim!, W.real!) - 1e-9 && W.t! < Math.max(W.sim!, W.real!) + 1e-9, "el ajustado queda entre el simulador y lo real");
  const fast = Array.from({ length: 30 }, () => g("win", 4, 1, []));
  assert.ok(playBracket(hakbal, A, sim, fast).speed >= playBracket(hakbal, A, sim, []).speed, "ganar antes en la mesa real sube la velocidad");
});

test("bracket oficial: umbrales de Game Changers, turnos extra, tierras y combos de 2 cartas", () => {
  const base = hakbal.cards.filter(c => { const m = db.get(c.n); return m && !m.gc && !m.xt && !m.mld; });
  const br = (extra: string[], combos?: Deck["combos"]) => { const d = { commanders: hakbal.commanders, cards: [...base, ...extra.map(n => ({ n, q: 1 }))], combos }; return bracketOf(d, analyze(d, db)); };
  const gcs = ["Test Changer A", "Test Changer B", "Test Changer C", "Test Changer D"];
  assert.equal(br([]).b, 2, "sin Game Changers");
  assert.equal(br(gcs.slice(0, 1)).b, 3, "1 Game Changer");
  assert.equal(br(gcs.slice(0, 3)).b, 3, "3 Game Changers siguen en bracket 3");
  assert.equal(br(gcs).b, 4, "4 Game Changers pasan a bracket 4");
  assert.equal(br(["Test Changer Land"]).b, 3, "una tierra Game Changer también cuenta");
  assert.equal(br(["Test Armageddon"]).b, 4, "destrucción masiva de tierras");
  assert.equal(br(["Test Time Walk"]).b, 2, "un turno extra suelto no sube el bracket");
  const combo = (cards: string[]) => ({ at: 1, inc: [{ id: "x", cards, prod: [], desc: "", bt: null }], almost: [] });
  assert.equal(br([], combo(["A", "B"])).b, 4, "combo de 2 cartas");
  assert.equal(br([], combo(["A", "B", "C"])).b, 2, "un combo de 3 cartas no sube el bracket");
  assert.equal(br([]).exact, false); assert.equal(br([], combo(["A", "B", "C"])).exact, true, "con combos revisados el bracket es exacto");
});

test("cambios sugeridos: sin colores para un comandante incoloro y nada si faltan sus datos", () => {
  const extra = new MemoryDb(new Map(db.cards), GC_FALLBACK);
  extra.put(fromScry(card("Test Golem Commander", "Legendary Artifact Creature — Golem", "", { color_identity: [], colors: [], mana_cost: "{5}", cmc: 5 })));
  for (let i = 0; i < 70; i++) extra.put(fromScry(card(`Test Rock ${i}`, "Artifact", i % 2 ? "{T}: Add {C}." : "Draw two cards.", { color_identity: [], colors: [], mana_cost: "{2}", cmc: 2, produced_mana: i % 2 ? ["C"] : [] })));
  const d = { ...hakbal, commanders: ["Test Golem Commander"], cards: Array.from({ length: 60 }, (_, i) => ({ n: `Test Rock ${i}`, q: 1 })) };
  const E: EdhData = { at: 1, slug: "x", decks: 100, themes: [], pool: [...pool.pool, ...Array.from({ length: 10 }, (_, i) => ({ n: `Test Rock ${60 + i}`, incl: 0.5, syn: 0 }))] };
  const S = swaps(d, analyze(d, extra), E, extra, plan());
  assert.ok(S.length > 0, "propone cambios");
  for (const s of S) assert.equal(extra.get(s.in)!.ci, "", `${s.in} tiene color y el comandante es incoloro`);
  const unknown = { ...hakbal, commanders: ["Comandante Sin Datos"] };
  assert.deepEqual(swaps(unknown, analyze(unknown, db), pool, db, plan()), [], "sin datos del comandante no se sugiere nada");
});

test("contrahechizos: cuentan en la casilla Removal y las metas del plan guían los cambios", () => {
  const counter = fromScry(card("Test Swan Song", "Instant", "Counter target enchantment, instant, or sorcery spell.", { color_identity: ["U"], colors: ["U"], mana_cost: "{U}", cmc: 1 }));
  assert.ok(!(counter.r as string[]).includes("removal") && isCounter(counter), "el texto no calza con el rol removal, pero es contrahechizo");
  assert.deepEqual(slotsOfCard(counter, false), ["removal"], "va a la casilla Removal, no a Sin casilla");
  const local = new MemoryDb(new Map(db.cards), GC_FALLBACK); local.put(counter);
  const d = { ...hakbal, cards: [...hakbal.cards, { n: "Test Swan Song", q: 1 }] };
  const A = analyze(d, local); const slots = buildSlots(A, synergyOf(A), plan());
  const rem = slots.find(s => s.k === "removal")!;
  assert.equal(rem.count, supportCount(A, "removal")); assert.equal(rem.count, A.roles.removal + rem.rows.filter(r => !(r.m!.r as string[]).includes("removal")).reduce((a, r) => a + r.q, 0));
  assert.ok(rem.rows.some(r => r.n === "Test Swan Song"));
  // con interacción "Poca" (meta 4 a 6) y más removal que eso, ningún cambio dice que falta removal
  const few = supportCount(A, "removal"); assert.ok(few > 6, `el mazo de prueba lleva ${few} de removal`);
  for (const s of swaps(d, A, pool, local, plan(null, "low"))) assert.ok(!s.fills.includes("removal"), `${s.in}: no falta removal con interacción Poca`);
});

test("cambios sugeridos: no proponen cortar cartas con varias copias", () => {
  const d = { ...hakbal, cards: [...hakbal.cards.slice(0, 60), { n: "Relentless Rats", q: 20 }] };
  const local = new MemoryDb(new Map(db.cards), GC_FALLBACK); local.put(fromScry(card("Relentless Rats", "Creature — Rat", "A deck can have any number of cards named Relentless Rats.", { color_identity: ["G"] })));
  assert.ok(swaps(d, analyze(d, local), pool, local, plan()).every(s => s.out !== "Relentless Rats"));
});

test("lector de listas: cantidades absurdas y listas enormes quedan acotadas", () => {
  const p = parseList("30000000 Forest\n-5 Island\n1 Sol Ring");
  assert.equal(p.find(c => c.n === "Forest")!.q, 99, "tope de 99 por carta");
  assert.ok(p.every(c => c.q >= 1 && c.q <= 99));
  const many = parseList(Array.from({ length: 5000 }, (_, i) => `1 Carta ${i}`).join("\n"));
  assert.ok(many.length <= 600, `quedaron ${many.length} entradas`);
});
