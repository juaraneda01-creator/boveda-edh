// Prioridades 3: novedades para tu comandante, comandante para una lista, mejora por tandas y mazos de MTGJSON.
// Cartas inventadas.
import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryDb, fromScry, analyze, synergyOf, newCardsFor, commandersFor, upgradePath, readMtgjsonDeck, listIdentity,
  type Card, type Deck, type EdhData, type Plan, type ScryCard,
} from "../src/engine/index.ts";

const sc = (name: string, type_line: string, oracle_text: string, extra: Partial<ScryCard> = {}): ScryCard =>
  ({ name, type_line, oracle_text, mana_cost: "{2}", cmc: 2, color_identity: [], colors: [], legalities: { commander: "legal", duel: "legal" }, ...extra });
const G = { color_identity: ["G"], colors: ["G"], mana_cost: "{1}{G}" };
const elf = (n: string, i: number) => sc(`Elfo ${n}`, "Creature — Elf", i % 2 ? "Other Elves you control get +1/+1." : "{T}: Add {G}.", { ...G, produced_mana: i % 2 ? undefined : ["G"] });
const CARDS: ScryCard[] = [
  sc("Reina Elfa", "Legendary Creature — Elf Druid", "Other Elves you control get +1/+1. Whenever an Elf enters the battlefield under your control, draw a card.", { ...G, mana_cost: "{2}{G}", cmc: 3, edhrec_rank: 300 }),
  sc("Rey Goblin", "Legendary Creature — Goblin", "Other Goblins you control get +1/+1.", { color_identity: ["R"], colors: ["R"], mana_cost: "{2}{R}", cmc: 3 }),
  sc("Señor Elfo Azul", "Legendary Creature — Elf Wizard", "Other Elves you control get +1/+1.", { color_identity: ["G", "U"], colors: ["G", "U"], mana_cost: "{G}{U}", cmc: 2, edhrec_rank: 900 }),
  sc("Jace Prueba", "Legendary Planeswalker — Jace", "+1: Draw a card.", { color_identity: ["G"], colors: ["G"], mana_cost: "{2}{G}", cmc: 3 }),
  sc("Gigante Sin Tribu", "Legendary Creature — Giant", "Trample", { ...G, mana_cost: "{4}{G}", cmc: 5 }),
  sc("Elfo Nuevo", "Creature — Elf", "Other Elves you control get +1/+1.", G),
  sc("Rampa Nueva", "Sorcery", "Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", G),
  sc("Robo Rojo Nuevo", "Sorcery", "Draw two cards.", { color_identity: ["R"], colors: ["R"], mana_cost: "{1}{R}" }),
  sc("Elfo Prohibido Duel", "Creature — Elf", "Other Elves you control get +1/+1.", { ...G, legalities: { commander: "legal", duel: "banned" } }),
  sc("Vaca Aburrida", "Creature — Ox", "", G),
  sc("Bosque Lento", "Land", "This land enters tapped.\n{T}: Add {G}.", { cmc: 0, mana_cost: "", produced_mana: ["G"], color_identity: ["G"] }),
  sc("Bosque Rapido", "Land", "{T}: Add {G}.", { cmc: 0, mana_cost: "", produced_mana: ["G"], color_identity: ["G"] }),
  sc("Forest", "Basic Land — Forest", "({T}: Add {G}.)", { cmc: 0, mana_cost: "", produced_mana: ["G"], color_identity: ["G"] }),
  sc("Carta Floja", "Creature — Ox", "", G),
  sc("Muy Jugada", "Creature — Elf", "When this creature enters, draw a card.", G),
  ...Array.from({ length: 14 }, (_, i) => elf(String(i), i)),
];
const db = new MemoryDb(new Map(), []);
for (const c of CARDS) db.put(fromScry(c));
const plan = (p: Partial<Plan> = {}): Plan => ({ bracket: null, theme: "", inter: "mid", ...p });
const ELVES = Array.from({ length: 14 }, (_, i) => `Elfo ${i}`);
const deck = (cards: string[], p: Partial<Plan> = {}, cmd = ["Reina Elfa"]): Deck =>
  ({ id: "d", name: "d", commanders: cmd, cards: cards.map(n => ({ n, q: n === "Forest" ? 20 : 1 })), maybe: [], kind: "mine", plan: plan(p), created: 1, updated: 1 });
const get = (...n: string[]): Card[] => n.map(x => db.get(x)!);

test("novedades: calzan con la tribu o con lo que falta, en colores y legales", () => {
  const d = deck([...ELVES, "Forest"]); const A = analyze(d, db); const Y = synergyOf(A);
  const r = newCardsFor(d, A, Y, get("Elfo Nuevo", "Rampa Nueva", "Robo Rojo Nuevo", "Vaca Aburrida", "Elfo 0", "Forest"), null);
  const names = r.map(x => x.n);
  assert.ok(names.includes("Elfo Nuevo"), "la tribu del mazo"); assert.match(r.find(x => x.n === "Elfo Nuevo")!.why, /tribu: Elf/);
  assert.ok(names.includes("Rampa Nueva"), "rellena una función que falta"); assert.match(r.find(x => x.n === "Rampa Nueva")!.why, /te falta/);
  assert.ok(!names.includes("Robo Rojo Nuevo"), "fuera de la identidad de color");
  assert.ok(!names.includes("Vaca Aburrida"), "no aporta nada al mazo");
  assert.ok(!names.includes("Elfo 0") && !names.includes("Forest"), "ni lo que ya está ni básicas");
  const duel = deck([...ELVES, "Forest"], { format: "duel" }); const Ad = analyze(duel, db);
  assert.ok(!newCardsFor(duel, Ad, synergyOf(Ad), get("Elfo Prohibido Duel"), null).length, "prohibida en Duel");
  assert.deepEqual(newCardsFor(deck(ELVES, {}, []), analyze(deck(ELVES, {}, []), db), Y, get("Elfo Nuevo"), null), [], "sin comandante no hay novedades");
});

test("comandante para una lista: cubre sus colores y comparte su tribu", () => {
  const list = get(...ELVES, "Forest");
  assert.equal(listIdentity(list), "G");
  const r = commandersFor(list, get("Reina Elfa", "Rey Goblin", "Señor Elfo Azul", "Gigante Sin Tribu", "Elfo Nuevo"), plan());
  const names = r.map(x => x.n);
  assert.equal(names[0], "Reina Elfa", "la tribu y los colores exactos primero");
  assert.ok(!names.includes("Rey Goblin"), "no cubre los colores");
  assert.ok(!names.includes("Elfo Nuevo"), "no puede ser comandante");
  const azul = r.find(x => x.n === "Señor Elfo Azul"); assert.ok(azul && azul.extra === "U" && /agrega U/.test(azul.why), "un color de más se avisa y pesa menos");
  assert.match(r[0].why, /tribu Elf/);
  assert.deepEqual(commandersFor([], get("Reina Elfa"), plan()), []);
  assert.ok(!names.includes("Jace Prueba"), "sin el texto de la carta, un planeswalker no se sugiere");
  // el comandante puede venir entre las 99 de una lista importada; el comandante actual no se vuelve a sugerir
  const withCmd = [...list, db.get("Reina Elfa")!];
  assert.equal(commandersFor(withCmd, get("Reina Elfa", "Señor Elfo Azul"), plan())[0].n, "Reina Elfa");
  assert.ok(!commandersFor(list, get("Reina Elfa", "Señor Elfo Azul"), plan(), 8, ["Reina Elfa"]).some(x => x.n === "Reina Elfa"));
});

test("mejora por tandas: maná, funciones y lo más jugado, sin repetir cartas", () => {
  const d = deck([...ELVES, "Bosque Lento", "Carta Floja", "Forest"]); const A = analyze(d, db);
  const E: EdhData = { at: 1, slug: "reina-elfa", decks: 100, themes: [], pool: [{ n: "Muy Jugada", incl: 0.7, syn: 0.3 }, { n: "Rampa Nueva", incl: 0.5, syn: 0.1 }] };
  const P = upgradePath(d, A, E, db, n => n === "Bosque Lento" ? "Bosque Rapido" : null, 5);
  assert.equal(P[0].k, "mana"); assert.deepEqual(P[0].swaps.map(s => [s.out, s.in]), [["Bosque Lento", "Bosque Rapido"]]);
  const ins = P.flatMap(s => s.swaps.map(x => x.in)); const outs = P.flatMap(s => s.swaps.map(x => x.out));
  assert.equal(new Set(ins).size, ins.length, "una carta entra una sola vez"); assert.equal(new Set(outs).size, outs.length, "una carta sale una sola vez");
  assert.ok(ins.includes("Muy Jugada") || ins.includes("Rampa Nueva"), "usa lo que se juega con el comandante");
  assert.ok(P.every(s => s.swaps.length), "no hay tandas vacías");
  assert.deepEqual(upgradePath(deck(ELVES, {}, []), analyze(deck(ELVES, {}, []), db), E, db, () => null), [], "sin comandante no hay ruta");
});

test("mazos de MTGJSON: comandante, cartas y banca", () => {
  const j = JSON.stringify({ meta: { date: "2026-10-01" }, data: { name: "Precon de Prueba", commander: [{ name: "Reina Elfa", count: 1 }], mainBoard: [{ name: "Reina Elfa", count: 1 }, { name: "Forest", count: 20 }, { name: "Forest", count: 10 }, { name: "Elfo 1", count: 1 }, { count: 2 }, { name: "Exagerado", count: 500 }], sideBoard: [{ name: "Carta Floja" }, { name: "Carta Floja" }] } });
  const m = readMtgjsonDeck(j)!;
  assert.equal(m.name, "Precon de Prueba"); assert.deepEqual(m.commanders, ["Reina Elfa"]);
  assert.deepEqual(m.cards, [{ n: "Forest", q: 30 }, { n: "Elfo 1", q: 1 }, { n: "Exagerado", q: 99 }], "sin el comandante, impresiones juntas, sin entradas sin nombre y con tope");
  assert.deepEqual(m.maybe, [{ n: "Carta Floja", q: 2 }], "las impresiones repetidas se juntan");
  assert.equal(readMtgjsonDeck("1 Sol Ring"), null); assert.equal(readMtgjsonDeck("{\"data\":{}}"), null);
  assert.ok(readMtgjsonDeck(JSON.stringify({ name: "Sin envoltura", mainBoard: [{ name: "Forest", count: 1 }] })), "también sin el objeto data");
});
