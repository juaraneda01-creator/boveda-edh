// Borrador y completado: llena las casillas con lo que más juega la gente con ese comandante (EDHREC),
// respetando identidad de color, legalidad, el bracket buscado y lo que ya está en el mazo.
import type { Card, CardDb, EdhData, EdhPoolCard, Entry, Plan } from "./types.ts";
import { BASIC_NAME, WUBRG, slug } from "./util.ts";
import { isCounter, slotGoals } from "./slots.ts";

export interface BuildInput {
  commanders: string[];
  cards: Entry[];             // lo que ya hay: nunca se quita
  plan: Plan;
  exclude?: string[];         // cartas que no se quieren
}
export interface BuildResult {
  cards: Entry[];             // el mazo completo propuesto
  added: Entry[];             // lo que se agregó
  spells: number; lands: number; gc: number;
  short: number;              // cuántas cartas faltaron porque la fuente no alcanzó
}

export const inIdentity = (m: Card, ci: string): boolean => !(m.ci || "").split("").some(c => (WUBRG as readonly string[]).includes(c) && !ci.includes(c));
export { isCounter };
const isInteraction = (m: Card): boolean => (m.r as string[]).includes("removal") || (m.r as string[]).includes("wipe") || isCounter(m);

/** ¿El bracket buscado permite esta carta? Los Game Changers del bracket 3 se cuentan aparte (máximo 3). */
export function bracketAllows(m: Card, bracket: number | null): boolean {
  if (!bracket || bracket >= 4) return true;
  if (bracket <= 2) return !(m.gc || m.xt || m.mld);
  return !(m.xt || m.mld);
}
export const gcLimit = (bracket: number | null): number => !bracket || bracket >= 4 ? Infinity : bracket === 3 ? 3 : 0;

/** Puntaje de una carta de EDHREC: cuánto se juega con el comandante y cuánta sinergia tiene con él. */
export const poolScore = (p: EdhPoolCard): number => (p.incl || 0) * 100 + Math.max(0, p.syn || 0) * 60;

export function completeDeck(input: BuildInput, E: EdhData, db: CardDb): BuildResult {
  const cmds = input.commanders.map(n => db.get(n)).filter((m): m is Card => !!m);
  const ci = [...new Set(cmds.flatMap(m => m.ci.split("")))].join("");
  const size = 100 - input.commanders.length;
  const br = input.plan.bracket;
  const goals = new Map(slotGoals(input.plan, input.commanders.length).map(g => [g.k, g]));
  const excl = new Set((input.exclude || []).map(slug).filter(Boolean));
  const have = new Map<string, Card | null>(input.cards.map(c => [slug(c.n), db.get(c.n)]));
  const cmdKeys = new Set(input.commanders.map(slug));

  const pool = E.pool.map(p => ({ ...p, m: db.get(p.n) })).filter((p): p is EdhPoolCard & { m: Card } =>
    !!p.m && !p.m.basic && inIdentity(p.m, ci) && (!p.m.legal || p.m.legal === "legal") && !cmdKeys.has(slug(p.m.n)) && !have.has(slug(p.m.n)) && !excl.has(slug(p.m.n)) && !excl.has(slug(p.n)) && bracketAllows(p.m, br),
  ).map(p => ({ ...p, score: poolScore(p) })).sort((a, b) => b.score - a.score);

  const chosen = new Map<string, Card>();
  let gcN = [...have.values()].filter(m => m && m.gc).length + cmds.filter(m => m.gc).length;
  const gcMax = gcLimit(br);
  const take = (m: Card): boolean => {
    const k = slug(m.n); if (chosen.has(k)) return false;
    if (m.gc) { if (gcN >= gcMax) return false; gcN++; }
    chosen.set(k, m); return true;
  };
  const existing = [...have.values()].filter((m): m is Card => !!m);
  const countHave = (f: (m: Card) => boolean) => input.cards.reduce((a, c) => { const m = have.get(slug(c.n)); return a + (m && f(m) ? c.q : 0); }, 0);

  // 1) casillas de apoyo: se llenan hasta el punto medio de su rango, descontando lo que ya hay
  const spells = pool.filter(p => p.m.t !== "Land");
  const mid = (k: "ramp" | "draw" | "removal" | "wipe" | "protection") => { const g = goals.get(k)!; return Math.round((g.lo + g.hi) / 2); };
  const counterQ = input.plan.inter === "high" ? 4 : input.plan.inter === "mid" ? 1 : 0;
  const quotas: [string, number, (m: Card) => boolean][] = [
    ["ramp", mid("ramp"), m => (m.r as string[]).includes("ramp")],
    ["draw", mid("draw"), m => (m.r as string[]).includes("draw")],
    ["counter", counterQ, isCounter],
    ["removal", mid("removal"), m => (m.r as string[]).includes("removal")],
    ["wipe", mid("wipe"), m => (m.r as string[]).includes("wipe")],
    ["protection", 3, m => (m.r as string[]).includes("protection")],
  ];
  for (const [, n, fits] of quotas) {
    let k = countHave(fits);
    for (const p of spells) { if (k >= n) break; if (fits(p.m) && take(p.m)) k++; }
  }

  // 2) tierras: cuántas van y cuántas no básicas ofrece la fuente
  const landGoal = goals.get("land")!; const landsTarget = Math.round((landGoal.lo + landGoal.hi) / 2);
  const landsHave = countHave(m => m.t === "Land");
  const spellsHave = input.cards.reduce((a, c) => a + c.q, 0) - landsHave;
  const landsNeed = Math.max(0, Math.min(landsTarget - landsHave, size - spellsHave - landsHave));
  const spellsTarget = Math.max(0, size - Math.max(landsTarget, landsHave) - spellsHave);

  // 3) el resto de los hechizos, por puntaje; la interacción tiene tope para no llenar el mazo de respuestas
  const interMax = goals.get("removal")!.hi + goals.get("wipe")!.hi + counterQ;
  let interN = countHave(isInteraction) + [...chosen.values()].filter(isInteraction).length;
  for (const p of spells) {
    if (chosen.size >= spellsTarget) break;
    const it = isInteraction(p.m);
    if (it && interN >= interMax && !chosen.has(slug(p.m.n))) continue;
    if (take(p.m) && it) interN++;
  }
  // si las casillas tomaron más de lo que cabe, se sueltan las de menor puntaje
  const scoreOf = new Map(pool.map(p => [slug(p.m.n), p.score]));
  const spellList = [...chosen.values()].sort((a, b) => (scoreOf.get(slug(b.n)) || 0) - (scoreOf.get(slug(a.n)) || 0)).slice(0, spellsTarget);

  const nonbasicMax = ci.length <= 1 ? 6 : 14;
  const nonbasicHave = existing.filter(m => m.t === "Land" && !m.basic).length;
  // las tierras también cuentan para el tope de Game Changers (Ancient Tomb, Gaea's Cradle, Field of the Dead…)
  let gcUsed = [...existing, ...cmds, ...spellList].filter(m => m.gc).length;
  const nonbasicCap = Math.max(0, Math.min(nonbasicMax - nonbasicHave, landsNeed));
  const nonbasic: Card[] = [];
  for (const p of pool) {
    if (nonbasic.length >= nonbasicCap) break;
    if (p.m.t !== "Land") continue;
    if (p.m.gc) { if (gcUsed >= gcMax) continue; gcUsed++; }
    nonbasic.push(p.m);
  }
  const basicsN = Math.max(0, landsNeed - nonbasic.length);
  const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const m of [...spellList, ...existing, ...cmds]) for (const s of (m.cost || "").match(/\{[^}]+\}/g) || []) for (const c of WUBRG) if (s.includes(c)) pips[c]++;
  const cols = ci.split("").filter(c => (WUBRG as readonly string[]).includes(c));
  const tot = cols.reduce((a, c) => a + (pips[c] || 1), 0) || 1;
  const basics: Entry[] = []; let left = basicsN;
  cols.forEach((c, i) => { const q = i === cols.length - 1 ? left : Math.min(left, Math.round(basicsN * (pips[c] || 1) / tot)); if (q > 0) basics.push({ n: BASIC_NAME[c], q }); left -= q; });
  if (!cols.length && basicsN > 0) basics.push({ n: "Wastes", q: basicsN });

  const added: Entry[] = [...spellList.map(m => ({ n: m.n, q: 1 })), ...nonbasic.map(m => ({ n: m.n, q: 1 })), ...basics];
  // las básicas nuevas se suman a las que ya había
  const out = input.cards.map(c => ({ ...c }));
  for (const a of added) { const e = out.find(c => slug(c.n) === slug(a.n)); if (e) e.q += a.q; else out.push({ ...a }); }
  const totalN = out.reduce((a, c) => a + c.q, 0);
  return { cards: out, added, spells: spellList.length, lands: nonbasic.length + basicsN, gc: gcUsed, short: Math.max(0, size - totalN) };
}
