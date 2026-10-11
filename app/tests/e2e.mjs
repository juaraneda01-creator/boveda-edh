// Pruebas de navegador del Constructor: recorren la app como una persona, en un teléfono de 390 px.
// Uso: node tests/e2e.mjs [parte del nombre de una prueba]
import fs from "node:fs";
import { serve, mock, launch, runAll, check, fixture, calls, net } from "./harness.mjs";

const site = await serve(); const browser = await launch();
const errors = [];
async function open({ width = 390, height = 844, storage } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, storageState: storage });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await mock(page); await page.goto(site.url); await page.waitForSelector(".hero, .page-h");
  return { ctx, page };
}
const idle = page => page.waitForFunction(() => !window.__boveda.S.busy, null, { timeout: 30000 });
const toastGone = async page => { await page.evaluate(() => { const S = window.__boveda.S; S.toast = null; window.__boveda.store.touch(); }); };
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const deckState = page => page.evaluate(() => { const { S, store, engine } = window.__boveda; const d = S.decks[0]; const A = store.insight(d).A; return { id: d.id, main: A.main, gc: A.gc, off: A.off, illegal: A.illegal, dupes: A.dupes, missing: A.missing.length, land: A.roles.land, bracket: engine.bracketOf(d, A).b, versions: S.versions.filter(v => v.deckId === d.id).length, plan: d.plan, name: d.name, combos: !!d.combos }; });

/** Crea un mazo desde un comandante y arma el borrador con el bracket indicado. */
async function draftDeck(page, cmd = "Hakbal", bracket = 2) {
  await page.getByRole("button", { name: /Empezar con un comandante|Nuevo mazo/ }).first().click();
  await page.getByPlaceholder(/Atraxa/).fill(cmd);
  await page.locator(".cmd-opt").first().click();
  await page.getByRole("button", { name: "Crear mazo" }).click();
  await page.waitForSelector(".steps"); await idle(page);
  if (bracket) await page.getByRole("button", { name: new RegExp(`^${bracket}\\. `) }).click();
  await page.getByRole("button", { name: "Armar borrador" }).click();
  await page.waitForFunction(() => { const S = window.__boveda.S; return !S.busy && S.decks[0] && S.decks[0].cards.length > 50; }, null, { timeout: 30000 });
  await page.waitForSelector(".slots"); await toastGone(page);
}
/** Agrega un mazo de referencia pegando su lista. */
async function addRef(page, file, owner = "Nico") {
  await page.goto(site.url + "#/"); await page.getByRole("button", { name: "Traer una lista" }).click();
  await page.locator(".sheet textarea").fill(fixture(file));
  await page.getByLabel(/mazo de referencia/).check(); await page.getByLabel("De quién es").fill(owner);
  await page.getByRole("button", { name: "Crear mazo" }).click();
  await page.waitForSelector(".steps"); await idle(page); await toastGone(page);
}

const tests = [
  ["primer uso: de un comandante a un borrador de 99 cartas dentro del bracket", async () => {
    const { ctx, page } = await open();
    check(await page.getByRole("heading", { level: 1 }).innerText() === "Arma tu mazo de Commander por casillas, no por lista", "portada");
    await draftDeck(page, "Hakbal", 2);
    const st = await deckState(page);
    check(st.main === 99, `99 cartas, hay ${st.main}`); check(st.gc.length === 0, "bracket 2 sin Game Changers: " + st.gc);
    check(!st.off.length && !st.illegal.length && !st.dupes.length && !st.missing, "lista limpia: " + JSON.stringify(st));
    check(st.bracket <= 2, "bracket " + st.bracket); check(st.plan.bracket === 2, "plan guardado");
    check(/99 de 99/.test(await page.locator(".deck-meta").innerText()), "cabecera con 99 de 99");
    check((await page.locator(".slot").count()) === 9, "nueve casillas");
    check((await overflow(page)) <= 0, "sin desborde horizontal en Armar");
    check(calls.edhrec >= 1 && calls.edhrec <= 3, "EDHREC consultado " + calls.edhrec);
    await ctx.close(); return `${st.land} tierras`;
  }],

  ["casillas: abrir, ver sugerencias, agregar y quitar", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3);
    await page.locator("#slot-ramp .slot-h").click();
    await page.waitForSelector("#slot-ramp .cards"); const before = (await deckState(page)).main;
    check((await page.locator("#slot-ramp .cards.sug li").count()) > 0, "hay sugerencias de ramp");
    const sugName = await page.locator("#slot-ramp .cards.sug li .cardname").first().innerText();
    await page.locator("#slot-ramp .cards.sug li .add").first().click();
    await page.waitForFunction(n => window.__boveda.S.decks[0].cards.reduce((a, c) => a + c.q, 0) === n, before + 1);
    check(/Sobran 1/.test(await page.locator(".lead-text").innerText()), "avisa que sobra una");
    const inRamp = await page.locator("#slot-ramp .cards:not(.sug) li .cardname").allInnerTexts();
    check(inRamp.includes(sugName), `${sugName} quedó en la casilla de ramp`);
    await page.locator("#slot-ramp .cards:not(.sug) li", { hasText: sugName }).getByRole("button", { name: /Quitar/ }).click();
    await page.waitForFunction(n => window.__boveda.S.decks[0].cards.reduce((a, c) => a + c.q, 0) === n, before);
    // vista por tipos
    await page.getByRole("tab", { name: "Tipos" }).click();
    check((await page.locator(".types h4").count()) >= 4, "agrupa por tipo");
    check((await overflow(page)) <= 0, "sin desborde");
    await ctx.close();
  }],

  ["agregar un Game Changer avisa el cambio de bracket y la ficha muestra la carta", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 2);
    await page.locator("#add-card").fill("Rhystic");
    await page.locator(".search-opts button", { hasText: "Rhystic Study" }).click();
    await page.waitForSelector(".toast.warn");
    check(/pasa de bracket 2 a 3/.test(await page.locator(".toast").innerText()), "aviso: " + await page.locator(".toast").innerText());
    const st = await deckState(page); check(st.gc.includes("Rhystic Study") && st.bracket === 3, "quedó en bracket 3");
    check(await page.locator(".note.warn", { hasText: "buscas 2" }).count() > 0, "aviso permanente en Armar");
    await toastGone(page);
    await page.getByRole("tab", { name: "Tipos" }).click();
    await page.locator(".types .cardname", { hasText: "Rhystic Study" }).first().click();
    await page.waitForSelector(".sheet");
    check(await page.locator(".sheet .pill", { hasText: "Game Changer" }).count() === 1, "la ficha dice Game Changer");
    await page.getByRole("button", { name: "Quitar del mazo" }).click();
    await page.waitForFunction(() => !window.__boveda.S.decks[0].cards.some(c => c.n === "Rhystic Study"));
    check((await deckState(page)).bracket <= 2, "vuelve a bracket 2");
    await page.keyboard.press("Escape");
    await ctx.close();
  }],

  ["traer una lista: pegar texto, detectar comandante y editar como texto", async () => {
    const { ctx, page } = await open();
    await page.getByRole("button", { name: "Traer una lista que ya tengo" }).click();
    await page.locator(".sheet textarea").fill(fixture("hakbal.txt"));
    await page.getByRole("button", { name: "Crear mazo" }).click();
    await page.waitForSelector(".slots"); await idle(page);
    let st = await deckState(page);
    check(st.main > 85 && st.missing === 0, "lista cargada: " + JSON.stringify(st));
    check(/Hakbal of the Surging Soul/.test(await page.locator(".deck-meta").innerText()), "comandante detectado");
    await toastGone(page);
    await page.getByRole("button", { name: "Editar como texto" }).click();
    const ta = page.locator(".sheet textarea"); const txt = await ta.inputValue();
    check(/^Commander\n1 Hakbal/.test(txt), "el texto parte por el comandante");
    await ta.fill(txt.split("\n").filter(l => !/Sol Ring|Cultivate/.test(l)).join("\n") + "\n1 Rhystic Study");
    await page.getByRole("button", { name: "Guardar lista" }).click(); await page.waitForSelector(".sheet", { state: "detached" }); await idle(page);
    st = await deckState(page);
    check(st.gc.includes("Rhystic Study"), "entró la carta escrita a mano"); check(st.versions === 1, "la lista anterior quedó como versión");
    await ctx.close();
  }],

  ["probar: manos, partidas simuladas contra un mazo de referencia y partidas reales", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3);
    const id = (await deckState(page)).id;
    await addRef(page, "hapatra.txt", "Nico"); await addRef(page, "callampitas.txt", "Feña");
    await page.goto(site.url + `#/mazo/${id}/probar`); await page.waitForSelector(".seg");
    check(/%/.test(await page.locator(".stat-v").first().innerText()), "estadísticas de manos");
    await page.getByRole("button", { name: "Robar 7 cartas" }).click();
    check((await page.locator(".hand li").count()) === 7, "mano de 7");
    await page.getByRole("button", { name: "Robar una carta" }).click();
    check((await page.locator(".hand li").count()) === 8, "roba la octava");
    check((await overflow(page)) <= 0, "manos sin desborde");
    // simuladas
    await page.getByRole("tab", { name: "Simuladas" }).click();
    check((await page.locator('.chip[aria-pressed="true"]').count()) === 2, "los dos mazos de referencia vienen elegidos");
    const t0 = Date.now(); await page.getByRole("button", { name: "200 partidas" }).click();
    await page.waitForSelector("table.tbl tr.mine", { timeout: 60000 }); const secs = (Date.now() - t0) / 1000;
    const sim = await page.evaluate(() => { const { S } = window.__boveda; return [...S.sims.values()][0]; });
    check(sim.n === 200 && sim.decks.length === 3, "tres mazos, 200 partidas");
    check(sim.decks.reduce((a, d) => a + d.w, 0) + sim.draws === 200, "todas las partidas cuentan");
    check(secs < 15, `simulación lenta: ${secs} s`);
    check((await overflow(page)) <= 0, "simuladas sin desborde");
    // reales
    await page.getByRole("tab", { name: "Reales" }).click();
    check(await page.getByRole("button", { name: "Guardar partida" }).isDisabled(), "no se guarda sin resultado");
    check(/Sin anotar/.test(await page.locator(".stepper b").innerText()), "el turno parte sin anotar");
    await page.getByRole("button", { name: "Gané" }).click(); await page.getByRole("button", { name: "Un turno más" }).click(); await page.getByRole("button", { name: "Un turno más" }).click();
    await page.getByRole("button", { name: "Combate" }).click(); await page.getByRole("button", { name: "Guardar partida" }).click();
    await page.waitForSelector(".games li");
    const g = await page.evaluate(() => window.__boveda.S.games[0]);
    check(g.res === "win" && g.turn === 8 && g.how === "combat", "partida guardada: " + JSON.stringify(g));
    check(/1-0/.test(await page.locator(".stats").first().innerText()), "récord 1-0");
    check((await overflow(page)) <= 0, "reales sin desborde");
    await ctx.close(); return `200 partidas en ${secs.toFixed(1)} s`;
  }],

  ["A contra B: comparar la lista actual con una versión guardada", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3);
    const id = (await deckState(page)).id;
    await page.goto(site.url + `#/mazo/${id}/versiones`);
    await page.getByLabel("Nombre de la versión").fill("Borrador inicial"); await page.getByRole("button", { name: "Guardar versión" }).click();
    await page.waitForSelector(".versions li"); await toastGone(page);
    check(/Igual a la lista actual/.test(await page.locator(".versions li").first().innerText()), "versión igual a la actual");
    check(await page.getByRole("button", { name: "Comparar con la actual" }).isDisabled(), "no se compara una lista consigo misma");
    // se sacan 30 tierras: la lista actual debe salir claramente peor
    await page.evaluate(async () => { const { S, store } = window.__boveda; const d = S.decks[0]; const lands = d.cards.filter(c => { const m = S.db.get(c.n); return m && m.t === "Land"; }); let left = 30; const cards = d.cards.flatMap(c => { if (!lands.includes(c) || left <= 0) return [c]; const cut = Math.min(c.q, left); left -= cut; return c.q - cut > 0 ? [{ ...c, q: c.q - cut }] : []; }); await store.saveDeck({ ...d, cards }, "prueba"); });
    await page.waitForFunction(() => /salieron 30/.test(document.querySelector(".versions")?.textContent || ""));
    await page.locator(".versions li", { hasText: "Borrador inicial" }).getByRole("button", { name: "Comparar con la actual" }).click();
    await page.waitForSelector("select"); check(await page.getByRole("tab", { name: "A contra B" }).getAttribute("aria-selected") === "true", "abre en A contra B");
    await page.getByRole("button", { name: "200 partidas" }).click();
    const result = page.locator(".note", { hasText: /rinde mejor|No hay diferencia/ });
    await result.waitFor({ timeout: 90000 }); const verdict = await result.innerText();
    check(/La versión A rinde mejor/.test(verdict), "la versión con tierras debe ganar: " + verdict);
    check(/espejo/.test(verdict), "sin rivales se usa la mesa de espejo");
    check((await page.locator("table.tbl td.best").count()) >= 1, "marca el mejor valor");
    check(/Salen de A \(30\)/.test(await page.locator(".cols h4").nth(1).innerText()), "lista lo que salió");
    check((await overflow(page)) <= 0, "sin desborde");
    await ctx.close();
  }],

  ["ajustar: cambios sugeridos, plan por bracket, combos y comparación con el meta", async () => {
    const { ctx, page } = await open();
    await page.getByRole("button", { name: "Traer una lista que ya tengo" }).click();
    await page.locator(".sheet textarea").fill(fixture("hakbal.txt")); await page.getByRole("button", { name: "Crear mazo" }).click();
    await page.waitForSelector(".slots"); await idle(page); await toastGone(page);
    const id = (await deckState(page)).id;
    await page.goto(site.url + `#/mazo/${id}/ajustar`);
    await page.getByRole("button", { name: "Consultar qué se juega con tu comandante" }).first().click(); await idle(page);
    await page.waitForSelector(".swaps li");
    const first = page.locator(".swaps li").first(); const txt = await first.innerText();
    const out = (txt.match(/Sale (.+?)\s+Entra/s) || [])[1].trim(); const inn = await first.locator(".in .cardname").innerText();
    await first.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForFunction(([o, i]) => { const c = window.__boveda.S.decks[0].cards.map(x => x.n); return c.includes(i) && !c.includes(o); }, [out, inn]);
    await page.locator(".toast", { hasText: /Entró .* y salió / }).waitFor({ timeout: 10000 }); await toastGone(page);
    check((await deckState(page)).versions === 1, "el cambio dejó una versión");
    // combos
    await page.getByRole("button", { name: "Copiar resumen del mazo" }).click(); await toastGone(page);
    await page.getByRole("tab", { name: "Combos" }).click(); await page.getByRole("button", { name: "Buscar combos" }).click(); await page.waitForSelector(".combos li"); await idle(page);
    check((await deckState(page)).combos, "combos guardados"); check(calls.spellbook >= 1, "se consultó Spellbook");
    check(/^Falta\s+\S+/.test(await page.locator(".combos").last().locator("li").first().innerText()), "muestra el combo a una carta");
    // meta
    await page.getByRole("tab", { name: "Meta" }).click();
    check(/%/.test(await page.locator(".sec", { hasText: "lo que juega el resto" }).locator(".stat-v").first().innerText()), "parecido a la lista típica");
    await page.getByRole("button", { name: "Consultar EDHTop16" }).click(); await idle(page);
    await page.waitForFunction(() => /cartas más jugadas en torneos/.test(document.body.textContent));
    // plan por bracket 1: la lista de Hakbal trae Game Changers que hay que sacar
    await toastGone(page); await page.getByRole("tab", { name: "Bracket" }).click(); await page.getByRole("button", { name: /^2\. Núcleo/ }).click();
    check((await page.locator(".checks li").count()) >= 5, "lista de reglas del bracket");
    check((await overflow(page)) <= 0, "sin desborde");
    await page.getByRole("tab", { name: "Sinergias" }).click(); check((await page.locator(".theme").count()) >= 1, "temas detectados");
    await ctx.close();
  }],

  ["versiones: una por tanda de cambios, y volver a una anterior", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3);
    const id = (await deckState(page)).id; const before = await page.evaluate(() => window.__boveda.S.decks[0].cards.map(c => c.n).sort().join("|"));
    for (const n of ["Rhystic Study", "Worldly Tutor"]) { await page.evaluate(([i, n]) => window.__boveda.store.addCard(i, n), [id, n]); }
    await page.evaluate(i => { const { S, store } = window.__boveda; return store.removeCard(i, S.decks[0].cards.find(c => c.q === 1 && c.n !== "Rhystic Study").n); }, id);
    let st = await deckState(page); check(st.versions === 1, `tres cambios seguidos dejan una sola versión, hay ${st.versions}`);
    await page.goto(site.url + `#/mazo/${id}/versiones`); await page.waitForSelector(".versions li");
    await page.getByRole("button", { name: "Volver a esta" }).click(); await page.getByRole("button", { name: "Toca de nuevo para restaurarla" }).click();
    await page.waitForFunction(b => window.__boveda.S.decks[0].cards.map(c => c.n).sort().join("|") === b, before);
    st = await deckState(page); check(st.main === 99, "lista restaurada con 99");
    check(st.versions === 2, `la lista que había antes de restaurar quedó como versión (hay ${st.versions})`);
    await page.locator(".toast", { hasText: "quedó guardada en Versiones" }).waitFor({ timeout: 10000 });   // el aviso dice la verdad
    // dos cambios sin esperar entre ellos: ninguno se pierde
    const two = await page.evaluate(() => { const { S, store } = window.__boveda; const d = S.decks[0]; const [a, b] = d.cards.filter(c => c.q === 1).slice(0, 2).map(c => c.n); store.removeCard(d.id, a); store.removeCard(d.id, b); const now = S.decks[0].cards.map(c => c.n); return !now.includes(a) && !now.includes(b); });
    check(two, "dos toques seguidos quitan las dos cartas");
    // un cambio grande siempre deja versión, aunque haya una reciente
    const v0 = (await deckState(page)).versions;
    await page.evaluate(() => { const { S, store } = window.__boveda; const d = S.decks[0]; return store.saveDeck({ ...d, cards: d.cards.slice(0, 50) }, "editar la lista"); });
    check((await deckState(page)).versions === v0 + 1, "reemplazar la lista deja versión");
    await ctx.close();
  }],

  ["los datos sobreviven a recargar la página y sin conexión la app sigue funcionando", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3);
    const a = await deckState(page);
    await page.reload(); await page.waitForSelector(".slots, .page-h");
    const b = await deckState(page);
    check(a.main === b.main && b.missing === 0 && b.name === a.name, "mismo mazo tras recargar: " + JSON.stringify(b));
    const sf = calls.collection; await page.reload(); await page.waitForSelector(".slots"); await page.waitForTimeout(400);
    check(calls.collection === sf, "al recargar no se vuelven a pedir cartas a Scryfall");
    net.offline = true;
    try {
      await page.goto(site.url + `#/mazo/${a.id}/probar`); await page.waitForSelector(".stat-v");
      await page.goto(site.url + `#/mazo/${a.id}/armar`); await page.locator("#add-card").fill("zzzz"); await page.getByRole("button", { name: "Agregar", exact: true }).click();
      await page.waitForSelector(".toast"); check((await deckState(page)).missing === 1, "sin conexión la carta se agrega y queda marcada sin datos");
      check(await page.locator(".note.warn", { hasText: "no tiene datos" }).count() === 1, "avisa que faltan datos");
    } finally { net.offline = false; }
    await ctx.close();
  }],

  ["respaldo: descargar, borrar todo e importar; y traer mazos desde la Bóveda", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3);
    await page.goto(site.url + "#/ajustes");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar respaldo" }).click()]);
    const backup = fs.readFileSync(await dl.path()); check(/boveda-constructor-\d{4}-\d\d-\d\d\.json/.test(dl.suggestedFilename()), "nombre del respaldo");
    check(/[0-9a-f]{7}/.test(await page.locator(".version").innerText()), "muestra la versión de la app");
    await ctx.close();
    // navegador limpio
    const s2 = await open(); const p2 = s2.page;
    await p2.goto(site.url + "#/ajustes"); await p2.locator('input[type="file"]').setInputFiles({ name: "respaldo.json", mimeType: "application/json", buffer: backup });
    await p2.waitForSelector(".note.info"); check(/Se importaron 1 mazo/.test(await p2.locator(".note.info").innerText()), "informe del respaldo");
    check((await deckState(p2)).main === 99, "el mazo volvió completo");
    // respaldo de la Bóveda original: solo entran los mazos de Commander
    const old = { app: "boveda-edh", version: 4, at: 1, collection: { items: [{ n: "Sol Ring", q: 1 }] }, binders: [{ name: "Venta", items: [] }], settings: { cur: "usd" },
      decks: [
        { id: "viejo1", format: "commander", name: "Hapatra viejo", commanders: ["Hapatra, Vizier of Poisons"], cards: [{ n: "Sol Ring", q: 1 }, { n: "Swamp", q: 10 }], side: [{ n: "Forest", q: 1 }], maybe: [], versions: [{ at: 5, savedAt: 6, src: "manual", commanders: ["Hapatra, Vizier of Poisons"], cards: [{ n: "Swamp", q: 9 }], side: [], maybe: [] }], rival: { owner: "Pame" } },
        { id: "viejo2", format: "pauper", name: "Burn", commanders: [], cards: [{ n: "Lightning Bolt", q: 4 }] }],
      games: [{ id: "g1", at: 10, deck: "viejo1", res: "win", turn: 9, how: "combat", seat: 2, opp: ["Atraxa"], note: "" }, { id: "g2", at: 11, deck: "viejo2", res: "loss" }] };
    await p2.locator('input[type="file"]').setInputFiles({ name: "boveda-edh-respaldo.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(old)) });
    await p2.waitForFunction(() => /Venían de la Bóveda/.test(document.body.textContent));
    const r = await p2.evaluate(() => { const S = window.__boveda.S; const d = S.decks.find(x => x.id === "viejo1"); return { n: S.decks.length, kind: d.kind, owner: d.owner, maybe: d.maybe, v: S.versions.filter(v => v.deckId === "viejo1").length, g: S.games.filter(g => g.deckId === "viejo1").length, all: S.games.length, pauper: S.decks.some(x => x.id === "viejo2") }; });
    check(r.n === 2 && !r.pauper, "entra solo el mazo de Commander"); check(r.kind === "ref" && r.owner === "Pame", "el mazo de un amigo queda como referencia");
    check(r.v === 1 && r.g === 1 && r.all === 1, "versiones y partidas del mazo importado"); check(r.maybe.length === 1, "el banquillo pasa a probables");
    check(/1 mazo de otro formato se dejó fuera/.test(await p2.locator(".note.info").innerText()), "avisa lo que quedó fuera");
    // un archivo cualquiera no rompe nada
    await p2.locator('input[type="file"]').setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{\"hola\":1}") });
    await p2.waitForSelector(".note.bad"); check((await p2.evaluate(() => window.__boveda.S.decks.length)) === 2, "nada cambió");
    await s2.ctx.close();
  }],

  ["importar sobre datos existentes deja versión, y un respaldo mal formado no rompe la app", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3);
    const id = (await deckState(page)).id;
    const backup = await page.evaluate(() => JSON.stringify(window.__boveda.store.makeBackup()));
    await page.evaluate(() => { const { S, store } = window.__boveda; const d = S.decks[0]; return store.saveDeck({ ...d, name: "Cambiado", cards: d.cards.slice(0, 40) }, "editar la lista"); });
    const v0 = (await deckState(page)).versions;
    await page.goto(site.url + "#/ajustes");
    const up = (name, text) => page.locator('input[type="file"]').setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
    await up("r.json", backup); await page.waitForSelector(".note.info");
    check(/1 mazo que ya tenías se reemplazó/.test(await page.locator(".note.info").innerText()), "avisa que reemplazó: " + await page.locator(".note.info").innerText());
    let st = await deckState(page); check(st.main === 99 && st.versions === v0 + 1, "la lista de 40 quedó como versión antes de reemplazarla");
    // respaldo de la Bóveda dos veces: las versiones no se duplican
    const old = JSON.stringify({ app: "boveda-edh", collection: { items: [] }, decks: [{ id: "v1", format: "commander", name: "Viejo", commanders: ["Hapatra, Vizier of Poisons"], cards: [{ n: "Swamp", q: 30 }], versions: [{ at: 5, savedAt: 6, src: "manual", cards: [{ n: "Swamp", q: 9 }] }] }], games: [] });
    await up("a.json", old); await page.waitForFunction(() => window.__boveda.S.decks.some(d => d.id === "v1")); await up("b.json", old); await page.waitForTimeout(300);
    check((await page.evaluate(() => window.__boveda.S.versions.filter(v => v.deckId === "v1").length)) === 1, "importar dos veces no duplica versiones");
    // respaldo mal formado: combos rotos, partida rota, id con barra, cantidad absurda, dirección peligrosa
    const bad = JSON.stringify({ app: "boveda-constructor", version: 1, decks: [
        { id: "a/b<c>", name: "Roto", commanders: ["Hakbal of the Surging Soul"], cards: [{ n: "Forest", q: 30000000 }, { n: "Sol Ring", q: "x" }, null, 7], combos: { inc: 5 }, plan: { bracket: 99, inter: "zzz", theme: 5 } },
        { id: "malo2", name: "Combos raros", commanders: ["Hakbal of the Surging Soul"], cards: Array.from({ length: 70 }, (_, i) => ({ n: "Island", q: 1 })), combos: { at: 1, inc: [{ id: 1, cards: null }, { id: 2, cards: ["Sol Ring", 5] }, "x"], almost: null } }],
      games: [{ id: "g9", deckId: "malo2", res: "win", opp: 7, turn: "abc", seat: 9 }, { id: "g10", deckId: "malo2", res: "nope" }],
      versions: [{ id: "v9", deckId: "malo2", cards: "no", label: {} }],
      cards: [{ k: "sol-ring", card: { n: "Sol Ring", rv: 6, uri: "javascript:alert(1)", img: "https://evil.example/x.png", at: 9e15, t: "Artifact", r: "x", tg: null } }, { k: "test-evil", card: { n: "Test Evil", rv: 6, uri: "javascript:alert(1)", img: "https://evil.example/x.png", at: 9e15, t: "Artifact", tg: [], rf: [], r: [] } }] });
    await up("malo.json", bad); await page.waitForFunction(() => window.__boveda.S.decks.some(d => d.name === "Roto"));
    const r = await page.evaluate(() => { const { S } = window.__boveda; const d = S.decks.find(x => x.name === "Roto"), e = S.decks.find(x => x.id === "malo2"); const c = S.db.cards.get("test-evil"); return { id: d.id, q: d.cards.map(c => c.q), combos: d.combos, plan: d.plan, inc: e.combos.inc, games: S.games.filter(g => g.deckId === "malo2"), v: S.versions.filter(v => v.deckId === "malo2"), uri: c && c.uri, img: c && c.img, at: c && c.at <= Date.now() }; });
    check(/^[\w-]+$/.test(r.id), "id saneado: " + r.id); check(r.q.every(q => q >= 1 && q <= 99), "cantidades acotadas: " + r.q);
    check(r.combos === undefined && r.plan.bracket === null && r.plan.inter === "mid" && typeof r.plan.theme === "string", "combos y plan inválidos descartados");
    check(r.inc.length === 1 && r.inc[0].cards.join() === "Sol Ring", "solo queda el combo bien formado");
    check(r.games.length === 1 && Array.isArray(r.games[0].opp) && r.games[0].turn === 0 && r.games[0].seat === null, "partida saneada: " + JSON.stringify(r.games));
    check(r.v.length === 1 && Array.isArray(r.v[0].cards) && typeof r.v[0].label === "string", "versión saneada");
    check(r.uri === "" && r.img === "" && r.at, "direcciones ajenas a Scryfall descartadas");
    for (const path of ["#/", `#/mazo/${r.id}/armar`, "#/mazo/malo2/probar", "#/mazo/malo2/ajustar", "#/mazo/malo2/versiones"]) {
      await page.goto(site.url + path); await page.waitForTimeout(150);
      check(await page.locator(".deck-row, .steps").count() > 0, `${path} se muestra`); check(!(await page.locator("text=no se pudo mostrar").count()), `${path} sin error`);
    }
    await page.goto(site.url + "#/mazo/malo2/probar"); await page.getByRole("tab", { name: "Reales" }).click(); await page.waitForSelector(".games li");
    await page.goto(site.url + "#/mazo/malo2/ajustar"); await page.getByRole("tab", { name: "Combos" }).click(); await page.waitForSelector(".combos li");
    await ctx.close(); return `${id.length ? "ok" : ""}`;
  }],

  ["Scryfall caído: pocas consultas y un mensaje que no culpa a los nombres", async () => {
    const { ctx, page } = await open(); const before = calls.scryfall; net.scry500 = true;
    try {
      await page.getByRole("button", { name: "Traer una lista que ya tengo" }).click();
      await page.locator(".sheet textarea").fill(fixture("hakbal.txt")); await page.getByRole("button", { name: "Crear mazo" }).click();
      await page.waitForSelector(".toast.warn", { timeout: 20000 });
      check(/Scryfall no está respondiendo/.test(await page.locator(".toast").innerText()), "mensaje: " + await page.locator(".toast").innerText());
      await idle(page); check(calls.scryfall - before <= 6, `consultas a Scryfall con el servicio caído: ${calls.scryfall - before}`);
    } finally { net.scry500 = false; }
    // cuando vuelve, las cartas se traen al pedirlo
    await toastGone(page); await page.getByRole("button", { name: "Actualizar cartas" }).click(); await idle(page);
    check((await deckState(page)).missing === 0, "al volver Scryfall, las cartas llegan");
    await ctx.close();
  }],

  ["el tema del plan cambia las sugerencias, y sin almacenamiento la app avisa", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3); const id = (await deckState(page)).id;
    await page.goto(site.url + `#/mazo/${id}/plan`); await page.getByRole("button", { name: "Merfolk", exact: true }).click();
    await page.waitForFunction(() => { const { S, store } = window.__boveda; const E = store.edhOf(S.decks[0]); return E && E.theme === "Merfolk"; }, null, { timeout: 15000 });
    await page.goto(site.url + `#/mazo/${id}/ajustar`); await page.waitForSelector(".sec-aside");
    check(/tema Merfolk/.test(await page.locator(".sec-aside").first().innerText()), "Ajustar usa el tema");
    await ctx.close();
    // navegador que no deja usar IndexedDB
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p2 = await c2.newPage();
    await p2.addInitScript(() => { Object.defineProperty(window, "indexedDB", { get() { throw new Error("bloqueado"); } }); });
    await mock(p2); await p2.goto(site.url); await p2.waitForSelector(".hero");
    await p2.waitForSelector(".note.bad"); check(/no deja guardar datos/.test(await p2.locator(".note.bad").first().innerText()), "aviso en la portada");
    await c2.close();
  }],

  ["el arranque nunca queda pegado en “Abriendo tus mazos”", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3);
    for (let i = 0; i < 25; i++) { await page.reload(); await page.waitForSelector(".slots", { timeout: 5000 }); }
    await ctx.close(); return "25 recargas";
  }],

  ["meta: torneos, Game Changers y reglas de brackets", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3);
    await page.goto(site.url + "#/meta"); await page.waitForSelector("table.tbl tbody tr"); await idle(page);
    check(/Kinnan, Bonder Prodigy/.test(await page.locator("table.tbl tbody tr").first().innerText()), "primer comandante del meta");
    check(/8,1 %/.test(await page.locator("table.tbl tbody tr").first().innerText()), "porcentaje del meta");
    check(await page.locator("table.tbl tr.mine", { hasText: "Hakbal" }).count() === 1, "marca tu comandante");
    check(/Game Changers \(53\)/.test(await page.locator(".sec h3").nth(1).innerText()), "53 Game Changers");
    check((await page.locator(".brackets > div").count()) === 5, "cinco brackets");
    check((await overflow(page)) <= 0, "sin desborde");
    await ctx.close();
  }],

  ["teléfono de 390 px: ninguna pantalla se desborda y los botones se pueden tocar", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3);
    const id = (await deckState(page)).id; const bad = []; const small = [];
    for (const path of ["#/", `#/mazo/${id}/plan`, `#/mazo/${id}/armar`, `#/mazo/${id}/probar`, `#/mazo/${id}/ajustar`, `#/mazo/${id}/versiones`, "#/meta", "#/ajustes"]) {
      await page.goto(site.url + path); await page.waitForTimeout(250); await idle(page);
      if (path.endsWith("/armar")) { for (const k of ["land", "ramp", "plan"]) await page.locator(`#slot-${k} .slot-h`).click(); }
      const tabs = /\/(probar|ajustar)$/.test(path) ? await page.locator("main .seg").first().getByRole("tab").all() : [null];
      for (const tab of tabs) {
        if (tab) { await tab.click(); await page.waitForTimeout(80); const h = await page.evaluate(() => document.documentElement.scrollHeight); if (h > 6500) bad.push(`${path} (${await tab.innerText()}): ${h}px de alto`); }
        const o2 = await overflow(page); if (o2 > 0) bad.push(`${path}${tab ? " (" + await tab.innerText() + ")" : ""}: ${o2}px`);
      }
      const o = await overflow(page); if (o > 0) bad.push(`${path}: ${o}px`);
      const tiny = await page.evaluate(() => [...document.querySelectorAll("main button, main a.btn, main input:not([type=checkbox]):not([type=file]), main select")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 34 || r.width < 30) && !e.classList.contains("cardname"); }).map(e => (e.textContent || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 20) + ` ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
      if (tiny.length) small.push(`${path}: ${[...new Set(tiny)].slice(0, 4).join(" | ")}`);
      const unnamed = await page.evaluate(() => [...document.querySelectorAll("button, a")].filter(e => !(e.textContent || "").trim() && !e.getAttribute("aria-label")).length);
      check(unnamed === 0, `${path}: ${unnamed} botones o enlaces sin nombre`);
    }
    check(!bad.length, "desborde: " + bad.join("; ")); check(!small.length, "botones chicos: " + small.join("; "));
    await ctx.close();
  }],

  ["escritorio de 1280 px: dos columnas y hoja centrada", async () => {
    const { ctx, page } = await open({ width: 1280, height: 800 }); await draftDeck(page, "Hakbal", 3);
    const id = (await deckState(page)).id; await page.goto(site.url + `#/mazo/${id}/plan`); await page.waitForSelector(".cols");
    const cols = await page.evaluate(() => getComputedStyle(document.querySelector(".cols")).gridTemplateColumns.split(" ").length);
    check(cols === 2, "dos columnas en el plan"); check((await overflow(page)) <= 0, "sin desborde");
    await ctx.close();
  }],

  ["rendimiento en teléfono lento: carga y cambio de pantalla", async () => {
    const { ctx, page } = await open(); await draftDeck(page, "Hakbal", 3); const id = (await deckState(page)).id;
    const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t0 = Date.now(); await page.goto(site.url + `#/mazo/${id}/armar`); await page.reload(); await page.waitForSelector(".slots"); const load = Date.now() - t0;
    const nav = async (hash, sel) => page.evaluate(async ([h, s]) => { const t = performance.now(); location.hash = h; for (let i = 0; i < 200; i++) { await new Promise(r => requestAnimationFrame(r)); if (document.querySelector(s)) break; } return Math.round(performance.now() - t); }, [hash, sel]);
    const probar = await nav(`#/mazo/${id}/probar`, ".bars"), ajustar = await nav(`#/mazo/${id}/ajustar`, ".swaps, .sec"), armar = await nav(`#/mazo/${id}/armar`, ".slots");
    check(load < 2500, `carga lenta: ${load} ms`); check(Math.max(probar, ajustar, armar) < 1500, `cambio de pantalla lento: ${probar}/${ajustar}/${armar} ms`);
    await ctx.close(); return `carga ${load} ms; probar ${probar} ms, ajustar ${ajustar} ms, armar ${armar} ms (CPU 4 veces más lenta)`;
  }],
];

const failed = await runAll(tests);
if (errors.length) { console.log("\nErrores de JavaScript en la página:\n  " + [...new Set(errors)].slice(0, 10).join("\n  ")); }
await browser.close(); site.close();
process.exit(failed || errors.length ? 1 : 0);
