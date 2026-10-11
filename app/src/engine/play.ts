// Cómo juega el mazo de verdad: partidas anotadas, turno de victoria y bracket por velocidad y deformación.
import type { Card, Game, Row } from "./types.ts";
import { combos2, type Analysis, type DeckLike } from "./analyze.ts";
import type { HandStats } from "./hands.ts";
import { FAST_MANA, FREE_INTERACTION } from "./constants.ts";

export const GAME_HOW: [string, string][] = [["combat", "Combate"], ["combo", "Combo"], ["drain", "Drenaje"], ["cmdr", "Daño de comandante"], ["poison", "Veneno"], ["alt", "Victoria alternativa"], ["concede", "Se rindieron"], ["other", "Otro"]];
export const howEs = (k: string | null): string => (GAME_HOW.find(h => h[0] === k) || [k, k || ""])[1] as string;

export interface GameStats {
  n: number; w: number; l: number; dr: number;
  pct: number | null;
  avgTurn: number | null;                        // turno promedio de las victorias con turno anotado
  seats: { s: number; n: number; w: number }[];
  opp: { k: string; n: number; w: number }[];    // contra cada rival
  how: [string, number][];                       // cómo gana
}
export function gameStats(list: Game[]): GameStats {
  const n = list.length, w = list.filter(g => g.res === "win").length, dr = list.filter(g => g.res === "draw").length;
  const winTurns = list.filter(g => g.res === "win" && g.turn).map(g => g.turn);
  const seats = [1, 2, 3, 4].map(s => { const L = list.filter(g => g.seat === s); return { s, n: L.length, w: L.filter(g => g.res === "win").length }; });
  const opp = new Map<string, { n: number; w: number }>();
  for (const g of list) for (const o of g.opp || []) { const x = opp.get(o) || { n: 0, w: 0 }; x.n++; if (g.res === "win") x.w++; opp.set(o, x); }
  const how = new Map<string, number>(); for (const g of list.filter(g => g.res === "win" && g.how)) how.set(g.how!, (how.get(g.how!) || 0) + 1);
  return {
    n, w, l: n - w - dr, dr, pct: n ? w / n : null, avgTurn: winTurns.length ? winTurns.reduce((a, x) => a + x, 0) / winTurns.length : null,
    seats, opp: [...opp.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.n - a.n), how: [...how.entries()].sort((a, b) => b[1] - a[1]),
  };
}

/** El simulador pesa como 10 partidas: con 10 victorias reales, estas pesan la mitad; con 30, el 75 %. */
export const WIN_SIM_W = 10;
export interface WinTurn { t: number | null; sim: number | null; real: number | null; n: number; w: number }
/** Turno de victoria: el del simulador de manos corregido con las victorias reales anotadas. */
export function winTurnOf(games: Game[], sim: HandStats | null): WinTurn {
  const s = sim && sim.winAvg ? sim.winAvg : null;
  const ts = games.filter(g => g.res === "win" && g.turn > 0).map(g => g.turn), n = ts.length;
  if (!n) return { t: s, sim: s, real: null, n: 0, w: 0 };
  const total = ts.reduce((a, x) => a + x, 0), real = total / n;
  if (s == null) return n >= 3 ? { t: real, sim: null, real, n, w: 1 } : { t: null, sim: null, real, n, w: 0 };
  return { t: (WIN_SIM_W * s + total) / (WIN_SIM_W + n), sim: s, real, n, w: n / (WIN_SIM_W + n) };
}

export interface Signals { fast: number; stax: number; free: number; c2: number | null; cedh: boolean }
/** Señales que definen la velocidad y la deformación: maná rápido, stax, interacción gratis y combos de 2 cartas. */
export function signals(d: DeckLike, A: Analysis): Signals {
  const rows: Row[] = [...A.rows, ...A.cmdMeta.filter((m): m is Card => !!m).map(m => ({ n: m.n, q: 1, m, cmd: true }))].filter(r => r.m);
  const cnt = (f: (r: Row) => boolean) => rows.filter(f).reduce((a, r) => a + r.q, 0);
  const fast = cnt(r => FAST_MANA.has(r.n.toLowerCase()));
  const free = cnt(r => FREE_INTERACTION.has(r.n.toLowerCase()));
  const stax = cnt(r => (r.m!.tg || []).includes("stax"));
  const c2 = d.combos ? combos2(d).length : null;
  return { fast, stax, free, c2, cedh: fast >= 5 && A.tutors.length >= 5 && (c2 || 0) >= 1 };
}

const SPEED_TURNS: [number, number][] = [[10, 1], [8, 2], [6, 3], [4, 4]];
const coma = (x: number) => x.toFixed(1).replace(".", ",");
export interface PlayBracket { speed: number; warp: number; b: number; turn: number | null; speedWhy: string; warpWhy: string }
/**
 * Bracket por juego, con dos ejes: velocidad (en qué turno amenaza ganar) y deformación de la partida
 * (stax, destrucción masiva de tierras, turnos extra encadenables, interacción gratis). Manda el más alto.
 */
export function playBracket(d: DeckLike, A: Analysis, sim: HandStats | null, games: Game[]): PlayBracket {
  const { fast, stax, free, c2, cedh } = signals(d, A);
  const W = winTurnOf(games, sim);
  let t = W.t; const why: string[] = [];
  if (t != null) why.push(W.n ? `gana hacia el turno ${coma(t)} (simulador corregido con ${W.n} victoria${W.n > 1 ? "s" : ""} real${W.n > 1 ? "es" : ""})` : `remate lanzable en el turno ${coma(t)}`);
  // un combo de 2 cartas con tutores adelanta la amenaza aunque el remate normal llegue tarde
  if ((c2 || 0) >= 1 && A.tutors.length >= 3) { const ct = Math.max(3, 7 - A.tutors.length * 0.35 - fast * 0.3); if (t == null || ct < t) { t = ct; why.push(`combo de 2 cartas con ${A.tutors.length} tutores (≈ turno ${coma(ct)})`); } }
  let speed = t == null ? 2 : (SPEED_TURNS.find(([lim]) => t! >= lim) || [0, 4])[1];
  if (t != null && t < 4 && cedh) speed = 5;
  const w: string[] = []; let warp = 1;
  if (A.mld.length) { warp = Math.max(warp, 4); w.push(`destrucción masiva de tierras (${A.mld.slice(0, 2).join(", ")})`); }
  if (A.xt.length >= 2 || (A.xt.length && A.tutors.length >= 3)) { warp = Math.max(warp, 4); w.push(`turnos extra encadenables (${A.xt.slice(0, 2).join(", ")})`); }
  else if (A.xt.length) { warp = Math.max(warp, 3); w.push(`un turno extra (${A.xt[0]})`); }
  if (stax >= 3) { warp = Math.max(warp, 4); w.push(`${stax} piezas de stax`); } else if (stax) { warp = Math.max(warp, 3); w.push(`${stax} pieza${stax > 1 ? "s" : ""} de stax`); }
  if (free >= 3) { warp = Math.max(warp, 4); w.push(`${free} hechizos de interacción gratis`); } else if (free) { warp = Math.max(warp, 3); w.push(`${free} de interacción gratis`); }
  if (cedh && warp >= 4 && speed >= 4) speed = 5;
  if (!w.length) w.push("nada que deforme la partida (el removal y los contrahechizos normales no cuentan)");
  return { speed, warp, b: Math.max(speed, warp), turn: t, speedWhy: why.join("; ") || "sin remate detectado", warpWhy: w.join("; ") };
}
