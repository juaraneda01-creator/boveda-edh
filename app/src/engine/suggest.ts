// Qué cambiar: sugerencias por casilla, cambios uno por uno, plan para llegar a un bracket
// y comparación con lo que juega la gente con el mismo comandante.
import type { Card, CardDb, Deck, EdhData, Plan } from "./types.ts";
import { bracketRule, combos2, type Analysis, type BracketRule, type DeckLike } from "./analyze.ts";
import { bracketAllows, gcLimit, inIdentity, isCounter, poolScore } from "./build.ts";
import { slotGoals, supportCount, type SlotKey } from "./slots.ts";
import type { Synergy } from "./synergy.ts";
import { CEDH_STAPLES, FAST_MANA, FREE_INTERACTION } from "./constants.ts";
import { ROLE_ES, slug } from "./util.ts";

const pct = (v: number) => `${Math.round(v * 100)} %`;
const inDeckSet = (d: Pick<Deck, "commanders">, A: Analysis) => new Set([...A.rows.map(r => slug(r.n)), ...(d.commanders || []).map(slug)]);

export interface Suggestion { n: string; m: Card; incl: number | null; syn: number | null; score: number; why: string; gc: boolean }

/** Candidatas de EDHREC para una casilla, ya filtradas por colores, legalidad y bracket buscado. */
export function slotSuggestions(k: SlotKey, d: Pick<Deck, "commanders">, A: Analysis, E: EdhData | null, db: CardDb, plan: Plan, limit = 10): Suggestion[] {
  if (!E) return [];
  const inDeck = inDeckSet(d, A); const gcLeft = gcLimit(plan.bracket) - A.gc.length;
  const fits = (m: Card): boolean => {
    if (k === "land") return m.t === "Land";
    if (m.t === "Land") return false;
    const r = m.r as string[];
    if (k === "plan") return !["ramp", "draw", "removal", "wipe", "protection", "tutor"].some(x => r.includes(x));
    if (k === "other") return false;
    if (k === "removal") return r.includes("removal") || isCounter(m);
    return r.includes(k);
  };
  const out: Suggestion[] = [];
  for (const p of E.pool) {
    const m = db.get(p.n); if (!m || m.basic || inDeck.has(slug(m.n)) || !fits(m)) continue;
    if (!inIdentity(m, A.ci) || (m.legal && m.legal !== "legal") || !bracketAllows(m, plan.bracket)) continue;
    if (m.gc && gcLeft <= 0) continue;
    const why: string[] = [];
    if (p.incl != null) why.push(`en ${pct(p.incl)} de las listas`);
    if (p.syn != null && p.syn > 0.05) why.push(`sinergia +${Math.round(p.syn * 100)}`);
    if (m.gc) why.push("Game Changer");
    out.push({ n: m.n, m, incl: p.incl, syn: p.syn, score: poolScore(p) + (k === "plan" ? Math.max(0, p.syn || 0) * 60 : 0), why: why.join(" · "), gc: m.gc });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface Swap { out: string; in: string; why: string; fills: string[] }
/** Cambios uno por uno: entra la carta más jugada que falta, sale la menos jugada que no cubre un rol escaso. */
export function swaps(d: Pick<Deck, "commanders">, A: Analysis, E: EdhData, db: CardDb, plan: Plan, limit = 12): Swap[] {
  const inDeck = inDeckSet(d, A);
  const scoreMap = new Map(E.pool.map(p => [slug(p.n), p]));
  // sin los datos del comandante no se conoce la identidad de color: mejor no sugerir que sugerir fuera de color
  if (!A.cmdMeta.length || !A.cmdMeta.every(Boolean)) return [];
  // qué funciones faltan o sobran según las metas del plan (las mismas que muestran las casillas)
  const support = slotGoals(plan, (d.commanders || []).length).filter(g => ["ramp", "draw", "removal", "wipe", "protection"].includes(g.k));
  const deficit: string[] = support.filter(g => supportCount(A, g.k) < g.lo).map(g => g.k);
  const surplus: string[] = support.filter(g => supportCount(A, g.k) > g.hi).map(g => g.k);
  const rolesOf = (m: Card): string[] => [...(m.r as string[]), ...(isCounter(m) && !(m.r as string[]).includes("removal") ? ["removal"] : [])];
  let gcLeft = gcLimit(plan.bracket) - A.gc.length;
  const adds = E.pool.filter(p => !inDeck.has(slug(p.n))).map(p => {
    const m = db.get(p.n); if (!m || m.t === "Land") return null;
    if (!inIdentity(m, A.ci)) return null;
    if (m.legal && m.legal !== "legal") return null;
    if (!bracketAllows(m, plan.bracket)) return null;
    const fills = rolesOf(m).filter(x => deficit.includes(x));
    return { n: m.n, m, incl: p.incl, syn: p.syn, fills, score: poolScore(p) + fills.length * 20 };
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.score - a.score);
  // las cartas con varias copias (Relentless Rats y parecidas) no se proponen como corte: son el plan del mazo
  const cuts = A.rows.filter(r => r.m && r.m.t !== "Land" && !r.m.basic && r.q === 1).map(r => {
    const s = scoreMap.get(slug(r.n)); const roles = rolesOf(r.m!);
    const protectedRole = roles.some(x => deficit.includes(x));
    const score = (s ? poolScore(s) : 0) + (protectedRole ? 40 : 0) - (roles.some(x => surplus.includes(x)) ? 15 : 0) + (r.m!.gc ? 10 : 0);
    return { n: r.n, incl: s ? s.incl : null, score };
  }).sort((a, b) => a.score - b.score);
  const out: Swap[] = []; const usedCuts = new Set<string>();
  for (const a of adds) {
    if (out.length >= limit) break;
    if (a.m.gc) { if (gcLeft <= 0) continue; }
    const c = cuts.find(x => !usedCuts.has(x.n) && x.score < a.score);
    if (!c) break;
    usedCuts.add(c.n); if (a.m.gc) gcLeft--;
    const why: string[] = [];
    if (a.incl != null) why.push(`jugada en ${pct(a.incl)} de los mazos de este comandante`);
    if (a.syn != null && a.syn > 0.05) why.push(`sinergia +${Math.round(a.syn * 100)}`);
    if (a.fills.length) why.push(`suma ${a.fills.map(x => ROLE_ES[x as keyof typeof ROLE_ES]).join(" y ")}, que te falta`);
    why.push(c.incl != null ? `${c.n} aparece solo en ${pct(c.incl)}` : `${c.n} casi no aparece en listas de este comandante`);
    out.push({ out: c.n, in: a.n, why: why.join(" · "), fills: a.fills });
  }
  return out;
}

export interface PlanCheck { ok: boolean | null; t: string }
export interface PlanCut { n: string; why: string; rep: string | null }
export interface PlanAdd { n: string; why: string }
export interface CedhBench { k: string; v: number | string; goal: string; ok: boolean }
export interface BracketPlan { R: BracketRule; checks: PlanCheck[]; cuts: PlanCut[]; adds: PlanAdd[]; bench: CedhBench[] | null; needGC: boolean }

/** Qué sacar y qué poner para que el mazo quede en el bracket buscado. */
export function bracketPlan(d: DeckLike, A: Analysis, target: number, db: CardDb, E: EdhData | null): BracketPlan {
  const R = bracketRule(target);
  const cmds = d.commanders || [];
  const inDeck = new Set([...A.rows.map(r => slug(r.n)), ...cmds.map(slug)]);
  const isCmd = (n: string) => cmds.some(c => slug(c) === slug(n));
  const c2 = combos2(d);
  const checks: PlanCheck[] = [], cuts: PlanCut[] = [], adds: PlanAdd[] = [];
  const replacementFor = (name: string): string | null => {
    const m = db.get(name); const role = (m && m.r && m.r[0]) || null;
    const pool = (E ? E.pool : []).map(p => ({ ...p, m: db.get(p.n) })).filter(p => p.m && !inDeck.has(slug(p.n)) && !p.m.gc && !p.m.xt && !p.m.mld && p.m.t !== "Land" && inIdentity(p.m, A.ci) && (!role || p.m.r.includes(role)) && !cuts.some(c => c.rep === p.m!.n))
      .sort((a, b) => (b.incl || 0) - (a.incl || 0));
    return pool[0] ? pool[0].m!.n : null;
  };
  // Game Changers
  if (A.gc.length > R.gc) {
    const extra = A.gc.filter(n => !isCmd(n)); const nCut = A.gc.length - R.gc;
    checks.push({ ok: false, t: `Game Changers: tienes ${A.gc.length}, el bracket ${target} permite ${R.gc === 0 ? "ninguno" : "hasta " + R.gc}` });
    for (const n of extra.slice(0, nCut)) cuts.push({ n, why: "Game Changer", rep: replacementFor(n) });
  } else checks.push({ ok: true, t: `Game Changers: ${A.gc.length}${R.gc < 99 ? ` de ${R.gc} permitidos` : " (sin límite)"}` });
  // destrucción masiva de tierras
  if (!R.mld && A.mld.length) { checks.push({ ok: false, t: `Destrucción masiva de tierras no permitida: ${A.mld.join(", ")}` }); for (const n of A.mld) cuts.push({ n, why: "destrucción masiva de tierras", rep: replacementFor(n) }); }
  else checks.push({ ok: true, t: R.mld ? "Destrucción masiva de tierras permitida" : "Sin destrucción masiva de tierras" });
  // turnos extra
  if (A.xt.length > R.xt) { checks.push({ ok: false, t: `Turnos extra: ${A.xt.length} (máximo sugerido ${R.xt})` }); for (const n of A.xt.slice(R.xt)) cuts.push({ n, why: "turno extra", rep: replacementFor(n) }); }
  else checks.push({ ok: true, t: `Turnos extra: ${A.xt.length}${R.xt < 99 ? ` (máximo sugerido ${R.xt})` : ""}` });
  // combos de 2 cartas
  if (!d.combos) checks.push({ ok: null, t: "Combos de 2 cartas: sin revisar. Busca combos para verificarlo." });
  else if (!R.combo2 && c2.length) {
    checks.push({ ok: false, t: `Combos de 2 cartas no permitidos: ${c2.map(c => c.cards.join(" + ")).join(" · ")}` });
    for (const c of c2) { const piece = c.cards.find(n => !isCmd(n)); if (piece && !cuts.some(x => x.n === piece)) cuts.push({ n: piece, why: "pieza de combo de 2 cartas", rep: replacementFor(piece) }); }
  } else checks.push({ ok: true, t: `Combos de 2 cartas: ${c2.length}${R.combo2 ? " (permitidos)" : ""}` });
  // tutores
  if (A.tutors.length > R.tutors) { checks.push({ ok: false, t: `Tutores: ${A.tutors.length}, conviene no pasar de ${R.tutors}` }); for (const n of A.tutors.filter(n => !cuts.some(c => c.n === n)).slice(0, A.tutors.length - R.tutors)) cuts.push({ n, why: "tutor", rep: replacementFor(n) }); }
  else checks.push({ ok: true, t: `Tutores: ${A.tutors.length}${R.tutors < 99 ? ` (hasta ${R.tutors})` : ""}` });
  // subir de nivel: Game Changers en tus colores, piezas que completan combos, y staples de torneo
  const gcPool = db.gcNames().map(n => db.get(n)).filter((m): m is Card => !!m && inIdentity(m, A.ci) && !inDeck.has(slug(m.n)) && (!m.legal || m.legal === "legal"));
  const rankE = (n: string) => { const p = E && E.pool.find(x => slug(x.n) === slug(n)); return p ? (p.incl || 0) : -1; };
  if (target >= 3) {
    const room = Math.min(R.gc, 99) - A.gc.length;
    const n = target === 3 ? Math.max(0, room) : 6;
    gcPool.sort((a, b) => rankE(b.n) - rankE(a.n) || (a.rank || 99999) - (b.rank || 99999));
    for (const m of gcPool.slice(0, n)) adds.push({ n: m.n, why: "Game Changer en tus colores" + (rankE(m.n) > 0 ? ` · ${pct(rankE(m.n))} en EDHREC` : "") });
  }
  if (target >= 4 && d.combos) {
    for (const c of (d.combos.almost || []).filter(c => c.cards.length <= 3).slice(0, 6)) {
      const miss = c.cards.filter(n => !inDeck.has(slug(n)));
      if (miss.length === 1 && !adds.some(a => a.n === miss[0])) adds.push({ n: miss[0], why: `completa ${c.cards.join(" + ")}${c.prod.length ? " → " + c.prod[0] : ""}` });
    }
  }
  let bench: CedhBench[] | null = null;
  if (target === 5) {
    const staples = ["C", ...A.ci.split("")].flatMap(c => CEDH_STAPLES[c] || []).filter((n, i, a) => a.indexOf(n) === i);
    for (const n of staples.filter(n => !inDeck.has(slug(n))).slice(0, 20)) if (!adds.some(a => slug(a.n) === slug(n))) adds.push({ n, why: "pieza habitual de cEDH en tus colores" });
    const fast = A.rows.filter(r => FAST_MANA.has(r.n.toLowerCase())).reduce((a, r) => a + r.q, 0);
    const free = A.rows.filter(r => FREE_INTERACTION.has(r.n.toLowerCase())).reduce((a, r) => a + r.q, 0);
    bench = [
      { k: "Maná rápido (Sol Ring, moxes, rituales)", v: fast, goal: "6 o más", ok: fast >= 6 },
      { k: "Interacción gratis (Force of Will, Pact…)", v: free, goal: "4 o más", ok: free >= 4 },
      { k: "Tutores", v: A.tutors.length, goal: "6 o más", ok: A.tutors.length >= 6 },
      { k: "Tierras", v: A.roles.land, goal: "27 a 31", ok: A.roles.land >= 26 && A.roles.land <= 32 },
      { k: "Coste promedio", v: A.avg.toFixed(2).replace(".", ","), goal: "2,2 o menos", ok: A.avg <= 2.2 },
      { k: "Combos de 2 cartas", v: d.combos ? c2.length : "sin revisar", goal: "1 o más", ok: c2.length >= 1 },
    ];
  }
  return { R, checks, cuts, adds, bench, needGC: gcPool.length === 0 };
}

export interface MetaCompare {
  decks: number | null;                              // cuántos mazos resume EDHREC
  score: number;                                     // 0–100: cuánto se parece tu lista a la lista típica
  core: { n: string; incl: number; have: boolean }[]; // el núcleo: cartas en la mitad o más de las listas
  coreHave: number;
  missing: { n: string; incl: number; m: Card | null }[];   // muy jugadas que no llevas
  rare: { n: string; incl: number | null; linked: boolean }[]; // que llevas y casi nadie juega
}
/** Tu lista contra lo que juega la gente con el mismo comandante. No es una nota: es un mapa de diferencias. */
export function metaCompare(d: Pick<Deck, "commanders">, A: Analysis, E: EdhData, db: CardDb, Y: Synergy): MetaCompare {
  const inDeck = inDeckSet(d, A);
  const pool = E.pool.filter(p => p.incl != null).map(p => ({ ...p, incl: p.incl as number, m: db.get(p.n) })).filter(p => !(p.m && p.m.basic));
  const typical = [...pool].sort((a, b) => b.incl - a.incl).slice(0, 60);
  const totalW = typical.reduce((a, p) => a + p.incl, 0) || 1;
  const haveW = typical.filter(p => inDeck.has(slug(p.n))).reduce((a, p) => a + p.incl, 0);
  const core = pool.filter(p => p.incl >= 0.5).sort((a, b) => b.incl - a.incl).map(p => ({ n: p.n, incl: p.incl, have: inDeck.has(slug(p.n)) }));
  const missing = pool.filter(p => p.incl >= 0.3 && !inDeck.has(slug(p.n)) && (!p.m || (inIdentity(p.m, A.ci) && (!p.m.legal || p.m.legal === "legal")))).sort((a, b) => b.incl - a.incl).slice(0, 15).map(p => ({ n: p.n, incl: p.incl, m: p.m }));
  const inclOf = new Map(E.pool.map(p => [slug(p.n), p.incl]));
  const rare = A.rows.filter(r => r.m && r.m.t !== "Land").map(r => ({ n: r.n, incl: inclOf.has(slug(r.n)) ? (inclOf.get(slug(r.n)) ?? null) : null, linked: (Y.links.get(r.n) || { n: 0 }).n > 0 }))
    .filter(x => x.incl == null || x.incl < 0.05).sort((a, b) => Number(a.linked) - Number(b.linked) || (a.incl || 0) - (b.incl || 0));
  return { decks: E.decks, score: Math.round(100 * haveW / totalW), core, coreHave: core.filter(c => c.have).length, missing, rare };
}
