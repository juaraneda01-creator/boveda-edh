// Pruebas de la versión para abrir dentro de claude.ai (../artifact). Simula lo que hace claude.ai:
// envuelve la página en su esqueleto y entrega window.claude con Firecrawl (mcp) y descargas.
// La app no debe consultar ningún sitio directo: todo pasa por Firecrawl, que aquí responde con los datos de prueba.
// Uso: node tests/artifact.mjs [parte del nombre de una prueba]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, mock, launch, runAll, check, fixture, calls } from "./harness.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = fs.readFileSync(path.resolve(HERE, "../../artifact/index.html"), "utf8");
const site = await serve("artifact"); const browser = await launch();
const errors = [];

// lo que pone claude.ai: esqueleto, y la capacidad mcp (Firecrawl) y la de descargas
const HOST = `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body><script>
(() => {
  const realFetch = window.fetch.bind(window);
  window.__direct = []; window.__relay = []; window.__saved = []; window.__mcpFail = null;
  window.fetch = (u, init) => { const url = String(u && u.url || u); if (/^https?:/.test(url) && !url.startsWith(location.origin)) window.__direct.push(url); return realFetch(u, init); };
  const mcp = Object.freeze({ async callTool(server, tool, input) {
    if (server !== "Firecrawl" || tool !== "firecrawl_scrape") throw { code: "not_in_manifest", message: "fuera del manifiesto" };
    if (window.__mcpFail) throw { code: window.__mcpFail, message: "falla simulada" };
    window.__relay.push(input.url);
    const r = await realFetch(input.url); const t = await r.text();
    return { content: [{ type: "text", text: "{}" }], payload: { rawHtml: t, metadata: { statusCode: r.status } } };
  } });
  const downloads = Object.freeze({ async save({ filename, data }) { window.__saved.push({ filename, data: String(data) }); return { status: "saved" }; } });
  window.claude = Object.freeze({ use: n => new Promise(ok => setTimeout(() => ok(n === "mcp" ? mcp : n === "downloads" ? downloads : null), 30)) });
})();
</script>${PAGE}</body></html>`;

async function open({ width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await mock(page);
  await page.route(site.url + "host.html", r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: HOST }));
  await page.goto(site.url + "host.html"); await page.waitForSelector(".hero, .page-h");
  return { ctx, page };
}
const idle = page => page.waitForFunction(() => !window.__boveda.S.busy, null, { timeout: 30000 });
const toastGone = page => page.evaluate(() => { const S = window.__boveda.S; S.toast = null; window.__boveda.store.touch(); });
const net = page => page.evaluate(() => ({ direct: window.__direct.slice(), relay: window.__relay.slice() }));
const deck = page => page.evaluate(() => { const { S, store } = window.__boveda; const d = S.decks[0]; const A = store.insight(d).A; return { id: d.id, main: A.main, missing: A.missing.length }; });

const tests = [
  ["la página arranca sin archivo de servicio y sin consultar otros sitios directo", async () => {
    const { ctx, page } = await open();
    check(await page.title() === "Bóveda Constructor", "título " + await page.title());
    check(/[0-9a-f]{7}/.test(await page.locator('meta[name="boveda-version"]').getAttribute("content")), "versión estampada");
    await page.waitForTimeout(300);
    check(!(await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.controller)), "sin archivo de servicio");
    check((await page.evaluate(() => navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r => r.length) : 0)) === 0, "nada registrado");
    await page.goto(site.url + "host.html#/ajustes"); await page.waitForSelector(".page-h");
    check(/dentro de claude\.ai/.test(await page.locator("main, body").first().innerText()), "Ajustes explica la versión dentro de claude.ai");
    check((await net(page)).direct.length === 0, "consultas directas: " + (await net(page)).direct);
    await ctx.close();
  }],

  ["pegar una lista: las cartas llegan por Firecrawl, en búsquedas de 20 nombres", async () => {
    const { ctx, page } = await open(); const exact0 = calls.exact || 0, coll0 = calls.collection;
    await page.getByRole("button", { name: "Traer una lista que ya tengo" }).click();
    await page.locator(".sheet textarea").fill(fixture("hakbal.txt"));
    await page.getByRole("button", { name: "Crear mazo" }).click();
    await page.waitForSelector(".slots"); await idle(page);
    const st = await deck(page); const n = await net(page);
    check(st.main > 85 && st.missing === 0, "lista cargada: " + JSON.stringify(st));
    check(n.direct.length === 0, "consultas directas: " + n.direct.slice(0, 3));
    check(calls.collection === coll0, "no usó el lote por POST");
    const exact = (calls.exact || 0) - exact0; check(exact >= 4 && exact <= 8, "búsquedas exactas: " + exact + "\n" + n.relay.map(u => decodeURIComponent(u).slice(0, 160)).join("\n"));
    check(n.relay.every(u => u.length < 2000), "direcciones cortas");
    await ctx.close(); return `${exact} búsquedas para ${st.main} cartas`;
  }],

  ["armar desde un comandante con EDHREC por Firecrawl; combos y torneos avisan que no están", async () => {
    const { ctx, page } = await open();
    await page.getByRole("button", { name: /Empezar con un comandante|Nuevo mazo/ }).first().click();
    await page.getByPlaceholder(/Atraxa/).fill("Hakbal");
    await page.locator(".cmd-opt").first().click({ timeout: 10000 });
    await page.getByRole("button", { name: "Crear mazo" }).click();
    await page.waitForSelector(".steps"); await idle(page);
    await page.getByRole("button", { name: /^3\. / }).click();
    await page.getByRole("button", { name: "Armar borrador" }).click();
    await page.waitForFunction(() => { const S = window.__boveda.S; return !S.busy && S.decks[0] && S.decks[0].cards.length > 50; }, null, { timeout: 30000 });
    check((await deck(page)).main === 99, "borrador de 99");
    let n = await net(page);
    check(n.relay.some(u => u.includes("json.edhrec.com")), "EDHREC por Firecrawl");
    check(n.direct.length === 0, "consultas directas: " + n.direct.slice(0, 3));
    await toastGone(page);
    const id = (await deck(page)).id; const sb0 = calls.spellbook, top0 = calls.edhtop16;
    await page.goto(site.url + `host.html#/mazo/${id}/ajustar`);
    await page.getByRole("tab", { name: "Combos" }).click(); await page.getByRole("button", { name: "Buscar combos" }).click(); await idle(page);
    await page.waitForFunction(() => /no está disponible en la versión dentro de claude\.ai/.test(document.body.textContent), null, { timeout: 5000 });
    check(calls.spellbook === sb0, "no intentó Spellbook");
    await page.goto(site.url + "host.html#/meta"); await page.waitForSelector(".page-h");
    check(/Foto guardada de EDHTop16/.test(await page.locator("body").innerText()), "meta con la foto guardada");
    check(calls.edhtop16 === top0, "no intentó EDHTop16");
    n = await net(page); check(n.direct.length === 0, "consultas directas: " + n.direct.slice(0, 3));
    await ctx.close();
  }],

  ["respaldo por la capacidad de descargas, y Firecrawl ausente da un mensaje claro", async () => {
    const { ctx, page } = await open();
    await page.getByRole("button", { name: "Traer una lista que ya tengo" }).click();
    await page.locator(".sheet textarea").fill(fixture("hakbal.txt")); await page.getByRole("button", { name: "Crear mazo" }).click();
    await page.waitForSelector(".slots"); await idle(page); await toastGone(page);
    await page.goto(site.url + "host.html#/ajustes"); await page.getByRole("button", { name: "Descargar respaldo" }).click();
    await page.waitForFunction(() => window.__saved.length === 1);
    const saved = await page.evaluate(() => window.__saved[0]);
    check(/^boveda-constructor-\d{4}-\d\d-\d\d\.json$/.test(saved.filename), "nombre " + saved.filename);
    check(JSON.parse(saved.data).decks.length === 1, "el respaldo trae el mazo");
    await page.locator(".toast", { hasText: "Respaldo descargado" }).waitFor({ timeout: 5000 }); await toastGone(page);
    // sin el conector: el mensaje dice qué hacer
    await page.evaluate(() => { window.__mcpFail = "server_not_connected"; });
    await page.goto(site.url + "host.html#/"); await page.getByRole("button", { name: /Nuevo mazo|Empezar con un comandante/ }).first().click();
    await page.getByPlaceholder(/Atraxa/).fill("Kinnan");
    await page.waitForFunction(() => /agrega el conector Firecrawl/.test(document.body.textContent), null, { timeout: 5000 });
    await ctx.close();
  }],

  ["teléfono de 390 px y tema oscuro elegido: sin desborde y con colores oscuros", async () => {
    const { ctx, page } = await open();
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check(bg === "rgb(18, 26, 31)", "fondo oscuro: " + bg);
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    const bg2 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check(bg2 === "rgb(245, 247, 246)", "fondo claro: " + bg2);
    for (const h of ["#/", "#/meta", "#/ajustes"]) {
      await page.goto(site.url + "host.html" + h); await page.waitForSelector(".page-h, .hero");
      const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(o <= 0, `desborde en ${h}: ${o}`);
    }
    await ctx.close();
  }],
];

const failed = await runAll(tests);
if (errors.length) console.log("Errores en la consola:\n  " + [...new Set(errors)].slice(0, 8).join("\n  "));
await browser.close(); site.close();
process.exit(failed || errors.length ? 1 : 0);
