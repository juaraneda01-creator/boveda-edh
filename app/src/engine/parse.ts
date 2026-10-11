// Lector de listas: texto de Moxfield, Archidekt, ManaBox, MTG Arena, MTGO o CSV.
import type { Deck, Entry } from "./types.ts";
import { slug } from "./util.ts";

export interface Parsed { n: string; q: number; c: boolean; side: boolean; maybe: boolean }

function splitCSVLine(l: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === "," || ch === ";" || ch === "\t") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseCSV(text: string): Parsed[] | null {
  const lines = text.split(/\r?\n/).filter(l => l.trim()); if (!lines.length) return null;
  const head = splitCSVLine(lines[0]).map(h => h.toLowerCase().replace(/^﻿/, ""));
  const col = (re: RegExp) => head.findIndex(h => re.test(h));
  const iN = col(/^(name|card name|nombre|card)$/), iQ = col(/^(count|quantity|qty|cantidad|amount)$/), iBd = col(/^(board|section|zone|zona|category|categories|categoría|tablero)$/);
  if (iN < 0) return null;
  const out: Parsed[] = [];
  for (const l of lines.slice(1)) {
    const c = splitCSVLine(l); const n = c[iN]; if (!n) continue;
    const bd = (iBd >= 0 ? (c[iBd] || "") : "").toLowerCase();
    const isSide = /side|banquillo/.test(bd), isMaybe = /maybe|consider|probable/.test(bd), isCmd = /commander|comandante/.test(bd);
    out.push({ n, q: iQ >= 0 ? (parseInt(c[iQ]) || 1) : 1, c: isCmd, side: isSide && !isMaybe, maybe: isMaybe });
  }
  return out;
}

export function looksCSV(text: string): boolean {
  const first = (String(text || "").split(/\r?\n/).find(l => l.trim()) || "").toLowerCase();
  return /[,;\t]/.test(first) && /(^|[,;\t"])\s*"?(name|card name|nombre)"?\s*([,;\t]|$)/.test(first);
}

function mergeParsed(list: Parsed[]): Parsed[] {
  const map = new Map<string, Parsed>();
  for (const c of list) {
    const key = slug(c.n) + (c.c ? "#c" : "") + (c.side ? "#s" : "") + (c.maybe ? "#m" : "");
    const p = map.get(key); if (p) p.q += c.q; else map.set(key, { ...c });
  }
  return [...map.values()];
}

export function parseList(input: string, { keepSide = false } = {}): Parsed[] {
  const text = String(input || "");
  if (looksCSV(text)) { const csv = parseCSV(text); if (csv) return mergeParsed(csv); }
  const out: Parsed[] = []; let section = "main";
  const clean = (name: string, q: number, sec: string): Parsed => {
    const isC = /\*CMDR\*/i.test(name) || sec === "cmdr";
    name = name.replace(/\*[A-Z]+\*/gi, "").replace(/\[[^\]]*\]/g, "").replace(/\^[^^]*\^/g, "")
      .replace(/\s+\([A-Za-z0-9]{2,6}\)(\s+[\w★\-]+)?\s*$/, "").replace(/\s+#.*$/, "").replace(/\s+\/\s+/, " // ").trim();
    return { n: name, q, c: isC && sec !== "maybe", side: sec === "side" || sec === "side-blank", maybe: sec === "maybe" };
  };
  for (const raw of text.split(/\r?\n/)) {
    let l = raw.trim();
    if (!l) { if (keepSide && section === "main" && out.reduce((a, c) => a + (c.q || 0), 0) >= 40) section = "side-blank"; continue; }
    l = l.replace(/^\/\/\s*/, "");
    const h = l.toLowerCase().replace(/\s*\(\d+\)\s*$/, "").replace(/[:\s]+$/, "");
    if (/^(commanders?|comandantes?)$/.test(h)) { section = "cmdr"; continue; }
    if (/^(deck|mainboard|main|mazo|main deck|companion)$/.test(h)) { section = "main"; continue; }
    if (/^(sideboard|side|banquillo|reserva)$/.test(h)) { section = "side"; continue; }
    if (/^(maybeboard|maybe|considering|quizas|quizás|tal vez|cartas probables|probables|en prueba)$/.test(h)) { section = "maybe"; continue; }
    if (/^(tokens?|acquireboard|attractions|stickers)$/.test(h)) { section = "skip"; continue; }
    if (/^(creatures?|instants?|sorcer(y|ies)|artifacts?|enchantments?|planeswalkers?|lands?|battles?|other|criaturas|tierras|hechizos|spells)$/.test(h)) continue;
    if (section === "skip") continue;
    if (/^(about|name|nombre)\b/i.test(l) && !/^\d/.test(l)) continue;   // cabecera de MTG Arena
    // etiquetas entre corchetes de Archidekt, Moxfield y ManaBox: [Commander{top}], [Sideboard], [Maybeboard{noDeck}]
    const tag = (l.match(/\[([^\]]*)\]/) || [])[1] || "";
    if (tag) {
      const sec2 = /commander/i.test(tag) ? "cmdr" : /sideboard/i.test(tag) ? "side" : /maybe|consider|nodeck/i.test(tag) ? "maybe" : null;
      if (sec2) { const m3 = l.match(/^(\d+)\s*x?\s+(.+)$/i); out.push(clean(m3 ? m3[2] : l, m3 ? +m3[1] : 1, sec2)); continue; }
    }
    let q = 1, name = l; const m = l.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (m) { q = +m[1]; name = m[2]; }
    else if (/^SB:\s*/i.test(l)) { const m2 = l.replace(/^SB:\s*/i, "").match(/^(\d+)\s*x?\s+(.+)$/i); if (m2) { out.push(clean(m2[2], +m2[1], "side")); continue; } }
    out.push(clean(name, q, section === "side-blank" ? "side" : section));
  }
  return mergeParsed(out.filter(x => x.n && !/^\d+$/.test(x.n)));
}

/** Texto suelto → secciones. Dos bloques separados por una línea en blanco, con el último de 1 o 2 líneas: ese bloque es el comandante. */
export function textToDeck(t: string): string {
  let text = String(t).replace(/\r/g, "").trim();
  if (!/^(sideboard|banquillo|maybeboard|commander|companion)\b/im.test(text)) {
    const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
    if (blocks.length === 2 && blocks[1].trim().split("\n").length <= 2) text = "Commander\n" + blocks[1] + "\nDeck\n" + blocks[0];
  }
  return text;
}

export interface Split { commanders: string[]; cards: Entry[]; maybe: Entry[] }

/** Reparte una lista leída en comandantes, mazo y cartas probables. En Commander el banquillo pasa a probables. */
export function splitParsed(parsed: Parsed[], commanders?: string[]): Split {
  const given = (commanders || []).map(c => c.trim()).filter(Boolean);
  const cmds = given.length ? given : parsed.filter(c => c.c).map(c => c.n);
  const isCmd = (n: string) => cmds.some(c => slug(c) === slug(n));
  const fold = (arr: Parsed[]): Entry[] => {
    const m = new Map<string, Entry>();
    for (const c of arr) { const k = slug(c.n); const p = m.get(k); if (p) p.q += c.q; else m.set(k, { n: c.n, q: c.q }); }
    return [...m.values()];
  };
  return {
    commanders: cmds,
    cards: fold(parsed.filter(c => !c.maybe && !c.side && !isCmd(c.n))),
    maybe: fold(parsed.filter(c => (c.maybe || c.side) && !isCmd(c.n))),
  };
}

export const listText = (arr: Entry[] | undefined): string => (arr || []).map(c => `${c.q} ${c.n}`).join("\n");

export function deckText(d: Pick<Deck, "commanders" | "cards" | "maybe">): string {
  const extra = d.maybe && d.maybe.length ? ["", "Maybeboard", listText(d.maybe)] : [];
  return ["Commander", ...(d.commanders || []).map(n => `1 ${n}`), "", "Deck", listText(d.cards), ...extra].join("\n");
}

export interface Diff { add: Entry[]; rem: Entry[] }
export function diffLists(a: Entry[] | undefined, b: Entry[] | undefined): Diff {
  const ma = new Map<string, number>(), mb = new Map<string, number>(), names = new Map<string, string>();
  for (const c of a || []) { const k = slug(c.n); ma.set(k, (ma.get(k) || 0) + c.q); names.set(k, c.n); }
  for (const c of b || []) { const k = slug(c.n); mb.set(k, (mb.get(k) || 0) + c.q); names.set(k, c.n); }
  const add: Entry[] = [], rem: Entry[] = [];
  for (const k of new Set([...ma.keys(), ...mb.keys()])) {
    const d = (mb.get(k) || 0) - (ma.get(k) || 0);
    if (d > 0) add.push({ n: names.get(k)!, q: d }); else if (d < 0) rem.push({ n: names.get(k)!, q: -d });
  }
  return { add, rem };
}

export const allNames = (d: Pick<Deck, "commanders" | "cards" | "maybe">): string[] =>
  [...(d.commanders || []), ...(d.cards || []).map(c => c.n), ...(d.maybe || []).map(c => c.n)];
