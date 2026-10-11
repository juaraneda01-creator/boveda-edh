// Estado de la app y acciones. Las pantallas leen de aquí y piden cambios aquí;
// cada cambio se guarda en su tabla y avisa a las pantallas para que se redibujen.
import {
  MemoryDb, GC_FALLBACK, RF_V, analyze, synergyOf, simulateHands, fromScry, slug, uid, diffLists, completeDeck, allNames,
  type Analysis, type Card, type Deck, type EdhData, type Entry, type Game, type HandStats, type Plan, type Synergy, type Version, type SimResult,
} from "../engine/index.ts";
import * as idb from "./idb.ts";
import * as net from "./net.ts";

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
  S.versions = versions; S.games = games;
  for (const r of cards) if (r && r.card && r.card.n) S.db.cards.set(r.k, r.card);
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

const cleanEntries = (a: unknown): Entry[] => (Array.isArray(a) ? a : []).filter(c => c && c.n != null).map(c => ({ n: String(c.n), q: Math.max(1, parseInt(c.q, 10) || 1) }));
export const defaultPlan = (): Plan => ({ bracket: null, theme: "", inter: "mid" });
export function cleanDeck(d: Partial<Deck>): Deck {
  const plan = { ...defaultPlan(), ...(d.plan || {}) };
  if (!["low", "mid", "high"].includes(plan.inter)) plan.inter = "mid";
  if (plan.bracket != null && !(plan.bracket >= 1 && plan.bracket <= 5)) plan.bracket = null;
  return {
    id: String(d.id || uid()), name: String(d.name || "Mazo sin nombre").slice(0, 80), commanders: (Array.isArray(d.commanders) ? d.commanders : []).map(String).slice(0, 2),
    cards: cleanEntries(d.cards), maybe: cleanEntries(d.maybe), kind: d.kind === "ref" ? "ref" : "mine", owner: d.owner ? String(d.owner).slice(0, 40) : undefined,
    plan, combos: d.combos, notes: d.notes ? String(d.notes).slice(0, 2000) : undefined, created: Number(d.created) || Date.now(), updated: Number(d.updated) || Date.now(),
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
export const edhOf = (d: Pick<Deck, "commanders">): EdhData | null => S.edh.get(net.edhKey(d.commanders)) || null;

/* ---------- cartas ---------- */
const STALE = 90 * 864e5;
const needsFetch = (name: string): boolean => { const k = slug(name); const c = S.db.cards.get(k); return !c || c.rv !== RF_V || Date.now() - (c.at || 0) > STALE; };
const isBasic = (n: string): boolean => !!S.db.get(n)?.basic;

/** Trae de Scryfall las cartas que falten (o todas, con `force`). Devuelve cuántas no se reconocieron. */
export async function ensureCards(names: string[], opts: { force?: boolean; label?: string; quiet?: boolean } = {}): Promise<{ missing: string[]; offline: boolean }> {
  const todo = [...new Set(names.filter(Boolean))].filter(n => !isBasic(n) && (opts.force || needsFetch(n)));
  if (!todo.length) return { missing: [], offline: false };
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
      if (r.offline) toast("No se pudo conectar con Scryfall. Revisa tu conexión y vuelve a intentar.", "warn");
      else if (missing.length) toast(`Scryfall no reconoció ${missing.length} carta${missing.length > 1 ? "s" : ""}: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}. Revisa que el nombre esté en inglés.`, "warn");
    }
    return { missing, offline: r.offline };
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
const AUTO_GAP = 30 * 60e3, MAX_VERSIONS = 40;
const sameList = (a: Deck, b: Deck): boolean => { const d = diffLists(a.cards, b.cards); return !d.add.length && !d.rem.length && a.commanders.join("|") === b.commanders.join("|"); };

/**
 * Guarda un mazo. Si la lista cambió, deja antes una versión del estado anterior
 * (una por tanda de cambios: no se crea otra si ya hay una automática de la última media hora).
 */
export async function saveDeck(next: Deck, src = "manual"): Promise<Deck> {
  const prev = deckById(next.id);
  const d: Deck = { ...next, updated: Date.now() };
  if (prev && !sameList(prev, d)) {
    // los combos guardados son de la lista anterior
    if (d.combos === prev.combos) d.combos = undefined;
    if (prev.cards.length) {
      const last = versionsOf(d.id).find(v => v.src !== "guardada");
      if (!last || Date.now() - last.at > AUTO_GAP) await addVersion(prev, `Antes de: ${src}`, src);
    }
  }
  S.decks = [d, ...S.decks.filter(x => x.id !== d.id)];
  touch(); await save("decks", d); return d;
}

async function addVersion(d: Deck, label: string, src: string): Promise<Version> {
  const v: Version = { id: uid(), deckId: d.id, at: Date.now(), label, src, commanders: [...d.commanders], cards: d.cards.map(c => ({ ...c })), maybe: d.maybe.map(c => ({ ...c })) };
  S.versions = [...S.versions, v];
  // tope por mazo: se van las automáticas más antiguas; las guardadas a mano se conservan
  const mine = versionsOf(d.id); const extra = mine.filter(x => x.src !== "guardada").slice(MAX_VERSIONS);
  if (extra.length) { const ids = new Set(extra.map(x => x.id)); S.versions = S.versions.filter(x => !ids.has(x.id)); void idb.del("versions", ...ids); }
  await save("versions", v); return v;
}
/** Guarda a mano una versión con nombre del estado actual. */
export async function snapshot(deckId: string, label: string): Promise<void> {
  const d = deckById(deckId); if (!d) return;
  await addVersion(d, label.trim().slice(0, 60) || "Versión guardada", "guardada"); touch(); toast("Versión guardada.");
}
export async function restoreVersion(id: string): Promise<void> {
  const v = S.versions.find(x => x.id === id); const d = v && deckById(v.deckId); if (!v || !d) return;
  await saveDeck({ ...d, commanders: [...v.commanders], cards: v.cards.map(c => ({ ...c })), maybe: v.maybe.map(c => ({ ...c })) }, "volver a una versión");
  toast("Lista restaurada. La que tenías quedó guardada como versión.");
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
  await saveDeck({ ...d, cards: [...d.cards.filter(c => slug(c.n) !== slug(out)), { n: real, q: 1 }], maybe: d.maybe.filter(c => slug(c.n) !== slug(real)) }, src);
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
  const key = net.edhKey(d.commanders) + "/" + slug(d.plan.theme);
  let T = S.edh.get(key) || null;
  if (!T || Date.now() - T.at > 7 * 864e5) {
    T = await net.edhrecTheme(E, d.plan.theme);
    if (T) { S.edh.set(key, T); await save("kv", { k: "edh:" + key, v: T }); await ensureCards(T.pool.map(c => c.n), { label: "Trayendo las cartas del tema", quiet: true }); }
  }
  if (!T || T.pool.length < 40) return E;
  const inTheme = new Set(T.pool.map(p => slug(p.n)));
  return { ...E, theme: T.theme, pool: [...T.pool.map(p => ({ ...p, syn: (p.syn || 0) + 0.15 })), ...E.pool.filter(p => !inTheme.has(slug(p.n)))] };
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
  const d = deckById(deckId); if (!d) return;
  await ensureCards(allNames(d), { quiet: true });
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
export interface ImportReport { decks: number; versions: number; games: number; cards: number; skipped: number; note: string }
/** Suma o actualiza lo que trae un respaldo. No borra lo que ya hay. */
export async function importData(data: { decks: Partial<Deck>[]; versions: Version[]; games: Game[]; cards: { k: string; card: Card }[] }, note = "", skipped = 0): Promise<ImportReport> {
  const decks = data.decks.map(cleanDeck); const ids = new Set(decks.map(d => d.id));
  const versions = data.versions.filter(v => v && v.id && ids.has(v.deckId)).map(v => ({ ...v, cards: cleanEntries(v.cards), maybe: cleanEntries(v.maybe), commanders: (v.commanders || []).map(String) }));
  const games = data.games.filter(g => g && g.id && ids.has(g.deckId) && ["win", "loss", "draw"].includes(g.res));
  const cards = data.cards.filter(r => r && r.k && r.card && r.card.n && r.card.rv === RF_V && !S.db.cards.has(r.k));
  S.decks = [...decks, ...S.decks.filter(d => !ids.has(d.id))].sort((a, b) => b.updated - a.updated);
  const vIds = new Set(versions.map(v => v.id)), gIds = new Set(games.map(g => g.id));
  S.versions = [...S.versions.filter(v => !vIds.has(v.id)), ...versions]; S.games = [...S.games.filter(g => !gIds.has(g.id)), ...games];
  for (const r of cards) S.db.cards.set(r.k, r.card);
  S.epoch++; touch();
  await Promise.all([decks.length ? save("decks", ...decks) : null, versions.length ? save("versions", ...versions) : null, games.length ? save("games", ...games) : null, cards.length ? save("cards", ...cards) : null]);
  return { decks: decks.length, versions: versions.length, games: games.length, cards: cards.length, skipped, note };
}
