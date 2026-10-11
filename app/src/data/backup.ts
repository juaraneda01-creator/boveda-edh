// Leer respaldos: los propios y los de la Bóveda original (de la que solo se traen los mazos de Commander,
// sus versiones y sus partidas; la colección, las carpetas de venta y los precios no se usan aquí).
import { RF_V, slug, uid, type Card, type Deck, type Entry, type Game, type Version } from "../engine/index.ts";
import { importData, type Backup, type ImportReport } from "./store.ts";

interface OldEntry { n: string; q: number }
interface OldDeck {
  id: string; name: string; format?: string; commanders?: string[]; cards?: OldEntry[]; side?: OldEntry[]; maybe?: OldEntry[];
  rival?: { owner?: string }; combos?: Deck["combos"]; created?: number; updated?: number;
  versions?: { at?: number; savedAt?: number; src?: string; commanders?: string[]; cards?: OldEntry[]; side?: OldEntry[]; maybe?: OldEntry[] }[];
}
interface OldGame { id: string; at: number; deck: string; res: Game["res"]; turn?: number; how?: string | null; seat?: number | null; opp?: string[]; note?: string }
interface OldCard extends Partial<Card> { lg?: { commander?: string }; usd?: number; eur?: number }
interface OldBackup { app?: string; decks?: OldDeck[]; games?: OldGame[]; cardData?: { cards?: Record<string, OldCard> } }

const fold = (...lists: (OldEntry[] | undefined)[]): Entry[] => {
  const m = new Map<string, Entry>();
  for (const l of lists) for (const c of l || []) { if (!c || !c.n) continue; const k = slug(c.n); const p = m.get(k); if (p) p.q += c.q || 1; else m.set(k, { n: String(c.n), q: c.q || 1 }); }
  return [...m.values()];
};

function fromOld(j: OldBackup): Parameters<typeof importData>[0] & { skipped: number } {
  const all = Array.isArray(j.decks) ? j.decks : [];
  const edh = all.filter(d => d && d.id && (d.format || "commander") === "commander");
  const decks: Partial<Deck>[] = [], versions: Version[] = [];
  for (const d of edh) {
    decks.push({ id: d.id, name: d.name, commanders: d.commanders || [], cards: fold(d.cards), maybe: fold(d.side, d.maybe), kind: d.rival ? "ref" : "mine", owner: d.rival ? d.rival.owner || "Amigo" : undefined, combos: d.combos, created: d.created, updated: d.updated });
    for (const v of d.versions || []) {
      versions.push({ id: uid() + versions.length, deckId: d.id, at: v.savedAt || v.at || Date.now(), label: `Antes de: ${v.src || "un cambio"}`, src: v.src || "manual", commanders: v.commanders || d.commanders || [], cards: fold(v.cards), maybe: fold(v.side, v.maybe) });
    }
  }
  const ids = new Set(edh.map(d => d.id));
  const games: Game[] = (Array.isArray(j.games) ? j.games : []).filter(g => g && ids.has(g.deck)).map(g => ({ id: String(g.id), deckId: g.deck, at: g.at, res: g.res, turn: g.turn || 0, how: g.how || null, seat: g.seat || null, opp: g.opp || [], note: g.note || "" }));
  // las cartas del respaldo sirven si se calcularon con las mismas reglas; si no, se vuelven a traer de Scryfall
  const cards: { k: string; card: Card }[] = [];
  for (const [k, c] of Object.entries((j.cardData && j.cardData.cards) || {})) {
    if (!c || !c.n || c.rv !== RF_V || !Array.isArray(c.tg) || !Array.isArray(c.rf)) continue;
    cards.push({ k, card: { n: c.n, cmc: c.cmc || 0, ci: c.ci || "", col: c.col || "", t: c.t || "Unknown", tl: c.tl || "", cost: c.cost || "", pm: c.pm || [], r: c.r || [], sb: c.sb || [], tg: c.tg, rf: c.rf, tq: c.tq, gc: !!c.gc, xt: !!c.xt, mld: !!c.mld, tap: !!c.tap, pw: c.pw, tu: c.tu, leg: !!c.leg, legal: (c.lg && c.lg.commander) || "", img: c.img || "", uri: c.uri || "", rank: c.rank || null, at: c.at || 0, rv: RF_V } });
  }
  return { decks, versions, games, cards, skipped: all.length - edh.length };
}

/** Lee un archivo de respaldo (propio o de la Bóveda original) y suma su contenido. */
export async function importBackupText(text: string): Promise<ImportReport> {
  let j: unknown;
  try { j = JSON.parse(text); } catch { throw new Error("El archivo no es un respaldo válido (no se pudo leer como JSON)."); }
  if (!j || typeof j !== "object") throw new Error("El archivo no es un respaldo válido.");
  const o = j as Partial<Backup> & OldBackup;
  if (o.app === "boveda-constructor") {
    if (!Array.isArray(o.decks)) throw new Error("El respaldo no trae mazos.");
    return importData({ decks: o.decks, versions: Array.isArray(o.versions) ? o.versions : [], games: Array.isArray(o.games) ? o.games as Game[] : [], cards: Array.isArray(o.cards) ? o.cards : [] });
  }
  if (o.app === "boveda-edh" || (Array.isArray(o.decks) && "collection" in (o as object))) {
    const d = fromOld(o as OldBackup);
    if (!d.decks.length) throw new Error("Ese respaldo de la Bóveda no trae mazos de Commander.");
    return importData(d, "bóveda", d.skipped);
  }
  throw new Error("Ese archivo no es un respaldo de la Bóveda ni del Constructor.");
}
