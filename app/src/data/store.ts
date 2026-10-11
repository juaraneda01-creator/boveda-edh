// Estado de la app y acciones. Las pantallas leen de aquí y piden cambios aquí;
// cada cambio se guarda en su tabla y avisa a las pantallas para que se redibujen.
import {
  MemoryDb, GC_FALLBACK, RF_V, MAX_QTY, MAX_ENTRIES, analyze, synergyOf, simulateHands, fromScry, slug, uid, diffLists, completeDeck, allNames,
  type Analysis, type Card, type Combo, type Combos, type Deck, type EdhData, type Entry, type Game, type HandStats, type Plan, type Synergy, type Version, type SimResult,
} from "../engine/index.ts";
import * as idb from "./idb.ts";
import * as net from "./net.ts";
import { relayProblem } from "./relay.ts";

export interface Settings { welcomed: boolean; lastBackup: number }
export interface Busy { label: string; done: number; total: number }
export interface Toast { msg: string; kind: "ok" | "warn"; at: number }
export interface SavedSim extends SimResult { rivals: string[] }

export const S = {
  ready: false,
  decks: [] as Deck[],
  versions: [] as Version[],
  games: [] as Game[],
  db: new MemoryDb(new Map(), GC_FALLBACK),
  gcAt: 0,                                           // cuándo se actualizó la lista de Game Changers (0 = lista incluida en la app)
  edh: new Map<string, EdhData>(),
  staples: new Map<string, { at: number; list: string[] }>(),
  sims: new Map<string, SavedSim>(),
  cedh: null as { at: number; rows: net.CedhRow[] } | null,
  settings: { welcomed: false, lastBackup: 0 } as Settings,
  busy: null as Busy | null,
  toast: null as Toast | null,
  epoch: 0,                                          // sube cuando cambian los datos de cartas: invalida los análisis guardados
  storageError: "",
};

/* ---------- aviso a las pantallas ---------- */
const subs = new Set<() => void>();
export const subscribe = (f: () => void): (() => void) => { subs.add(f); return () => { subs.delete(f); }; };
export function touch(): void { for (const f of [...subs]) f(); }

let toastT: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, kind: "ok" | "warn" = "ok"): void {
  S.toast = { msg, kind, at: Date.now() }; clearTimeout(toastT);
  toastT = setTimeout(() => { S.toast = null; touch(); }, kind === "warn" ? 7000 : 4200);
  touch();
}
function setBusy(label: string, total = 1): Busy { const b = { label, done: 0, total }; S.busy = b; touch(); return b; }
function endBusy(b: Busy): void { if (S.busy === b) { S.busy = null; touch(); } }

async function save(store: idb.StoreName, ...values: unknown[]): Promise<void> {
  try { await idb.put(store, ...values); if (S.storageError) { S.storageError = ""; touch(); } }
  catch { S.storageError = "El navegador no dejó guardar el último cambio. Descarga un respaldo desde Ajustes para no perder tu trabajo."; touch(); }
}

/* ---------- arranque ---------- */
export async function init(): Promise<void> {
  const [decks, versions, games, cards, kv] = await Promise.all([
    idb.getAll<Deck>("decks"), idb.getAll<Version>("versions"), idb.getAll<Game>("games"),
    idb.getAll<{ k: string; card: Card }>("cards"), idb.getAll<{ k: string; v: unknown }>("kv"),
  ]);
  S.decks = decks.map(cleanDeck).sort((a, b) => b.updated - a.updated);
  S.versions = versions.map(cleanVersion).filter((v): v is Version => !!v); S.games = games.map(cleanGame).filter((g): g is Game => !!g);
  for (const r of cards) { const c = r && cleanCard(r.card); if (c) S.db.cards.set(String(r.k), c); }
  for (const r of kv) {
    if (r.k === "settings") S.settings = { ...S.settings, ...(r.v as Partial<Settings>) };
    else if (r.k === "gc") { const g = r.v as { at: number; list: string[] }; if (g && Array.isArray(g.list) && g.list.length > 20) { S.db.setGC(g.list); S.gcAt = g.at; } }
    else if (r.k === "cedh") S.cedh = r.v as typeof S.cedh;
    else if (r.k.startsWith("edh:")) S.edh.set(r.k.slice(4), r.v as EdhData);
    else if (r.k.startsWith("staples:")) S.staples.set(r.k.slice(8), r.v as { at: number; list: string[] });
    else if (r.k.startsWith("sim:")) S.sims.set(r.k.slice(4), r.v as SavedSim);
  }
  S.ready = true; S.epoch++; touch();
  void idb.persist();
}

/* ---------- limpieza de lo que entra (respaldos, datos guardados): nada mal formado llega a las pantallas ---------- */
const str = (v: unknown, max: number): string => String(v == null ? "" : v).slice(0, max);
const strs = (v: unknown, n: number, max: number): string[] => (Array.isArray(v) ? v : []).filter(x => typeof x === "string" && x).slice(0, n).map(x => str(x, max));
/** Los identificadores viajan en la dirección de la página: solo letras, números, guion y guion bajo. */
export const safeId = (v: unknown): string => str(v, 64).replace(/[^\w-]/g, "-");
const cleanEntries = (a: unknown): Entry[] => (Array.isArray(a) ? a : []).filter(c => c && typeof c === "object" && c.n != null && String(c.n).trim()).slice(0, MAX_ENTRIES).map(c => ({ n: str(c.n, 150).trim(), q: Math.max(1, Math.min(MAX_QTY, parseInt(c.q, 10) || 1)) }));
const cleanCombo = (c: unknown): Combo | null => { const o = c as Partial<Combo> | null; if (!o || typeof o !== "object") return null; const cards = strs(o.cards, 12, 150); return cards.length ? { id: str(o.id, 64), cards, prod: strs(o.prod, 12, 200), desc: str(o.desc, 900), bt: o.bt ? str(o.bt, 20) : null } : null; };
function cleanCombos(v: unknown): Combos | undefined {
  const o = v as Partial<Combos> | null; if (!o || typeof o !== "object" || !Array.isArray(o.inc)) return undefined;
  const list = (a: unknown) => (Array.isArray(a) ? a : []).slice(0, 80).map(cleanCombo).filter((x): x is Combo => !!x);
  return { at: Number(o.at) || 0, inc: list(o.inc), almost: list(o.almost) };
}
const SCRY_IMG = /^https:\/\/cards\.scryfall\.io\//, SCRY_URI = /^https:\/\/scryfall\.com\//;
/** Una carta guardada o importada: solo se aceptan direcciones de Scryfall, y la fecha nunca queda en el futuro. */
export function cleanCard(c: unknown): Card | null {
  const o = c as Partial<Card> | null; if (!o || typeof o !== "object" || typeof o.n !== "string" || !o.n) return null;
  return {
    n: str(o.n, 150), cmc: Number(o.cmc) || 0, ci: str(o.ci, 5), col: str(o.col, 5), t: str(o.t, 20) || "Unknown", tl: str(o.tl, 120), cost: str(o.cost, 60), pm: strs(o.pm, 8, 2),
    r: strs(o.r, 10, 20) as Card["r"], sb: strs(o.sb, 10, 20), tg: strs(o.tg, 60, 40), rf: strs(o.rf, 40, 20), tq: typeof o.tq === "number" ? o.tq : undefined,
    gc: !!o.gc, xt: !!o.xt, mld: !!o.mld, tap: !!o.tap, pw: typeof o.pw === "number" ? o.pw : undefined, tu: typeof o.tu === "number" ? o.tu : undefined, leg: !!o.leg, legal: str(o.legal, 20),
    img: typeof o.img === "string" && SCRY_IMG.test(o.img) ? o.img : "", uri: typeof o.uri === "string" && SCRY_URI.test(o.uri) ? o.uri : "",
    rank: typeof o.rank === "number" ? o.rank : null, at: Math.min(Date.now(), Number(o.at) || 0), rv: Number(o.rv) || 0,
  };
}
export function cleanGame(g: unknown): Game | null {
  const o = g as Partial<Game> | null; if (!o || typeof o !== "object" || !o.id || !o.deckId || !["win", "loss", "draw"].includes(o.res as string)) return null;
  const seat = Number(o.seat);
  return { id: safeId(o.id), deckId: safeId(o.deckId), at: Number(o.at) || Date.now(), res: o.res as Game["res"], turn: Math.max(0, Math.min(30, Math.round(Number(o.turn)) || 0)), how: o.how ? str(o.how, 20) : null, seat: [1, 2, 3, 4].includes(seat) ? seat : null, opp: strs(o.opp, 6, 80), note: str(o.note, 200) };
}
export function cleanVersion(v: unknown): Version | null {
  const o = v as Partial<Version> | null; if (!o || typeof o !== "object" || !o.id || !o.deckId) return null;
  return { id: safeId(o.id), deckId: safeId(o.deckId), at: Number(o.at) || Date.now(), label: str(o.label, 60) || "Versión", src: str(o.src, 40) || "manual", commanders: strs(o.commanders, 2, 150), cards: cleanEntries(o.cards), maybe: cleanEntries(o.maybe) };
}
export const defaultPlan = (): Plan => ({ bracket: null, theme: "", inter: "mid" });
export function cleanDeck(d: Partial<Deck>): Deck {
  const plan = { ...defaultPlan(), ...(d.plan || {}) };
  if (!["low", "mid", "high"].includes(plan.inter)) plan.inter = "mid";
  if (plan.bracket != null && !(plan.bracket >= 1 && plan.bracket <= 5)) plan.bracket = null;
  return {
    id: safeId(d.id) || uid(), name: str(d.name, 80).trim() || "Mazo sin nombre", commanders: strs(d.commanders, 2, 150),
    cards: cleanEntries(d.cards), maybe: cleanEntries(d.maybe), kind: d.kind === "ref" ? "ref" : "mine", owner: d.owner ? str(d.owner, 40) : undefined,
    plan: { bracket: plan.bracket == null ? null : Math.round(Number(plan.bracket)), theme: str(plan.theme, 80), inter: plan.inter }, combos: cleanCombos(d.combos), notes: d.notes ? str(d.notes, 2000) : undefined, created: Number(d.created) || Date.now(), updated: Number(d.updated) || Date.now(),
  };
}

/* ---------- análisis con memoria ---------- */
interface Memo { epoch: number; A: Analysis; Y: Synergy; H: HandStats | null }
const memo = new WeakMap<Deck, Memo>();
/** Análisis, sinergias y prueba de manos de un mazo. Se recalculan solo si cambió el mazo o los datos de cartas. */
export function insight(d: Deck): Memo {
  const hit = memo.get(d); if (hit && hit.epoch === S.epoch) return hit;
  const A = analyze(d, S.db); const m: Memo = { epoch: S.epoch, A, Y: synergyOf(A), H: simulateHands(A) };
  memo.set(d, m); return m;
}
export const deckById = (id: string): Deck | undefined => S.decks.find(d => d.id === id);
export const versionsOf = (deckId: string): Version[] => S.versions.filter(v => v.deckId === deckId).sort((a, b) => b.at - a.at);
export const gamesOf = (deckId: string): Game[] => S.games.filter(g => g.deckId === deckId).sort((a, b) => b.at - a.at);
const themeKey = (d: Pick<Deck, "commanders"> & { plan?: Plan }): string => net.edhKey(d.commanders) + "/" + slug((d.plan && d.plan.theme) || "");
const mixed = new WeakMap<EdhData, WeakMap<EdhData, EdhData>>();
/**
 * Lo que se juega con el comandante. Si el plan tiene un tema y ya se trajo su página de EDHREC,
 * devuelve las cartas del tema primero (con ventaja en el puntaje) y después la lista general.
 */
export function edhOf(d: Pick<Deck, "commanders"> & { plan?: Plan }): EdhData | null {
  const E = S.edh.get(net.edhKey(d.commanders)) || null; if (!E || !d.plan || !d.plan.theme) return E;
  const T = S.edh.get(themeKey(d)); if (!T || T.pool.length < 40) return E;
  let byT = mixed.get(E); if (!byT) { byT = new WeakMap(); mixed.set(E, byT); }
  let M = byT.get(T);
  if (!M) { const inTheme = new Set(T.pool.map(p => slug(p.n))); M = { ...E, theme: T.theme, pool: [...T.pool.map(p => ({ ...p, syn: (p.syn || 0) + 0.15 })), ...E.pool.filter(p => !inTheme.has(slug(p.n)))] }; byT.set(T, M); }
  return M;
}
const themeTried = new Set<string>();
/** ¿Falta traer la página del tema elegido? (Se intenta una sola vez por tema: puede que EDHREC no la tenga.) */
export const needsTheme = (d: Pick<Deck, "commanders" | "plan">): boolean => !!d.plan.theme && !!S.edh.get(net.edhKey(d.commanders)) && !S.edh.get(themeKey(d)) && !themeTried.has(themeKey(d));

/* ---------- cartas ---------- */
const STALE = 90 * 864e5;
const needsFetch = (name: string): boolean => { const k = slug(name); const c = S.db.cards.get(k); return !c || c.rv !== RF_V || Date.now() - (c.at || 0) > STALE; };
const isBasic = (n: string): boolean => !!S.db.get(n)?.basic;

/** Trae de Scryfall las cartas que falten (o todas, con `force`). Devuelve cuántas no se reconocieron. */
// cartas que ya se están pidiendo: una segunda pantalla que las necesita espera esa misma consulta en vez de repetirla
const inflight = new Map<string, Promise<unknown>>();
export async function ensureCards(names: string[], opts: { force?: boolean; label?: string; quiet?: boolean } = {}): Promise<{ missing: string[]; offline: boolean }> {
  const want = [...new Set(names.filter(Boolean))].filter(n => !isBasic(n) && (opts.force || needsFetch(n)));
  const waits = [...new Set(want.map(n => inflight.get(slug(n))).filter((p): p is Promise<unknown> => !!p))];
  const todo = want.filter(n => !inflight.has(slug(n)));
  if (!todo.length) { await Promise.all(waits); return { missing: [], offline: false }; }
  const run = fetchAndStore(todo, opts);
  for (const n of todo) inflight.set(slug(n), run);
  try { const [r] = await Promise.all([run, ...waits]); return r; }
  finally { for (const n of todo) if (inflight.get(slug(n)) === run) inflight.delete(slug(n)); }
}
async function fetchAndStore(todo: string[], opts: { label?: string; quiet?: boolean }): Promise<{ missing: string[]; offline: boolean }> {
  const b = S.busy ? null : setBusy(opts.label || "Buscando cartas en Scryfall", todo.length);
  try {
    const r = await net.fetchCards(todo, (done) => { if (b) { b.done = done; touch(); } });
    const recs: { k: string; card: Card }[] = [];
    for (const { card, asked } of r.found) {
      const c = fromScry(card); S.db.put(c, asked);
      recs.push({ k: slug(c.n), card: c });
      const front = slug(c.n.split(" // ")[0]); if (front !== slug(c.n)) recs.push({ k: front, card: c });
      if (slug(asked) !== slug(c.n)) recs.push({ k: slug(asked), card: c });
    }
    if (recs.length) { S.epoch++; await save("cards", ...recs); }
    const missing = r.notFound.filter(n => !S.db.cards.has(slug(n)));
    if (!opts.quiet) {
      if (r.offline) toast(relayProblem() || "No se pudo conectar con Scryfall. Revisa tu conexión y vuelve a intentar.", "warn");
      else if (r.down) toast("Scryfall no está respondiendo. Las cartas que faltan se traerán cuando vuelva; inténtalo en unos minutos.", "warn");
      else if (missing.length) toast(`Scryfall no reconoció ${missing.length} carta${missing.length > 1 ? "s" : ""}: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}. Revisa que el nombre esté en inglés.`, "warn");
    }
    return { missing, offline: r.offline || r.down };
  } finally { if (b) endBusy(b); else touch(); }
}

export async function refreshGC(force = false): Promise<void> {
  if (!force && S.gcAt && Date.now() - S.gcAt < 7 * 864e5) return;
  try {
    const list = await net.gameChangers();
    if (list.length > 20) {
      const recs: { k: string; card: Card }[] = [];
      for (const c of list) if (!S.db.cards.has(slug(c.name))) { const m = fromScry(c); S.db.put(m); recs.push({ k: slug(m.n), card: m }); }
      S.db.setGC(list.map(c => c.name)); S.gcAt = Date.now(); S.epoch++;
      await save("kv", { k: "gc", v: { at: S.gcAt, list: list.map(c => c.name) } }); if (recs.length) await save("cards", ...recs);
      if (force) toast(`Lista de Game Changers actualizada: ${list.length} cartas.`);
      touch();
    }
  } catch { if (force) toast("No se pudo actualizar la lista de Game Changers. Se sigue usando la que ya estaba.", "warn"); }
}

/* ---------- mazos ---------- */
const AUTO_GAP = 30 * 60e3, MAX_VERSIONS = 40, BULK_SIZE = 6;
/** Cambios que reemplazan la lista: siempre dejan versión, aunque muevan pocas cartas. */
const ALWAYS = new Set(["editar la lista", "volver a una versión", "borrador", "completar", "cambiar comandante"]);
type Listed = Pick<Deck, "commanders" | "cards">;
const sameList = (a: Listed, b: Listed): boolean => { const d = diffLists(a.cards, b.cards); return !d.add.length && !d.rem.length && a.commanders.join("|") === b.commanders.join("|"); };
const changeSize = (a: Listed, b: Listed): number => { const d = diffLists(a.cards, b.cards); return d.add.reduce((s, c) => s + c.q, 0) + d.rem.reduce((s, c) => s + c.q, 0) + (a.commanders.join("|") === b.commanders.join("|") ? 0 : BULK_SIZE); };

/**
 * Guarda un mazo. Si la lista cambió, deja antes una versión del estado anterior:
 * - en un cambio grande (editar el texto, borrador, completar, restaurar, importar, o 6 cartas o más), siempre;
 * - en cambios de una carta, una por tanda (no se crea otra si ya hay una automática de la última media hora).
 * El estado en memoria cambia antes de cualquier espera: dos cambios seguidos nunca se pisan.
 */
export function saveDeck(next: Deck, src = "manual"): Promise<Deck> {
  const prev = deckById(next.id);
  const d: Deck = { ...next, updated: Date.now() };
  let v: Version | null = null;
  if (prev && !sameList(prev, d)) {
    // los combos guardados son de la lista anterior
    if (d.combos === prev.combos) d.combos = undefined;
    if (prev.cards.length) {
      const mine = versionsOf(d.id); const last = mine.find(x => x.src !== "guardada");
      const bulk = ALWAYS.has(src) || changeSize(prev, d) >= BULK_SIZE;
      // no se repite una versión idéntica a la más reciente
      if ((bulk || !last || Date.now() - last.at > AUTO_GAP) && !(mine[0] && sameList(mine[0], prev))) v = addVersion(prev, `Antes de: ${src}`, src);
    }
  }
  S.decks = [d, ...S.decks.filter(x => x.id !== d.id)];
  touch();
  return Promise.all([v ? save("versions", v) : null, save("decks", d)]).then(() => d);
}

/** Agrega una versión al estado (sin esperar). Quien llama la guarda en su tabla. */
function addVersion(d: Listed & Pick<Deck, "id" | "maybe">, label: string, src: string): Version {
  const v: Version = { id: uid(), deckId: d.id, at: Date.now(), label, src, commanders: [...d.commanders], cards: d.cards.map(c => ({ ...c })), maybe: d.maybe.map(c => ({ ...c })) };
  S.versions = [...S.versions, v];
  // tope por mazo: se van las automáticas más antiguas; las guardadas a mano se conservan
  const extra = versionsOf(d.id).filter(x => x.src !== "guardada").slice(MAX_VERSIONS);
  if (extra.length) { const ids = new Set(extra.map(x => x.id)); S.versions = S.versions.filter(x => !ids.has(x.id)); void idb.del("versions", ...ids).catch(() => { /* se reintenta al próximo recorte */ }); }
  return v;
}
/** Guarda a mano una versión con nombre del estado actual. */
export async function snapshot(deckId: string, label: string): Promise<void> {
  const d = deckById(deckId); if (!d) return;
  const v = addVersion(d, label.trim().slice(0, 60) || "Versión guardada", "guardada"); touch(); await save("versions", v); toast("Versión guardada.");
}
export async function restoreVersion(id: string): Promise<void> {
  const v = S.versions.find(x => x.id === id); const d = v && deckById(v.deckId); if (!v || !d) return;
  if (sameList(v, d)) { toast("Esa versión es igual a la lista actual."); return; }
  await saveDeck({ ...d, commanders: [...v.commanders], cards: v.cards.map(c => ({ ...c })), maybe: v.maybe.map(c => ({ ...c })) }, "volver a una versión");
  toast("Lista restaurada. La que tenías quedó guardada en Versiones.");
}
export async function deleteVersion(id: string): Promise<void> { S.versions = S.versions.filter(v => v.id !== id); touch(); await idb.del("versions", id); }

export async function newDeck(init: Partial<Deck>): Promise<Deck> {
  const d = cleanDeck({ ...init, id: uid(), created: Date.now(), updated: Date.now() });
  S.decks = [d, ...S.decks]; touch(); await save("decks", d); return d;
}
export async function deleteDeck(id: string): Promise<void> {
  const vs = S.versions.filter(v => v.deckId === id).map(v => v.id), gs = S.games.filter(g => g.deckId === id).map(g => g.id);
  S.decks = S.decks.filter(d => d.id !== id); S.versions = S.versions.filter(v => v.deckId !== id); S.games = S.games.filter(g => g.deckId !== id); S.sims.delete(id);
  touch();
  await Promise.all([idb.del("decks", id), vs.length ? idb.del("versions", ...vs) : null, gs.length ? idb.del("games", ...gs) : null, idb.del("kv", "sim:" + id)]);
}

export type Board = "cards" | "maybe";
/** Agrega una carta al mazo o a las probables. Trae sus datos si faltan. */
export async function addCard(deckId: string, name: string, board: Board = "cards", src = "agregar carta"): Promise<boolean> {
  const d0 = deckById(deckId); if (!d0) return false;
  await ensureCards([name], { quiet: true });
  const m = S.db.get(name); const real = m ? m.n : name.trim();
  const d = deckById(deckId); if (!d) return false;
  if (d.commanders.some(c => slug(c) === slug(real))) { toast(`${real} ya es tu comandante.`, "warn"); return false; }
  const inMain = d.cards.find(c => slug(c.n) === slug(real));
  if (board === "cards" && inMain && !(m && m.basic)) { toast(`${real} ya está en el mazo.`, "warn"); return false; }
  if (board === "maybe" && (inMain || d.maybe.some(c => slug(c.n) === slug(real)))) { toast(`${real} ya está en la lista.`, "warn"); return false; }
  const bump = (arr: Entry[]): Entry[] => arr.some(c => slug(c.n) === slug(real)) ? arr.map(c => slug(c.n) === slug(real) ? { ...c, q: c.q + 1 } : c) : [...arr, { n: real, q: 1 }];
  const next: Deck = board === "cards" ? { ...d, cards: bump(d.cards), maybe: d.maybe.filter(c => slug(c.n) !== slug(real)) } : { ...d, maybe: bump(d.maybe) };
  await saveDeck(next, src);
  if (!m) toast(`${real} se agregó, pero Scryfall no la reconoció. Revisa el nombre en inglés.`, "warn");
  return true;
}
export async function removeCard(deckId: string, name: string, board: Board = "cards", all = true): Promise<void> {
  const d = deckById(deckId); if (!d) return;
  const drop = (arr: Entry[]): Entry[] => arr.flatMap(c => slug(c.n) !== slug(name) ? [c] : (all || c.q <= 1 ? [] : [{ ...c, q: c.q - 1 }]));
  await saveDeck(board === "cards" ? { ...d, cards: drop(d.cards) } : { ...d, maybe: drop(d.maybe) }, "quitar carta");
}
/** Saca una carta y pone otra en su lugar, en un solo paso. */
export async function swapCard(deckId: string, out: string, inn: string, src = "recomendación"): Promise<void> {
  const d0 = deckById(deckId); if (!d0) return;
  await ensureCards([inn], { quiet: true });
  const d = deckById(deckId); if (!d) return; const m = S.db.get(inn); const real = m ? m.n : inn;
  if (d.cards.some(c => slug(c.n) === slug(real))) { toast(`${real} ya está en el mazo.`, "warn"); return; }
  // sale una sola copia de la carta que se cambia
  const rest = d.cards.flatMap(c => slug(c.n) !== slug(out) ? [c] : c.q > 1 ? [{ ...c, q: c.q - 1 }] : []);
  await saveDeck({ ...d, cards: [...rest, { n: real, q: 1 }], maybe: d.maybe.filter(c => slug(c.n) !== slug(real)) }, src);
  toast(`Entró ${real} y salió ${out}.`);
}
export async function moveCard(deckId: string, name: string, to: Board): Promise<void> {
  const d = deckById(deckId); if (!d) return;
  const from: Board = to === "cards" ? "maybe" : "cards"; const e = d[from].find(c => slug(c.n) === slug(name)); if (!e) return;
  if (d[to].some(c => slug(c.n) === slug(name))) { toast(`${e.n} ya está ahí.`, "warn"); return; }
  await saveDeck({ ...d, [from]: d[from].filter(c => slug(c.n) !== slug(name)), [to]: [...d[to], { n: e.n, q: to === "cards" ? 1 : e.q }] }, to === "cards" ? "pasar al mazo" : "pasar a probables");
}

/* ---------- partidas reales ---------- */
export async function addGame(g: Omit<Game, "id" | "at">): Promise<void> {
  const game: Game = { ...g, id: uid(), at: Date.now(), turn: Math.max(0, Math.min(30, Math.round(g.turn) || 0)), opp: g.opp.map(String).slice(0, 6), note: String(g.note || "").slice(0, 200) };
  S.games = [...S.games, game]; touch(); await save("games", game);
  toast(game.res === "win" ? "Victoria anotada." : "Partida anotada.");
}
export async function deleteGame(id: string): Promise<void> { S.games = S.games.filter(g => g.id !== id); touch(); await idb.del("games", id); }

/* ---------- fuentes externas ---------- */
const errMsg = (e: unknown, fallback: string): string => e instanceof net.NetError ? e.message : fallback;

/** Lo que se juega con este comandante (EDHREC). Se guarda una semana. */
export async function loadEdh(d: Pick<Deck, "commanders">, force = false): Promise<EdhData | null> {
  if (!d.commanders.length) { toast("El mazo necesita un comandante para buscar qué se juega con él.", "warn"); return null; }
  const key = net.edhKey(d.commanders); const cached = S.edh.get(key);
  if (cached && !force && Date.now() - cached.at < 7 * 864e5) return cached;
  const b = setBusy("Consultando EDHREC");
  try {
    const E = await net.edhrec(d.commanders);
    S.edh.set(key, E); await save("kv", { k: "edh:" + key, v: E });
    endBusy(b);
    await ensureCards(E.pool.map(c => c.n), { label: "Trayendo las cartas recomendadas", quiet: true });
    touch(); return E;
  } catch (e) { toast(errMsg(e, "EDHREC no respondió. Vuelve a intentar en un rato."), "warn"); return cached || null; }
  finally { endBusy(b); }
}

/** Cartas del tema elegido, mezcladas con la lista general del comandante y con ventaja en el puntaje. */
export async function edhForPlan(d: Pick<Deck, "commanders" | "plan">): Promise<EdhData | null> {
  const E = await loadEdh(d); if (!E || !d.plan.theme) return E;
  const key = themeKey(d);
  let T = S.edh.get(key) || null;
  if (!T || Date.now() - T.at > 7 * 864e5) {
    themeTried.add(key);
    const fresh = await net.edhrecTheme(E, d.plan.theme);
    if (fresh) { T = fresh; S.edh.set(key, T); await save("kv", { k: "edh:" + key, v: T }); await ensureCards(T.pool.map(c => c.n), { label: "Trayendo las cartas del tema", quiet: true }); }
    touch();
  }
  return edhOf(d);
}

export async function loadCombos(deckId: string): Promise<void> {
  const d = deckById(deckId); if (!d) return;
  const b = setBusy("Buscando combos en Commander Spellbook");
  try {
    const combos = await net.findCombos(d.commanders, d.cards);
    const cur = deckById(deckId); if (!cur) return;   // el mazo pudo cambiar mientras llegaba la respuesta
    if (!sameList(cur, d)) { toast("La lista cambió mientras se buscaban los combos. Búscalos de nuevo.", "warn"); return; }
    const next = { ...cur, combos }; S.decks = S.decks.map(x => x.id === deckId ? next : x);
    await save("decks", next);
    toast(combos.inc.length ? `${combos.inc.length} combo${combos.inc.length > 1 ? "s" : ""} en tu lista.` : "Tu lista no tiene combos catalogados.");
  } catch (e) { toast(errMsg(e, "Commander Spellbook no respondió. Vuelve a intentar en un rato."), "warn"); }
  finally { endBusy(b); touch(); }
}

export async function loadCedh(force = false): Promise<void> {
  if (!force && S.cedh && Date.now() - S.cedh.at < 24 * 3600e3) return;
  const b = setBusy("Consultando EDHTop16");
  try { S.cedh = { at: Date.now(), rows: await net.cedhTop() }; await save("kv", { k: "cedh", v: S.cedh }); }
  catch (e) { toast(errMsg(e, "EDHTop16 no respondió.") + " Se muestra la última foto guardada.", "warn"); }
  finally { endBusy(b); }
}
export async function loadStaples(d: Pick<Deck, "commanders">): Promise<void> {
  const key = net.edhKey(d.commanders); const b = setBusy("Consultando EDHTop16");
  try {
    const list = await net.cedhStaples(d.commanders);
    if (!list.length) { toast("EDHTop16 no tiene listas de torneo de este comandante.", "warn"); return; }
    const rec = { at: Date.now(), list }; S.staples.set(key, rec); await save("kv", { k: "staples:" + key, v: rec });
    endBusy(b); await ensureCards(list, { label: "Trayendo cartas de torneo", quiet: true });
  } catch (e) { toast(errMsg(e, "EDHTop16 no respondió."), "warn"); }
  finally { endBusy(b); touch(); }
}
export const staplesOf = (d: Pick<Deck, "commanders">) => S.staples.get(net.edhKey(d.commanders)) || null;

/** Borrador o completado: llena lo que falta con lo más jugado, según el plan. */
export async function draft(deckId: string, exclude: string[] = []): Promise<void> {
  const d0 = deckById(deckId); if (!d0) return;
  if (!d0.commanders.length) { toast("Elige primero un comandante.", "warn"); return; }
  await ensureCards(d0.commanders, { quiet: true });
  if (d0.commanders.some(c => !S.db.get(c))) { toast("No se encontraron los datos del comandante en Scryfall. Revisa el nombre.", "warn"); return; }
  const E = await edhForPlan(d0); if (!E) return;
  const pre = deckById(deckId); if (!pre) return;
  await ensureCards(allNames(pre), { quiet: true });
  // se vuelve a leer después de las esperas: mientras tanto pudo cambiar la lista
  const d = deckById(deckId); if (!d) return;
  const R = completeDeck({ commanders: d.commanders, cards: d.cards, plan: d.plan, exclude }, E, S.db);
  if (!R.added.length) { toast("El mazo ya está completo: no hay nada que agregar."); return; }
  await saveDeck({ ...d, cards: R.cards }, d.cards.length ? "completar" : "borrador");
  const n = R.added.reduce((a, c) => a + c.q, 0);
  toast(`${d.cards.length ? "Se completó" : "Borrador listo"}: ${n} cartas nuevas (${R.spells} hechizos y ${R.lands} tierras)${E.theme ? `, con el tema ${E.theme}` : ""}.${R.short ? ` EDHREC no tenía suficientes cartas con esas condiciones: faltan ${R.short}.` : ""}`, R.short ? "warn" : "ok");
}

export async function saveSim(deckId: string, sim: SavedSim): Promise<void> { S.sims.set(deckId, sim); touch(); await save("kv", { k: "sim:" + deckId, v: sim }); }
export async function saveSettings(patch: Partial<Settings>): Promise<void> { S.settings = { ...S.settings, ...patch }; touch(); await save("kv", { k: "settings", v: S.settings }); }

/* ---------- respaldo ---------- */
export interface Backup { app: "boveda-constructor"; version: 1; at: number; decks: Deck[]; versions: Version[]; games: Game[]; cards: { k: string; card: Card }[] }
export function makeBackup(): Backup {
  const used = new Set<string>(); for (const d of S.decks) for (const n of allNames(d)) used.add(slug(n));
  for (const v of S.versions) for (const c of v.cards) used.add(slug(c.n));
  const cards = [...S.db.cards.entries()].filter(([k]) => used.has(k)).map(([k, card]) => ({ k, card }));
  return { app: "boveda-constructor", version: 1, at: Date.now(), decks: S.decks, versions: S.versions, games: S.games, cards };
}
export interface ImportReport { decks: number; versions: number; games: number; cards: number; skipped: number; note: string; replaced: number }
/** Suma o actualiza lo que trae un respaldo. No borra lo que ya hay. */
export async function importData(data: { decks: unknown[]; versions: unknown[]; games: unknown[]; cards: unknown[] }, note = "", skipped = 0): Promise<ImportReport> {
  const decks = data.decks.slice(0, 500).filter(d => d && typeof d === "object").map(d => cleanDeck(d as Partial<Deck>)); const ids = new Set(decks.map(d => d.id));
  const versions = data.versions.slice(0, 20000).map(cleanVersion).filter((v): v is Version => !!v && ids.has(v.deckId));
  const games = data.games.slice(0, 50000).map(cleanGame).filter((g): g is Game => !!g && ids.has(g.deckId));
  const cards = data.cards.slice(0, 60000).map(r => { const o = r as { k?: unknown; card?: unknown } | null; const c = o && cleanCard(o.card); return c && o && o.k && c.rv === RF_V ? { k: slug(o.k), card: c } : null; })
    .filter((r): r is { k: string; card: Card } => !!r && !!r.k && !S.db.cards.has(r.k));
  // un mazo que ya existe y cuya lista cambia: la lista actual queda antes como versión
  const replaced: Version[] = [];
  for (const d of decks) { const cur = deckById(d.id); if (cur && cur.cards.length && !sameList(cur, d)) replaced.push(addVersion(cur, "Antes de: importar respaldo", "importar respaldo")); }
  S.decks = [...decks, ...S.decks.filter(d => !ids.has(d.id))].sort((a, b) => b.updated - a.updated);
  const vIds = new Set(versions.map(v => v.id)), gIds = new Set(games.map(g => g.id));
  S.versions = [...S.versions.filter(v => !vIds.has(v.id)), ...versions]; S.games = [...S.games.filter(g => !gIds.has(g.id)), ...games];
  for (const r of cards) S.db.cards.set(r.k, r.card);
  S.epoch++; touch();
  await Promise.all([decks.length ? save("decks", ...decks) : null, versions.length || replaced.length ? save("versions", ...versions, ...replaced) : null, games.length ? save("games", ...games) : null, cards.length ? save("cards", ...cards) : null]);
  return { decks: decks.length, versions: versions.length, games: games.length, cards: cards.length, skipped, note, replaced: replaced.length };
}
