import { render } from "preact";
import { App } from "./ui/App.tsx";
import { init, S, touch } from "./data/store.ts";
import * as engine from "./engine/index.ts";
import * as store from "./data/store.ts";
import { IN_CLAUDE } from "./data/relay.ts";
import "./style.css";

render(<App />, document.getElementById("app")!);
init().catch(() => { S.ready = true; S.storageError = "No se pudieron abrir los datos guardados en este navegador."; touch(); });

// para las pruebas de navegador y para revisar algo a mano desde la consola
(window as unknown as Record<string, unknown>).__boveda = { engine, store, S };

// la app sigue abriendo sin conexión; el archivo de servicio siempre intenta la red primero
// dentro de claude.ai no hay archivo de servicio: la página la sirve claude.ai
if (!IN_CLAUDE && "serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => { /* sin instalación: la app funciona igual */ }); });
}
