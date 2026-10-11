// A contra B: dos versiones del mismo mazo, con las mismas manos y las mismas partidas simuladas.
// Las dos corren con la misma semilla para que la diferencia venga de las cartas y no de la suerte.
import type { CardDb, Entry } from "./types.ts";
import { analyze, bracketOf, type Analysis, type DeckLike } from "./analyze.ts";
import { simulateHands, type HandStats } from "./hands.ts";
import { simRun, type SimInput } from "./sim.ts";
import { diffLists } from "./parse.ts";
import { newSeed, seeded } from "./util.ts";

export interface Side { name: string; A: Analysis; bracket: number; hands: HandStats | null; win: number; ci: [number, number]; avgTurn: number | null; how: Record<string, number> }
export interface Delta { k: string; a: number | null; b: number | null; better: "a" | "b" | null; fmt: "n" | "pct" | "turn" | "cmc" }
export interface Comparison {
  a: Side; b: Side;
  add: Entry[]; rem: Entry[];           // de A a B: qué entra y qué sale
  deltas: Delta[];
  n: number; seed: number; mirror: boolean; rivals: string[];
  diff: number;                         // % de victorias de B menos el de A
  margin: number;                       // margen de azar (95 %) de esa diferencia
  verdict: "a" | "b" | "tie";
  text: string;
}

export interface CompareInput { a: DeckLike & { name: string }; b: DeckLike & { name: string }; rivals: SimInput[]; n?: number; seed?: number; onStep?: (done: number, total: number) => void }

export async function compareVersions(input: CompareInput, db: CardDb): Promise<Comparison> {
  const n = input.n || 400, seed = input.seed != null ? input.seed : newSeed();
  const A = analyze(input.a, db), B = analyze(input.b, db);
  const hA = simulateHands(A, seeded(seed), 4000), hB = simulateHands(B, seeded(seed), 4000);
  const mk = (id: string, d: DeckLike & { name: string }): SimInput => ({ id, name: d.name, commanders: d.commanders, cards: d.cards, combos: d.combos });
  const rivals = input.rivals.slice(0, 3); const mirror = rivals.length === 0;
  let sa: { pct: number; ci: [number, number]; avgTurn: number | null; how: Record<string, number>; games: number };
  let sb: typeof sa;
  if (mirror) {
    // sin rivales: mesa de espejo con dos copias de cada versión, rotando asientos
    const R = await simRun([mk("a1", input.a), mk("b1", input.b), mk("a2", input.a), mk("b2", input.b)], db, n, { seed, onStep: g => input.onStep && input.onStep(g, n) });
    const merge = (x: string, y: string): typeof sa => {
      const p = R.decks.find(d => d.id === x)!, q = R.decks.find(d => d.id === y)!; const w = p.w + q.w;
      const how: Record<string, number> = { ...p.how }; for (const [k, v] of Object.entries(q.how)) how[k] = (how[k] || 0) + v;
      const turns = (p.avgTurn || 0) * p.w + (q.avgTurn || 0) * q.w;
      return { pct: w / n, ci: [0, 0], avgTurn: w ? turns / w : null, how, games: n };
    };
    sa = merge("a1", "a2"); sb = merge("b1", "b2");
  } else {
    // contra la misma mesa: cada versión juega las mismas n partidas contra los mismos rivales
    const RA = await simRun([mk("__a", input.a), ...rivals], db, n, { seed, onStep: g => input.onStep && input.onStep(g, n * 2) });
    const RB = await simRun([mk("__b", input.b), ...rivals], db, n, { seed, onStep: g => input.onStep && input.onStep(n + g, n * 2) });
    const pick = (R: typeof RA, id: string): typeof sa => { const x = R.decks.find(d => d.id === id)!; return { pct: x.pct, ci: x.ci, avgTurn: x.avgTurn, how: x.how, games: n }; };
    sa = pick(RA, "__a"); sb = pick(RB, "__b");
  }
  const half = (p: number, g: number) => 1.96 * Math.sqrt(p * (1 - p) / g);
  sa.ci = [Math.max(0, sa.pct - half(sa.pct, sa.games)), Math.min(1, sa.pct + half(sa.pct, sa.games))];
  sb.ci = [Math.max(0, sb.pct - half(sb.pct, sb.games)), Math.min(1, sb.pct + half(sb.pct, sb.games))];
  const diff = sb.pct - sa.pct;
  // En la mesa de espejo las dos versiones juegan las mismas partidas: si una gana, la otra pierde.
  // Ese margen es más ancho que el de dos corridas independientes, y hay que usar el que corresponde.
  const margin = mirror
    ? 1.96 * Math.sqrt(Math.max(0, sa.pct + sb.pct - diff * diff) / n)
    : 1.96 * Math.sqrt(sa.pct * (1 - sa.pct) / sa.games + sb.pct * (1 - sb.pct) / sb.games);
  const verdict: "a" | "b" | "tie" = Math.abs(diff) <= margin ? "tie" : diff > 0 ? "b" : "a";
  const side = (name: string, X: Analysis, d: DeckLike, h: HandStats | null, s: typeof sa): Side => ({ name, A: X, bracket: bracketOf(d, X).b, hands: h, win: s.pct, ci: s.ci, avgTurn: s.avgTurn, how: s.how });
  const dl = diffLists(input.a.cards, input.b.cards);
  const lower = (a: number | null, b: number | null): "a" | "b" | null => a == null || b == null || a === b ? null : a < b ? "a" : "b";
  const deltas: Delta[] = [
    { k: "Gana en la simulación", a: sa.pct, b: sb.pct, better: verdict === "tie" ? null : verdict, fmt: "pct" },
    { k: "Turno en que gana", a: sa.avgTurn, b: sb.avgTurn, better: lower(sa.avgTurn, sb.avgTurn), fmt: "turn" },
    { k: "Manos atascadas", a: hA && hA.pScrew, b: hB && hB.pScrew, better: lower(hA && hA.pScrew, hB && hB.pScrew), fmt: "pct" },
    { k: "Manos con mulligan", a: hA && hA.pMull, b: hB && hB.pMull, better: lower(hA && hA.pMull, hB && hB.pMull), fmt: "pct" },
    { k: "Comandante en mesa", a: hA && hA.avgTurn, b: hB && hB.avgTurn, better: lower(hA && hA.avgTurn, hB && hB.avgTurn), fmt: "turn" },
    { k: "Remate lanzable", a: hA && hA.winAvg, b: hB && hB.winAvg, better: lower(hA && hA.winAvg, hB && hB.winAvg), fmt: "turn" },
    { k: "Coste promedio", a: A.avg, b: B.avg, better: null, fmt: "cmc" },
    { k: "Tierras", a: A.roles.land, b: B.roles.land, better: null, fmt: "n" },
    { k: "Ramp", a: A.roles.ramp, b: B.roles.ramp, better: null, fmt: "n" },
    { k: "Robo", a: A.roles.draw, b: B.roles.draw, better: null, fmt: "n" },
    { k: "Removal y barridos", a: A.roles.removal + A.roles.wipe, b: B.roles.removal + B.roles.wipe, better: null, fmt: "n" },
    { k: "Game Changers", a: A.gc.length, b: B.gc.length, better: null, fmt: "n" },
  ];
  const p100 = (v: number) => Math.round(v * 100);
  const where = mirror ? "en una mesa de espejo (dos copias de cada versión)" : `contra ${rivals.map(r => r.name).join(", ")}`;
  const text = verdict === "tie"
    ? `No hay diferencia clara: ${input.a.name} gana ${p100(sa.pct)} % y ${input.b.name} ${p100(sb.pct)} % ${where}. La diferencia (${Math.abs(p100(diff))} puntos) cabe dentro del margen de azar (±${p100(margin)}). Si los cambios te gustan por otra razón, no te cuestan victorias.`
    : `${verdict === "b" ? input.b.name : input.a.name} rinde mejor: gana ${p100(verdict === "b" ? sb.pct : sa.pct)} % contra ${p100(verdict === "b" ? sa.pct : sb.pct)} % ${where}. La diferencia (${Math.abs(p100(diff))} puntos) supera el margen de azar (±${p100(margin)}).`;
  return { a: side(input.a.name, A, input.a, hA, sa), b: side(input.b.name, B, input.b, hB, sb), add: dl.add, rem: dl.rem, deltas, n, seed, mirror, rivals: rivals.map(r => r.name), diff, margin, verdict, text };
}
