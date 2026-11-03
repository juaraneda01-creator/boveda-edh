// Datos de cartas locales a partir de MTGJSON (AtomicCards, licencia MIT).
// Se convierten al formato de Scryfall que ya entiende fromScry, así el resto del motor no cambia.
import type { ScryCard } from "./cards.ts";
import { slug } from "./util.ts";

/** Formato compacto que se guarda en el navegador (y que produce tools/mtgjson.mjs). */
export interface LocalPack {
  format: "boveda-cartas";
  v: 1;
  date: string;        // fecha de compilación de MTGJSON
  version: string;     // versión de MTGJSON
  cards: ScryCard[];
}

interface MjFace {
  name: string; faceName?: string; side?: string; layout?: string;
  manaValue?: number; convertedManaCost?: number; manaCost?: string;
  colors?: string[]; colorIdentity?: string[]; type?: string; text?: string;
  power?: string; toughness?: string; loyalty?: string; defense?: string;
  isGameChanger?: boolean; isFunny?: boolean; edhrecRank?: number; edhrecSaltiness?: number;
  legalities?: Record<string, string>;
  identifiers?: { scryfallOracleId?: string; scryfallId?: string };
}
interface MjAtomic { meta?: { date?: string; version?: string }; data?: Record<string, MjFace[]> }

const FORMATS = ["commander", "duel", "pauper", "pioneer"];
// MTGJSON: "Legal", "Banned", "Restricted"; si el formato no aparece, la carta no es legal. Scryfall: minúsculas y "not_legal".
const legalities = (l: Record<string, string> | undefined): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const f of FORMATS) { const v = (l || {})[f]; out[f] = v ? v.toLowerCase().replace(/\s+/g, "_") : "not_legal"; }
  return out;
};
const BASIC_TYPE: [RegExp, string][] = [[/\bPlains\b/, "W"], [/\bIsland\b/, "U"], [/\bSwamp\b/, "B"], [/\bMountain\b/, "R"], [/\bForest\b/, "G"]];

/** Maná que produce, deducido del texto y de los tipos básicos (MTGJSON no trae produced_mana). */
export function producedMana(text: string, type: string): string[] {
  const out = new Set<string>();
  for (const [re, c] of BASIC_TYPE) if (re.test(type)) out.add(c);
  for (const m of (text || "").matchAll(/\badd\b([^.\n]*)/gi)) {
    const part = m[1];
    if (/any color|any one color|mana of any type|any combination of colors|the chosen color|chosen colors?|exiled card's colors|any of [^.]*colors/i.test(part)) for (const c of "WUBRG") out.add(c);
    for (const s of part.match(/\{[WUBRGC](\/[WUBRGP])?\}/g) || []) for (const c of s.replace(/[{}]/g, "").split("/")) if ("WUBRGC".includes(c)) out.add(c);
  }
  return ["W", "U", "B", "R", "G", "C"].filter(c => out.has(c));
}

const img = (id?: string): { normal?: string } | undefined =>
  id && /^[0-9a-f-]{36}$/.test(id) ? { normal: `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg` } : undefined;

/** Una carta de AtomicCards (sus caras) a una carta con forma de Scryfall. */
export function atomicToScry(name: string, faces: MjFace[]): ScryCard {
  const fs = [...faces].sort((a, b) => (a.side || "a").localeCompare(b.side || "a"));
  const a = fs[0];
  const type = fs.map(f => f.type || "").join(" // ");
  const text = fs.map(f => f.text || "").join("\n");
  const ids = a.identifiers || {};
  const c: ScryCard = {
    name,
    cmc: a.manaValue ?? a.convertedManaCost ?? 0,
    color_identity: a.colorIdentity || [],
    colors: fs.length > 1 ? [...new Set(fs.flatMap(f => f.colors || []))] : (a.colors || []),
    type_line: type,
    mana_cost: a.manaCost || "",
    produced_mana: producedMana(text, fs.map(f => f.type || "").join(" ")),
    power: a.power, toughness: a.toughness,
    game_changer: !!a.isGameChanger,
    legalities: legalities(a.legalities),
    edhrec_rank: a.edhrecRank,
    edhrec_saltiness: typeof a.edhrecSaltiness === "number" ? a.edhrecSaltiness : undefined,
    layout: a.layout,
    scryfall_uri: ids.scryfallOracleId ? `https://scryfall.com/search?q=oracleid%3A${ids.scryfallOracleId}` : undefined,
    image_uris: img(ids.scryfallId),
  };
  if (fs.length > 1) {
    c.oracle_text = undefined;
    c.card_faces = fs.map(f => ({ name: f.faceName || f.name, type_line: f.type, oracle_text: f.text || "", mana_cost: f.manaCost || "", colors: f.colors, power: f.power, toughness: f.toughness }));
  } else c.oracle_text = a.text || "";
  return c;
}

/** AtomicCards completo → paquete compacto (deja fuera las cartas de broma). */
export function compactAtomic(json: MjAtomic): LocalPack {
  const cards: ScryCard[] = [];
  for (const [name, faces] of Object.entries(json.data || {})) {
    if (!Array.isArray(faces) || !faces.length || !faces[0] || typeof faces[0].name !== "string") continue;
    if (faces[0].isFunny && !(faces[0].legalities || {}).commander) continue;
    cards.push(atomicToScry(name, faces));
  }
  return { format: "boveda-cartas", v: 1, date: json.meta?.date || "", version: json.meta?.version || "", cards };
}

/** Acepta un AtomicCards de MTGJSON o un paquete compacto ya armado. Lanza un error legible si no es ninguno. */
export function readLocalPack(json: unknown): LocalPack {
  const o = json as Partial<LocalPack> & MjAtomic;
  if (o && o.format === "boveda-cartas" && Array.isArray(o.cards)) {
    const cards = (o.cards as unknown[]).filter((c): c is ScryCard => !!c && typeof c === "object" && typeof (c as ScryCard).name === "string" && !!(c as ScryCard).name).slice(0, 100000);
    return { format: "boveda-cartas", v: 1, date: String(o.date || "").slice(0, 20), version: String(o.version || "").slice(0, 40), cards };
  }
  if (o && o.data && typeof o.data === "object" && !Array.isArray(o.data)) return compactAtomic(o);
  throw new Error("El archivo no es AtomicCards de MTGJSON ni un paquete de cartas de la Bóveda.");
}

/** Índice para buscar cartas por nombre, por cara frontal o por cualquiera de sus caras. */
export class LocalIndex {
  readonly date: string; readonly version: string; readonly size: number;
  private by = new Map<string, ScryCard>();
  private list: ScryCard[];
  constructor(pack: LocalPack) {
    this.date = pack.date; this.version = pack.version; this.size = pack.cards.length; this.list = pack.cards;
    for (const c of pack.cards) {
      const keys = [slug(c.name), ...(c.card_faces || []).map(f => slug(f.name))];
      for (const k of keys) if (k && !this.by.has(k)) this.by.set(k, c);
    }
    // el nombre completo manda sobre una cara que se llame igual que otra carta
    for (const c of pack.cards) this.by.set(slug(c.name), c);
  }
  get(name: string): ScryCard | null { return this.by.get(slug(name)) || null; }
  /** Todas las cartas, una vez cada una. */
  all(): ScryCard[] { return this.list; }
  gameChangers(): string[] { const s = new Set<string>(); for (const c of this.by.values()) if (c.game_changer) s.add(c.name); return [...s].sort(); }
}
