// Paso 1: el plan. Comandante, bracket buscado, estrategia e interacción definen las metas de cada casilla.
import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { S, saveDeck, deleteDeck, draft, edhOf, loadEdh, insight, ensureCards } from "../data/store.ts";
import { BRACKETS, bracketOf, bracketRule, slotGoals, type Deck, type Interaction, type Plan } from "../engine/index.ts";
import { Chips, Confirm, Note, Section, Sheet, go } from "./kit.tsx";
import { CommanderPicker } from "./Decks.tsx";

export function StepPlan({ d }: { d: Deck }): JSX.Element {
  const { A, Y } = insight(d); const E = edhOf(d);
  const [name, setName] = useState(d.name); const [theme, setTheme] = useState(d.plan.theme); const [notes, setNotes] = useState(d.notes || "");
  const [pick, setPick] = useState(false); const [cmds, setCmds] = useState<string[]>(d.commanders); const [excl, setExcl] = useState("");
  useEffect(() => { setName(d.name); setTheme(d.plan.theme); setNotes(d.notes || ""); setCmds(d.commanders); }, [d.id]);
  const setPlan = (p: Partial<Plan>) => void saveDeck({ ...d, plan: { ...d.plan, ...p } });
  const goals = slotGoals(d.plan, d.commanders.length);
  const B = A.main ? bracketOf(d, A) : null; const size = 100 - d.commanders.length;
  const detected = Y.themes.filter(t => t.state === "fuerte" || t.state === "a medias").slice(0, 4);
  const busy = !!S.busy;
  return (
    <div class="cols">
      <div>
        <Section title="Comandante y nombre">
          <label class="field"><span>Nombre del mazo</span><input type="text" value={name} maxLength={80} onInput={e => setName((e.target as HTMLInputElement).value)} onBlur={() => { if (name.trim() && name !== d.name) void saveDeck({ ...d, name: name.trim() }); }} /></label>
          <p>{d.commanders.length ? <>Comandante: <b>{d.commanders.join(" + ")}</b>.</> : <span class="warn-text">Este mazo todavía no tiene comandante.</span>} <button class="btn ghost" onClick={() => setPick(true)}>{d.commanders.length ? "Cambiar" : "Elegir comandante"}</button></p>
        </Section>

        <Section title="Bracket buscado">
          <p class="muted">Define qué cartas se permiten y cuántas tierras y tutores conviene llevar. Guía oficial del 9 de febrero de 2026, todavía en versión beta.</p>
          <Chips label="Bracket buscado" value={d.plan.bracket ?? 0} options={[[0, "Sin definir"], ...BRACKETS.slice(1).map(b => [b!.n, `${b!.n}. ${b!.name}`] as [number, string])]} onPick={v => setPlan({ bracket: v || null })} />
          {d.plan.bracket ? <p class="rule">{bracketRule(d.plan.bracket).text}</p> : <p class="muted small">Sin bracket, las sugerencias no filtran Game Changers ni turnos extra.</p>}
          {B && d.plan.bracket ? (B.b > d.plan.bracket
            ? <Note tone="warn" action={<a class="btn" href={`#/mazo/${d.id}/ajustar`}>Ver qué sacar</a>}>Hoy tu lista es bracket {B.b}: {B.why}. Buscas {d.plan.bracket}.</Note>
            : <Note tone="info">Tu lista cabe en el bracket {d.plan.bracket} (hoy es {B.b}: {B.why}).</Note>) : null}
        </Section>

        <Section title="Estrategia">
          <p class="muted">Si eliges un tema, el borrador y las sugerencias le dan prioridad a las cartas de ese tema.</p>
          <label class="field"><span>Tema del mazo</span><input type="text" value={theme} list="themes" placeholder="Por ejemplo: tokens, +1/+1 counters, aristocrats" autocomplete="off" onInput={e => setTheme((e.target as HTMLInputElement).value)} onBlur={() => { if (theme.trim() !== d.plan.theme) setPlan({ theme: theme.trim() }); }} /></label>
          {E && E.themes.length ? <><datalist id="themes">{E.themes.map(t => <option value={t.v} key={t.s} />)}</datalist>
            <div class="chips" role="group" aria-label="Temas de EDHREC para este comandante">{E.themes.slice(0, 10).map(t => <button type="button" class="chip" key={t.s} aria-pressed={d.plan.theme.toLowerCase() === t.v.toLowerCase()} onClick={() => { const v = d.plan.theme.toLowerCase() === t.v.toLowerCase() ? "" : t.v; setTheme(v); setPlan({ theme: v }); }}>{t.v}</button>)}</div>
            <p class="muted small">Temas más jugados con este comandante según EDHREC.</p></>
            : d.commanders.length ? <button class="btn" disabled={busy} onClick={() => void loadEdh(d)}>Ver los temas de este comandante</button> : null}
          {detected.length ? <p class="small">Lo que tu lista ya hace: {detected.map(t => `${t.es.toLowerCase()} (${t.state})`).join(", ")}.</p> : null}
        </Section>

        <Section title="Interacción">
          <p class="muted">Cuánto removal y cuántos barridos quieres llevar.</p>
          <Chips<Interaction> label="Interacción" value={d.plan.inter} options={[["low", "Poca"], ["mid", "Normal"], ["high", "Mucha"]]} onPick={v => setPlan({ inter: v })} />
        </Section>

        <Section title="Notas">
          <label class="field"><span>Cómo quieres que gane el mazo, qué probar, qué evitar</span><textarea rows={3} value={notes} maxLength={2000} onInput={e => setNotes((e.target as HTMLTextAreaElement).value)} onBlur={() => { if (notes !== (d.notes || "")) void saveDeck({ ...d, notes }); }} /></label>
        </Section>
      </div>

      <div>
        <Section title="Metas de cada casilla">
          <p class="muted">Salen del bracket y la interacción que elegiste. En Armar verás cuánto llevas de cada una.</p>
          <table class="tbl"><thead><tr><th>Casilla</th><th class="n">Meta</th><th class="n">Llevas</th></tr></thead>
            <tbody>{goals.filter(g => g.k !== "other").map(g => { const have = g.k === "plan" ? null : g.k === "tutor" ? A.tutors.length : A.roles[g.k as keyof typeof A.roles]; return <tr key={g.k}><td>{g.n}</td><td class="n">{g.lo === g.hi ? g.lo : `${g.lo} a ${g.hi}`}</td><td class="n">{have == null ? "" : have}</td></tr>; })}</tbody></table>
        </Section>

        <Section title={A.main ? "Completar el mazo" : "Armar un borrador"}>
          {A.main >= size ? <p class="muted">El mazo ya tiene sus {size} cartas. Para cambiar cartas una por una, sigue en <a href={`#/mazo/${d.id}/ajustar`}>Ajustar</a>.</p> : <>
            <p>{A.main ? `Faltan ${size - A.main} cartas. ` : ""}La app llena cada casilla con lo más jugado con tu comandante, dentro de tus colores y del bracket que buscas. No quita nada de lo que ya pusiste.</p>
            <label class="field"><span>Cartas que no quieres (opcional, separadas por coma)</span><input type="text" value={excl} placeholder="Cyclonic Rift, Rhystic Study" autocomplete="off" onInput={e => setExcl((e.target as HTMLInputElement).value)} /></label>
            <button class="btn primary" disabled={busy || !d.commanders.length} onClick={async () => { await draft(d.id, excl.split(",").map(x => x.trim()).filter(Boolean)); go(`#/mazo/${d.id}/armar`); }}>{A.main ? "Completar lo que falta" : "Armar borrador"}</button>
            {!d.commanders.length ? <p class="muted small">Primero elige un comandante.</p> : null}
          </>}
        </Section>

        <Section title="Este mazo">
          <label class="check"><input type="checkbox" checked={d.kind === "ref"} onChange={e => void saveDeck({ ...d, kind: (e.target as HTMLInputElement).checked ? "ref" : "mine" })} /> <span>Es un mazo de referencia (de un rival o de torneo)</span></label>
          {d.kind === "ref" ? <label class="field"><span>De quién es</span><input type="text" value={d.owner || ""} maxLength={40} onChange={e => void saveDeck({ ...d, owner: (e.target as HTMLInputElement).value.trim() })} /></label> : null}
          <p><Confirm label="Eliminar mazo" sure="Toca de nuevo para eliminar el mazo, sus versiones y sus partidas" onYes={() => { void deleteDeck(d.id); go("#/"); }} /></p>
        </Section>
      </div>

      {pick ? <Sheet title="Elegir comandante" onClose={() => setPick(false)} wide>
        <CommanderPicker picked={cmds} onChange={setCmds} />
        <div class="row end"><button class="btn primary" disabled={!cmds.length} onClick={async () => { await ensureCards(cmds, { quiet: true }); await saveDeck({ ...d, commanders: cmds, cards: d.cards.filter(c => !cmds.includes(c.n)) }, "cambiar comandante"); setPick(false); }}>Usar {cmds.length > 1 ? "estos comandantes" : "este comandante"}</button></div>
      </Sheet> : null}
    </div>
  );
}
