// Análisis de un mazo de Commander: conteos, curva, legalidad, bracket oficial y base de maná.
import type { Card, CardDb, Deck, Row } from "./types.ts";
import { BASICS, WUBRG, slug } from "./util.ts";
import { ANY_NUMBER } from "./constants.ts";

export type DeckLike = Pick<Deck, "commanders" | "cards"> & Partial<Pick<Deck, "maybe" | "combos">>;

export interface Roles { land: number; ramp: number; draw: number; removal: number; wipe: number; tutor: number; protection: number; wincon: number; recursion: number }

export interface Analysis {
  ci: string;                 // identidad de color del mazo
  rows: Row[];                // las 99 (sin comandantes)
  maybe: Row[];
  cmdMeta: (Card | null)[];
  main: number;               // cartas del mazo sin contar comandantes
  total: number;              // con comandantes
  maybeN: number;
  missing: string[];          // cartas sin datos todavía
  roles: Roles;
  types: Record<string, number>;
  curve: number[];            // hechizos por coste 0..7+
  avg: number;                // coste promedio de los hechizos
  spells: number;
  gc: string[];               // Game Changers
  off: string[];              // fuera de la identidad de color
  dupes: string[];            // copias repetidas
  illegal: string[];          // no legales en Commander
  xt: string[];               // turnos extra
  mld: string[];              // destrucción masiva de tierras
  tutors: string[];
}

/** Rangos recomendados para un mazo de 100 cartas. */
export const TARGETS = [
  { k: "land", n: "Tierras", d: "fuentes de maná base", lo: 35, hi: 38, max: 45 },
  { k: "ramp", n: "Ramp", d: "aceleración", lo: 8, hi: 12, max: 20 },
  { k: "draw", n: "Robo", d: "ventaja de cartas", lo: 8, hi: 12, max: 20 },
  { k: "removal", n: "Removal", d: "respuestas puntuales", lo: 6, hi: 10, max: 16 },
  { k: "wipe", n: "Barridos", d: "limpian la mesa", lo: 2, hi: 4, max: 8 },
  { k: "protection", n: "Protección", d: "cuidan tu juego", lo: 2, hi: 6, max: 10 },
] as const;

export function analyze(d: DeckLike, db: CardDb): Analysis {
  const cmdMeta = (d.commanders || []).map(n => db.get(n));
  const ciSet = [...new Set(cmdMeta.flatMap(m => m ? m.ci.split("") : []))];
  const rows: Row[] = (d.cards || []).map(c => ({ ...c, m: db.get(c.n) }));
  const maybe: Row[] = (d.maybe || []).map(c => ({ ...c, m: db.get(c.n) }));
  const ci = ciSet.filter(c => (WUBRG as readonly string[]).includes(c)).sort((a, b) => WUBRG.indexOf(a as typeof WUBRG[number]) - WUBRG.indexOf(b as typeof WUBRG[number])).join("");
  const main = rows.reduce((a, r) => a + r.q, 0);
  const total = main + (d.commanders || []).length;
  const missing = [...(d.commanders || []).filter(n => !db.get(n)), ...rows.filter(r => !r.m).map(r => r.n), ...maybe.filter(r => !r.m).map(r => r.n)];
  const roles: Roles = { land: 0, ramp: 0, draw: 0, removal: 0, wipe: 0, tutor: 0, protection: 0, wincon: 0, recursion: 0 };
  const types: Record<string, number> = {}; const curve = [0, 0, 0, 0, 0, 0, 0, 0]; let cmcSum = 0, spells = 0;
  const gc: string[] = [], off: string[] = [], dupes: string[] = [], illegal: string[] = [], xt: string[] = [], mld: string[] = [], tutors: string[] = [];
  const cmdKnown = cmdMeta.length > 0 && cmdMeta.every(Boolean);
  const copies = new Map<string, number>(); for (const r of rows) copies.set(slug(r.n), (copies.get(slug(r.n)) || 0) + r.q);
  for (const r of rows) {
    const t = r.m ? r.m.t : "Unknown"; types[t] = (types[t] || 0) + r.q;
    if (!r.m) continue;
    if (t === "Land") roles.land += r.q;
    else { curve[Math.min(7, Math.round(r.m.cmc))] += r.q; cmcSum += r.m.cmc * r.q; spells += r.q; }
    for (const x of r.m.r || []) if (x in roles) roles[x] += r.q;
    if (r.m.gc) gc.push(r.n); if (r.m.xt) xt.push(r.n); if (r.m.mld) mld.push(r.n); if ((r.m.r || []).includes("tutor")) tutors.push(r.n);
    if (cmdKnown && (r.m.ci || "").split("").some(c => (WUBRG as readonly string[]).includes(c) && !ci.includes(c))) off.push(r.n);
    if (r.m.legal && r.m.legal !== "legal" && r.m.legal !== "restricted" && !illegal.includes(r.n)) illegal.push(r.n);
  }
  for (const [k, q] of copies) {
    if (q <= 1 || BASICS.has(k)) continue;
    const r0 = rows.find(x => slug(x.n) === k);
    if (!ANY_NUMBER.test((r0 ? r0.n : k.replace(/-/g, " ")).toLowerCase())) dupes.push(r0 ? r0.n : k);
  }
  for (const m of cmdMeta) if (m) { if (m.gc) gc.push(m.n); if (m.legal && m.legal !== "legal") illegal.push(m.n); }
  return { ci, rows, maybe, cmdMeta, main, total, maybeN: maybe.reduce((a, r) => a + r.q, 0), missing, roles, types, curve, avg: spells ? cmcSum / spells : 0, spells, gc, off, dupes, illegal, xt, mld, tutors };
}

export type Status = "good" | "warn" | "bad";
export function status(v: number, lo: number, hi: number): Status {
  if (v >= lo && v <= hi) return "good";
  if (v < lo * 0.7 || v > hi * 1.3) return "bad";
  return "warn";
}

/** Tierras sugeridas según la curva (fórmula de Karsten para 100 cartas). */
export function karstenLands(A: Analysis): number {
  const cheap = A.rows.filter(r => r.m && r.m.t !== "Land" && r.m.cmc <= 2 && (r.m.r || []).some(x => x === "ramp" || x === "draw")).reduce((a, r) => a + r.q, 0);
  return 31.42 + 3.13 * A.avg - 0.28 * cheap;
}

export const combos2 = (d: DeckLike) => ((d.combos && d.combos.inc) || []).filter(c => c.cards.length <= 2);

export interface Bracket { b: number; why: string; exact: boolean }
/** Bracket oficial según la guía del 9 de febrero de 2026. `exact` es falso si aún no se buscaron combos. */
export function bracketOf(d: DeckLike, A: Analysis): Bracket {
  const c2 = combos2(d).length, gcN = A.gc.length; let b: number; const why: string[] = [];
  if (gcN >= 4 || A.mld.length || c2) {
    b = 4;
    if (gcN >= 4) why.push(`${gcN} Game Changers (más de 3)`);
    if (A.mld.length) why.push("destrucción masiva de tierras");
    if (c2) why.push(`${c2} combo${c2 > 1 ? "s" : ""} de 2 cartas`);
  } else if (gcN >= 1 || A.xt.length > 2) {
    b = 3;
    if (gcN) why.push(`${gcN} Game Changer${gcN > 1 ? "s" : ""}`);
    if (A.xt.length > 2) why.push("varios turnos extra");
  } else {
    b = 2; why.push("sin Game Changers" + (d.combos ? ", sin combos de 2 cartas" : ""));
    if (!A.tutors.length && !A.xt.length) why.push("sin tutores ni turnos extra (podría ser 1 si es temático)");
  }
  // los tutores no cambian el bracket oficial (son una recomendación): se reflejan en el bracket por juego
  if (b <= 3 && A.tutors.length > 3) why.push(`${A.tutors.length} tutores: juega más fuerte de lo que dice su bracket`);
  return { b, why: why.join(" · "), exact: !!d.combos };
}

/** Reglas por bracket (guía oficial, actualización del 9 de febrero de 2026). */
export const BRACKETS = [
  null,
  { n: 1, name: "Exhibición", gc: 0, combo2: false, xt: 0, mld: false, tutors: 2, text: "Mazos temáticos o casuales. Sin Game Changers, sin destrucción masiva de tierras, sin turnos extra y sin combos infinitos de 2 cartas. Pocos tutores." },
  { n: 2, name: "Núcleo", gc: 0, combo2: false, xt: 2, mld: false, tutors: 3, text: "El nivel de un precon. Sin Game Changers, sin destrucción masiva de tierras, sin combos de 2 cartas. Turnos extra sueltos, sin encadenarlos. Pocos tutores." },
  { n: 3, name: "Mejorado", gc: 3, combo2: false, xt: 3, mld: false, tutors: 6, text: "Mazos afinados. Hasta 3 Game Changers. Sin destrucción masiva de tierras ni combos de 2 cartas tempranos. Más tutores permitidos." },
  { n: 4, name: "Optimizado", gc: 99, combo2: true, xt: 99, mld: true, tutors: 99, text: "Alto poder sin restricciones: Game Changers ilimitados, combos, tutores y destrucción masiva de tierras." },
  { n: 5, name: "cEDH", gc: 99, combo2: true, xt: 99, mld: true, tutors: 99, text: "Competitivo de torneo. Mismas reglas que el 4, pero construido para ganar lo antes posible contra el meta de torneos." },
] as const;
export type BracketRule = NonNullable<typeof BRACKETS[number]>;
export const bracketRule = (n: number): BracketRule => BRACKETS[Math.max(1, Math.min(5, n))] as BracketRule;

export interface Check { ok: boolean; t: string; w: number }
export interface Health { score: number; checks: Check[] }
/** Lista de control básica: 100 cartas, identidad, singleton, legalidad, casillas en rango, curva y manos. */
export function health(A: Analysis, pScrew: number | null): Health {
  const checks: Check[] = [
    { ok: A.total === 100, t: `100 cartas exactas (${A.total})`, w: 15 },
    { ok: !A.off.length && A.cmdMeta.every(Boolean), t: "Todo dentro de la identidad de color", w: 10 },
    { ok: !A.dupes.length, t: "Singleton sin copias repetidas", w: 10 },
    { ok: !A.illegal.length, t: "Todas las cartas legales en Commander", w: 5 },
    ...TARGETS.map(t => ({ ok: status(A.roles[t.k], t.lo, t.hi) === "good", t: `${t.n} en rango (${A.roles[t.k]} de ${t.lo}–${t.hi})`, w: 8 })),
    { ok: A.avg > 0 && A.avg <= 3.6, t: `Curva razonable (coste promedio ${A.avg.toFixed(2).replace(".", ",")}, máximo 3,6)`, w: 6 },
    { ok: pScrew != null && pScrew <= 0.15, t: `Pocas manos atascadas${pScrew != null ? ` (${Math.round(pScrew * 100)} %)` : ""}`, w: 6 },
  ];
  const tot = checks.reduce((a, c) => a + c.w, 0), got = checks.reduce((a, c) => a + (c.ok ? c.w : 0), 0);
  return { score: Math.round(100 * got / tot), checks };
}

export interface ManaBase {
  pips: Record<string, number>;     // símbolos de cada color en los costes
  src: Record<string, number>;      // tierras que dan cada color
  rocks: Record<string, number>;    // piedras y criaturas de maná por color
  lands: number; basics: number;
  tapped: string[];                 // tierras que entran giradas
  utility: string[];                // tierras que no dan color
  cols: string[];
  pipT: number;
}
export function manaBase(A: Analysis): ManaBase {
  const z = () => ({ W: 0, U: 0, B: 0, R: 0, G: 0 } as Record<string, number>);
  const pips = z(), src = z(), rocks = z();
  let lands = 0, basics = 0; const tapped: string[] = [], utility: string[] = [];
  const all: Row[] = [...A.rows, ...A.cmdMeta.filter((m): m is Card => !!m).map(m => ({ n: m.n, q: 1, m }))];
  for (const r of all) {
    const m = r.m; if (!m) continue;
    if (m.t !== "Land") {
      const syms = (m.cost || "").match(/\{[^}]+\}/g) || [];
      for (const s of syms) for (const c of WUBRG) if (s.includes(c)) pips[c] += (r.q || 1);
      if ((m.r || []).includes("ramp")) for (const c of (m.pm || [])) if (c in rocks) rocks[c] += r.q;
    } else {
      lands += r.q; if (m.basic) basics += r.q;
      if (m.tap) tapped.push(r.n);
      const cols = (m.pm || []).filter(c => (WUBRG as readonly string[]).includes(c));
      for (const c of cols) src[c] += r.q;
      if (!cols.length && !m.basic) utility.push(r.n);
    }
  }
  const cols = WUBRG.filter(c => A.ci.includes(c) || pips[c] > 0);
  const pipT = cols.reduce((a, c) => a + pips[c], 0) || 1;
  return { pips, src, rocks, lands, basics, tapped, utility, cols, pipT };
}
