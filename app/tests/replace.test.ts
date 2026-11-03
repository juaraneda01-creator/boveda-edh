// Prioridades 2: reemplazos por rol, medidor de sal y cartas de dos caras con reverso de tierra.
// Cartas inventadas.
import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryDb, fromScry, atomicToScry, analyze, replacementsFor, saltOf, landBacks, type Card, type Deck, type EdhData, type Plan, type ScryCard,
} from "../src/engine/index.ts";

const sc = (name: string, type_line: string, oracle_text: string, extra: Partial<ScryCard> = {}): ScryCard =>
  ({ name, type_line, oracle_text, mana_cost: "{2}", cmc: 2, color_identity: [], colors: [], legalities: { commander: "legal", duel: "legal" }, ...extra });
const CARDS: ScryCard[] = [
  sc("Prueba Comandante", "Legendary Creature — Elf", "Vigilance", { color_identity: ["G", "U"], colors: ["G", "U"], mana_cost: "{G}{U}" }),
  sc("Piedra Cara", "Artifact", "{T}: Add {C}.", { cmc: 4, mana_cost: "{4}", produced_mana: ["C"], edhrec_saltiness: 0.2 } as Partial<ScryCard>),
  sc("Piedra Barata", "Artifact", "{T}: Add {C}.", { cmc: 2, produced_mana: ["C"], edhrec_rank: 50 }),
  sc("Piedra Verde", "Artifact", "{T}: Add {G}.", { cmc: 3, mana_cost: "{3}", produced_mana: ["G"], color_identity: ["G"], edhrec_rank: 5000 }),
  sc("Piedra Roja", "Artifact", "{T}: Add {R}.", { cmc: 2, produced_mana: ["R"], color_identity: ["R"] }),
  sc("Piedra Prohibida Duel", "Artifact", "{T}: Add {C}{C}.", { cmc: 1, produced_mana: ["C"], legalities: { commander: "legal", duel: "banned" } }),
  sc("Piedra Changer", "Artifact", "{T}: Add {C}{C}.", { cmc: 1, produced_mana: ["C"], game_changer: true }),
  sc("Robo Simple", "Sorcery", "Draw two cards.", { cmc: 3, color_identity: ["U"], mana_cost: "{2}{U}" }),
  sc("Robo Molesto", "Enchantment", "Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.", { cmc: 3, color_identity: ["U"], mana_cost: "{2}{U}", edhrec_saltiness: 2.4 } as Partial<ScryCard>),
  sc("Robo Amable", "Enchantment", "At the beginning of your upkeep, draw a card.", { cmc: 3, color_identity: ["U"], mana_cost: "{2}{U}", edhrec_saltiness: 0.3 } as Partial<ScryCard>),
  sc("Tierra Lenta", "Land", "This land enters tapped.\n{T}: Add {G} or {U}.", { cmc: 0, mana_cost: "", produced_mana: ["G", "U"], color_identity: ["G", "U"] }),
  sc("Tierra Rapida", "Land", "{T}: Add {G} or {U}.", { cmc: 0, mana_cost: "", produced_mana: ["G", "U"], color_identity: ["G", "U"] }),
  sc("Mapa // Cueva", "Artifact // Land", "", { layout: "transform", oracle_text: undefined, card_faces: [{ name: "Mapa", type_line: "Artifact", oracle_text: "{1}, {T}: Scry 1.", mana_cost: "{2}" }, { name: "Cueva", type_line: "Land", oracle_text: "{T}: Add {C}.", mana_cost: "" }], cmc: 2 }),
  sc("Torre Utilitaria", "Land", "You have no maximum hand size.\n{T}: Add {C}.", { cmc: 0, mana_cost: "", produced_mana: ["C"] }),
  sc("Otra Tierra Utilitaria", "Land", "{T}: Add {C}.\n{2}, {T}: Draw a card, then discard a card.", { cmc: 0, mana_cost: "", produced_mana: ["C"] }),
  sc("Hechizo // Tierra", "Sorcery // Land", "", { layout: "modal_dfc", oracle_text: undefined, card_faces: [{ name: "Hechizo", type_line: "Sorcery", oracle_text: "Draw a card.", mana_cost: "{1}{U}" }, { name: "Tierra", type_line: "Land", oracle_text: "{T}: Add {U}.", mana_cost: "" }], color_identity: ["U"], cmc: 2 }),
];
const db = new MemoryDb(new Map(), []);
for (const c of CARDS) db.put(fromScry(c));
const plan = (p: Partial<Plan> = {}): Plan => ({ bracket: null, theme: "", inter: "mid", ...p });
const deck = (cards: string[], p: Partial<Plan> = {}): Deck => ({ id: "d", name: "d", commanders: ["Prueba Comandante"], cards: cards.map(n => ({ n, q: 1 })), maybe: [], kind: "mine", plan: plan(p), created: 1, updated: 1 });
const all = (): Card[] => [...db.all()];
const names = (r: { n: string }[]) => r.map(x => x.n);

test("reemplazos: mismo rol, en colores, sin repetir lo que ya está, lo barato primero", () => {
  const d = deck(["Piedra Cara", "Piedra Barata"]); const A = analyze(d, db);
  const r = replacementsFor("Piedra Cara", d, A, d.plan, all(), null);
  assert.ok(!names(r).includes("Piedra Barata"), "no propone lo que ya está en el mazo");
  assert.ok(!names(r).includes("Piedra Roja"), "no propone fuera de la identidad de color");
  assert.ok(!names(r).some(n => /Robo|Tierra/.test(n)), "solo el mismo rol y no tierras");
  assert.equal(r[0].m.cmc, 1, "lo más barato primero cuando nada viene de EDHREC");
  assert.deepEqual(names(r).slice(0, 2).sort(), ["Piedra Changer", "Piedra Prohibida Duel"]);
  assert.match(r[0].why, /mismo rol: ramp/); assert.match(r[0].why, /cuesta 3 menos/);
});

test("reemplazos: respetan Duel Commander, el bracket y los Game Changers", () => {
  const d = deck(["Piedra Cara"], { format: "duel", bracket: 2 }); const A = analyze(d, db);
  const r = names(replacementsFor("Piedra Cara", d, A, d.plan, all(), null));
  assert.ok(!r.includes("Piedra Prohibida Duel"), "prohibida en Duel"); assert.ok(!r.includes("Piedra Changer"), "Game Changer en bracket 2");
  assert.ok(r.includes("Piedra Verde"));
  const d4 = deck(["Piedra Cara"], { bracket: 4 }); assert.ok(names(replacementsFor("Piedra Cara", d4, analyze(d4, db), d4.plan, all(), null)).includes("Piedra Changer"));
});

test("reemplazos: lo que se juega con el comandante manda", () => {
  const d = deck(["Piedra Cara"]); const A = analyze(d, db);
  const E: EdhData = { at: 1, slug: "x", decks: 10, themes: [], pool: [{ n: "Piedra Verde", incl: 0.6, syn: 0 }] };
  const r = replacementsFor("Piedra Cara", d, A, d.plan, all(), E);
  assert.equal(r[0].n, "Piedra Verde"); assert.match(r[0].why, /en 60 % de las listas/);
});

test("reemplazos de tierras: mismos colores y mejor si entran enderezadas", () => {
  const d = deck(["Tierra Lenta"]); const A = analyze(d, db);
  const r = replacementsFor("Tierra Lenta", d, A, d.plan, all(), null);
  assert.equal(r[0].n, "Tierra Rapida"); assert.match(r[0].why, /entra enderezada/);
  assert.ok(r.every(x => x.m.t === "Land"));
});

test("reemplazos con menos sal: solo cartas menos molestas del mismo rol", () => {
  const d = deck(["Robo Molesto"]); const A = analyze(d, db);
  const r = replacementsFor("Robo Molesto", d, A, d.plan, all(), null, { lowerSalt: true });
  assert.deepEqual(names(r), ["Robo Amable"]); assert.match(r[0].why, /sal 0,3/);
  assert.deepEqual(replacementsFor("No Existe", d, A, d.plan, all(), null), []);
});

test("medidor de sal: promedio, nivel y las más molestas", () => {
  const A = analyze(deck(["Robo Molesto", "Robo Amable", "Piedra Cara", "Piedra Barata"]), db);
  const R = saltOf(A);
  assert.equal(R.known, 3, "solo cuentan las cartas con dato"); assert.equal(R.total, 5);
  assert.equal(Math.round((R.avg as number) * 100), Math.round((2.4 + 0.3 + 0.2) / 3 * 100));
  assert.equal(R.level, "alta"); assert.deepEqual(R.top.map(t => t.n), ["Robo Molesto"]);
  assert.equal(saltOf(analyze(deck(["Piedra Barata"]), db)).level, null, "sin datos no hay nivel");
  assert.ok(R.top.every(t => t.cmd === false));
});

test("cartas de dos caras con reverso de tierra se reconocen (Scryfall y MTGJSON)", () => {
  const m = db.get("Hechizo // Tierra")!;
  assert.equal(m.t, "Sorcery"); assert.equal(m.bk, true);
  assert.deepEqual(landBacks(analyze(deck(["Hechizo // Tierra", "Robo Simple"]), db)), ["Hechizo // Tierra"]);
  assert.equal(db.get("Robo Simple")!.bk, undefined);
  assert.equal(db.get("Mapa // Cueva")!.bk, undefined, "una carta que se transforma no se juega como tierra desde la mano");
  const fromMj = fromScry(atomicToScry("Hechizo MJ // Tierra MJ", [
    { name: "Hechizo MJ // Tierra MJ", faceName: "Hechizo MJ", side: "a", layout: "modal_dfc", type: "Instant", text: "Draw a card.", manaCost: "{U}", colors: ["U"], colorIdentity: ["U"], manaValue: 1, edhrecSaltiness: 0.15 },
    { name: "Hechizo MJ // Tierra MJ", faceName: "Tierra MJ", side: "b", layout: "modal_dfc", type: "Land", text: "{T}: Add {U}.", colors: [], colorIdentity: ["U"], manaValue: 1 },
  ]));
  assert.equal(fromMj.bk, true); assert.equal(fromMj.salt, 0.15);
});

test("reemplazos de tierras que no dan color: solo otras que hagan algo parecido, nunca duales cualquiera", () => {
  const d = deck(["Torre Utilitaria"]); const A = analyze(d, db);
  const r = names(replacementsFor("Torre Utilitaria", d, A, d.plan, all(), null));
  assert.ok(!r.includes("Tierra Rapida") && !r.includes("Tierra Lenta"), "no propone duales para una tierra utilitaria: " + r);
});
