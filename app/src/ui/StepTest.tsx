// Paso 3: probar. Cuatro pruebas: manos, partidas simuladas, partidas reales y una versión contra otra.
import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { S, insight, gamesOf, versionsOf, addGame, deleteGame, saveSim, ensureCards, toast, touch } from "../data/store.ts";
import {
  health, simRun, compareVersions, gameStats, winTurnOf, playBracket, bracketOf, GAME_HOW, howEs, allNames, slug, UserError,
  type Combos, type Comparison, type Deck, type Entry, type GameResult, type SimInput, type Version,
} from "../engine/index.ts";
import { Bar, CardName, Chips, Confirm, Note, Section, Stat, dateTime, dateTxt, num1, pct, plural, turnTxt, ui } from "./kit.tsx";

type Tab = "manos" | "simuladas" | "reales" | "ab";
const SIM_HOW: Record<string, string> = { combat: "combate", drain: "drenaje", combo: "combo", cmdr: "daño de comandante", poison: "veneno" };
const p100 = (v: number) => Math.round(v * 100);

export function StepTest({ d }: { d: Deck }): JSX.Element {
  const [tab, setTab] = useState<Tab>(ui.ab && ui.ab.deckId === d.id ? "ab" : "manos");
  const { A } = insight(d);
  if (A.main < 60) return <div class="empty"><h2>Todavía no hay suficiente para probar</h2><p>Las pruebas necesitan al menos 60 cartas en el mazo. Llevas {A.main}.</p><a class="btn primary" href={`#/mazo/${d.id}/armar`}>Seguir armando</a></div>;
  return (
    <div>
      <div class="seg" role="tablist" aria-label="Tipo de prueba">
        {([["manos", "Manos"], ["simuladas", "Simuladas"], ["reales", "Reales"], ["ab", "A contra B"]] as [Tab, string][]).map(([k, l]) => <button role="tab" aria-selected={tab === k} key={k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {A.missing.length ? <Note tone="warn">{plural(A.missing.length, "carta sin datos se trata", "cartas sin datos se tratan")} como una criatura promedio en las pruebas.</Note> : null}
      {tab === "manos" ? <Hands d={d} /> : tab === "simuladas" ? <Simulated d={d} /> : tab === "reales" ? <Real d={d} /> : <AB d={d} />}
    </div>
  );
}

/* ---------- manos ---------- */
function Hands({ d }: { d: Deck }): JSX.Element {
  const { A, H } = insight(d);
  const [hand, setHand] = useState<{ lib: string[]; n: number; mull: number } | null>(null);
  const deal = (mull = 0) => { const lib: string[] = []; for (const c of d.cards) for (let i = 0; i < c.q; i++) lib.push(c.n); for (let i = lib.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [lib[i], lib[j]] = [lib[j], lib[i]]; } setHand({ lib, n: 7, mull }); };
  useEffect(() => { setHand(null); }, [d.id, d.updated]);
  if (!H) return <p class="muted">No hay datos suficientes para probar manos.</p>;
  const Hc = health(A, H.pScrew);
  const isLand = (n: string) => { const m = S.db.get(n); return !!m && m.t === "Land"; };
  const shown = hand ? hand.lib.slice(0, hand.n) : []; const lands = shown.filter(isLand).length;
  // con mulligan de Londres, el primero es gratis en Commander: se roban 7 y se manda al fondo una menos cada vez
  const toBottom = hand ? Math.max(0, hand.mull - 1) : 0;
  return (
    <div class="cols">
      <div>
        <Section title="Consistencia en 10.000 manos">
          <p class="muted">La app reparte 10.000 manos iniciales y juega los primeros 10 turnos en solitario: una tierra por turno, ramp y comandante.</p>
          <div class="stats">
            <Stat k="manos con mulligan" v={pct(H.pMull)} tone={H.pMull <= 0.2 ? "good" : H.pMull <= 0.3 ? "warn" : "bad"} />
            <Stat k="atascadas en el turno 4" v={pct(H.pScrew)} sub="menos de 3 tierras" tone={H.pScrew <= 0.15 ? "good" : H.pScrew <= 0.25 ? "warn" : "bad"} />
            <Stat k="inundadas" v={pct(H.pFlood)} sub="8 o más tierras al turno 6" tone={H.pFlood <= 0.12 ? "good" : "warn"} />
            <Stat k="comandante en mesa" v={turnTxt(H.avgTurn)} sub={`cuesta ${H.cmdCmc}; al turno ${Math.max(4, H.cmdCmc)}: ${pct(H.byT[Math.min(6, Math.max(4, H.cmdCmc)) as 4 | 5 | 6])}`} />
            <Stat k="remate lanzable" v={H.hasWin ? turnTxt(H.winAvg) : "—"} sub={H.hasWin ? `al turno 8: ${pct(H.winBy[8])}` : "no se detectan remates"} />
          </div>
        </Section>
        <Section title="Maná disponible por turno">
          <div class="bars">{H.manaT.slice(1, 9).map((v, i) => <div class="bars-row" key={i}><span>Turno {i + 1}</span><Bar value={v} max={Math.max(8, H.manaT[8])} label={`Turno ${i + 1}: ${num1(v)} de maná`} /><b>{num1(v)}</b></div>)}</div>
          <p class="muted small">Promedio de maná con tierras y ramp ya jugado. Si la barra va por debajo del número del turno, el mazo se queda corto de tierras.</p>
        </Section>
        <Section title="Tierras en la mano inicial">
          <div class="bars">{H.hyp.map((v, i) => <div class={"bars-row" + (i >= 2 && i <= 4 ? " ok" : "")} key={i}><span>{i} {i === 1 ? "tierra" : "tierras"}</span><Bar value={v} max={Math.max(...H.hyp)} label={`${i} tierras: ${pct(v)}`} /><b>{pct(v)}</b></div>)}</div>
          <p class="muted small">Con {H.L} tierras en {H.N} cartas. Lo sano es abrir con 2 a 4: pasa en {pct(H.hyp[2] + H.hyp[3] + H.hyp[4])} de las manos.</p>
        </Section>
      </div>
      <div>
        <Section title="Robar una mano">
          {!hand ? <><p class="muted">Mira manos reales de tu lista y decide si te las quedarías.</p><button class="btn primary" onClick={() => deal()}>Robar 7 cartas</button></> : <>
            <ul class="hand">{shown.map((n, i) => <li key={i + n} class={isLand(n) ? "land" : ""}><CardName name={n} deckId={d.id} m={S.db.get(n)} /></li>)}</ul>
            <p class="small">{plural(lands, "tierra", "tierras")} de {shown.length} cartas{hand.mull ? `. Mulligan número ${hand.mull}${toBottom ? `: manda ${toBottom} al fondo` : " (gratis)"}` : ""}.</p>
            <div class="row"><button class="btn primary" onClick={() => deal()}>Otra mano</button><button class="btn" onClick={() => deal(hand.mull + 1)}>Mulligan</button><button class="btn ghost" disabled={hand.n >= hand.lib.length} onClick={() => setHand({ ...hand, n: hand.n + 1 })}>Robar una carta</button></div>
          </>}
        </Section>
        <Section title="Lista de control" aside={<b class="score">{Hc.score} de 100</b>}>
          <ul class="checks">{Hc.checks.map(c => <li class={c.ok ? "ok" : "no"} key={c.t}><span aria-hidden="true">{c.ok ? "✓" : "✕"}</span><span class="sr">{c.ok ? "Cumple: " : "No cumple: "}</span>{c.t}</li>)}</ul>
        </Section>
      </div>
    </div>
  );
}

/* ---------- elegir rivales ---------- */
function useRivals(d: Deck): { rivals: Deck[]; sel: string[]; toggle: (id: string) => void; picked: Deck[] } {
  const rivals = S.decks.filter(x => x.id !== d.id && x.cards.reduce((a, c) => a + c.q, 0) >= 60);
  const [sel, setSel] = useState<string[]>(() => { const saved = S.sims.get(d.id); const ids = saved ? saved.rivals.filter(id => rivals.some(r => r.id === id)) : []; return ids.length ? ids : rivals.slice(0, 3).map(r => r.id); });
  const toggle = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id].slice(-3));
  return { rivals, sel, toggle, picked: sel.map(id => rivals.find(r => r.id === id)).filter((x): x is Deck => !!x) };
}
function RivalPicker({ rivals, sel, toggle }: { rivals: Deck[]; sel: string[]; toggle: (id: string) => void }): JSX.Element {
  if (!rivals.length) return <Note tone="info" action={<button class="btn" onClick={() => { ui.newDeck = "list"; touch(); }}>Agregar un mazo de referencia</button>}>No tienes otros mazos de 60 cartas o más. Pega la lista de un rival o de un torneo como mazo de referencia y úsalo de contrincante.</Note>;
  return <div><p class="small muted">Rivales en la mesa (hasta 3)</p><div class="chips" role="group" aria-label="Rivales">{rivals.map(r => <button type="button" class="chip" key={r.id} aria-pressed={sel.includes(r.id)} onClick={() => toggle(r.id)}>{r.name}{r.kind === "ref" && r.owner ? ` (${r.owner})` : ""}</button>)}</div></div>;
}

/* ---------- partidas simuladas ---------- */
function Simulated({ d }: { d: Deck }): JSX.Element {
  const { rivals, sel, toggle, picked } = useRivals(d);
  const [busy, setBusy] = useState(""); const R = S.sims.get(d.id);
  const real = gameStats(gamesOf(d.id));
  const run = async (n: number) => {
    if (busy || !picked.length) return; setBusy(`0 de ${n}`);
    try {
      await ensureCards([d, ...picked].flatMap(allNames), { quiet: true });
      const out = await simRun([d, ...picked], S.db, n, { onStep: g => setBusy(`${g} de ${n}`) });
      await saveSim(d.id, { ...out, rivals: picked.map(r => r.id) });
    } catch (e) { toast(e instanceof UserError ? e.message : "No se pudo simular: " + (e instanceof Error ? e.message : "error"), "warn"); }
    finally { setBusy(""); }
  };
  const mine = R && R.decks.find(x => x.id === d.id);
  const stale = R && R.at < d.updated;
  return (
    <div>
      <Section title="Partidas simuladas">
        <p class="muted">Cientos de partidas rápidas contra otros mazos, rotando los asientos. Es un modelo aproximado: sirve para comparar mazos y ver tendencias, no para predecir una partida. No se mezcla con tus partidas reales.</p>
        <RivalPicker rivals={rivals} sel={sel} toggle={toggle} />
        {rivals.length ? <div class="row">{[200, 500, 1000].map(n => <button class={"btn" + (n === 500 ? " primary" : "")} key={n} disabled={!!busy || !picked.length} onClick={() => void run(n)}>{n} partidas</button>)}{busy ? <span class="muted" role="status">Simulando… {busy}</span> : null}</div> : null}
        {!d.combos ? <p class="muted small">Los combos entran en la simulación después de buscarlos en <a href={`#/mazo/${d.id}/ajustar`}>Ajustar</a>.</p> : null}
      </Section>
      {R ? <Section title={`Resultado de ${R.n} partidas`} aside={<span class="muted small">{dateTime(R.at)}</span>}>
        {stale ? <Note tone="warn">La lista cambió después de esta simulación. Vuelve a correrla para ver el efecto.</Note> : null}
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mazo</th><th class="n">Gana</th><th class="n">Rango</th><th class="n">Turno</th><th>Cómo gana</th></tr></thead>
          <tbody>{[...R.decks].sort((a, b) => b.pct - a.pct).map(x => <tr key={x.id} class={x.id === d.id ? "mine" : ""}><td>{x.name}</td><td class="n"><b>{p100(x.pct)} %</b></td><td class="n">{p100(x.ci[0])} a {p100(x.ci[1])}</td><td class="n">{turnTxt(x.avgTurn)}</td><td class="small">{Object.entries(x.how).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${SIM_HOW[k] || k} ${Math.round(100 * v / Math.max(1, x.w))} %`).join(", ") || "—"}</td></tr>)}</tbody></table></div>
        <p class="muted small">El rango es donde caería el porcentaje con 95 % de seguridad: si dos mazos se traslapan, la diferencia puede ser suerte.{R.draws ? ` ${p100(R.draws / R.n)} % de las partidas llegó al turno 20 sin ganador.` : ""}</p>
        {mine ? <>
          <h4>Tu mazo por asiento</h4>
          <div class="stats">{mine.seat.slice(0, R.players).map((v, i) => <Stat k={`asiento ${i + 1}`} v={v == null ? "—" : p100(v) + " %"} key={i} />)}</div>
          <p>{real.n >= 5 && real.pct != null ? `En la mesa real ganas ${p100(real.pct)} % (${real.n} partidas) y la simulación da ${p100(mine.pct)} %. ${Math.abs(real.pct - mine.pct) >= 0.15 ? (real.pct > mine.pct ? "Juegas el mazo mejor de lo que el modelo supone, o tu grupo interactúa menos." : "Tu grupo juega más fuerte o interactúa más de lo que el modelo supone.") : "Coinciden bastante."}`
            : `En una mesa pareja de ${R.players} se espera ${Math.round(100 / R.players)} %. ${mine.pct >= 1.4 / R.players ? "Tu mazo sale favorito contra estos rivales." : mine.pct <= 0.6 / R.players ? "Tu mazo sale en desventaja contra estos rivales." : "Tu mazo sale parejo con estos rivales."}`}</p>
        </> : null}
      </Section> : null}
    </div>
  );
}

/* ---------- partidas reales ---------- */
function Real({ d }: { d: Deck }): JSX.Element {
  const list = gamesOf(d.id); const st = gameStats(list); const { A, H } = insight(d);
  const [res, setRes] = useState<GameResult | null>(null); const [turn, setTurn] = useState(0); const [how, setHow] = useState<string | null>(null); const [seat, setSeat] = useState<number | null>(null);
  const [opp, setOpp] = useState<string[]>([]); const [oppTxt, setOppTxt] = useState(""); const [note, setNote] = useState("");
  const known = S.decks.filter(x => x.id !== d.id).map(x => ({ k: x.commanders.join(" + ") || x.name, es: x.kind === "ref" && x.owner ? `${x.name} (${x.owner})` : x.name }));
  const save = async () => {
    if (!res) return;
    const extra = oppTxt.split(",").map(x => x.trim()).filter(Boolean);
    await addGame({ deckId: d.id, res, turn, how, seat, opp: [...new Set([...opp, ...extra])], note });
    setRes(null); setTurn(0); setHow(null); setSeat(null); setOppTxt(""); setNote("");   // los rivales suelen repetirse en la siguiente
  };
  const W = winTurnOf(list, H); const P = playBracket(d, A, H, list); const official = bracketOf(d, A);
  const expect = st.pct == null ? "" : st.n < 5 ? `Con ${plural(st.n, "partida", "partidas")} todavía es pronto para sacar conclusiones.`
    : st.pct >= 0.375 ? "Gana bastante más de lo esperado en una mesa pareja de cuatro (25 %). Puede que juegue por sobre el nivel de tu grupo."
    : st.pct <= 0.125 ? "Gana bastante menos de lo esperado (25 %). Revisa el paso Ajustar o compáralo con los mazos de tu grupo."
    : "Rinde parejo con tu grupo (lo esperado en una mesa de cuatro es 25 %).";
  return (
    <div class="cols">
      <div>
        <Section title="Anotar una partida">
          <div class="form">
            <div class="form-row"><span>Resultado</span><Chips<GameResult> label="Resultado" value={res} options={[["win", "Gané"], ["loss", "Perdí"], ["draw", "Empate"]]} onPick={v => setRes(res === v ? null : v)} /></div>
            <div class="form-row"><span>Turno en que terminó</span><div class="stepper"><button class="btn" aria-label="Un turno menos" disabled={turn <= 0} onClick={() => setTurn(Math.max(0, turn - 1))}>−</button><b>{turn || "Sin anotar"}</b><button class="btn" aria-label="Un turno más" onClick={() => setTurn(Math.min(30, turn ? turn + 1 : 7))}>+</button></div></div>
            <div class="form-row"><span>Cómo terminó</span><Chips<string> label="Cómo terminó" value={how} options={GAME_HOW} onPick={v => setHow(how === v ? null : v)} /></div>
            <div class="form-row"><span>Tu asiento</span><Chips<number> label="Asiento" value={seat} options={[[1, "1"], [2, "2"], [3, "3"], [4, "4"]]} onPick={v => setSeat(seat === v ? null : v)} /></div>
            <div class="form-row"><span>Rivales</span><div>
              {known.length ? <div class="chips" role="group" aria-label="Rivales">{known.map(r => <button type="button" class="chip" key={r.k} aria-pressed={opp.includes(r.k)} onClick={() => setOpp(o => o.includes(r.k) ? o.filter(x => x !== r.k) : [...o, r.k])}>{r.es}</button>)}</div> : null}
              <input type="text" value={oppTxt} placeholder="Otros comandantes, separados por coma" autocomplete="off" aria-label="Otros rivales" onInput={e => setOppTxt((e.target as HTMLInputElement).value)} /></div></div>
            <div class="form-row"><span>Nota</span><input type="text" value={note} maxLength={200} placeholder="Qué funcionó, qué faltó" autocomplete="off" aria-label="Nota" onInput={e => setNote((e.target as HTMLInputElement).value)} /></div>
            <button class="btn primary" disabled={!res} onClick={() => void save()}>Guardar partida</button>
          </div>
        </Section>
        {list.length ? <Section title="Últimas partidas">
          <ul class="games">{list.slice(0, 20).map(g => <li key={g.id}><div><b class={g.res}>{g.res === "win" ? "Victoria" : g.res === "loss" ? "Derrota" : "Empate"}</b>{g.turn ? `, turno ${g.turn}` : ""}{g.how ? `, ${howEs(g.how).toLowerCase()}` : ""}{g.seat ? `, asiento ${g.seat}` : ""}
            <div class="muted small">{dateTxt(g.at)}{g.opp.length ? `, contra ${g.opp.join(", ")}` : ""}{g.note ? `. ${g.note}` : ""}</div></div>
            <Confirm label="Borrar" sure="¿Borrar?" onYes={() => void deleteGame(g.id)} /></li>)}</ul>
        </Section> : null}
      </div>
      <div>
        {st.n ? <Section title="Cómo rinde en la mesa">
          <div class="stats">
            <Stat k="partidas" v={st.n} /><Stat k="victorias" v={pct(st.pct)} tone={st.n >= 5 ? ((st.pct || 0) >= 0.25 ? "good" : "warn") : undefined} /><Stat k="récord" v={`${st.w}-${st.l}${st.dr ? "-" + st.dr : ""}`} /><Stat k="gana en el turno" v={num1(st.avgTurn)} />
          </div>
          <p>{expect}</p>
          {st.seats.some(x => x.n) ? <><h4>Por asiento</h4><div class="stats">{st.seats.map(x => <Stat k={`asiento ${x.s}`} v={x.n ? p100(x.w / x.n) + " %" : "—"} sub={x.n ? `${x.w} de ${x.n}` : undefined} key={x.s} />)}</div></> : null}
          {st.how.length ? <p class="small">Cómo gana: {st.how.map(([k, c]) => `${howEs(k).toLowerCase()} (${c})`).join(", ")}.</p> : null}
          {st.opp.length ? <><h4>Contra cada rival</h4><table class="tbl"><tbody>{st.opp.slice(0, 12).map(o => <tr key={o.k}><td>{o.k}</td><td class="n">{o.w} de {o.n}</td><td class="n">{p100(o.w / o.n)} %</td></tr>)}</tbody></table></> : null}
        </Section> : <Section title="Cómo rinde en la mesa"><p class="muted">Aún no hay partidas anotadas con este mazo. Con 5 o más ya se ve cómo rinde contra tu grupo, y el turno en que ganas corrige el bracket por juego.</p></Section>}
        <Section title="Turno de victoria">
          <div class="stats"><Stat k="simulador de manos" v={turnTxt(W.sim)} /><Stat k={`tus victorias${W.n ? ` (${W.n})` : ""}`} v={turnTxt(W.real)} /><Stat k={W.n ? `ajustado, lo real pesa ${p100(W.w)} %` : "ajustado"} v={turnTxt(W.t)} /></div>
          <p class="muted small">El simulador pesa como 10 partidas.{W.n && W.n < 10 ? ` Con ${plural(10 - W.n, "victoria más", "victorias más")} con turno anotado, las reales pesarán la mitad.` : !W.n ? " Anota en qué turno ganas para corregirlo con tus partidas." : ""}</p>
        </Section>
        <Section title="Bracket por juego">
          <div class="stats"><Stat k="oficial" v={official.b} sub="por las cartas que lleva" /><Stat k="velocidad" v={P.speed} /><Stat k="deformación" v={P.warp} /><Stat k="por juego" v={P.b} tone={P.b > official.b ? "warn" : undefined} /></div>
          <p class="small">Velocidad: {P.speedWhy}. Deformación: {P.warpWhy}.</p>
          {P.b > official.b ? <p class="small warn-text">Juega más fuerte de lo que dice su bracket oficial: conviene avisarlo en la conversación antes de la partida.</p> : null}
        </Section>
      </div>
    </div>
  );
}

/* ---------- A contra B ---------- */
interface Opt { id: string; label: string; src: Pick<Deck, "commanders" | "cards" | "combos"> }
/**
 * Combos que valen para una lista: de los que encontró la última búsqueda (completos o a una carta),
 * los que esa lista tiene enteros. Así ninguna versión corre con combos que la otra no pudo usar.
 */
function combosFor(d: Deck, commanders: string[], cards: Entry[]): Combos | undefined {
  if (!d.combos) return undefined;
  const have = new Set([...commanders, ...cards.map(c => c.n)].map(slug));
  return { at: d.combos.at, inc: [...d.combos.inc, ...d.combos.almost].filter(c => c.cards.length > 0 && c.cards.every(n => have.has(slug(n)))), almost: [] };
}
function AB({ d }: { d: Deck }): JSX.Element {
  const vs: Version[] = versionsOf(d.id);
  const opts: Opt[] = [{ id: "now", label: "Lista actual", src: { commanders: d.commanders, cards: d.cards, combos: combosFor(d, d.commanders, d.cards) } }, ...vs.map(v => ({ id: v.id, label: `${v.label} (${dateTime(v.at)})`, src: { commanders: v.commanders, cards: v.cards, combos: combosFor(d, v.commanders, v.cards) } }))];
  const pre = ui.ab && ui.ab.deckId === d.id ? ui.ab : null;
  const [a, setA] = useState(pre ? pre.a : (vs[0] ? vs[0].id : "now")); const [b, setB] = useState(pre ? pre.b : "now");
  const { rivals, sel, toggle, picked } = useRivals(d);
  const [busy, setBusy] = useState(""); const [C, setC] = useState<Comparison | null>(null);
  useEffect(() => { if (pre) { ui.ab = null; } }, []);
  const oa = opts.find(o => o.id === a), ob = opts.find(o => o.id === b);
  const run = async (n: number) => {
    if (!oa || !ob || busy) return; setBusy("0 %"); setC(null);
    try {
      const rivalsIn: SimInput[] = picked;
      await ensureCards([...oa.src.cards.map(c => c.n), ...ob.src.cards.map(c => c.n), ...picked.flatMap(allNames)], { quiet: true });
      setC(await compareVersions({ a: { ...oa.src, name: a === "now" ? "La lista actual" : "La versión A" }, b: { ...ob.src, name: b === "now" ? "La lista actual" : "La versión B" }, rivals: rivalsIn, n, onStep: (g, t) => setBusy(`${Math.round(100 * g / t)} %`) }, S.db));
    } catch (e) { toast(e instanceof UserError ? e.message : "No se pudo comparar: " + (e instanceof Error ? e.message : "error"), "warn"); }
    finally { setBusy(""); }
  };
  const fmt = (v: number | null, f: string) => v == null ? "—" : f === "pct" ? pct(v) : f === "turn" ? turnTxt(v) : f === "cmc" ? v.toFixed(2).replace(".", ",") : String(v);
  if (vs.length === 0) return <Section title="Una versión contra otra"><p class="muted">Aquí comparas dos listas del mismo mazo con las mismas manos y las mismas partidas simuladas. Todavía no hay versiones: se guarda una sola cada vez que cambias la lista, o puedes guardar una a mano en <a href={`#/mazo/${d.id}/versiones`}>Versiones</a>.</p></Section>;
  return (
    <div>
      <Section title="Una versión contra otra">
        <p class="muted">Las dos listas corren la misma cantidad de manos y de partidas simuladas, con la misma semilla. El veredicto solo declara un ganador cuando la diferencia supera el margen de azar.{d.combos ? " Los combos son los de tu última búsqueda que cada lista tiene completos." : " Sin buscar combos en Ajustar, ninguna de las dos los usa."}</p>
        <div class="form">
          <label class="field"><span>A</span><select value={a} onChange={e => setA((e.target as HTMLSelectElement).value)}>{opts.map(o => <option value={o.id} key={o.id}>{o.label}</option>)}</select></label>
          <label class="field"><span>B</span><select value={b} onChange={e => setB((e.target as HTMLSelectElement).value)}>{opts.map(o => <option value={o.id} key={o.id}>{o.label}</option>)}</select></label>
        </div>
        <RivalPicker rivals={rivals} sel={sel} toggle={toggle} />
        {!rivals.length || !picked.length ? <p class="muted small">Sin rivales, las dos versiones juegan entre sí en una mesa de espejo (dos copias de cada una).</p> : null}
        <div class="row">{[200, 400, 800].map(n => <button class={"btn" + (n === 400 ? " primary" : "")} key={n} disabled={!!busy || a === b} onClick={() => void run(n)}>{n} partidas</button>)}{busy ? <span class="muted" role="status">Comparando… {busy}</span> : null}</div>
        {a === b ? <p class="muted small">Elige dos listas distintas.</p> : null}
      </Section>
      {C ? <Section title="Resultado">
        <Note tone={C.verdict === "tie" ? "info" : undefined}>{C.text}</Note>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th class="n">A</th><th class="n">B</th></tr></thead>
          <tbody>{C.deltas.map(x => <tr key={x.k}><td>{x.k}</td><td class={"n" + (x.better === "a" ? " best" : "")}>{fmt(x.a, x.fmt)}</td><td class={"n" + (x.better === "b" ? " best" : "")}>{fmt(x.b, x.fmt)}</td></tr>)}</tbody></table></div>
        <p class="muted small">{C.n} partidas por versión{C.mirror ? " en mesa de espejo" : ` contra ${C.rivals.join(", ")}`}. Margen de azar de la diferencia: ±{p100(C.margin)} puntos{C.verdict === "tie" && C.n < 800 ? "; con más partidas el margen baja y se ven diferencias más chicas" : ""}. En negrita, el mejor valor cuando la diferencia supera el ruido de la prueba.</p>
        <div class="cols">
          <div><h4>Entran en B ({C.add.reduce((s, c) => s + c.q, 0)})</h4>{C.add.length ? <ul class="cards">{C.add.map(c => <li key={c.n}><CardName name={c.n} deckId={d.id} m={S.db.get(c.n)} />{c.q > 1 ? ` ×${c.q}` : ""}</li>)}</ul> : <p class="muted">Ninguna.</p>}</div>
          <div><h4>Salen de A ({C.rem.reduce((s, c) => s + c.q, 0)})</h4>{C.rem.length ? <ul class="cards">{C.rem.map(c => <li key={c.n}><CardName name={c.n} deckId={d.id} m={S.db.get(c.n)} />{c.q > 1 ? ` ×${c.q}` : ""}</li>)}</ul> : <p class="muted">Ninguna.</p>}</div>
        </div>
      </Section> : null}
    </div>
  );
}
