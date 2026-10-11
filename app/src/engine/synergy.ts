// Sinergias: qué temas tiene el mazo, cuáles están completos y qué cartas no conectan con nada.
import type { Card, CardDb, EdhData, Row } from "./types.ts";
import type { Analysis } from "./analyze.ts";
import { THEMES, subtypesOf, type Theme } from "./tags.ts";
import { WUBRG, slug } from "./util.ts";

export type ThemeState = "fuerte" | "a medias" | "débil" | "ausente";
export interface ThemeResult extends Theme {
  enR: Row[]; payR: Row[];      // cartas que habilitan y que aprovechan
  E: number; P: number;         // cuántas de cada lado
  me: number; mp: number;       // mínimos razonables
  score: number; state: ThemeState;
  cmd: boolean;                 // el comandante participa del tema
  need: "en" | "pay" | null;    // qué lado falta reforzar
}
export interface Tribe { s: string; n: number; pay: Row[] }
export interface Synergy {
  themes: ThemeResult[]; tribes: Tribe[];
  lonely: Row[];                              // cartas sueltas: no conectan con ningún tema ni cumplen un rol básico
  links: Map<string, { n: number; why: string[] }>;
  noTags: number;
  cohesion: number;                           // % de hechizos conectados con algún tema activo
}

const hasTag = (r: Row, k: string) => !!r.m && (r.m.tg || []).includes(k);
const enOf = (r: Row, th: Theme) => th.en.some(k => hasTag(r, k)) || (th.enType || []).includes(r.m!.t) || (!!th.enRole && (r.m!.r as string[] || []).includes(th.enRole));
const payOf = (r: Row, th: Theme) => th.pay.some(k => hasTag(r, k));

export function synergyOf(A: Analysis): Synergy {
  const rows: Row[] = [...A.rows, ...A.cmdMeta.filter((m): m is Card => !!m).map(m => ({ n: m.n, q: 1, m, cmd: true }))].filter(r => r.m && !r.m.basic);
  const noTags = rows.filter(r => !Array.isArray(r.m!.tg)).length;
  const themes: ThemeResult[] = THEMES.map(th => {
    const en = rows.filter(r => enOf(r, th)), pay = rows.filter(r => payOf(r, th));
    const E = en.reduce((a, r) => a + r.q, 0), P = pay.reduce((a, r) => a + r.q, 0);
    const cmd = rows.some(r => r.cmd && (enOf(r, th) || payOf(r, th)));
    const [me, mp] = th.min.map(x => Math.max(1, Math.round(x)));
    const score = Math.round(100 * Math.min(1, Math.sqrt((E / me) * (P / mp)) / 1.4));
    const state: ThemeState = E >= me && P >= mp ? "fuerte" : E >= me * 0.5 && P >= Math.max(1, mp * 0.5) ? "a medias" : P > 0 && E > 0 ? "débil" : "ausente";
    const need: "en" | "pay" | null = E < me ? "en" : P < mp ? "pay" : null;
    return { ...th, enR: en, payR: pay, E, P, me, mp, score, state, cmd, need };
  }).filter(t => t.E + t.P > 0).sort((a, b) => (Number(b.cmd) - Number(a.cmd)) || b.score - a.score);
  // tribal
  const tribeCount = new Map<string, number>(); for (const r of rows) for (const s of subtypesOf(r.m)) tribeCount.set(s, (tribeCount.get(s) || 0) + r.q);
  const tribePay = rows.filter(r => (r.m!.tg || []).some(k => k.startsWith("tribe:")));
  const tribes: Tribe[] = [...tribeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, n]) => ({ s, n, pay: tribePay.filter(r => r.m!.tg.includes("tribe:" + s) || r.m!.tg.includes("tribe:*")) })).filter(t => t.n >= 5 || t.pay.length);
  // cartas sin interacción con ningún tema activo (candidatas a salir)
  const active = themes.filter(t => t.state !== "ausente" && t.score >= 35);
  const links = new Map<string, { n: number; why: string[] }>();
  for (const r of rows) {
    let n = 0; const why: string[] = [];
    for (const th of active) {
      if (enOf(r, th) && th.P > 0) { n += th.P - (payOf(r, th) ? r.q : 0); why.push(th.es); }
      else if (payOf(r, th) && th.E > 0) { n += th.E - (enOf(r, th) ? r.q : 0); why.push(th.es); }
    }
    for (const t of tribes) if (subtypesOf(r.m).includes(t.s) && t.pay.length) { n += t.pay.length; why.push("tribu " + t.s); }
    links.set(r.n, { n, why: [...new Set(why)] });
  }
  const staple = (r: Row) => (r.m!.r || []).some(x => ["ramp", "draw", "removal", "wipe", "protection", "tutor"].includes(x)) || r.m!.t === "Land";
  const linkN = (r: Row) => (links.get(r.n) || { n: 0 }).n;
  const lonely = rows.filter(r => !r.cmd && !staple(r) && linkN(r) === 0);
  const total = rows.filter(r => !r.cmd && r.m!.t !== "Land").length || 1;
  const linked = rows.filter(r => !r.cmd && r.m!.t !== "Land" && linkN(r) > 0).length;
  return { themes, tribes, lonely, links, noTags, cohesion: Math.round(100 * linked / total) };
}

export interface SynergyAdd { n: string; m: Card; incl: number; both: boolean; s: number }
/** Cartas conocidas (EDHREC o caché) que refuerzan el lado débil de un tema. */
export function synergyAdds(d: { commanders: string[] }, A: Analysis, th: ThemeResult, db: CardDb, E: EdhData | null, limit = 8): SynergyAdd[] {
  const want = th.need === "en" ? th.en : th.pay;
  const inDeck = new Set([...A.rows.map(r => slug(r.n)), ...(d.commanders || []).map(slug)]);
  const edhIncl = new Map(((E && E.pool) || []).map(c => [slug(c.n), c.incl || 0]));
  const inCI = (m: Card) => !(m.ci || "").split("").some(c => (WUBRG as readonly string[]).includes(c) && !A.ci.includes(c));
  const out: SynergyAdd[] = []; const seen = new Set<string>();
  for (const m of db.all()) {
    const k = slug(m.n);
    if (!m.n || seen.has(k) || inDeck.has(k) || m.t === "Land" || (m.legal && m.legal !== "legal") || !inCI(m)) continue;
    seen.add(k);
    const tg = m.tg || []; if (!want.some(w => tg.includes(w)) && !(th.need === "en" && (th.enType || []).includes(m.t))) continue;
    const both = th.en.some(w => tg.includes(w)) && th.pay.some(w => tg.includes(w));
    const incl = edhIncl.get(k) || 0;
    out.push({ n: m.n, m, incl, both, s: incl * 4 + (both ? 1.5 : 0) + (m.rank ? Math.max(0, 1 - m.rank / 20000) : 0) });
  }
  return out.sort((a, b) => b.s - a.s).slice(0, limit);
}

export interface ComboEngine { outlets: number; drains: number; fodder: number; loops: number }
/** Motor de sacrificio que cierra partidas sin depender de un combo catalogado: salida + drenajes por muerte + cuerpos. */
export function comboEngine(rows: Row[]): ComboEngine {
  const has = (m: Card, k: string) => (m.tg || []).includes(k) || (m.rf || []).includes(k);
  const q = (f: (m: Card) => boolean) => rows.filter(r => r.m && f(r.m)).reduce((a, r) => a + r.q, 0);
  const outlets = q(m => has(m, "sacOutlet") && m.t !== "Land");
  const drains = q(m => has(m, "deathDrain"));
  const fodder = q(m => has(m, "sacFodder") || (has(m, "minusPay") && has(m, "token")) || (has(m, "token") && has(m, "dies")));
  const loops = outlets >= 2 && drains >= 2 && fodder >= 3 ? Math.min(4, Math.floor(Math.min(outlets, drains, fodder / 2))) : 0;
  return { outlets, drains, fodder, loops };
}
