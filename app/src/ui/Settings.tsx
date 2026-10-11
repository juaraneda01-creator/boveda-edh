// Ajustes: respaldo, traer mazos desde la Bóveda, datos de cartas y versión de la app.
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { S, makeBackup, saveSettings, ensureCards, toast, type ImportReport } from "../data/store.ts";
import { importBackupText } from "../data/backup.ts";
import { usage, memoryOnly } from "../data/idb.ts";
import { allNames } from "../engine/index.ts";
import { Note, Section, agoTxt, dateTime, download, plural } from "./kit.tsx";

declare const __BUILD__: { v: string };

export function SettingsScreen(): JSX.Element {
  const file = useRef<HTMLInputElement>(null); const [rep, setRep] = useState<ImportReport | null>(null); const [err, setErr] = useState(""); const [use, setUse] = useState<{ used: number; quota: number } | null>(null);
  useEffect(() => { void usage().then(setUse); }, []);
  const backup = () => { download(`boveda-constructor-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(makeBackup())); void saveSettings({ lastBackup: Date.now() }); toast("Respaldo descargado."); };
  const onFile = async (f: File | undefined) => {
    if (!f) return; setErr(""); setRep(null);
    try {
      const r = await importBackupText(await f.text()); setRep(r);
      void ensureCards(S.decks.flatMap(allNames), { label: "Trayendo los datos de las cartas", quiet: true });
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo leer el archivo."); }
    finally { if (file.current) file.current.value = ""; }
  };
  const stale = S.decks.length > 0 && (!S.settings.lastBackup || Date.now() - S.settings.lastBackup > 30 * 864e5);
  const mb = (n: number) => (n / 1048576).toFixed(1).replace(".", ",") + " MB";
  return (
    <div>
      <div class="page-h"><h1>Ajustes</h1></div>
      <Section title="Respaldo">
        <p>Tus mazos viven en este navegador. Un respaldo es un archivo con tus mazos, versiones y partidas, para pasarlos a otro equipo o guardarlos por seguridad.</p>
        {stale ? <Note tone="warn">{S.settings.lastBackup ? `Tu último respaldo es de ${agoTxt(S.settings.lastBackup)}.` : "Todavía no has descargado un respaldo."} Si borras los datos del navegador, los mazos se pierden.</Note> : S.settings.lastBackup ? <p class="muted small">Último respaldo: {dateTime(S.settings.lastBackup)}.</p> : null}
        <div class="row"><button class="btn primary" disabled={!S.decks.length} onClick={backup}>Descargar respaldo</button><button class="btn" onClick={() => file.current && file.current.click()}>Importar respaldo</button></div>
        <input ref={file} type="file" accept=".json,application/json" hidden aria-label="Archivo de respaldo" onChange={e => void onFile((e.target as HTMLInputElement).files?.[0])} />
        {err ? <Note tone="bad">{err}</Note> : null}
        {rep ? <Note tone="info">Se importaron {plural(rep.decks, "mazo", "mazos")}, {plural(rep.versions, "versión", "versiones")} y {plural(rep.games, "partida", "partidas")}.{rep.note === "bóveda" ? ` Venían de la Bóveda${rep.skipped ? `: ${plural(rep.skipped, "mazo de otro formato se dejó", "mazos de otros formatos se dejaron")} fuera, igual que la colección y los precios` : ""}.` : ""} Lo que ya tenías sigue ahí.</Note> : null}
      </Section>

      <Section title="Traer mis mazos desde la Bóveda">
        <p>En la Bóveda, abre “Ajustes y respaldo” y descarga el respaldo. Después impórtalo aquí con el botón de arriba: entran tus mazos de Commander con sus versiones y sus partidas anotadas. La colección, las carpetas de venta, los precios y los mazos de Pauper y Pioneer no se usan en esta app.</p>
      </Section>

      <Section title="Datos de cartas">
        <p class="muted">Los datos vienen de Scryfall y se guardan en el navegador por 90 días. {S.db.cards.size.toLocaleString("es-CL")} cartas guardadas.</p>
        <button class="btn" disabled={!!S.busy || !S.decks.length} onClick={async () => { const r = await ensureCards(S.decks.flatMap(allNames), { force: true, label: "Actualizando todas las cartas" }); if (!r.offline && !r.missing.length) toast("Cartas actualizadas."); }}>Actualizar las cartas de mis mazos</button>
      </Section>

      <Section title="Almacenamiento">
        {memoryOnly ? <Note tone="bad">Este navegador no deja guardar datos (puede ser una ventana privada). Lo que hagas se pierde al cerrar la pestaña: descarga un respaldo antes de salir.</Note> : null}
        <p class="muted">{plural(S.decks.length, "mazo", "mazos")}, {plural(S.versions.length, "versión", "versiones")} y {plural(S.games.length, "partida", "partidas")}.{use && use.quota ? ` La app ocupa ${mb(use.used)} de ${mb(use.quota)} disponibles.` : ""}</p>
      </Section>

      <Section title="Acerca de">
        <p class="muted small">Bóveda Constructor, versión <b class="version">{__BUILD__.v}</b>. Si este código no coincide con el último que te informaron, la app publicada está atrasada.</p>
        <p class="muted small">Fuentes: Scryfall (cartas y Game Changers), EDHREC (qué se juega con cada comandante), Commander Spellbook (combos) y EDHTop16 (torneos cEDH). No está afiliada a Wizards of the Coast. Las simulaciones son aproximadas.</p>
      </Section>
    </div>
  );
}
