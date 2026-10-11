// Arnés de las pruebas de navegador: sirve ../constructor en un puerto local, abre Chromium
// y responde por Scryfall, EDHREC, Commander Spellbook y EDHTop16 con datos de prueba (sin red).
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const require = createRequire(import.meta.url);
let pw; for (const p of ["playwright", "/opt/npm-tools/node_modules/playwright"]) { try { pw = require(p); break; } catch { /* siguiente */ } }
if (!pw) { console.error("Falta playwright: corre `npm install` en app/."); process.exit(1); }

export const CARDS = JSON.parse(fs.readFileSync(path.join(HERE, "fixtures/cards.json"), "utf8"));
export const fixture = f => fs.readFileSync(path.join(HERE, "fixtures", f), "utf8");
const byName = new Map(); for (const c of CARDS) { byName.set(c.name.toLowerCase(), c); byName.set(c.name.split(" // ")[0].toLowerCase(), c); }
const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’,.!?"():]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };

export function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("no"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" }); res.end(fs.readFileSync(file));
  });
  return new Promise(ok => server.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${server.address().port}/constructor/`, close: () => server.close() })));
}

/** Lo que se pidió a cada sitio, para comprobar que la app no consulta de más. */
export const calls = { scryfall: 0, collection: 0, edhrec: 0, spellbook: 0, edhtop16: 0, other: [] };
export const net = { offline: false, scry500: false };

const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
const edhPage = (theme) => {
  // la página de un tema trae otras 60 cartas, en otro orden
  const all = CARDS.filter(c => !/Basic/.test(c.type_line)); const list = theme ? all.slice(-60).reverse() : all;
  return { num_decks_avg: 4321, container: { json_dict: { card: { num_decks: 4321 }, cardlists: [{ cardviews: list.map((c, i) => ({ name: c.name, potential_decks: 1000, num_decks: Math.max(20, 950 - i * 3), synergy: ((i * 7) % 40 - 10) / 100 })) }] } }, panels: { taglinks: [{ value: "Merfolk", count: 900, slug: "merfolk" }, { value: "Landfall", count: 300, slug: "landfall" }] } };
};

export async function mock(page) {
  await page.route("**/*", async route => {
    const req = route.request(); const u = new URL(req.url());
    if (u.hostname === "127.0.0.1") return route.continue();
    if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    if (net.offline) return route.abort("internetdisconnected");
    if (u.hostname === "api.scryfall.com") {
      calls.scryfall++;
      if (net.scry500) return json(route, { object: "error" }, 500);
      if (u.pathname === "/cards/collection") {
        calls.collection++;
        const ids = JSON.parse(req.postData()).identifiers; const data = [], not_found = [];
        for (const i of ids) { const c = byName.get(String(i.name).toLowerCase()); if (c) data.push(c); else not_found.push(i); }
        return json(route, { data, not_found });
      }
      if (u.pathname === "/cards/named") { const c = byName.get((u.searchParams.get("fuzzy") || "").toLowerCase()); return c ? json(route, c) : json(route, { object: "error" }, 404); }
      if (u.pathname === "/cards/autocomplete") { const q = (u.searchParams.get("q") || "").toLowerCase(); return json(route, { data: CARDS.filter(c => c.name.toLowerCase().includes(q)).map(c => c.name).slice(0, 20) }); }
      if (u.pathname === "/cards/search") {
        const q = u.searchParams.get("q") || "";
        if (/is:gamechanger/.test(q)) return json(route, { data: CARDS.filter(c => c.game_changer), has_more: false });
        const term = q.replace(/\s*is:commander.*$/, "").toLowerCase();
        const data = CARDS.filter(c => /Legendary Creature/.test(c.type_line) && c.name.toLowerCase().includes(term));
        return data.length ? json(route, { data }) : json(route, { object: "error" }, 404);
      }
      return json(route, { object: "error" }, 404);
    }
    if (u.hostname === "json.edhrec.com") {
      calls.edhrec++;
      const m = u.pathname.match(/^\/pages\/commanders\/([^/]+)(?:\/([^/]+))?\.json$/);
      if (!m) return json(route, {}, 404);
      return json(route, edhPage(m[2]));
    }
    if (u.hostname === "backend.commanderspellbook.com") {
      calls.spellbook++;
      const body = JSON.parse(req.postData()); const names = body.main.map(c => c.card);
      return json(route, { results: {
        included: [{ id: "c1", uses: [0, 1, 2].map(i => ({ card: { name: names[i] } })), produces: [{ feature: { name: "Maná infinito" } }], description: "Combo de prueba de tres cartas." }],
        almostIncluded: [{ id: "c2", uses: [{ card: { name: names[3] } }, { card: { name: CARDS.find(c => !names.includes(c.name) && !/Land|Legendary/.test(c.type_line) && c.color_identity.every(x => "GU".includes(x))).name } }], produces: [{ feature: { name: "Robo infinito" } }], description: "A una carta." }],
      } });
    }
    if (u.hostname === "edhtop16.com") {
      calls.edhtop16++;
      const body = JSON.parse(req.postData());
      if (/commanders\(/.test(body.query)) return json(route, { data: { commanders: { edges: [["Kinnan, Bonder Prodigy", 0.081, 620, 0.21, 130, "GU"], ["Thrasios, Triton Hero / Tymna the Weaver", 0.052, 400, 0.19, 76, "WUBG"], ["Hakbal of the Surging Soul", 0.004, 31, 0.1, 3, "GU"]].map(([name, metaShare, count, conversionRate, topCuts, colorId]) => ({ node: { name, colorId, stats: { count, metaShare, conversionRate, topCuts } } })) } } });
      return json(route, { data: { commander: { name: body.variables.name, staples: { edges: ["Rhystic Study", "Sol Ring", "Worldly Tutor", "Fierce Guardianship"].map(name => ({ node: { name } })) } } } });
    }
    calls.other.push(u.hostname); return route.fulfill({ status: 404, body: "" });
  });
}

export async function launch() {
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
  return pw.chromium.launch({ executablePath: exe });
}

/** Corre las pruebas una por una y sale con error si alguna falla. */
export async function runAll(tests) {
  const only = process.argv.slice(2).filter(a => !a.startsWith("--"));
  let failed = 0; const t00 = Date.now();
  for (const [name, fn] of tests) {
    if (only.length && !only.some(o => name.includes(o))) continue;
    const t0 = Date.now();
    try { const note = await fn(); console.log(`ok  ${name}${note ? ` (${note})` : ""} · ${Date.now() - t0} ms`); }
    catch (e) { failed++; console.log(`FALLA  ${name}\n   ${String(e && e.stack || e).split("\n").slice(0, 6).join("\n   ")}`); }
  }
  console.log(failed ? `\n${failed} prueba(s) con fallas.` : `\nPruebas de navegador: todas pasan (${((Date.now() - t00) / 1000).toFixed(1)} s).`);
  return failed;
}
export function check(cond, msg) { if (!cond) throw new Error(msg); }
