// Paso 4: ajustar. Qué cambiar primero, cómo llegar al bracket buscado, sinergias, combos y comparación con el meta.
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { S, insight, edhOf, edhForPlan, loadCombos, loadStaples, staplesOf, swapCard, removeCard, gamesOf, toast } from "../data/store.ts";
import {
  swaps, bracketPlan, bracketOf, metaCompare, synergyAdds, combos2, playBracket, gameStats, deckText, slug, TAG_ES, BRACKETS,
  type Deck, type ThemeResult,
} from "../engine/index.ts";
import { Bar, CardName, Chips, Note, Pill, Section, Stat, agoTxt, copyText, pct, plural } from "./kit.tsx";
import { addWithImpact } from "./StepBuild.tsx";

type Tab = "cambios" | "bracket" | "sinergias" | "combos" | "meta";
const TABS: [Tab, string][] = [["cambios", "Cambios"], ["bracket", "Bracket"], ["sinergias", "Sinergias"], ["combos", "Combos"], ["meta", "Meta"]];

export function StepTune({ d }: { d: Deck }): JSX.Element {
  const { A, Y, H } = insight(d); const E = edhOf(d); const busy = !!S.busy;
  const [target, setTarget] = useState<number>(d.plan.bracket || Math.max(2, A.main ? bracketOf(d, A).b : 3));
  const [openTheme, setOpenTheme] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("cambios");
  if (!A.main) return <div class="empty"><h2>Aún no hay nada que ajustar</h2><p>Primero arma el mazo o pide un borrador.</p><a class="btn primary" href={`#/mazo/${d.id}/plan`}>Ir al plan</a></div>;
  const needE = <button class="btn" disabled={busy || !d.commanders.length} onClick={() => void edhForPlan(d)}>Consultar qué se juega con tu comandante</button>;
  const SW = E ? swaps(d, A, E, S.db, d.plan, 10) : [];
  const P = bracketPlan(d, A, target, S.db, E);
  const M = E ? metaCompare(d, A, E, S.db, Y) : null;
  const st = staplesOf(d); const inDeck = new Set(A.rows.map(r => slug(r.n)));
  const c2 = combos2(d);
  const themes = Y.themes.filter(t => t.state !== "ausente").slice(0, 6);
  const tone = (s: string) => s === "fuerte" ? "good" : s === "a medias" ? "warn" : "bad";
  const prompt = () => {
    const B = bracketOf(d, A), PB = playBracket(d, A, H, gamesOf(d.id)), gs = gameStats(gamesOf(d.id));
    return [
      `Revisa este mazo de Commander y propón hasta 8 cambios concretos (carta que sale por carta que entra), con el motivo de cada uno.`,
      `Comandante: ${d.commanders.join(" + ")}. Bracket buscado: ${d.plan.bracket || "sin definir"}. Estrategia: ${d.plan.theme || "sin definir"}.`,
      `Estado según mi app: bracket oficial ${B.b} (${B.why}); bracket por juego ${PB.b}; ${A.roles.land} tierras, ${A.roles.ramp} ramp, ${A.roles.draw} robo, ${A.roles.removal} removal, ${A.roles.wipe} barridos; coste promedio ${A.avg.toFixed(2)}.`,
      H ? `Prueba de manos: ${pct(H.pMull)} con mulligan, ${pct(H.pScrew)} atascadas en el turno 4, comandante en el turno ${H.avgTurn ? H.avgTurn.toFixed(1) : "?"}.` : "",
      `Sinergias: ${themes.map(t => `${t.es} ${t.state} (habilitan ${t.E}, aprovechan ${t.P})`).join("; ") || "ninguna clara"}. Cohesión ${Y.cohesion} %. Cartas sueltas: ${Y.lonely.map(r => r.n).slice(0, 15).join(", ") || "ninguna"}.`,
      gs.n ? `Partidas reales: ${gs.w} victorias en ${gs.n}.` : "",
      d.notes ? `Mis notas: ${d.notes}` : "",
      `Respeta la identidad de color y el bracket buscado. Nombres de cartas en inglés.`, "", deckText(d),
    ].filter(x => x !== "").join("\n");
  };
  return (
    <div>
      <div class="seg" role="tablist" aria-label="Qué ajustar">{TABS.map(([k, l]) => <button role="tab" aria-selected={tab === k} key={k} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === "cambios" ? <><Section title="Qué cambiar primero" aside={E ? <span class="muted small">EDHREC, {agoTxt(E.at)}{E.theme ? `, tema ${E.theme}` : ""}</span> : null}>
        {!E ? <><p class="muted">La app compara tu lista con lo que juega la gente con el mismo comandante y propone cambios uno por uno.</p>{needE}</> : SW.length ? <>
          <p class="muted">Entra la carta más jugada que te falta; sale la menos jugada que no cubre una casilla escasa. Cada cambio queda en Versiones y se puede probar en A contra B.</p>
          <ul class="swaps">{SW.map(s => <li key={s.in}>
            <div><span class="out">Sale <CardName name={s.out} deckId={d.id} m={S.db.get(s.out)} /></span> <span class="in">Entra <CardName name={s.in} deckId={d.id} m={S.db.get(s.in)} /></span><div class="muted small">{s.why}</div></div>
            <button class="btn" disabled={busy} onClick={() => void swapCard(d.id, s.out, s.in)}>Aplicar</button></li>)}</ul>
        </> : <p class="muted">No hay cambios claros: tu lista ya lleva las cartas más jugadas que caben en tu plan.</p>}
      </Section>
      <Section title="Pedir una segunda opinión">
        <p class="muted">Copia un resumen del mazo con todo lo que la app midió y pégalo en una conversación con Claude para pedir cambios razonados.</p>
        <button class="btn" onClick={async () => toast(await copyText(prompt()) ? "Resumen copiado. Pégalo en una conversación con Claude." : "No se pudo copiar el resumen.")}>Copiar resumen del mazo</button>
      </Section></> : null}

      {tab === "bracket" ? <Section title="Llegar a un bracket">
        <Chips<number> label="Bracket objetivo" value={target} options={BRACKETS.slice(1).map(b => [b!.n, `${b!.n}. ${b!.name}`] as [number, string])} onPick={setTarget} />
        <p class="rule">{P.R.text}</p>
        <ul class="checks">{P.checks.map(c => <li class={c.ok === true ? "ok" : c.ok === false ? "no" : "na"} key={c.t}><span aria-hidden="true">{c.ok === true ? "✓" : c.ok === false ? "✕" : "?"}</span><span class="sr">{c.ok === true ? "Cumple: " : c.ok === false ? "No cumple: " : "Sin revisar: "}</span>{c.t}</li>)}</ul>
        {P.cuts.length ? <><h4>Para bajar a este bracket, saca</h4><ul class="swaps">{P.cuts.map(c => <li key={c.n}>
          <div><span class="out">Sale <CardName name={c.n} deckId={d.id} m={S.db.get(c.n)} /></span> <span class="muted small">({c.why})</span>{c.rep ? <span class="in"> Entra <CardName name={c.rep} deckId={d.id} m={S.db.get(c.rep)} /></span> : null}</div>
          {c.rep ? <button class="btn" disabled={busy} onClick={() => void swapCard(d.id, c.n, c.rep!, "plan por bracket")}>Aplicar</button> : <button class="btn" onClick={() => void removeCard(d.id, c.n)}>Quitar</button>}</li>)}</ul>
          {!E ? <p class="muted small">Con los datos de EDHREC, la app propone además un reemplazo para cada carta. {needE}</p> : null}</> : null}
        {P.adds.length ? <><h4>Para subir a este bracket, considera</h4><ul class="cards sug">{P.adds.map(a => <li key={a.n}><CardName name={a.n} deckId={d.id} m={S.db.get(a.n)} /><span class="why">{a.why}</span><button type="button" class="add" onClick={() => void addWithImpact(d, a.n, "plan por bracket")}>Agregar</button></li>)}</ul></> : null}
        {P.bench ? <><h4>Referencias de cEDH</h4><table class="tbl"><thead><tr><th></th><th class="n">Llevas</th><th class="n">Meta</th></tr></thead><tbody>{P.bench.map(b => <tr key={b.k}><td>{b.k}</td><td class={"n" + (b.ok ? " best" : "")}>{b.v}</td><td class="n">{b.goal}</td></tr>)}</tbody></table></> : null}
        {!P.cuts.length && !P.adds.length ? <p class="muted">Tu lista cumple las reglas de este bracket.</p> : null}
      </Section> : null}

      {tab === "sinergias" ? <Section title="Sinergias">
        <div class="stats">
          <Stat k="cohesión" v={Y.cohesion + " %"} sub="hechizos conectados con algún tema" tone={Y.cohesion >= 70 ? "good" : Y.cohesion >= 45 ? "warn" : "bad"} />
          <Stat k="temas fuertes" v={Y.themes.filter(t => t.state === "fuerte").length} />
          <Stat k="cartas sueltas" v={Y.lonely.length} tone={Y.lonely.length > 8 ? "warn" : undefined} />
        </div>
        <p class="muted small">Un tema funciona cuando hay cartas que lo habilitan y cartas que lo aprovechan.</p>
        {themes.length ? <div class="themes">{themes.map(t => <ThemeBox d={d} t={t} open={openTheme === t.k} onToggle={() => setOpenTheme(openTheme === t.k ? null : t.k)} tone={tone(t.state)} key={t.k} />)}</div> : <p class="muted">No se detectan temas todavía. Agrega más cartas con un plan común.</p>}
        {Y.tribes.length ? <p class="small">Tribus: {Y.tribes.map(t => `${t.s} (${t.n} criaturas${t.pay.length ? `, ${t.pay.length} la aprovechan` : ", ninguna carta la aprovecha"})`).join("; ")}.</p> : null}
        {Y.lonely.length ? <><h4>Cartas sueltas</h4><p class="muted small">No habilitan ni aprovechan ninguno de tus temas y no son ramp, robo, removal ni protección. Son las primeras candidatas a salir.</p>
          <ul class="cards">{Y.lonely.map(r => <li key={r.n}><span class="cost">{r.m ? r.m.cmc : "?"}</span><CardName name={r.n} deckId={d.id} m={r.m} /><button type="button" class="x" aria-label={`Quitar ${r.n}`} onClick={() => void removeCard(d.id, r.n)}>Quitar</button></li>)}</ul></> : null}
      </Section> : null}

      {tab === "combos" ? <Section title="Combos" aside={d.combos ? <span class="muted small">Commander Spellbook, {agoTxt(d.combos.at)}</span> : null}>
        {!d.combos ? <><p class="muted">Busca en Commander Spellbook los combos que tu lista ya tiene y los que quedan a una carta. Los de 2 cartas cambian el bracket.</p><button class="btn" disabled={busy} onClick={() => void loadCombos(d.id)}>Buscar combos</button></> : <>
          {c2.length ? <Note tone="warn">{plural(c2.length, "combo de 2 cartas", "combos de 2 cartas")}: con eso la lista es bracket 4 o más.</Note> : null}
          {d.combos.inc.length ? <ul class="combos">{d.combos.inc.slice(0, 12).map(c => <li key={c.id}><div>{c.cards.map((n, i) => <>{i ? " + " : ""}<CardName name={n} deckId={d.id} m={S.db.get(n)} key={n} /></>)}</div><div class="muted small">{c.prod.slice(0, 3).join(", ") || "Sin resultado descrito"}</div></li>)}</ul> : <p class="muted">Tu lista no tiene combos catalogados.</p>}
          {d.combos.inc.length > 12 ? <p class="muted small">Y {d.combos.inc.length - 12} más.</p> : null}
          {d.combos.almost.filter(c => c.cards.filter(n => !inDeck.has(slug(n)) && !d.commanders.some(x => slug(x) === slug(n))).length === 1).length ? <><h4>A una carta de distancia</h4>
            <ul class="combos">{d.combos.almost.map(c => ({ c, miss: c.cards.filter(n => !inDeck.has(slug(n)) && !d.commanders.some(x => slug(x) === slug(n))) })).filter(x => x.miss.length === 1).slice(0, 8).map(({ c, miss }) => <li key={c.id}>
              <div>Falta <CardName name={miss[0]} deckId={d.id} m={S.db.get(miss[0])} /> para {c.cards.filter(n => n !== miss[0]).join(" + ")}</div><div class="muted small">{c.prod.slice(0, 3).join(", ")}</div></li>)}</ul></> : null}
          <button class="btn ghost" disabled={busy} onClick={() => void loadCombos(d.id)}>Buscar de nuevo</button>
        </>}
      </Section> : null}

      {tab === "meta" ? <Section title="Tu lista contra lo que juega el resto" aside={E && E.decks ? <span class="muted small">{E.decks.toLocaleString("es-CL")} mazos en EDHREC</span> : null}>
        {!M ? <><p class="muted">Compara tu lista con la lista típica de tu comandante: qué llevas del núcleo, qué te falta y qué juegas tú que casi nadie juega.</p>{needE}</> : <>
          <div class="stats">
            <Stat k="parecido a la lista típica" v={M.score + " %"} sub="según las 60 cartas más jugadas" />
            <Stat k="del núcleo" v={`${M.coreHave} de ${M.core.length}`} sub="cartas en la mitad o más de las listas" />
            <Stat k="poco jugadas" v={M.rare.length} sub="en menos de 5 % de las listas" />
          </div>
          <p class="muted small">No es una nota. Parecerse poco puede ser una decisión tuya: lo útil es ver las diferencias una por una.</p>
          {M.missing.length ? <><h4>Muy jugadas que no llevas</h4><ul class="cards sug">{M.missing.map(m => <li key={m.n}><span class="cost">{m.m ? (m.m.t === "Land" ? "T" : m.m.cmc) : "?"}</span><CardName name={m.n} deckId={d.id} m={m.m} /><span class="why num">{pct(m.incl)}</span><button type="button" class="add" onClick={() => void addWithImpact(d, m.n, "comparación con el meta")}>Agregar</button></li>)}</ul></> : null}
          {M.rare.length ? <><h4>Las llevas tú y casi nadie más</h4><ul class="cards">{M.rare.slice(0, 20).map(r => <li key={r.n}><CardName name={r.n} deckId={d.id} m={S.db.get(r.n)} /><span class="why">{r.linked ? "conecta con tus temas" : "no conecta con tus temas"}</span></li>)}</ul></> : null}
        </>}
        <h4>Listas de torneo de este comandante</h4>
        {st ? <><p class="small">{st.list.filter(n => inDeck.has(slug(n))).length} de las {st.list.length} cartas más jugadas en torneos cEDH están en tu lista. <span class="muted">EDHTop16, {agoTxt(st.at)}.</span></p>
          <ul class="cards sug">{st.list.filter(n => !inDeck.has(slug(n))).slice(0, 15).map(n => <li key={n}><CardName name={n} deckId={d.id} m={S.db.get(n)} /><button type="button" class="add" onClick={() => void addWithImpact(d, n, "listas de torneo")}>Agregar</button></li>)}</ul></>
          : <><p class="muted small">Sirve si apuntas a bracket 4 o 5: muestra qué llevan las listas de torneo y tú no.</p><button class="btn ghost" disabled={busy || !d.commanders.length} onClick={() => void loadStaples(d)}>Consultar EDHTop16</button></>}
      </Section> : null}
    </div>
  );
}

function ThemeBox({ d, t, open, onToggle, tone }: { d: Deck; t: ThemeResult; open: boolean; onToggle: () => void; tone: string }): JSX.Element {
  const { A } = insight(d); const E = edhOf(d);
  const adds = open && t.need ? synergyAdds(d, A, t, S.db, E, 8) : [];
  const names = (rows: ThemeResult["enR"]) => rows.length ? rows.slice(0, 12).map((r, i) => <>{i ? ", " : ""}<CardName name={r.n} deckId={d.id} m={r.m} key={r.n} /></>) : <span class="muted">ninguna</span>;
  return (
    <div class="theme">
      <div class="theme-h"><b>{t.es}</b>{t.cmd ? <Pill tone="accent">tu comandante</Pill> : null}<Pill tone={tone as "good" | "warn" | "bad"}>{t.state}</Pill></div>
      <div class="theme-sides">
        <div><div class="small">Habilitan <b>{t.E}</b> <span class="muted">de {t.me} o más</span></div><Bar value={t.E} max={t.me} label={`Habilitan ${t.E} de ${t.me}`} /><div class="small theme-cards">{names(t.enR)}{t.enR.length > 12 ? ` y ${t.enR.length - 12} más` : ""}</div></div>
        <div><div class="small">Aprovechan <b>{t.P}</b> <span class="muted">de {t.mp} o más</span></div><Bar value={t.P} max={t.mp} label={`Aprovechan ${t.P} de ${t.mp}`} /><div class="small theme-cards">{names(t.payR)}{t.payR.length > 12 ? ` y ${t.payR.length - 12} más` : ""}</div></div>
      </div>
      {t.need ? <div class="theme-need"><span class="small">Le faltan cartas que {t.need === "en" ? "habiliten" : "aprovechen"} el tema.</span> <button class="btn ghost" onClick={onToggle} aria-expanded={open}>{open ? "Ocultar" : "Ver sugerencias"}</button>
        {open ? (adds.length ? <ul class="cards sug">{adds.map(x => <li key={x.n}><span class="cost">{x.m.cmc}</span><CardName name={x.n} deckId={d.id} m={x.m} /><span class="why">{x.incl ? pct(x.incl) + ", " : ""}{x.m.tg.filter(k => TAG_ES[k]).slice(0, 2).map(k => TAG_ES[k]).join(", ")}</span><button type="button" class="add" onClick={() => void addWithImpact(d, x.n, "sinergia")}>Agregar</button></li>)}</ul>
          : <p class="muted small">No hay candidatas entre las cartas conocidas. Consulta qué se juega con tu comandante para tener más opciones.</p>) : null}</div> : null}
    </div>
  );
}
