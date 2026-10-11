// Meta de Commander: torneos cEDH, lista vigente de Game Changers y reglas de los brackets.
import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { S, loadCedh, refreshGC, insight, newDeck, ensureCards } from "../data/store.ts";
import { BRACKETS, CEDH_SNAPSHOT, CEDH_SNAPSHOT_AT, slug } from "../engine/index.ts";
import { IN_CLAUDE } from "../data/relay.ts";
import { CardName, Note, Section, agoTxt, dateTxt, go, pct } from "./kit.tsx";

const key = (name: string) => name.split(" / ").map(slug).sort().join("|");

export function MetaScreen(): JSX.Element {
  useEffect(() => { void loadCedh(); void refreshGC(); }, []);
  const live = S.cedh; const busy = !!S.busy;
  const rows = live ? live.rows : CEDH_SNAPSHOT.map(([name, share, count]) => ({ name, share, count, conv: null as number | null, tops: null as number | null, colors: "" }));
  const mine = S.decks.filter(d => d.kind === "mine" && d.commanders.length);
  const myKeys = new Map(mine.map(d => [key(d.commanders.join(" / ")), d]));
  const start = async (name: string) => { const cmds = name.split(" / ").slice(0, 2); await ensureCards(cmds, { quiet: true }); const d = await newDeck({ name: cmds[0].split(",")[0], commanders: cmds, plan: { bracket: 5, theme: "", inter: "high" } }); go(`#/mazo/${d.id}/plan`); };
  const gc = S.db.gcNames(); const inDecks = new Set(mine.flatMap(d => insight(d).A.gc.map(slug)));
  return (
    <div>
      <div class="page-h"><h1>Meta de Commander</h1></div>
      <Section title="Torneos cEDH, últimos 3 meses" aside={IN_CLAUDE ? undefined : <button class="btn ghost" disabled={busy} onClick={() => void loadCedh(true)}>Actualizar</button>}>
        {live ? <p class="muted small">EDHTop16, consultado {agoTxt(live.at)} ({dateTxt(live.at)}).</p>
          : IN_CLAUDE ? <p class="muted small">Foto guardada de EDHTop16 del {CEDH_SNAPSHOT_AT}. Los datos en vivo no están disponibles en la versión dentro de claude.ai.</p>
          : <Note tone="warn">No se pudo consultar EDHTop16 desde aquí. Se muestra la foto guardada del {CEDH_SNAPSHOT_AT}.</Note>}
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th class="n">#</th><th>Comandante</th><th class="n">Del meta</th><th class="n">Listas</th>{live ? <th class="n">Llega al corte</th> : null}<th></th></tr></thead>
          <tbody>{rows.slice(0, 30).map((r, i) => { const own = myKeys.get(key(r.name)); return (
            <tr key={r.name} class={own ? "mine" : ""}><td class="n">{i + 1}</td><td>{r.name}</td><td class="n">{r.share == null ? "—" : pct(r.share / 100, 1)}</td><td class="n">{r.count ?? "—"}</td>{live ? <td class="n">{r.conv == null ? "—" : pct(r.conv / 100)}</td> : null}
              <td class="n">{own ? <a href={`#/mazo/${own.id}/armar`}>Tu mazo</a> : <button class="btn ghost" disabled={busy} onClick={() => void start(r.name)}>Armar</button>}</td></tr>); })}</tbody></table></div>
        <p class="muted small">“Llega al corte” es la parte de las listas de ese comandante que pasa a la fase final. Para ver qué cartas llevan esas listas, abre tu mazo y ve a Ajustar.</p>
      </Section>

      <Section title={`Game Changers (${gc.length})`} aside={<button class="btn ghost" disabled={busy} onClick={() => void refreshGC(true)}>Actualizar</button>}>
        <p class="muted small">{S.gcAt ? `Lista de Scryfall, actualizada ${agoTxt(S.gcAt)}.` : "Lista incluida en la app (guía oficial del 9 de febrero de 2026). Se actualiza sola desde Scryfall cuando hay conexión."} En negrita, las que llevas en algún mazo tuyo.</p>
        <p class="gc-list">{gc.map((n, i) => <>{i ? ", " : ""}<span class={inDecks.has(slug(n)) ? "mine" : ""} key={n}><CardName name={n} m={S.db.get(n)} /></span></>)}</p>
      </Section>

      <Section title="Los cinco brackets">
        <p class="muted small">Guía oficial de Wizards of the Coast, actualización del 9 de febrero de 2026. Sigue en versión beta: puede cambiar.</p>
        <dl class="brackets">{BRACKETS.slice(1).map(b => <div key={b!.n}><dt>{b!.n}. {b!.name}</dt><dd>{b!.text}</dd></div>)}</dl>
      </Section>
    </div>
  );
}
