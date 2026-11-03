// Prioridades 2 de MTGJSON: reemplazos por rol, medidor de "sal" y cartas de dos caras con reverso de tierra.
import type { Card, Deck, EdhData, Plan, Role } from "./types.ts";
import type { Analysis } from "./analyze.ts";
import { legalIn } from "./cards.ts";
import { bracketAllows, gcLimit, inIdentity } from "./build.ts";
import { isCounter } from "./slots.ts";
import { ROLE_ES, slug } from "./util.ts";

export interface Replacement { n: string; m: Card; score: number; why: string; gc: boolean }

const rolesOf = (m: Card): string[] => [...new Set([...(m.r as string[]), ...(isCounter(m) ? ["removal"] : [])])];
const fmtDelta = (d: number): string => d < 0 ? `${-d} menos de coste` : d > 0 ? `${d} más de coste` : "mismo coste";

/**
 * Cartas que cumplen la misma función que `name`, dentro de los colores, el formato y el bracket del mazo.
 * Prioriza lo que más se juega con el comandante (EDHREC) y luego lo más barato. Con `lowerSalt`, solo propone
 * cartas menos molestas para la mesa que la original.
 */
export function replacementsFor(
  name: string, d: Pick<Deck, "commanders" | "cards">, A: Analysis, plan: Plan, candidates: Iterable<Card>, E: EdhData | null,
  opts: { limit?: number; lowerSalt?: boolean } = {},
): Replacement[] {
  const limit = opts.limit ?? 8;
  const row = A.rows.find(r => slug(r.n) === slug(name)); const m0 = row && row.m;
  if (!m0 || m0.basic || !A.cmdMeta.length || !A.cmdMeta.every(Boolean)) return [];
  const inDeck = new Set([...d.cards.map(c => slug(c.n)), ...d.commanders.map(slug)]);
  const pool = new Map((E ? E.pool : []).map(p => [slug(p.n), p]));
  const want = rolesOf(m0); const tags = new Set(m0.tg);
  const isLand = m0.t === "Land";
  const cols = (m0.pm || []).filter(c => "WUBRG".includes(c));
  const gcLeft = gcLimit(plan.bracket) - A.gc.length + (m0.gc ? 1 : 0);
  const salt0 = m0.salt ?? null;
  const out: Replacement[] = []; const seen = new Set<string>();
  for (const m of candidates) {
    const k = slug(m.n);
    if (!m.n || seen.has(k) || inDeck.has(k) || m.basic) continue;
    seen.add(k);
    if ((m.t === "Land") !== isLand) continue;
    if (!inIdentity(m, A.ci) || !legalIn(m, plan.format) || !bracketAllows(m, plan.bracket)) continue;
    if (m.gc && gcLeft <= 0) continue;
    if (opts.lowerSalt && (salt0 == null || m.salt == null || m.salt >= salt0)) continue;
    const why: string[] = []; let score = 0;
    if (isLand) {
      // tierras: que den los mismos colores, mejor si entran enderezadas
      const give = (m.pm || []).filter(c => "WUBRG".includes(c) && A.ci.includes(c));
      const covers = cols.filter(c => give.includes(c)).length;
      if (cols.length && !covers) continue;
      score += covers * 12 + (give.length > cols.length ? 6 : 0) + (m.tap ? -8 : 6);
      why.push(give.length ? `da ${give.join("")}` : "tierra utilitaria"); if (!m.tap) why.push("entra enderezada");
    } else {
      const shared = want.filter(r => rolesOf(m).includes(r));
      const sharedTags = m.tg.filter(t => tags.has(t)).length;
      if (want.length ? !shared.length : !sharedTags) continue;
      score += shared.length * 15 + Math.min(4, sharedTags) * 4;
      if (shared.length) why.push(`mismo rol: ${shared.map(r => ROLE_ES[r as Role] || r).join(", ")}`);
      else why.push("mismo tema");
      const dc = Math.round(m.cmc - m0.cmc); score += dc < 0 ? -dc * 4 : -dc * 6; why.push(fmtDelta(dc));
    }
    const p = pool.get(k);
    if (p && p.incl != null) { score += p.incl * 100; why.push(`en ${Math.round(p.incl * 100)} % de las listas`); }
    else if (m.rank) { score += Math.max(0, 30 - Math.log10(m.rank) * 8); if (m.rank <= 2000) why.push(`puesto ${m.rank.toLocaleString("es-CL")} en EDHREC`); }
    if (m.salt != null && salt0 != null && m.salt < salt0) { score += (salt0 - m.salt) * (opts.lowerSalt ? 20 : 4); if (opts.lowerSalt) why.push(`sal ${m.salt.toFixed(1).replace(".", ",")}`); }
    if (m.gc) why.push("Game Changer");
    out.push({ n: m.n, m, score, why: why.join(" · "), gc: m.gc });
  }
  return out.sort((a, b) => b.score - a.score || a.m.cmc - b.m.cmc || a.n.localeCompare(b.n)).slice(0, limit);
}

export interface SaltReport {
  known: number;               // cartas con dato de sal
  total: number;               // cartas que no son tierras básicas (con comandantes)
  avg: number | null;          // promedio de las cartas con dato
  sum: number;
  level: "baja" | "media" | "alta" | null;
  top: { n: string; salt: number }[];
}
/** "Sal" del mazo según EDHREC: orientación para la mesa casual, no una regla. */
export function saltOf(A: Analysis): SaltReport {
  const cards = [...A.cmdMeta.filter((m): m is Card => !!m).map(m => ({ n: m.n, m })), ...A.rows.filter(r => r.m && !r.m.basic).map(r => ({ n: r.n, m: r.m as Card }))];
  const withSalt = cards.filter(x => typeof x.m.salt === "number");
  const sum = withSalt.reduce((a, x) => a + (x.m.salt as number), 0);
  const avg = withSalt.length ? sum / withSalt.length : null;
  const level = avg == null ? null : avg < 0.55 ? "baja" : avg < 0.9 ? "media" : "alta";
  const top = withSalt.map(x => ({ n: x.n, salt: x.m.salt as number })).filter(x => x.salt >= 1).sort((a, b) => b.salt - a.salt).slice(0, 8);
  return { known: withSalt.length, total: cards.length, avg, sum: Math.round(sum * 100) / 100, level, top };
}

/** Cartas de dos caras con reverso de tierra: cuentan como hechizo, pero también pueden jugarse como tierra. */
export const landBacks = (A: Analysis): string[] => A.rows.filter(r => r.m && r.m.bk).map(r => r.n);
