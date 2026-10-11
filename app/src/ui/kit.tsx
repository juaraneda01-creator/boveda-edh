// Piezas comunes de las pantallas.
import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { S, subscribe, touch } from "../data/store.ts";
import { autocomplete } from "../data/net.ts";
import { WUBRG, COLOR_ES, type Card } from "../engine/index.ts";

/* ---------- estado de la interfaz que cruza pantallas ---------- */
export const ui = {
  card: null as { name: string; deckId?: string } | null,   // carta abierta en la ficha
  newDeck: null as null | "cmd" | "list",
  ab: null as { deckId: string; a: string; b: string } | null,   // selección pendiente para A contra B
};
export function openCard(name: string, deckId?: string): void { ui.card = { name, deckId }; touch(); }

/** Vuelve a dibujar el componente cuando cambia el estado de la app. */
export function useStore(): typeof S {
  const [, set] = useState(0);
  // el arranque puede terminar antes de que este efecto corra: al suscribirse se redibuja una vez por si acaso
  useEffect(() => { const off = subscribe(() => set(x => x + 1)); set(x => x + 1); return off; }, []);
  return S;
}
export function useHash(): string {
  const [h, set] = useState(location.hash);
  useEffect(() => { const f = () => set(location.hash); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h;
}
export function go(path: string): void { location.hash = path; window.scrollTo(0, 0); }

/* ---------- formato ---------- */
export const pct = (v: number | null | undefined, digits = 0): string => v == null || isNaN(v) ? "—" : (v * 100).toFixed(digits).replace(".", ",") + " %";
export const num1 = (v: number | null | undefined): string => v == null || isNaN(v) ? "—" : v.toFixed(1).replace(".", ",");
export const turnTxt = (v: number | null | undefined): string => v == null || isNaN(v) ? "—" : "T" + num1(v);
export const dateTxt = (t: number): string => new Date(t).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
export const dateTime = (t: number): string => new Date(t).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const agoTxt = (t: number): string => { const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`; };
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/* ---------- piezas ---------- */
export function Pips({ ci }: { ci: string }): JSX.Element {
  const s = (ci || "").split("").filter(c => (WUBRG as readonly string[]).includes(c));
  return <span class="pips" role="img" aria-label={s.length ? "Colores: " + s.map(c => COLOR_ES[c]).join(", ") : "Incoloro"}>{(s.length ? s : ["C"]).map(c => <i class={"pip p-" + c} key={c} />)}</span>;
}

/** Nombre de carta que abre su ficha al tocarlo. */
export function CardName({ name, deckId, m }: { name: string; deckId?: string; m?: Card | null }): JSX.Element {
  return <button type="button" class={"cardname" + (m && m.gc ? " is-gc" : "")} onClick={() => openCard(name, deckId)}>{name}</button>;
}

export function Pill({ tone, children }: { tone?: "good" | "warn" | "bad" | "info" | "accent"; children: ComponentChildren }): JSX.Element {
  return <span class={"pill" + (tone ? " " + tone : "")}>{children}</span>;
}

export function Stat({ k, v, sub, tone }: { k: string; v: ComponentChildren; sub?: ComponentChildren; tone?: "good" | "warn" | "bad" }): JSX.Element {
  return <div class={"stat" + (tone ? " " + tone : "")}><div class="stat-v">{v}</div><div class="stat-k">{k}</div>{sub ? <div class="stat-sub">{sub}</div> : null}</div>;
}

/**
 * Medidor de casilla: las cartas vistas de canto, una raya por carta, con la zona de meta marcada.
 * Es la firma visual de la app: un mazo es un fajo de cartas, y así se ve cuánto lleva cada casilla.
 */
export function Stack({ count, lo, hi, tone }: { count: number; lo: number; hi: number; tone: string }): JSX.Element {
  const max = Math.max(hi + 4, count + 1, 8); const x = (n: number) => `${(100 * n / max).toFixed(2)}%`;
  return (
    <div class={"stack " + tone} role="img" aria-label={`${count} cartas; la meta es de ${lo} a ${hi}`}>
      <div class="stack-goal" style={{ left: x(lo), width: x(Math.max(0.6, hi - lo)) }} />
      <div class="stack-cards" style={{ width: x(count), backgroundSize: `${(100 / Math.max(1, count)).toFixed(3)}% 100%` }} />
    </div>
  );
}

export function Bar({ value, max, label }: { value: number; max: number; label?: string }): JSX.Element {
  return <div class="bar" role="img" aria-label={label}><i style={{ width: `${Math.min(100, Math.round(100 * value / Math.max(1e-9, max)))}%` }} /></div>;
}

export function Section({ title, aside, children, id }: { title: string; aside?: ComponentChildren; children: ComponentChildren; id?: string }): JSX.Element {
  return <section class="sec" id={id}><div class="sec-h"><h3>{title}</h3>{aside ? <div class="sec-aside">{aside}</div> : null}</div>{children}</section>;
}

export function Note({ tone, children, action }: { tone?: "warn" | "bad" | "info"; children: ComponentChildren; action?: ComponentChildren }): JSX.Element {
  return <div class={"note" + (tone ? " " + tone : "")}><div>{children}</div>{action ? <div class="note-act">{action}</div> : null}</div>;
}

export function Chips<T extends string | number>({ value, options, onPick, label }: { value: T | null; options: [T, string][]; onPick: (v: T) => void; label: string }): JSX.Element {
  return <div class="chips" role="group" aria-label={label}>{options.map(([v, l]) => <button type="button" class="chip" aria-pressed={value === v} key={String(v)} onClick={() => onPick(v)}>{l}</button>)}</div>;
}

/** Hoja que sube desde abajo (en pantallas anchas, un cuadro centrado). Se cierra con Escape o tocando fuera. */
export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ComponentChildren; wide?: boolean }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", key); document.body.classList.add("no-scroll");
    const first = ref.current && ref.current.querySelector<HTMLElement>("input,textarea,button.primary");
    if (first) first.focus(); else if (ref.current) ref.current.focus();
    return () => { removeEventListener("keydown", key); document.body.classList.remove("no-scroll"); if (prev && prev.focus) prev.focus(); };
  }, []);
  return (
    <div class="sheet-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class={"sheet" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div class="sheet-h"><h2>{title}</h2><button type="button" class="btn ghost" onClick={onClose} aria-label="Cerrar">Cerrar</button></div>
        <div class="sheet-b">{children}</div>
      </div>
    </div>
  );
}

/** Buscador de cartas con autocompletado de Scryfall. */
export function CardSearch({ onPick, placeholder, action = "Agregar", id }: { onPick: (name: string) => void | Promise<unknown>; placeholder?: string; action?: string; id?: string }): JSX.Element {
  const [q, setQ] = useState(""); const [opts, setOpts] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [sel, setSel] = useState(-1);
  const seq = useRef(0);
  useEffect(() => {
    if (q.trim().length < 2) { setOpts([]); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => { const r = await autocomplete(q); if (my === seq.current) { setOpts(r.slice(0, 8)); setSel(-1); } }, 220);
    return () => clearTimeout(t);
  }, [q]);
  const pick = async (name: string) => { const n = name.trim(); if (!n || busy) return; setBusy(true); seq.current++; setOpts([]); try { await onPick(n); setQ(""); } finally { setBusy(false); } };
  return (
    <div class="search">
      <div class="search-row">
        <input id={id} type="text" value={q} placeholder={placeholder || "Nombre de la carta, en inglés"} autocomplete="off" autocapitalize="off" spellcheck={false} aria-label={placeholder || "Buscar carta"}
          onInput={e => setQ((e.target as HTMLInputElement).value)}
          onKeyDown={e => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(opts.length - 1, s + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(-1, s - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); void pick(sel >= 0 ? opts[sel] : (opts[0] && opts[0].toLowerCase() === q.trim().toLowerCase() ? opts[0] : q)); }
            else if (e.key === "Escape") setOpts([]);
          }} />
        <button type="button" class="btn" disabled={busy || q.trim().length < 2} onClick={() => void pick(q)}>{busy ? "Buscando…" : action}</button>
      </div>
      {opts.length ? <ul class="search-opts" role="listbox">{opts.map((o, i) => <li key={o} role="option" aria-selected={i === sel}><button type="button" class={i === sel ? "on" : ""} onClick={() => void pick(o)}>{o}</button></li>)}</ul> : null}
    </div>
  );
}

/** Botón que pide confirmar con un segundo toque, en vez de un cuadro del navegador. */
export function Confirm({ label, sure, onYes, class: cls }: { label: string; sure: string; onYes: () => void; class?: string }): JSX.Element {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <button type="button" class={(cls || "btn ghost") + (armed ? " danger" : "")} onClick={() => { if (armed) { setArmed(false); onYes(); } else setArmed(true); }}>{armed ? sure : label}</button>;
}

export function download(filename: string, text: string, type = "application/json"): void {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
export async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; }
  catch { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch { /* sin portapapeles */ } ta.remove(); return ok; }
}
