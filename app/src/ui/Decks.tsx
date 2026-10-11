// Tus mazos y las dos formas de empezar uno: desde un comandante o con una lista que ya existe.
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { S, insight, newDeck, ensureCards, toast } from "../data/store.ts";
import { importLink, searchCommanders, NetError, LINK_SITES } from "../data/net.ts";
import { IN_CLAUDE, relayProblem } from "../data/relay.ts";
import { bracketOf, buildSlots, nextStep, parseList, splitParsed, textToDeck, type Deck, type ScryCard } from "../engine/index.ts";
import { Pill, Pips, Sheet, go, plural, ui } from "./kit.tsx";
import { touch } from "../data/store.ts";

function DeckRow({ d }: { d: Deck }): JSX.Element {
  const { A, Y } = insight(d); const size = 100 - d.commanders.length;
  const B = A.main ? bracketOf(d, A) : null;
  const tone = A.main === size ? "good" : A.main > size ? "bad" : undefined;
  return (
    <a class="deck-row" href={`#/mazo/${d.id}/armar`}>
      <div class="deck-row-main">
        <div class="deck-row-name"><Pips ci={A.ci} /> <b>{d.name}</b></div>
        <div class="deck-row-cmd">{d.commanders.join(" + ") || "Sin comandante"}{d.kind === "ref" && d.owner ? `, de ${d.owner}` : ""}</div>
        <div class="deck-row-next">{nextStep(buildSlots(A, Y, d.plan, d.commanders.length), A, size)}</div>
      </div>
      <div class="deck-row-side">
        <Pill tone={tone}>{A.main} de {size}</Pill>
        {B ? <Pill tone={d.plan.bracket && B.b > d.plan.bracket ? "warn" : undefined}>Bracket {B.b}</Pill> : null}
      </div>
    </a>
  );
}

export function DecksScreen(): JSX.Element {
  const mine = S.decks.filter(d => d.kind === "mine"), refs = S.decks.filter(d => d.kind === "ref");
  const open = (m: "cmd" | "list") => { ui.newDeck = m; touch(); };
  if (!S.decks.length) return (
    <div class="hero">
      <h1>Arma tu mazo de Commander por casillas, no por lista</h1>
      <p class="lede">Eliges comandante y bracket. La app te muestra cuántas tierras, ramp, robo y respuestas pide ese plan, te sugiere qué poner en cada casilla y te deja probar el resultado antes de sacar una sola carta de la carpeta.</p>
      <div class="hero-acts">
        <button class="btn primary big" onClick={() => open("cmd")}>Empezar con un comandante</button>
        <button class="btn big" onClick={() => open("list")}>Traer una lista que ya tengo</button>
      </div>
      <p class="muted small">¿Vienes de la Bóveda? En <a href="#/ajustes">Ajustes</a> puedes traer tus mazos de Commander con el respaldo.</p>
      <ol class="hero-steps">
        <li><span><b>Plan.</b> Comandante, estrategia y bracket buscado.</span></li>
        <li><span><b>Armar.</b> Nueve casillas con su meta y sugerencias para cada una.</span></li>
        <li><span><b>Probar.</b> Manos, partidas simuladas, partidas reales y una versión contra otra.</span></li>
        <li><span><b>Ajustar.</b> Qué sacar, qué poner y cómo se compara con lo que juega el resto.</span></li>
      </ol>
    </div>
  );
  return (
    <div>
      <div class="page-h"><h1>Tus mazos</h1><div class="row"><button class="btn primary" onClick={() => open("cmd")}>Nuevo mazo</button><button class="btn" onClick={() => open("list")}>Traer una lista</button></div></div>
      {mine.length ? <div class="deck-list">{mine.map(d => <DeckRow d={d} key={d.id} />)}</div> : <p class="muted">Todavía no tienes mazos propios. Los de abajo son de referencia.</p>}
      {refs.length ? <><h2 class="sub-h">Mazos de referencia</h2><p class="muted small">De rivales o de torneo. Sirven como contrincantes en las partidas simuladas.</p><div class="deck-list">{refs.map(d => <DeckRow d={d} key={d.id} />)}</div></> : null}
    </div>
  );
}

export function NewDeckSheet({ mode, onClose }: { mode: "cmd" | "list"; onClose: () => void }): JSX.Element {
  const [tab, setTab] = useState(mode);
  return (
    <Sheet title="Nuevo mazo" onClose={onClose} wide>
      <div class="seg" role="tablist">
        <button role="tab" aria-selected={tab === "cmd"} onClick={() => setTab("cmd")}>Desde un comandante</button>
        <button role="tab" aria-selected={tab === "list"} onClick={() => setTab("list")}>Con una lista</button>
      </div>
      {tab === "cmd" ? <FromCommander onClose={onClose} /> : <FromList onClose={onClose} />}
    </Sheet>
  );
}

/** Buscador de comandantes: escribe, elige uno (o dos, si son compañeros) y crea el mazo vacío. */
export function CommanderPicker({ picked, onChange }: { picked: string[]; onChange: (names: string[]) => void }): JSX.Element {
  const [q, setQ] = useState(""); const [res, setRes] = useState<ScryCard[] | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    if (q.trim().length < (IN_CLAUDE ? 3 : 2)) { setRes(null); setErr(""); return; }
    const my = ++seq.current; setBusy(true);
    const t = setTimeout(async () => {
      try { const r = await searchCommanders(q); if (my !== seq.current) return; setRes(r); setErr(""); }
      catch (e) { if (my === seq.current) { setRes([]); setErr(e instanceof NetError ? (relayProblem() || "No se pudo buscar en Scryfall. Revisa tu conexión.") : "Error al buscar."); } }
      finally { if (my === seq.current) setBusy(false); }
    }, IN_CLAUDE ? 800 : 300);
    return () => clearTimeout(t);
  }, [q]);
  const toggle = (n: string) => onChange(picked.includes(n) ? picked.filter(x => x !== n) : [...picked, n].slice(-2));
  return (
    <div>
      <label class="field"><span>Comandante</span>
        <input type="text" value={q} placeholder="Por ejemplo: Atraxa, Hakbal, Slimefoot" autocomplete="off" spellcheck={false} onInput={e => setQ((e.target as HTMLInputElement).value)} /></label>
      {picked.length ? <div class="picked">Elegido: {picked.map(n => <button type="button" class="chip" aria-pressed="true" key={n} onClick={() => toggle(n)}>{n} ✕</button>)}{picked.length === 1 ? <span class="muted small"> Si juega con compañero, busca y elige el segundo.</span> : null}</div> : null}
      {err ? <p class="warn-text small">{err}</p> : null}
      {busy && !res ? <p class="muted small">Buscando…</p> : null}
      {res && !res.length && !err ? <p class="muted small">Ninguna carta legal como comandante calza con “{q}”. Prueba con el nombre en inglés.</p> : null}
      {res && res.length ? <ul class="cmd-list">{res.map(c => (
        <li key={c.name}><button type="button" class={"cmd-opt" + (picked.includes(c.name) ? " on" : "")} onClick={() => toggle(c.name)}>
          <Pips ci={(c.color_identity || []).join("")} /><span><b>{c.name}</b><small>{(c.type_line || "").split(" // ")[0]}</small></span>
        </button></li>))}</ul> : null}
    </div>
  );
}

function FromCommander({ onClose }: { onClose: () => void }): JSX.Element {
  const [picked, setPicked] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!picked.length || busy) return; setBusy(true);
    try {
      await ensureCards(picked, { quiet: true });
      const d = await newDeck({ name: picked[0].split(",")[0], commanders: picked, cards: [], maybe: [] });
      onClose(); go(`#/mazo/${d.id}/plan`);
    } finally { setBusy(false); }
  };
  return (
    <div>
      <p class="muted">El mazo parte vacío. En el paso siguiente defines el plan y la app arma un borrador que puedes cambiar carta por carta.</p>
      <CommanderPicker picked={picked} onChange={setPicked} />
      <div class="row end"><button class="btn primary" disabled={!picked.length || busy} onClick={() => void create()}>{busy ? "Creando…" : "Crear mazo"}</button></div>
    </div>
  );
}

function FromList({ onClose }: { onClose: () => void }): JSX.Element {
  const [text, setText] = useState(""); const [url, setUrl] = useState(""); const [name, setName] = useState(""); const [ref, setRef] = useState(false); const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const create = async () => {
    if (busy) return; setErr(""); setBusy(true);
    try {
      let commanders: string[], cards, maybe, title = name.trim();
      if (url.trim() && !text.trim()) {
        const im = await importLink(url.trim()); commanders = im.commanders; cards = im.cards; maybe = im.maybe; title = title || im.name;
      } else {
        const s = splitParsed(parseList(textToDeck(text), { keepSide: true })); commanders = s.commanders; cards = s.cards; maybe = s.maybe;
      }
      const n = cards.reduce((a, c) => a + c.q, 0);
      if (!n && !commanders.length) { setErr("No encontré cartas. Pega la lista con una carta por línea, por ejemplo “1 Sol Ring”."); return; }
      const d = await newDeck({ name: title || (commanders[0] ? commanders[0].split(",")[0] : "Mazo importado"), commanders: commanders.slice(0, 2), cards, maybe, kind: ref ? "ref" : "mine", owner: ref ? owner.trim() || "Rival" : undefined });
      onClose(); go(`#/mazo/${d.id}/${commanders.length ? "armar" : "plan"}`);
      const r = await ensureCards([...commanders, ...cards.map(c => c.n), ...maybe.map(c => c.n)], { label: "Trayendo los datos de las cartas" });
      if (!commanders.length) toast("La lista no indicaba comandante. Elígelo en el paso Plan.", "warn");
      else if (!r.missing.length && !r.offline) toast(`${plural(n, "carta", "cartas")} en el mazo.`);
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo leer la lista."); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <label class="field"><span>Lista de cartas</span>
        <textarea rows={9} value={text} spellcheck={false} placeholder={"Commander\n1 Hakbal of the Surging Soul\n\nDeck\n1 Sol Ring\n1 Cultivate\n8 Forest"} onInput={e => setText((e.target as HTMLTextAreaElement).value)} /></label>
      <p class="muted small">Sirve el texto que exportan Moxfield, Archidekt, ManaBox y MTG Arena. El comandante puede ir en una sección “Commander” o con la marca *CMDR*.</p>
      <label class="field"><span>O el enlace público del mazo ({LINK_SITES})</span>
        <input type="url" value={url} placeholder="https://moxfield.com/decks/…" onInput={e => setUrl((e.target as HTMLInputElement).value)} /></label>
      <label class="field"><span>Nombre del mazo (opcional)</span><input type="text" value={name} maxLength={80} onInput={e => setName((e.target as HTMLInputElement).value)} /></label>
      <label class="check"><input type="checkbox" checked={ref} onChange={e => setRef((e.target as HTMLInputElement).checked)} /> <span>Es un mazo de referencia: de un rival o de torneo, para usarlo como contrincante</span></label>
      {ref ? <label class="field"><span>De quién es</span><input type="text" value={owner} maxLength={40} placeholder="Por ejemplo: Nico" onInput={e => setOwner((e.target as HTMLInputElement).value)} /></label> : null}
      {err ? <p class="warn-text" role="alert">{err}</p> : null}
      <div class="row end"><button class="btn primary" disabled={busy || (!text.trim() && !url.trim())} onClick={() => void create()}>{busy ? "Leyendo…" : "Crear mazo"}</button></div>
    </div>
  );
}
