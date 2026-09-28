"""Prueba de humo: abre la página armada en un navegador, recorre todas las
secciones y pestañas en computador y teléfono, y falla si hay errores de
JavaScript, textos rotos o contenido que se sale de la pantalla.
Uso:  python3 build.py && python3 tests/smoke.py"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
PAGE = (ROOT / "index.html").as_uri()
SEED = {
  "decks": [
    {"id": "c1", "format": "commander", "name": "Prueba Commander", "commanders": ["Omnath, Locus of Mana"],
     "cards": [{"n": "Sol Ring", "q": 1}, {"n": "Cultivate", "q": 1}, {"n": "Forest", "q": 35}], "side": [], "maybe": [{"n": "Craterhoof Behemoth", "q": 1}], "log": [], "updated": 2},
    {"id": "p1", "format": "pauper", "name": "Prueba Pauper", "commanders": [],
     "cards": [{"n": "Lightning Bolt", "q": 4}, {"n": "Guttersnipe", "q": 4}, {"n": "Mountain", "q": 18}], "side": [{"n": "Hydroblast", "q": 2}], "maybe": [], "log": [], "updated": 2},
    {"id": "q1", "format": "pioneer", "name": "Prueba Pioneer", "commanders": [],
     "cards": [{"n": "Monastery Swiftspear", "q": 4}, {"n": "Mountain", "q": 20}], "side": [], "maybe": [], "log": [], "updated": 2}],
  "collection": {"items": [{"n": "Sol Ring", "q": 2, "set": "CMM"}, {"n": "Lightning Bolt", "q": 4}]},
  "wishlist": [{"n": "Rhystic Study", "target": 30, "added": 1}],
  "binders": [{"id": "b1", "name": "Venta", "items": [{"n": "Sol Ring", "q": 1, "set": "CMM", "num": "1"}], "sales": [],
               "pricing": {"src": "ck", "pct": 100, "min": 0, "clp": True, "round": 100, "syncColl": True, "v2": True}, "created": 1, "updated": 1}],
  "settings": {"cur": "usd", "autoRefresh": False, "autoFetch": False, "onboarded": False}}
BAD = ["undefined", "NaN", "[object Object]"]
problems = []

def run(width):
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": width, "height": 900})
        pg.on("pageerror", lambda e: problems.append(f"[{width}] error de JavaScript: {e}"))
        pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('boveda-edh:data'," + json.dumps(json.dumps(SEED)) + ");sessionStorage.setItem('s','1')}")
        pg.route("**/*", lambda r, req: r.continue_() if req.url.startswith("file:") else r.abort())
        pg.goto(PAGE); pg.wait_for_timeout(800)

        def check(where):
            sw = pg.evaluate("document.documentElement.scrollWidth")
            if sw > width + 1: problems.append(f"[{width}] se sale de la pantalla ({sw}px) en {where}")
            t = pg.inner_text("#main")
            for bad in BAD:
                if bad in t: problems.append(f"[{width}] texto '{bad}' en {where}")

        views = pg.evaluate("[...document.querySelectorAll('#tabs [data-view]')].map(b=>b.dataset.view)")
        assert "home" in views, "falta la sección Inicio"
        for v in views:
            pg.evaluate(f"S.view='{v}'; S.editing=null; render()"); pg.wait_for_timeout(150); check(v)
            if v in ("commander", "pauper", "pioneer"):
                subs = pg.evaluate("[...new Set([...document.querySelectorAll('.subtabs [data-sub], .subchips [data-sub]')].map(b=>b.dataset.sub))]")
                tabs = set(subs)
                for group in list(subs):
                    pg.evaluate(f"S.deckTab='{group}'; render()"); pg.wait_for_timeout(80)
                    tabs |= set(pg.evaluate("[...document.querySelectorAll('.subchips [data-sub]')].map(b=>b.dataset.sub)"))
                for t in sorted(tabs):
                    pg.evaluate(f"S.deckTab='{t}'; render()"); pg.wait_for_timeout(80); check(f"{v}/{t}")
                pg.evaluate(f"S.showMeta['{v}']=true; render()"); pg.wait_for_timeout(150); check(f"{v}/meta")
                pg.evaluate(f"S.showMeta['{v}']=false; render()")
        for t in pg.evaluate("TOOLS.map(t=>t.k)"):
            pg.evaluate(f"S.view='tools'; render(); openTool('{t}')"); pg.wait_for_timeout(120); check(f"herramienta {t}")
        pg.evaluate("S.view='commander'; S.editing={format:'commander',name:'',commanders:[],text:''}; render()")
        pg.fill("#f-list", "Commander\n1 Omnath, Locus of Mana\n\nDeck\n1 Sol Ring\n\nSideboard\n1 Pyroblast"); pg.wait_for_timeout(400); check("editor")
        split = pg.evaluate("editorSplit('commander')")
        if not split["side"] or split["commanders"] != ["Omnath, Locus of Mana"]: problems.append(f"[{width}] el editor no separó comandante y sideboard: {split}")
        b.close()

for w in (1280, 390):
    run(w)
if problems:
    print("\n".join(dict.fromkeys(problems))); sys.exit(1)
print("Prueba de humo OK: todas las vistas cargan sin errores en computador y teléfono.")
