// Paso 2: armar por casillas. Cada casilla muestra cuántas cartas lleva, su meta y qué se podría agregar.
import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { S, addCard, removeCard, moveCard, saveDeck, insight, edhOf, edhForPlan, needsTheme, ensureCards, toast, draft } from "../data/store.ts";
import {
  buildSlots, nextStep, slotSuggestions, deckText, parseList, splitParsed, textToDeck, allNames, bracketOf, TYPE_ES, TYPE_ORDER, slug,
  type Deck, type EdhData, type Row, type Slot, type SlotKey,
} from "../engine/index.ts";
import { CardName, CardSearch, Note, Section, Sheet, Stack, pct, plural, copyText } from "./kit.tsx";
import { bracketImpact } from "./CardSheet.tsx";

/** Agrega una carta avisando si cambia el bracket. */
export async function addWithImpact(d: Deck, name: string, src?: string): Promise<void> {
  await ensureCards([name], { quiet: true });
  const impact = bracketImpact(d, name);
  const ok = await addCard(d.id, name, "cards", src);
  if (ok && impact) toast(impact, "warn");
}

const byCost = (a: Row, b: Row) => (a.m ? a.m.cmc : 99) - (b.m ? b.m.cmc : 99) || a.n.localeCompare(b.n);

function SlotBox({ d, slot, E, open, onToggle }: { d: Deck; slot: Slot; E: EdhData | null; open: boolean; onToggle: () => void }): JSX.Element {
  const [more, setMore] = useState(false);
  const { A } = insight(d);
  const sug = open && slot.k !== "other" ? slotSuggestions(slot.k, d, A, E, S.db, d.plan, more ? 24 : 8) : [];
  const goal = slot.lo === slot.hi ? `${slot.lo}` : `${slot.lo} a ${slot.hi}`;
  const verdict = slot.k === "other" ? (slot.count ? `${slot.count} sin función clara` : "Ninguna") : slot.gap ? `Faltan ${slot.gap}` : slot.over ? `Sobran ${slot.over}` : "En rango";
  return (
    <div class={"slot " + slot.state + (open ? " open" : "")} id={"slot-" + slot.k}>
      <button type="button" class="slot-h" aria-expanded={open} onClick={onToggle}>
        <span class="slot-name">{slot.n}</span>
        <span class="slot-num"><b>{slot.count}</b>{slot.k === "other" ? "" : <span class="muted"> de {goal}</span>}</span>
        <Stack count={slot.count} lo={slot.lo} hi={slot.hi} tone={slot.state} />
        <span class={"slot-verdict " + slot.state}>{verdict}</span>
      </button>
      {open ? <div class="slot-b">
        <p class="muted small">{slot.d}</p>
        {slot.rows.length ? <ul class="cards">{[...slot.rows].sort(byCost).map(r => (
          <li key={r.n}><span class="cost">{r.m ? (r.m.t === "Land" ? "T" : r.m.cmc) : "?"}</span><CardName name={r.n} deckId={d.id} m={r.m} />{r.q > 1 ? <span class="muted"> ×{r.q}</span> : null}
            <button type="button" class="x" aria-label={`Quitar ${r.n}`} onClick={() => void removeCard(d.id, r.n, "cards", false)}>Quitar</button></li>))}</ul>
          : <p class="muted">{slot.k === "other" ? "Todas tus cartas tienen una función o conectan con tus temas." : "Todavía no hay cartas en esta casilla."}</p>}
        {slot.k !== "other" ? (E ? (sug.length ? <>
          <h4>Qué se juega aquí con tu comandante</h4>
          <ul class="cards sug">{sug.map(s => (
            <li key={s.n}><span class="cost">{s.m.t === "Land" ? "T" : s.m.cmc}</span><CardName name={s.n} deckId={d.id} m={s.m} /><span class="why num">{s.incl != null ? pct(s.incl) : ""}</span>
              <button type="button" class="add" aria-label={`Agregar ${s.n}`} onClick={() => void addWithImpact(d, s.n, "sugerencia")}>Agregar</button></li>))}</ul>
          {!more && sug.length >= 8 ? <button class="btn ghost" onClick={() => setMore(true)}>Ver más</button> : null}
        </> : <p class="muted small">No quedan sugerencias para esta casilla dentro de tus colores y tu bracket.</p>)
          : <button class="btn" disabled={!!S.busy || !d.commanders.length} onClick={() => void edhForPlan(d)}>Ver qué se juega con tu comandante</button>) : null}
      </div> : null}
    </div>
  );
}

export function StepBuild({ d }: { d: Deck }): JSX.Element {
  const { A, Y } = insight(d); const size = 100 - d.commanders.length;
  const E = edhOf(d);
  const slots = buildSlots(A, Y, d.plan, d.commanders.length);
  const [open, setOpen] = useState<SlotKey | null>(null); const [toMaybe, setToMaybe] = useState(false); const [edit, setEdit] = useState(false); const [view, setView] = useState<"slots" | "types">("slots");
  useEffect(() => { if (needsTheme(d) && !S.busy) void edhForPlan(d); }, [d.id, d.plan.theme]);
  const toggle = (k: SlotKey) => { setOpen(open === k ? null : k); if (open !== k && !E && d.commanders.length && !S.busy) void edhForPlan(d); };
  const B = A.main ? bracketOf(d, A) : null;
  const types = TYPE_ORDER.map(t => ({ t, rows: A.rows.filter(r => (r.m ? r.m.t : "Unknown") === t) })).filter(g => g.rows.length);
  return (
    <div>
      <div class="lead">
        <p class="lead-text">{nextStep(slots, A, size)}</p>
        {A.main < size && d.commanders.length ? <button class="btn" disabled={!!S.busy} onClick={() => void draft(d.id)}>{A.main ? "Completar lo que falta" : "Armar borrador"}</button> : null}
      </div>
      {A.missing.length ? <Note tone="warn" action={<button class="btn" disabled={!!S.busy} onClick={() => void ensureCards(allNames(d), { force: false })}>Actualizar cartas</button>}>{plural(A.missing.length, "carta no tiene datos", "cartas no tienen datos")}: {A.missing.slice(0, 4).join(", ")}{A.missing.length > 4 ? "…" : ""}. Mientras tanto no cuentan en las casillas.</Note> : null}
      {A.off.length ? <Note tone="bad">Fuera de la identidad de color: {A.off.map((n, i) => <>{i ? ", " : ""}<CardName name={n} deckId={d.id} key={n} /></>)}.</Note> : null}
      {A.illegal.length ? <Note tone="bad">No legales en Commander: {A.illegal.map((n, i) => <>{i ? ", " : ""}<CardName name={n} deckId={d.id} key={n} /></>)}.</Note> : null}
      {A.dupes.length ? <Note tone="bad">Copias repetidas (Commander es de una copia por carta): {A.dupes.join(", ")}.</Note> : null}
      {B && d.plan.bracket && B.b > d.plan.bracket ? <Note tone="warn" action={<a class="btn" href={`#/mazo/${d.id}/ajustar`}>Ver qué sacar</a>}>La lista es bracket {B.b} y buscas {d.plan.bracket}: {B.why}.</Note> : null}

      <Section title="Agregar una carta" aside={<label class="check inline"><input type="checkbox" checked={toMaybe} onChange={e => setToMaybe((e.target as HTMLInputElement).checked)} /> <span>A probables</span></label>}>
        <CardSearch id="add-card" onPick={n => toMaybe ? addCard(d.id, n, "maybe") : addWithImpact(d, n)} />
      </Section>

      <Section title={view === "slots" ? "Casillas" : "Por tipo de carta"} aside={<div class="seg small" role="tablist"><button role="tab" aria-selected={view === "slots"} onClick={() => setView("slots")}>Casillas</button><button role="tab" aria-selected={view === "types"} onClick={() => setView("types")}>Tipos</button></div>}>
        {view === "slots" ? <>
          <p class="muted small">Cada raya es una carta; la franja marca la meta. Una carta que cumple dos funciones aparece en las dos casillas.</p>
          <div class="slots">{slots.map(s => <SlotBox d={d} slot={s} E={E} open={open === s.k} onToggle={() => toggle(s.k)} key={s.k} />)}</div>
        </> : <div class="types">{types.map(g => (
          <div key={g.t}><h4>{TYPE_ES[g.t] || g.t} <span class="muted">{g.rows.reduce((a, r) => a + r.q, 0)}</span></h4>
            <ul class="cards">{[...g.rows].sort(byCost).map(r => <li key={r.n}><span class="cost">{r.m ? (r.m.t === "Land" ? "T" : r.m.cmc) : "?"}</span><CardName name={r.n} deckId={d.id} m={r.m} />{r.q > 1 ? <span class="muted"> ×{r.q}</span> : null}
              <button type="button" class="x" aria-label={`Quitar ${r.n}`} onClick={() => void removeCard(d.id, r.n, "cards", false)}>Quitar</button></li>)}</ul></div>))}
          {!types.length ? <p class="muted">El mazo está vacío.</p> : null}</div>}
      </Section>

      <Section title={`Cartas probables${A.maybeN ? ` (${A.maybeN})` : ""}`}>
        {A.maybe.length ? <ul class="cards">{A.maybe.map(r => <li key={r.n}><span class="cost">{r.m ? (r.m.t === "Land" ? "T" : r.m.cmc) : "?"}</span><CardName name={r.n} deckId={d.id} m={r.m} />
          <button type="button" class="add" onClick={() => void moveCard(d.id, r.n, "cards")}>Al mazo</button><button type="button" class="x" aria-label={`Quitar ${r.n} de probables`} onClick={() => void removeCard(d.id, r.n, "maybe")}>Quitar</button></li>)}</ul>
          : <p class="muted">Cartas que estás considerando. No cuentan para el mazo ni para las pruebas.</p>}
      </Section>

      <Section title="La lista completa">
        <div class="row"><button class="btn" onClick={() => setEdit(true)}>Editar como texto</button><button class="btn ghost" onClick={async () => toast(await copyText(deckText(d)) ? "Lista copiada. Puedes pegarla en Moxfield o Archidekt para probarla allá." : "No se pudo copiar la lista.")}>Copiar lista</button></div>
        <p class="muted small">Para jugar manos con arrastrar y soltar, pega la lista en <a href="https://moxfield.com/decks/add" target="_blank" rel="noopener noreferrer">Moxfield</a> o <a href="https://archidekt.com/" target="_blank" rel="noopener noreferrer">Archidekt</a>.</p>
      </Section>
      {edit ? <EditText d={d} onClose={() => setEdit(false)} /> : null}
    </div>
  );
}

function EditText({ d, onClose }: { d: Deck; onClose: () => void }): JSX.Element {
  const [text, setText] = useState(deckText(d)); const [busy, setBusy] = useState(false);
  const s = splitParsed(parseList(textToDeck(text), { keepSide: true })); const n = s.cards.reduce((a, c) => a + c.q, 0);
  const saveIt = async () => {
    setBusy(true);
    try {
      const cmds = s.commanders.length ? s.commanders.slice(0, 2) : d.commanders;
      await saveDeck({ ...d, commanders: cmds, cards: s.cards.filter(c => !cmds.some(x => slug(x) === slug(c.n))), maybe: s.maybe }, "editar la lista");
      onClose(); await ensureCards([...cmds, ...s.cards.map(c => c.n), ...s.maybe.map(c => c.n)]);
    } finally { setBusy(false); }
  };
  return (
    <Sheet title="Editar la lista" onClose={onClose} wide>
      <label class="field"><span>Una carta por línea. Secciones: Commander, Deck y Maybeboard</span><textarea rows={16} value={text} spellcheck={false} onInput={e => setText((e.target as HTMLTextAreaElement).value)} /></label>
      <p class="muted small">Se leen {plural(n, "carta", "cartas")} en el mazo{s.maybe.length ? ` y ${s.maybe.reduce((a, c) => a + c.q, 0)} probables` : ""}{s.commanders.length ? `, con ${s.commanders.join(" + ")} al mando` : ""}. La lista anterior queda guardada en Versiones.</p>
      <div class="row end"><button class="btn primary" disabled={busy} onClick={() => void saveIt()}>{busy ? "Guardando…" : "Guardar lista"}</button></div>
    </Sheet>
  );
}
