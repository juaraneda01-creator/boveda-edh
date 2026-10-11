// Casillas del mazo: cuántas cartas de cada función pide el plan y cuáles las ocupan hoy.
// Es la vista con la que se arma: en vez de una lista de 99, nueve casillas con su meta.
import type { Card, Plan, Row } from "./types.ts";
import { status, type Analysis, type Status } from "./analyze.ts";
import type { Synergy } from "./synergy.ts";

export type SlotKey = "land" | "ramp" | "draw" | "removal" | "wipe" | "protection" | "tutor" | "plan" | "other";

export interface SlotGoal { k: SlotKey; n: string; d: string; lo: number; hi: number }
export interface Slot extends SlotGoal {
  rows: Row[];        // cartas que ocupan la casilla (una carta con dos funciones aparece en las dos)
  count: number;
  state: Status | "info";
  gap: number;        // cuántas faltan para el mínimo (0 si ya llegó)
  over: number;       // cuántas sobran sobre el máximo
}

const INTER = {
  low: { removal: [4, 6], wipe: [1, 2] },
  mid: { removal: [6, 10], wipe: [2, 4] },
  high: { removal: [9, 13], wipe: [3, 5] },
} as const;

/** Metas de cada casilla según el plan: el bracket mueve tierras, ramp y tutores; la interacción mueve removal y barridos. */
export function slotGoals(plan: Plan, commanders = 1): SlotGoal[] {
  const b = plan.bracket || 3; const it = INTER[plan.inter] || INTER.mid;
  const land: [number, number] = b >= 5 ? [27, 32] : b === 4 ? [33, 37] : [35, 38];
  const ramp: [number, number] = b >= 4 ? [10, 15] : [8, 12];
  const tutor: [number, number] = b >= 5 ? [6, 14] : b === 4 ? [3, 10] : b === 3 ? [0, 6] : b === 2 ? [0, 3] : [0, 2];
  const deck = 100 - commanders;
  // lo que queda para el plan del mazo después de las casillas de apoyo
  const support = land[0] + ramp[0] + 8 + it.removal[0] + it.wipe[0] + 2;
  const planLo = Math.max(20, deck - support - 12), planHi = deck - support;
  return [
    { k: "land", n: "Tierras", d: "La base de maná. Con menos, las manos se atascan.", lo: land[0], hi: land[1] },
    { k: "ramp", n: "Ramp", d: "Aceleración: piedras, criaturas de maná y tierras extra.", lo: ramp[0], hi: ramp[1] },
    { k: "draw", n: "Robo", d: "Ventaja de cartas para no quedarte sin jugadas.", lo: 8, hi: 12 },
    { k: "removal", n: "Removal", d: "Respuestas puntuales, incluidos los contrahechizos.", lo: it.removal[0], hi: it.removal[1] },
    { k: "wipe", n: "Barridos", d: "Limpian la mesa cuando vas atrás.", lo: it.wipe[0], hi: it.wipe[1] },
    { k: "protection", n: "Protección", d: "Cuidan a tu comandante y tus piezas clave.", lo: 2, hi: 6 },
    { k: "tutor", n: "Tutores", d: "Buscan la carta que necesitas. El bracket limita cuántos conviene llevar.", lo: tutor[0], hi: tutor[1] },
    { k: "plan", n: "Plan del mazo", d: "Las cartas que hacen lo que el mazo quiere hacer: sus temas y sus remates.", lo: planLo, hi: planHi },
    { k: "other", n: "Sin casilla", d: "No cumplen una función de apoyo ni conectan con tus temas: las primeras candidatas a salir.", lo: 0, hi: 6 },
  ];
}

const UTILITY: SlotKey[] = ["ramp", "draw", "removal", "wipe", "protection", "tutor"];

/** A qué casillas pertenece una carta. `linked`: si conecta con algún tema activo del mazo. */
export function slotsOfCard(m: Card | null, linked: boolean): SlotKey[] {
  if (!m) return ["other"];
  if (m.t === "Land") return ["land"];
  const out: SlotKey[] = UTILITY.filter(k => (m.r as string[]).includes(k));
  if (linked || (m.r as string[]).includes("wincon")) out.push("plan");
  return out.length ? out : ["other"];
}

export function buildSlots(A: Analysis, Y: Synergy, plan: Plan, commanders = 1): Slot[] {
  const goals = slotGoals(plan, commanders);
  const by = new Map<SlotKey, Row[]>(goals.map(g => [g.k, []]));
  for (const r of A.rows) {
    const linked = (Y.links.get(r.n) || { n: 0 }).n > 0;
    for (const k of slotsOfCard(r.m, linked)) by.get(k)!.push(r);
  }
  return goals.map(g => {
    const rows = by.get(g.k)!; const count = rows.reduce((a, r) => a + r.q, 0);
    // "Plan" se traslapa con las demás (una carta del tema puede ser además ramp o robo): solo importa si se queda corta
    const state: Status | "info" = g.k === "other" ? (count > g.hi ? "warn" : "info") : g.k === "plan" ? (count < g.lo ? "warn" : "good") : g.k === "tutor" ? (count > g.hi ? "warn" : count < g.lo ? "warn" : "good") : status(count, g.lo, g.hi);
    return { ...g, rows, count, state, gap: Math.max(0, g.lo - count), over: g.k === "plan" ? 0 : Math.max(0, count - g.hi) };
  });
}

/** Resumen en una frase de lo que más urge. */
export function nextStep(slots: Slot[], A: Analysis, deckSize: number): string {
  if (!A.cmdMeta.length) return "Elige un comandante para empezar.";
  if (A.missing.length) return `Faltan los datos de ${A.missing.length} carta${A.missing.length > 1 ? "s" : ""}: actualízalas para que el análisis sea completo.`;
  const need = slots.filter(s => s.gap > 0 && s.k !== "plan" && s.k !== "tutor").sort((a, b) => b.gap / Math.max(1, b.lo) - a.gap / Math.max(1, a.lo))[0];
  if (A.main < deckSize) return need ? `Faltan ${deckSize - A.main} cartas. Lo más urgente: ${need.gap} de ${need.n.toLowerCase()}.` : `Faltan ${deckSize - A.main} cartas para completar el mazo.`;
  if (A.main > deckSize) { const over = slots.filter(s => s.over > 0).sort((a, b) => b.over - a.over)[0]; return `Sobran ${A.main - deckSize} cartas.${over ? ` Mira primero ${over.n.toLowerCase()} (${over.over} sobre el máximo).` : ""}`; }
  if (need) return `El mazo está completo, pero le faltan ${need.gap} de ${need.n.toLowerCase()}.`;
  return "El mazo está completo y con las casillas en rango. Toca probarlo.";
}
