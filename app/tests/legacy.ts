// Carga el motor de la Bóveda original (../src/*.js) dentro de un contexto aislado, para comparar
// sus resultados con los del motor nuevo. No se usa en la app: solo en las pruebas de paridad.
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LEGACY_SRC = path.resolve(HERE, "../../src");
export const hasLegacy = (): boolean => fs.existsSync(path.join(LEGACY_SRC, "core.js"));

export interface Legacy { run<T>(code: string): T; setRandom(f: () => number): void }

export function loadLegacy(): Legacy {
  let random: () => number = Math.random;
  const math = Object.create(Math); math.random = () => random();
  const noop = () => {};
  const el = { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], hidden: true, textContent: "", innerHTML: "", dataset: {}, classList: { add: noop, remove: noop, contains: () => false } };
  const ctx: Record<string, unknown> = {
    console, setTimeout, clearTimeout, Math: math, Date, JSON, URL, TextEncoder, TextDecoder, Promise,
    document: { ...el, documentElement: el, body: el, createElement: () => ({ ...el }) },
    location: { hostname: "", href: "file:///", search: "", hash: "" },
    navigator: { userAgent: "node", onLine: true },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    addEventListener: noop, removeEventListener: noop,
    fetch: () => Promise.reject(new Error("sin red en las pruebas")),
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ["meta.js", "core.js", "tags.js", "power.js", "report.js", "games.js", "sim.js"]) {
    vm.runInContext(fs.readFileSync(path.join(LEGACY_SRC, f), "utf8"), ctx, { filename: f });
  }
  // el original redibuja la pantalla al guardar: aquí no hay pantalla
  vm.runInContext("var render = function(){}; var renderBusy = function(){}; var toast = function(){};", ctx);
  return {
    run<T>(code: string): T { return vm.runInContext(code, ctx) as T; },
    setRandom(f) { random = f; },
  };
}
