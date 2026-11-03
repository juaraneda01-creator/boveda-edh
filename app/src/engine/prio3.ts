// Prioridades 3 de MTGJSON: novedades para tu comandante, comandante para una lista y mejora por tandas.
import type { Card, CardDb, Deck, EdhData, Entry, Plan } from "./types.ts";
import type { Analysis } from "./analyze.ts";
import type { Synergy } from "./synergy.ts";
import { canCommand, legalIn } from "./cards.ts";
import { bracketAllows, inIdentity } from "./build.ts";
import { slotGoals, supportCount, isCounter } from "./slots.ts";
import { swaps, type Swap } from "./suggest.ts";
import { subtypesOf } from "./tags.ts";
import { ROLE_ES, WUBRG, slug } from "./util.ts";

const SUPPORT = ["ramp", "draw", "removal", "wipe", "protection"] as const;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const rolesOf = (m: Card): string[] => [...new Set([...(m.r as string[]), ...(isCounter(m) ? ["removal"] : [])])];

/* ---------- novedades para tu comandante ---------- */
export interface NewCard { n: string; m: Card; score: number; why: string }
/**
 * Entre cartas nuevas (las que no estaban en el archivo anterior de MTGJSON, o las de una búsqueda reciente en Scryfall),
 * las que calzan con el mazo: en sus colores, legales, dentro del bracket y que refuercen un tema activo o una función que falta.
 */
export function newCardsFor(d: Pick<Deck, "commanders" | "cards" | "plan">, A: Analysis, Y: Synergy, cands: Iterable<Card>, E: EdhData | null, limit = 12): NewCard[] {
  if (!A.cmdMeta.length || !A.cmdMeta.every(Boolean)) return [];
  const inDeck = new Set([...d.cards.map(c => slug(c.n)), ...d.commanders.map(slug)]);
  const active = Y.themes.filter(t => t.state === "fuerte" || t.state === "a medias");
  const deficit = slotGoals(d.plan, d.commanders.length).filter(g => (SUPPORT as readonly string[]).includes(g.k) && supportCount(A, g.k) < g.lo).map(g => g.k as string);
  const tribe = new Set(Y.tribes.slice(0, 2).map(t => t.s));
  const pool = new Map((E ? E.pool : []).map(p => [slug(p.n), p]));
  const out: NewCard[] = []; const seen = new Set<string>();
  for (const m of cands) {
    const k = slug(m.n);
    if (!m.n || seen.has(k) || inDeck.has(k) || m.basic) continue;
    seen.add(k);
    if (!inIdentity(m, A.ci) || !legalIn(m, d.plan.format) || !bracketAllows(m, d.plan.bracket)) continue;
    const why: string[] = []; let score = 0;
    const th = active.filter(t => t.en.some(x => m.tg.includes(x)) || t.pay.some(x => m.tg.includes(x)));
    if (th.length) { score += 20 * th.length; why.push(`tema: ${th.map(t => t.es.toLowerCase()).join(", ")}`); }
    const fills = rolesOf(m).filter(r => deficit.includes(r));
    if (fills.length) { score += 15 * fills.length; why.push(`te falta ${fills.map(r => ROLE_ES[r as keyof typeof ROLE_ES] || r).join(", ")}`); }
    const tr = subtypesOf(m).filter(s => tribe.has(s));
    if (tr.length) { score += 12; why.push(`tribu: ${tr.map(cap).join(", ")}`); }
    if (!score) continue;
    const p = pool.get(k);
    if (p && p.incl != null) { score += p.incl * 60; why.push(`en ${Math.round(p.incl * 100)} % de las listas`); }
    if (m.gc) why.push("Game Changer");
    out.push({ n: m.n, m, score, why: why.join(" · ") });
  }
  return out.sort((a, b) => b.score - a.score || a.m.cmc - b.m.cmc || a.n.localeCompare(b.n)).slice(0, limit);
}

/* ---------- comandante para una lista ---------- */
export interface CmdSuggestion { n: string; m: Card; score: number; extra: string; why: string }
/** Para una lista sin comandante (o para cambiarlo): legendarias que cubren sus colores y comparten sus temas y tribus. */
export function commandersFor(cards: (Card | null)[], cands: Iterable<Card>, plan: Pick<Plan, "format">, limit = 8): CmdSuggestion[] {
  const known = cards.filter((m): m is Card => !!m && !m.basic);
  if (!known.length) return [];
  const ci = WUBRG.filter(c => known.some(m => m.ci.includes(c))).join("");
  // cuánto pesa cada etiqueta y cada tribu en la lista
  const tagW = new Map<string, number>(); const tribeW = new Map<string, number>();
  for (const m of known) { for (const t of new Set(m.tg)) tagW.set(t, (tagW.get(t) || 0) + 1); for (const s of subtypesOf(m)) tribeW.set(s, (tribeW.get(s) || 0) + 1); }
  const names = new Set(known.map(m => slug(m.n)));
  const out: CmdSuggestion[] = []; const seen = new Set<string>();
  for (const m of cands) {
    const k = slug(m.n);
    if (!m.n || seen.has(k) || names.has(k)) continue;
    seen.add(k);
    if (!canCommand(m) || !legalIn(m, plan.format)) continue;
    if ([...ci].some(c => !m.ci.includes(c))) continue;              // tiene que cubrir todos los colores de la lista
    const extra = [...m.ci].filter(c => (WUBRG as readonly string[]).includes(c) && !ci.includes(c)).join("");
    const shared = [...new Set(m.tg)].map(t => [t, tagW.get(t) || 0] as const).filter(([, w]) => w >= 3).sort((a, b) => b[1] - a[1]);
    const tribes = subtypesOf(m).map(s => [s, tribeW.get(s) || 0] as const).filter(([, w]) => w >= 4).sort((a, b) => b[1] - a[1]);
    let score = shared.reduce((a, [, w]) => a + Math.min(w, 15), 0) + tribes.reduce((a, [, w]) => a + w * 2, 0) - extra.length * 8;
    if (m.rank) score += Math.max(0, 20 - Math.log10(m.rank) * 5);
    if (score <= 0) continue;
    const why: string[] = [];
    if (tribes.length) why.push(`tribu ${cap(tribes[0][0])} (${tribes[0][1]} cartas)`);
    if (shared.length) why.push(`${shared.length} ${shared.length === 1 ? "etiqueta compartida" : "etiquetas compartidas"} con la lista`);
    if (extra) why.push(`agrega ${extra}`);
    out.push({ n: m.n, m, score, extra, why: why.join(" · ") || "cubre los colores de la lista" });
  }
  return out.sort((a, b) => b.score - a.score || a.extra.length - b.extra.length || a.n.localeCompare(b.n)).slice(0, limit);
}
/** Identidad de color de una lista (las cartas que no son básicas). */
export const listIdentity = (cards: (Card | null)[]): string => WUBRG.filter(c => cards.some(m => m && !m.basic && m.ci.includes(c))).join("");

/* ---------- mejorar un precon (o cualquier mazo) por tandas ---------- */
export interface Stage { k: "mana" | "roles" | "plan"; title: string; why: string; swaps: Swap[] }
/**
 * Ruta de mejora en tres tandas, para hacer de a pocos cambios y probar entre una y otra:
 * 1) base de maná (tierras que entran giradas), 2) funciones que faltan, 3) lo más jugado con tu comandante.
 * `landFor(name)` propone una tierra mejor para una que entra girada (viene de los reemplazos por rol).
 */
export function upgradePath(d: Pick<Deck, "commanders" | "cards" | "plan">, A: Analysis, E: EdhData, db: CardDb, landFor: (name: string) => string | null, perStage = 5): Stage[] {
  if (!A.cmdMeta.length || !A.cmdMeta.every(Boolean)) return [];
  const used = new Set<string>(); const take = (s: Swap) => { used.add(slug(s.out)); used.add(slug(s.in)); return s; };
  const fresh = (s: Swap) => !used.has(slug(s.out)) && !used.has(slug(s.in));
  // 1) base de maná
  const mana: Swap[] = [];
  for (const r of A.rows) {
    if (mana.length >= perStage) break;
    if (!r.m || r.m.t !== "Land" || r.m.basic || !r.m.tap) continue;
    const inn = landFor(r.n); if (!inn || used.has(slug(inn))) continue;
    mana.push(take({ out: r.n, in: inn, why: "entra girada; la nueva da los mismos colores y entra enderezada", fills: [] }));
  }
  // 2) y 3) a partir de los cambios sugeridos (EDHREC + funciones que faltan)
  const all = swaps(d, A, E, db, d.plan, 40);
  const roles = all.filter(s => s.fills.length && fresh(s)).slice(0, perStage).map(take);
  const plan = all.filter(s => !s.fills.length && fresh(s)).slice(0, perStage).map(take);
  return [
    { k: "mana" as const, title: "Base de maná", why: "Tierras que entran giradas por otras que dan los mismos colores sin perder el turno.", swaps: mana },
    { k: "roles" as const, title: "Funciones que faltan", why: "Ramp, robo, removal o protección que el plan pide y la lista no tiene.", swaps: roles },
    { k: "plan" as const, title: "Lo más jugado con tu comandante", why: "Cartas muy usadas en EDHREC por cartas poco jugadas que no cumplen una función.", swaps: plan },
  ].filter(s => s.swaps.length);
}

/* ---------- mazos de MTGJSON (precons) ---------- */
interface MjDeckCard { name?: string; count?: number }
export interface MjDeck { name: string; commanders: string[]; cards: Entry[]; maybe: Entry[] }
/** Lee un mazo de MTGJSON (AllDeckFiles o la página del mazo): { data: { name, commander[], mainBoard[], sideBoard[] } }. */
export function readMtgjsonDeck(text: string): MjDeck | null {
  let j: unknown; try { j = JSON.parse(text); } catch { return null; }
  const o = (j && typeof j === "object" && "data" in (j as object) ? (j as { data: unknown }).data : j) as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || !Array.isArray(o.mainBoard)) return null;
  const list = (a: unknown): Entry[] => (Array.isArray(a) ? a : []).filter((c: MjDeckCard) => c && typeof c.name === "string" && c.name)
    .map((c: MjDeckCard) => ({ n: String(c.name).slice(0, 150), q: Math.max(1, Math.min(99, Math.round(Number(c.count) || 1))) }));
  const commanders = list(o.commander).map(c => c.n).slice(0, 2);
  const cmd = new Set(commanders.map(slug));
  return { name: String(o.name || "Mazo de MTGJSON").slice(0, 80), commanders, cards: list(o.mainBoard).filter(c => !cmd.has(slug(c.n))), maybe: list(o.sideBoard) };
}
