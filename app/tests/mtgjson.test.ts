// Datos locales de MTGJSON y legalidad en Duel Commander.
// El AtomicCards de estas pruebas es inventado, con el formato documentado de MTGJSON.
import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryDb, fromScry, atomicToScry, compactAtomic, readLocalPack, producedMana, LocalIndex, legalIn, formatEs,
  analyze, health, illegalFor, slotSuggestions, completeDeck, GC_FALLBACK, type Deck, type EdhData, type Plan,
} from "../src/engine/index.ts";

const ATOMIC = {
  meta: { date: "2026-11-03", version: "5.x-prueba" },
  data: {
    "Prueba Ring": [{ name: "Prueba Ring", manaValue: 1, manaCost: "{1}", colors: [], colorIdentity: [], type: "Artifact", types: ["Artifact"],
      text: "{T}: Add {C}{C}.", layout: "normal", isGameChanger: false, edhrecRank: 1, legalities: { commander: "Legal", duel: "Banned", vintage: "Restricted" },
      identifiers: { scryfallOracleId: "0000-oracle", scryfallId: "abcdef12-3456-7890-abcd-ef1234567890" } }],
    "Prueba Tutor": [{ name: "Prueba Tutor", manaValue: 2, manaCost: "{1}{B}", colors: ["B"], colorIdentity: ["B"], type: "Sorcery", types: ["Sorcery"],
      text: "Search your library for a card, put that card into your hand, then shuffle.", layout: "normal", isGameChanger: true, legalities: { commander: "Legal", duel: "Legal" } }],
    "Prueba Front // Prueba Back": [
      { name: "Prueba Front // Prueba Back", faceName: "Prueba Back", side: "b", layout: "modal_dfc", type: "Land", text: "Prueba Back enters tapped.\n{T}: Add {G}.", colors: [], colorIdentity: ["G"], manaValue: 3, legalities: { commander: "Legal", duel: "Legal" } },
      { name: "Prueba Front // Prueba Back", faceName: "Prueba Front", side: "a", layout: "modal_dfc", type: "Creature — Elf", text: "Reach", manaCost: "{2}{G}", colors: ["G"], colorIdentity: ["G"], manaValue: 3, power: "2", toughness: "3", legalities: { commander: "Legal", duel: "Legal" } }],
    "Prueba Dual": [{ name: "Prueba Dual", manaValue: 0, colors: [], colorIdentity: ["U", "G"], type: "Land — Forest Island", text: "", layout: "normal", legalities: { commander: "Legal", duel: "Legal" } }],
    "Prueba Prisma": [{ name: "Prueba Prisma", manaValue: 3, manaCost: "{3}", colors: [], colorIdentity: [], type: "Artifact", text: "{T}: Add one mana of any color.", layout: "normal", legalities: { commander: "Legal" } }],
    "Prueba Broma": [{ name: "Prueba Broma", manaValue: 1, colors: [], colorIdentity: [], type: "Artifact", text: "", layout: "normal", isFunny: true, legalities: {} }],
  },
};

test("maná que produce: tipos básicos, símbolos y 'cualquier color'", () => {
  assert.deepEqual(producedMana("{T}: Add {C}{C}.", "Artifact"), ["C"]);
  assert.deepEqual(producedMana("", "Land — Forest Island"), ["U", "G"]);
  assert.deepEqual(producedMana("{T}: Add one mana of any color.", "Artifact"), ["W", "U", "B", "R", "G"]);
  assert.deepEqual(producedMana("{T}: Add {R} or {G}.", "Land"), ["R", "G"]);
  assert.deepEqual(producedMana("Draw a card.", "Sorcery"), []);
});

test("AtomicCards → carta del motor: legalidades, Game Changer, ranking, imagen y caras", () => {
  const ring = fromScry(atomicToScry("Prueba Ring", ATOMIC.data["Prueba Ring"]));
  assert.equal(ring.legal, "legal"); assert.equal(ring.duel, "banned"); assert.equal(ring.gc, false); assert.equal(ring.rank, 1);
  assert.deepEqual(ring.pm, ["C"]); assert.ok(ring.r.includes("ramp"), "una piedra de maná cuenta como ramp");
  assert.match(ring.img, /^https:\/\/cards\.scryfall\.io\/normal\/front\/a\/b\/abcdef12-/);
  const tutor = fromScry(atomicToScry("Prueba Tutor", ATOMIC.data["Prueba Tutor"]));
  assert.equal(tutor.gc, true); assert.ok(tutor.r.includes("tutor"));
  const prisma = fromScry(atomicToScry("Prueba Prisma", ATOMIC.data["Prueba Prisma"]));
  assert.equal(prisma.duel, "not_legal", "si el formato no aparece en MTGJSON, la carta no es legal ahí");
  const mdfc = fromScry(atomicToScry("Prueba Front // Prueba Back", ATOMIC.data["Prueba Front // Prueba Back"]));
  assert.equal(mdfc.t, "Creature", "la cara frontal manda aunque venga segunda en el archivo");
  assert.equal(mdfc.cost, "{2}{G}"); assert.equal(mdfc.pw, 2);
});

test("paquete compacto: deja fuera las cartas de broma y se puede volver a leer", () => {
  const pack = compactAtomic(ATOMIC);
  assert.equal(pack.format, "boveda-cartas"); assert.equal(pack.date, "2026-11-03"); assert.equal(pack.cards.length, 5);
  const again = readLocalPack(JSON.parse(JSON.stringify(pack)));
  assert.equal(again.cards.length, 5);
  assert.equal(readLocalPack(ATOMIC).cards.length, 5, "también acepta AtomicCards directo");
  assert.throws(() => readLocalPack({ data: [] }), /no es AtomicCards/);
  assert.throws(() => readLocalPack(null), /no es AtomicCards/);
});

test("índice local: busca por nombre, por cara y entrega los Game Changers", () => {
  const idx = new LocalIndex(compactAtomic(ATOMIC));
  assert.equal(idx.size, 5); assert.equal(idx.date, "2026-11-03");
  assert.equal(idx.get("prueba ring")?.name, "Prueba Ring");
  assert.equal(idx.get("Prueba Back")?.name, "Prueba Front // Prueba Back");
  assert.equal(idx.get("Prueba Front // Prueba Back")?.name, "Prueba Front // Prueba Back");
  assert.equal(idx.get("Prueba Broma"), null);
  assert.deepEqual(idx.gameChangers(), ["Prueba Tutor"]);
});

// --- Duel Commander ---
const db = new MemoryDb(new Map(), GC_FALLBACK);
for (const c of compactAtomic(ATOMIC).cards) db.put(fromScry(c));
db.put(fromScry({ name: "Prueba Comandante", type_line: "Legendary Creature — Elf", oracle_text: "Vigilance", mana_cost: "{G}{U}", cmc: 2, color_identity: ["G", "U"], colors: ["G", "U"], legalities: { commander: "legal", duel: "legal" } }));
db.put(fromScry({ name: "Prueba Sin Dato", type_line: "Instant", oracle_text: "Draw a card.", mana_cost: "{U}", cmc: 1, color_identity: ["U"], colors: ["U"], legalities: { commander: "legal" } }));
const plan = (format?: Plan["format"]): Plan => ({ bracket: null, theme: "", inter: "mid", format });
const deck = (format?: Plan["format"]): Deck => ({ id: "d", name: "d", commanders: ["Prueba Comandante"], cards: [{ n: "Prueba Ring", q: 1 }, { n: "Prueba Dual", q: 1 }, { n: "Prueba Sin Dato", q: 1 }], maybe: [], kind: "mine", plan: plan(format), created: 1, updated: 1 });

test("legalidad según formato: Commander y Duel Commander", () => {
  const ring = db.get("Prueba Ring")!, sinDato = db.get("Prueba Sin Dato")!;
  assert.equal(legalIn(ring, "commander"), true); assert.equal(legalIn(ring, undefined), true); assert.equal(legalIn(ring, "duel"), false);
  assert.equal(legalIn(sinDato, "duel"), true, "sin dato de Duel se da por buena");
  assert.equal(formatEs("duel"), "Duel Commander"); assert.equal(formatEs(undefined), "Commander");
  const A = analyze(deck("duel"), db);
  assert.deepEqual(A.illegal, []); assert.deepEqual(A.illegalDuel, ["Prueba Ring"]);
  assert.deepEqual(illegalFor(A, "duel"), ["Prueba Ring"]); assert.deepEqual(illegalFor(A, "commander"), []);
  const chk = (f: Plan["format"]) => health(A, 0.1, f).checks.find(c => /legales/.test(c.t))!;
  assert.equal(chk("duel").ok, false); assert.match(chk("duel").t, /Duel Commander/);
  assert.equal(chk(undefined).ok, true); assert.match(chk(undefined).t, /en Commander/);
});

test("sugerencias y borrador no proponen cartas prohibidas en Duel Commander", () => {
  const E: EdhData = { at: 1, slug: "x", decks: 10, themes: [], pool: [{ n: "Prueba Ring", incl: 0.9, syn: 0 }, { n: "Prueba Prisma", incl: 0.8, syn: 0 }] };
  const d0: Deck = { ...deck(), cards: [] };
  const A = analyze(d0, db);
  const names = (f: Plan["format"]) => slotSuggestions("ramp", d0, A, E, db, plan(f), 10).map(s => s.n);
  assert.deepEqual(names("commander").sort(), ["Prueba Prisma", "Prueba Ring"]);
  assert.deepEqual(names("duel"), [], "en Duel: la piedra está prohibida y el prisma no es legal");
  const built = completeDeck({ commanders: d0.commanders, cards: [], plan: plan("duel") }, E, db);
  assert.ok(!built.cards.some(c => c.n === "Prueba Ring" || c.n === "Prueba Prisma"));
});
