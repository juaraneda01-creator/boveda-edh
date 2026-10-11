// Versiones: fotos de la lista. Se guarda una sola por tanda de cambios, y se pueden guardar a mano con nombre.
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { versionsOf, snapshot, restoreVersion, deleteVersion, touch } from "../data/store.ts";
import { diffLists, type Deck } from "../engine/index.ts";
import { Confirm, Pill, Section, dateTime, go, plural, ui } from "./kit.tsx";

export function StepVersions({ d }: { d: Deck }): JSX.Element {
  const vs = versionsOf(d.id); const [label, setLabel] = useState("");
  const total = (a: { q: number }[]) => a.reduce((s, c) => s + c.q, 0);
  const compare = (id: string) => { ui.ab = { deckId: d.id, a: id, b: "now" }; touch(); go(`#/mazo/${d.id}/probar`); };
  return (
    <div>
      <Section title="Guardar la lista actual">
        <p class="muted">Guarda una versión con nombre antes de un cambio grande. Después puedes compararla con la lista nueva o volver a ella.</p>
        <div class="search-row"><input type="text" value={label} maxLength={60} placeholder="Por ejemplo: antes de sacar los barridos" aria-label="Nombre de la versión" onInput={e => setLabel((e.target as HTMLInputElement).value)} />
          <button class="btn primary" disabled={!d.cards.length} onClick={async () => { await snapshot(d.id, label); setLabel(""); }}>Guardar versión</button></div>
      </Section>
      <Section title={`Versiones anteriores${vs.length ? ` (${vs.length})` : ""}`}>
        {!vs.length ? <p class="muted">Todavía no hay versiones. La app guarda una sola cada vez que cambias la lista (una por tanda de cambios seguidos).</p> :
          <ul class="versions">{vs.map(v => {
            const df = diffLists(v.cards, d.cards); const add = total(df.add), rem = total(df.rem);
            return <li key={v.id}>
              <div><b>{v.label}</b> {v.src === "guardada" ? <Pill tone="accent">guardada por ti</Pill> : null}
                <div class="muted small">{dateTime(v.at)}, {plural(total(v.cards), "carta", "cartas")}. {add || rem ? `Desde entonces entraron ${add} y salieron ${rem}.` : "Igual a la lista actual."}</div>
                {add || rem ? <details><summary class="small">Ver diferencias</summary><p class="small"><b>Entraron:</b> {df.add.map(c => c.n).join(", ") || "ninguna"}.</p><p class="small"><b>Salieron:</b> {df.rem.map(c => c.n).join(", ") || "ninguna"}.</p></details> : null}</div>
              <div class="row">
                <button class="btn" disabled={!add && !rem} onClick={() => compare(v.id)}>Comparar con la actual</button>
                <Confirm label="Volver a esta" sure="Toca de nuevo para restaurarla" onYes={() => void restoreVersion(v.id)} />
                <Confirm label="Eliminar" sure="¿Eliminar?" onYes={() => void deleteVersion(v.id)} />
              </div>
            </li>;
          })}</ul>}
      </Section>
    </div>
  );
}
