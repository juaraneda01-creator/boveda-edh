// Armazón: barra superior, navegación, avisos y la pantalla que corresponde a la dirección.
import { Component, type ComponentChildren, type JSX } from "preact";
import { S, deckById, deleteDeck, makeBackup, touch } from "../data/store.ts";
import { isMemoryOnly } from "../data/idb.ts";
import { useHash, useStore, go, ui, download, Confirm } from "./kit.tsx";
import { DecksScreen, NewDeckSheet } from "./Decks.tsx";
import { DeckScreen } from "./Deck.tsx";
import { MetaScreen } from "./Meta.tsx";
import { SettingsScreen } from "./Settings.tsx";
import { CardSheet } from "./CardSheet.tsx";

export type Step = "plan" | "armar" | "probar" | "ajustar" | "versiones";
const STEPS: Step[] = ["plan", "armar", "probar", "ajustar", "versiones"];

export function parseRoute(hash: string): { view: "decks" | "deck" | "meta" | "settings"; id?: string; step?: Step } {
  const p = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  if (p[0] === "mazo" && p[1]) return { view: "deck", id: p[1], step: STEPS.includes(p[2] as Step) ? p[2] as Step : "armar" };
  if (p[0] === "meta") return { view: "meta" };
  if (p[0] === "ajustes") return { view: "settings" };
  return { view: "decks" };
}

/**
 * Si una pantalla falla al dibujarse, la app no queda en blanco: explica qué pasó y deja
 * salvar los datos o eliminar el mazo que la rompe.
 */
class Boundary extends Component<{ deckId?: string; children: ComponentChildren }, { err: string }> {
  state = { err: "" };
  static getDerivedStateFromError(e: unknown): { err: string } { return { err: e instanceof Error ? e.message : String(e) }; }
  render(): ComponentChildren {
    if (!this.state.err) return this.props.children;
    const id = this.props.deckId;
    return (
      <div class="empty" role="alert">
        <h2>Esta pantalla no se pudo mostrar</h2>
        <p>Algo en los datos guardados la hizo fallar. Tus mazos siguen en el navegador: descarga un respaldo antes de hacer cualquier otra cosa.</p>
        <p class="muted small">Detalle técnico: {this.state.err}</p>
        <div class="row" style={{ justifyContent: "center" }}>
          <button class="btn primary" onClick={() => download(`boveda-constructor-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(makeBackup()))}>Descargar respaldo</button>
          <button class="btn" onClick={() => { this.setState({ err: "" }); go("#/"); }}>Volver a tus mazos</button>
          {id ? <Confirm label="Eliminar este mazo" sure="Toca de nuevo para eliminarlo" onYes={() => { void deleteDeck(id); this.setState({ err: "" }); go("#/"); }} /> : null}
        </div>
      </div>
    );
  }
}

export function App(): JSX.Element {
  useStore(); const route = parseRoute(useHash());
  if (!S.ready) return <div class="boot"><p>Abriendo tus mazos…</p></div>;
  const deck = route.view === "deck" && route.id ? deckById(route.id) : undefined;
  const nav: [string, string, boolean][] = [["#/", "Mazos", route.view === "decks" || route.view === "deck"], ["#/meta", "Meta", route.view === "meta"], ["#/ajustes", "Ajustes", route.view === "settings"]];
  return (
    <div class="app">
      <header class="top">
        <a class="brand" href="#/" aria-label="Bóveda, constructor de mazos: ir a tus mazos"><span class="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Bóveda <b>Constructor</b></span></a>
        <nav class="nav" aria-label="Secciones">{nav.map(([h, l, on]) => <a href={h} key={h} aria-current={on ? "page" : undefined}>{l}</a>)}</nav>
      </header>
      {S.busy ? <div class="busy" role="status"><span>{S.busy.label}{S.busy.total > 1 ? ` (${S.busy.done} de ${S.busy.total})` : ""}</span><div class="busy-bar"><i style={{ width: `${S.busy.total > 1 ? Math.round(100 * S.busy.done / S.busy.total) : 100}%` }} class={S.busy.total > 1 ? "" : "loop"} /></div></div> : null}
      {S.storageError ? <div class="note bad wrap-note" role="alert">{S.storageError}</div> : null}
      {isMemoryOnly() ? <div class="note bad wrap-note" role="alert">Este navegador no deja guardar datos (puede ser una ventana privada). Lo que hagas se pierde al cerrar la pestaña: descarga un respaldo desde Ajustes antes de salir.</div> : null}
      <main class="wrap" id="main">
        <Boundary key={route.view + (route.id || "")} deckId={route.view === "deck" ? route.id : undefined}>
        {route.view === "deck" ? (deck ? <DeckScreen deck={deck} step={route.step || "armar"} key={deck.id} /> : <div class="empty"><h2>Ese mazo ya no existe</h2><p>Puede que lo hayas eliminado en otra pestaña.</p><button class="btn primary" onClick={() => go("#/")}>Ver tus mazos</button></div>)
          : route.view === "meta" ? <MetaScreen />
          : route.view === "settings" ? <SettingsScreen />
          : <DecksScreen />}
        </Boundary>
      </main>
      {ui.newDeck ? <NewDeckSheet mode={ui.newDeck} onClose={() => { ui.newDeck = null; touch(); }} /> : null}
      {ui.card ? <CardSheet name={ui.card.name} deckId={ui.card.deckId} onClose={() => { ui.card = null; touch(); }} /> : null}
      {S.toast ? <div class={"toast " + S.toast.kind} role="status" key={S.toast.at}>{S.toast.msg}</div> : null}
    </div>
  );
}
