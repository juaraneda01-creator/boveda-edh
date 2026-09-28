# Versión en vivo: las cartas llegan por /api/cards; si esa función falla, se usa Scryfall directo.
import json, os
from playwright.sync_api import sync_playwright
html = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "index.html")).read()
card = lambda n: {"object":"card","id":"i","name":n,"cmc":2,"color_identity":["G"],"colors":["G"],"type_line":"Creature — Elf","oracle_text":"{T}: Add {G}.","mana_cost":"{1}{G}","produced_mana":["G"],"prices":{"usd":"1"},"legalities":{"commander":"legal"}}
def run(api_ok):
    hits = {"api":0, "sf":0}
    def route(r, req):
        u = req.url
        if u in ("https://boveda-edh.netlify.app/", "https://boveda-edh.netlify.app/index.html"): return r.fulfill(status=200, content_type="text/html", body=html)
        if u.startswith("https://boveda-edh.netlify.app/api/cards"):
            hits["api"] += 1
            if not api_ok: return r.fulfill(status=500, body="{}")
            names = json.loads(req.post_data)["names"]; return r.fulfill(status=200, content_type="application/json", body=json.dumps({"data":[card(n) for n in names], "not_found":[]}))
        if u.startswith("https://boveda-edh.netlify.app/api/salt"):
            hits["salt"] = hits.get("salt",0)+1; return r.fulfill(status=200, content_type="application/json", body=json.dumps({"at":1790000000000, "done":True, "n":2, "map":{"llanowar-elves":1.2, "teferis-protection":2.13}}))
        if "api.scryfall.com/cards/collection" in u:
            hits["sf"] += 1; ids = json.loads(req.post_data)["identifiers"]; return r.fulfill(status=200, content_type="application/json", body=json.dumps({"data":[card(i["name"]) for i in ids], "not_found":[]}))
        return r.fulfill(status=404, body="")
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.route("**/*", route); pg.goto("https://boveda-edh.netlify.app/"); pg.wait_for_timeout(700)
        n = pg.evaluate("async ()=>{ S.data.settings.autoRefresh=false; return await fetchCards(['Llanowar Elves','Elvish Mystic','Fyndhorn Elves'],{quiet:true}); }")
        pg.wait_for_timeout(2200)
        hits["saltvals"] = pg.evaluate("[saltOf('Llanowar Elves', cardOf('Llanowar Elves')), saltOf(\"Teferi's Protection\"), saltOf('Elvish Mystic', cardOf('Elvish Mystic')) <= 0.75]")
        b.close()
    return n, hits, errs
n, h, e = run(True)
assert n == 3 and h["api"] >= 1 and h["sf"] == 0 and not e, (n, h, e)
assert h.get("salt") == 1 and h["saltvals"] == [1.2, 2.13, True], h
n2, h2, e2 = run(False)
assert n2 == 3 and h2["sf"] >= 1 and not e2, (n2, h2, e2)
print("Cartas en vivo OK: usa la base propia (y Scryfall si falla) y la sal completa de EDHREC.")
