// Fuentes externas: Scryfall (cartas), EDHREC (qué se juega con cada comandante),
// Commander Spellbook (combos), EDHTop16 (torneos cEDH) y listas de Moxfield o Archidekt.
// Aquí solo se piden y se ordenan los datos; nada de pantalla ni de almacenamiento.
import type { Combo, Combos, EdhData, EdhPoolCard, Entry } from "../engine/types.ts";
import type { ScryCard } from "../engine/cards.ts";
import { edhSlug, sleep, slug } from "../engine/util.ts";

/** Sitios que no dejan consultarse desde otra página: en el sitio publicado pasan por el puente propio (/api/proxy). */
const PROXY_HOSTS = new Set(["json.edhrec.com", "backend.commanderspellbook.com", "edhtop16.com", "api2.moxfield.com", "archidekt.com"]);
const onSite = (): boolean => /(^|\.)netlify\.app$/i.test(location.hostname || "");
let proxyDown = false;

export class NetError extends Error {
  site: string;
  constructor(site: string, msg?: string) { super(msg || `No se pudo conectar con ${site}.`); this.site = site; }
}

async function bridge(url: string, init?: RequestInit): Promise<Response> {
  const u = new URL(url);
  if (onSite() && !proxyDown && PROXY_HOSTS.has(u.hostname)) {
    try {
      const r = await fetch("/api/proxy?url=" + encodeURIComponent(url), init);
      // 404: el puente no está publicado; 403: no conoce ese sitio. En ambos casos se intenta directo.
      if (r.status !== 404 && r.status !== 403) return r;
      if (r.status === 404) proxyDown = true;
    } catch { /* se intenta directo */ }
  }
  return fetch(url, init);
}
const JSON_POST = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });

/* ---------- Scryfall ---------- */
let lastCall = 0;
async function sf(url: string, body?: unknown, tries = 0): Promise<Response> {
  const wait = Math.max(0, lastCall + 120 - Date.now()); if (wait) await sleep(wait); lastCall = Date.now();
  const r = await fetch(url, body ? JSON_POST(body) : { headers: { Accept: "application/json" } });
  if (r.status === 429 && tries < 3) { await sleep(1500); return sf(url, body, tries + 1); }
  return r;
}
/** Nombre limpio para Scryfall: sin código de edición, número ni marcas de foil. */
export const cleanCardName = (n: string): string => String(n || "").replace(/[‘’]/g, "'").replace(/\s*\*[A-Z]+\*\s*$/i, "").replace(/\s*\([A-Za-z0-9]{2,6}\)\s*[\w-]*\s*$/, "").replace(/\s+/g, " ").trim();

export interface FetchedCards { found: { card: ScryCard; asked: string }[]; notFound: string[]; offline: boolean; down: boolean }
export async function fetchCards(names: string[], onStep?: (done: number, total: number) => void): Promise<FetchedCards> {
  const todo = [...new Map(names.filter(Boolean).map(n => [slug(n), String(n).trim()])).values()];
  const out: FetchedCards = { found: [], notFound: [], offline: false, down: false };
  const pending: string[] = [];
  // un lote rechazado se divide: una carta con nombre raro no deja sin datos a las otras 74
  const batch = async (chunk: string[]): Promise<void> => {
    let r: Response;
    try { r = await sf("https://api.scryfall.com/cards/collection", { identifiers: chunk.map(n => ({ name: cleanCardName(n).split(" // ")[0] })) }); }
    catch { out.offline = true; pending.push(...chunk); return; }
    // 429 o 5xx: Scryfall no está respondiendo. No tiene sentido dividir el lote ni culpar a los nombres.
    if (r.status === 429 || r.status >= 500) { out.down = true; pending.push(...chunk); return; }
    if (!r.ok) {
      if (chunk.length > 1) { const h = Math.ceil(chunk.length / 2); await batch(chunk.slice(0, h)); if (!out.offline && !out.down) await batch(chunk.slice(h)); }
      else out.notFound.push(chunk[0]);
      return;
    }
    const j = await r.json() as { data?: ScryCard[]; not_found?: { name?: string }[] };
    const byClean = new Map(chunk.map(n => [slug(cleanCardName(n).split(" // ")[0]), n]));
    for (const c of j.data || []) out.found.push({ card: c, asked: byClean.get(slug(c.name.split(" // ")[0])) || c.name });
    for (const nf of j.not_found || []) if (nf.name) out.notFound.push(byClean.get(slug(nf.name)) || nf.name);
  };
  let done = 0;
  for (let i = 0; i < todo.length && !out.offline && !out.down; i += 75) {
    const chunk = todo.slice(i, i + 75); await batch(chunk); done += chunk.length; if (onStep) onStep(done, todo.length);
  }
  // segunda oportunidad para las que no calzaron exacto: búsqueda aproximada, una por una
  const retry = out.notFound.splice(0, 40); const still: string[] = [...out.notFound];
  for (const n of retry) {
    if (out.offline || out.down) { pending.push(n); continue; }
    try {
      const r = await sf("https://api.scryfall.com/cards/named?fuzzy=" + encodeURIComponent(cleanCardName(n).split(" // ")[0]));
      if (r.ok) out.found.push({ card: await r.json() as ScryCard, asked: n });
      else if (r.status === 429 || r.status >= 500) { out.down = true; pending.push(n); }
      else still.push(n);
    } catch { out.offline = true; pending.push(n); }
  }
  // "no reconocidas" son solo las que Scryfall rechazó de verdad; las que quedaron sin consultar se reintentan después
  out.notFound = still;
  return out;
}

export async function autocomplete(q: string): Promise<string[]> {
  if (q.trim().length < 2) return [];
  try { const r = await sf("https://api.scryfall.com/cards/autocomplete?q=" + encodeURIComponent(q.trim())); if (!r.ok) return []; return ((await r.json()) as { data?: string[] }).data || []; }
  catch { return []; }
}

/** Busca comandantes por nombre, ordenados por popularidad. */
export async function searchCommanders(q: string): Promise<ScryCard[]> {
  if (q.trim().length < 2) return [];
  try {
    const r = await sf("https://api.scryfall.com/cards/search?unique=cards&order=edhrec&q=" + encodeURIComponent(`${q.trim()} is:commander legal:commander`));
    if (r.status === 404) return [];
    if (!r.ok) throw new NetError("Scryfall");
    return (((await r.json()) as { data?: ScryCard[] }).data || []).slice(0, 12);
  } catch (e) { if (e instanceof NetError) throw e; throw new NetError("Scryfall"); }
}

/** Lista oficial de Game Changers, según Scryfall. */
export async function gameChangers(): Promise<ScryCard[]> {
  let url: string | null = "https://api.scryfall.com/cards/search?q=" + encodeURIComponent("is:gamechanger") + "&unique=cards"; const list: ScryCard[] = [];
  while (url) {
    const r = await sf(url); if (!r.ok) throw new NetError("Scryfall");
    const j = await r.json() as { data?: ScryCard[]; has_more?: boolean; next_page?: string };
    list.push(...(j.data || [])); url = j.has_more && j.next_page ? j.next_page : null;
  }
  return list;
}

/* ---------- EDHREC ---------- */
interface EdhJson { num_decks_avg?: number; container?: { json_dict?: { card?: { num_decks?: number }; cardlists?: { cardviews?: { name: string; potential_decks?: number; num_decks?: number; inclusion?: number; synergy?: number }[] }[] } }; panels?: { taglinks?: { value: string; count: number; slug: string }[] } }
function poolOf(j: EdhJson): EdhPoolCard[] {
  const pool = new Map<string, EdhPoolCard>();
  for (const l of (j.container && j.container.json_dict && j.container.json_dict.cardlists) || []) for (const v of l.cardviews || []) {
    const pot = v.potential_decks || 0; const incl = pot ? (v.num_decks != null ? v.num_decks : (v.inclusion || 0)) / pot : null;
    const rec: EdhPoolCard = { n: v.name, incl, syn: v.synergy != null ? v.synergy : null };
    const p = pool.get(slug(v.name)); if (!p || (rec.incl || 0) > (p.incl || 0)) pool.set(slug(v.name), rec);
  }
  return [...pool.values()];
}
export const edhKey = (commanders: string[]): string => commanders.map(edhSlug).join("-");

export async function edhrec(commanders: string[]): Promise<EdhData> {
  const key = edhKey(commanders);
  const tries = commanders.length > 1 ? [key, [...commanders].reverse().map(edhSlug).join("-")] : [key];
  let j: EdhJson | null = null, used = "";
  try { for (const s of tries) { const r = await bridge(`https://json.edhrec.com/pages/commanders/${s}.json`); if (r.ok) { j = await r.json() as EdhJson; used = s; break; } } }
  catch { throw new NetError("EDHREC"); }
  if (!j) throw new NetError("EDHREC", `EDHREC no tiene una página para “${commanders.join(" + ")}”.`);
  const jd = (j.container && j.container.json_dict) || {};
  const themes = ((j.panels && j.panels.taglinks) || []).map(t => ({ v: t.value, c: t.count, s: t.slug })).slice(0, 14);
  return { at: Date.now(), slug: used, decks: j.num_decks_avg || (jd.card && jd.card.num_decks) || null, themes, pool: poolOf(j) };
}

/** Página de un tema del comandante en EDHREC (por ejemplo, fichas o contadores): otra lista de cartas para esa estrategia. */
export async function edhrecTheme(E: EdhData, theme: string): Promise<EdhData | null> {
  const t = E.themes.find(x => slug(x.v) === slug(theme) || slug(x.s || "") === slug(theme)) || E.themes.find(x => slug(x.v).includes(slug(theme)) || slug(theme).includes(slug(x.v)));
  if (!t || !t.s) return null;
  try {
    const r = await bridge(`https://json.edhrec.com/pages/commanders/${E.slug}/${t.s.split("/").pop()}.json`); if (!r.ok) return null;
    return { at: Date.now(), slug: E.slug, decks: E.decks, themes: E.themes, theme: t.v, pool: poolOf(await r.json() as EdhJson) };
  } catch { return null; }
}

/* ---------- Commander Spellbook ---------- */
interface SbVariant { id: string; uses?: { card?: { name?: string } | string }[]; produces?: { feature?: { name?: string }; name?: string }[]; description?: string; bracketTag?: string }
export async function findCombos(commanders: string[], cards: Entry[]): Promise<Combos> {
  let r: Response;
  try { r = await bridge("https://backend.commanderspellbook.com/find-my-combos", JSON_POST({ commanders: commanders.map(n => ({ card: n, quantity: 1 })), main: cards.map(c => ({ card: c.n, quantity: c.q })) })); }
  catch { throw new NetError("Commander Spellbook"); }
  if (!r.ok) throw new NetError("Commander Spellbook");
  const j = await r.json() as { results?: { included?: SbVariant[]; almostIncluded?: SbVariant[] }; included?: SbVariant[]; almostIncluded?: SbVariant[] };
  const res = j.results || j;
  const norm = (v: SbVariant): Combo => ({
    id: String(v.id), cards: (v.uses || []).map(u => typeof u.card === "string" ? u.card : (u.card && u.card.name) || "").filter(x => !!x),
    prod: (v.produces || []).map(p => (p.feature && p.feature.name) || p.name || "").filter(Boolean), desc: String(v.description || "").slice(0, 900), bt: v.bracketTag || null,
  });
  return { at: Date.now(), inc: (res.included || []).map(norm).slice(0, 60), almost: (res.almostIncluded || []).map(norm).slice(0, 60) };
}

/* ---------- EDHTop16 (torneos cEDH) ---------- */
export interface CedhRow { name: string; share: number | null; count: number | null; conv: number | null; tops: number | null; colors: string }
export async function cedhTop(): Promise<CedhRow[]> {
  const q = `query { commanders(first: 40, sortBy: POPULARITY, timePeriod: THREE_MONTHS) { edges { node { name colorId stats(filters: {timePeriod: THREE_MONTHS}) { count metaShare conversionRate topCuts } } } } }`;
  let j: { data?: { commanders?: { edges?: { node: { name: string; colorId?: string; stats?: { count?: number; metaShare?: number; conversionRate?: number; topCuts?: number } } }[] } }; errors?: { message?: string }[] };
  try { const r = await bridge("https://edhtop16.com/api/graphql", JSON_POST({ query: q })); j = await r.json(); }
  catch { throw new NetError("EDHTop16"); }
  const edges = j && j.data && j.data.commanders && j.data.commanders.edges;
  if (!edges || !edges.length) throw new NetError("EDHTop16");
  const pct = (v: number | undefined): number | null => v == null ? null : (v <= 1 ? v * 100 : v);
  return edges.map(e => { const s = e.node.stats || {}; return { name: e.node.name, share: pct(s.metaShare), count: s.count ?? null, conv: pct(s.conversionRate), tops: s.topCuts ?? null, colors: e.node.colorId || "" }; });
}

/** Cartas más jugadas con un comandante en torneos. El esquema de EDHTop16 ha cambiado varias veces: se prueban tres formas. */
export async function cedhStaples(commanders: string[]): Promise<string[]> {
  const name = commanders.join(" / "); if (!name) return [];
  const queries = [
    `query($name:String!){ commander(name:$name){ name staples(first:60){ edges{ node{ name } } } } }`,
    `query($name:String!){ commander(name:$name){ name staples{ name } } }`,
    `query($name:String!){ commander(name:$name){ name cardWinRateStats(first:60){ edges{ node{ card{ name } } } } } }`,
  ];
  const names: string[] = [];
  const walk = (o: unknown, depth = 0): void => {
    if (!o || depth > 8) return;
    if (Array.isArray(o)) { o.forEach(x => walk(x, depth + 1)); return; }
    if (typeof o === "object") { const r = o as Record<string, unknown>; if (typeof r.name === "string" && depth > 2) names.push(r.name); for (const v of Object.values(r)) if (v && typeof v === "object") walk(v, depth + 1); }
  };
  try {
    for (const q of queries) {
      const r = await bridge("https://edhtop16.com/api/graphql", JSON_POST({ query: q, variables: { name } }));
      if (!r.ok) continue; const j = await r.json() as { data?: { commander?: unknown } }; if (!j.data || !j.data.commander) continue;
      walk(j.data.commander); if (names.length) break;
    }
  } catch { throw new NetError("EDHTop16"); }
  return [...new Set(names)].filter(n => !commanders.some(c => slug(c) === slug(n))).slice(0, 60);
}

/* ---------- Importar por enlace ---------- */
export interface Imported { name: string; commanders: string[]; cards: Entry[]; maybe: Entry[] }
export const LINK_SITES = "Moxfield o Archidekt";
export async function importLink(url: string): Promise<Imported> {
  const mox = url.match(/moxfield\.com\/decks\/([\w-]+)/i), arch = url.match(/archidekt\.com\/(?:api\/)?decks\/(\d+)/i);
  const get = async (u: string, site: string): Promise<unknown> => {
    let r: Response; try { r = await bridge(u, { headers: { Accept: "application/json" } }); } catch { throw new NetError(site, `${site} no dejó leer el mazo desde aquí. Copia la lista como texto y pégala.`); }
    if (!r.ok) throw new NetError(site, r.status === 404 ? `${site} no encontró ese mazo. Revisa que sea público.` : `${site} respondió con un error (${r.status}). Copia la lista como texto y pégala.`);
    return r.json();
  };
  if (mox) {
    interface MoxBoard { cards?: Record<string, { quantity?: number; card?: { name?: string } }> }
    const j = await get(`https://api2.moxfield.com/v3/decks/all/${mox[1]}`, "Moxfield") as { name?: string; boards?: Record<string, MoxBoard> };
    const board = (b: MoxBoard | undefined): Entry[] => !b ? [] : Object.values(b.cards || {}).map(x => ({ n: (x.card && x.card.name) || "", q: x.quantity || 1 })).filter(c => c.n);
    const B = j.boards || {};
    return { name: j.name || "Mazo de Moxfield", commanders: board(B.commanders).map(c => c.n), cards: board(B.mainboard), maybe: [...board(B.sideboard), ...board(B.maybeboard)] };
  }
  if (arch) {
    const j = await get(`https://archidekt.com/api/decks/${arch[1]}/`, "Archidekt") as { name?: string; categories?: { name: string; includedInDeck?: boolean }[]; cards?: { quantity?: number; categories?: string[]; card?: { name?: string; oracleCard?: { name?: string } } }[] };
    const cards: Entry[] = [], maybe: Entry[] = [], commanders: string[] = [];
    const cats = new Map((j.categories || []).map(c => [c.name, c.includedInDeck !== false]));
    for (const c of j.cards || []) {
      const n = (c.card && c.card.oracleCard && c.card.oracleCard.name) || (c.card && c.card.name) || ""; if (!n) continue;
      const q = c.quantity || 1; const cs = (c.categories || []).map(String);
      if (cs.some(x => /commander/i.test(x))) commanders.push(n);
      else if (cs.some(x => /side|maybe/i.test(x)) || cs.some(x => cats.get(x) === false)) maybe.push({ n, q });
      else cards.push({ n, q });
    }
    return { name: j.name || "Mazo de Archidekt", commanders, cards, maybe };
  }
  throw new NetError("el enlace", `Ese enlace no es de ${LINK_SITES}. Copia la lista como texto y pégala.`);
}
