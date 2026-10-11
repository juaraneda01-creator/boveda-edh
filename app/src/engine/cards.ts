// De la carta de Scryfall a la carta del motor, y el índice de cartas en memoria.
import type { Card, CardDb } from "./types.ts";
import { BASICS, BASIC_CI, slug } from "./util.ts";
import { cardFlags, detectRoles, mainType, sbCats, RF_V } from "./detect.ts";
import { detectTags } from "./tags.ts";

/** Lo que usamos de la respuesta de Scryfall. */
export interface ScryCard {
  name: string;
  cmc?: number;
  color_identity?: string[];
  colors?: string[];
  type_line?: string;
  oracle_text?: string;
  mana_cost?: string;
  produced_mana?: string[];
  power?: string;
  toughness?: string;
  game_changer?: boolean;
  legalities?: Record<string, string>;
  edhrec_rank?: number;
  scryfall_uri?: string;
  image_uris?: { normal?: string; small?: string };
  card_faces?: { name?: string; type_line?: string; oracle_text?: string; mana_cost?: string; colors?: string[]; power?: string; toughness?: string; image_uris?: { normal?: string; small?: string } }[];
}

const stat = (v: string | undefined): number | undefined => { const n = parseInt(String(v), 10); return isNaN(n) ? undefined : n; };

export function fromScry(c: ScryCard): Card {
  const f0 = (c.card_faces || [])[0] || {};
  const tl = c.type_line || f0.type_line || "";
  const oracle = c.oracle_text != null ? c.oracle_text : (c.card_faces || []).map(x => x.oracle_text || "").join("\n");
  // en el texto, el nombre de la propia carta pasa a ser "this": así las reglas no dependen del nombre
  const o = oracle.toLowerCase().split(c.name.toLowerCase()).join("this").split((f0.name || "@@@").toLowerCase()).join("this");
  const cost = (c.card_faces && c.card_faces.length && f0.mana_cost != null) ? f0.mana_cost : (c.mana_cost || "");
  const t = mainType(tl); const pm = c.produced_mana || [];
  const flags = cardFlags(o, t, tl);
  return {
    n: c.name, cmc: c.cmc || 0, ci: (c.color_identity || []).join(""), col: (c.colors || f0.colors || []).join(""),
    t, tl: tl.split(" // ")[0], cost, pm,
    r: detectRoles(o, t, tl, pm), sb: sbCats(o, c.name), tg: detectTags(o, t, tl),
    rf: flags.rf, tq: flags.tq, rv: flags.rv,
    gc: c.game_changer === true,
    xt: /take an extra turn/.test(o),
    mld: /destroy all lands|each player sacrifices (all|\w+) lands|lands don't untap|destroy all permanents/.test(o),
    tap: t === "Land" && /enters( the battlefield)? tapped\./.test(o) && !/unless|if you control|you may pay|you may reveal/.test(o),
    pw: stat(c.power != null ? c.power : f0.power), tu: stat(c.toughness != null ? c.toughness : f0.toughness),
    leg: /Legendary/.test(tl), legal: (c.legalities || {}).commander || "",
    img: (c.image_uris && c.image_uris.normal) || (f0.image_uris && f0.image_uris.normal) || "",
    uri: c.scryfall_uri || "", rank: c.edhrec_rank || null, at: Date.now(),
  };
}

export function basicCard(name: string): Card {
  const b = slug(name).replace("snow-covered-", ""); const ci = BASIC_CI[b] || "";
  return { n: name, cmc: 0, ci, col: "", t: "Land", tl: "Basic Land", cost: "", pm: ci ? [ci] : ["C"], r: [], sb: [], tg: [], rf: [], gc: false, xt: false, mld: false, tap: false, leg: false, legal: "legal", img: "", uri: "", rank: null, basic: true, at: 0, rv: RF_V };
}

/** ¿Puede ser comandante? Criatura legendaria, o cualquier carta que lo diga en su texto (lo decide quien llama con el texto). */
export const canCommand = (m: Card): boolean => m.leg && (/Creature/.test(m.tl) || /Vehicle|Spacecraft/.test(m.tl) || m.t === "Planeswalker");

/** Índice de cartas en memoria. Las tierras básicas no se guardan: se arman al pedirlas. */
export class MemoryDb implements CardDb {
  cards: Map<string, Card>;
  gc: Set<string>;
  private gcList: string[];
  private merged = new Map<string, Card>();
  constructor(cards: Map<string, Card> = new Map(), gcNames: string[] = []) {
    this.cards = cards; this.gcList = gcNames; this.gc = new Set(gcNames.map(slug));
  }
  setGC(names: string[]): void { this.gcList = names; this.gc = new Set(names.map(slug)); this.merged.clear(); }
  put(card: Card, alias?: string): void {
    const k = slug(card.n); this.cards.set(k, card); this.merged.delete(k);
    // cartas de dos caras: también se encuentran por la cara frontal y por el nombre con que se pidieron
    const front = slug(card.n.split(" // ")[0]); if (front !== k && !this.cards.has(front)) this.cards.set(front, card);
    if (alias && slug(alias) !== k) { this.cards.set(slug(alias), card); this.merged.delete(slug(alias)); }
  }
  get(name: string): Card | null {
    const k = slug(name);
    if (BASICS.has(k)) return basicCard(name);
    const c = this.cards.get(k); if (!c) return null;
    if (c.gc || !this.gc.has(k)) return c;
    let m = this.merged.get(k); if (!m) { m = { ...c, gc: true }; this.merged.set(k, m); }
    return m;
  }
  all(): Iterable<Card> { return this.cards.values(); }
  isGC(name: string): boolean { const c = this.get(name); return !!c && c.gc; }
  gcNames(): string[] { return this.gcList; }
}
