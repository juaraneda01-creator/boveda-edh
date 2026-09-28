# Calibración con torneos: estira solo el tramo sobre 8; los mazos casuales no cambian.
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deckrun
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); F = os.path.join(HERE, "fixtures")
html = open(os.path.join(HERE, "..", "index.html")).read()
ALL, FRONT = deckrun.load_cards("hakbal_cards.py", "voja_cards.py", "hapatra_cards.py")
lists = {}
for txt, cmd in [("voja.txt","Voja, Jaws of the Conclave"),("hapatra.txt","Hapatra, Vizier of Poisons"),("hakbal.txt","Hakbal of the Surging Soul")]:
    names = [re.sub(r"^\d+ ","",l) for l in open(os.path.join(F,txt)).read().splitlines() if re.match(r"^\d+ ",l)]
    lists[cmd] = [n for n in names if n != cmd]
data = {"at":1790000000000,"days":180,"min":24,"src":"TopDeck.gg","cmds":list(lists),"lists":90,
        "tours":[{"id":"t1","n":"Torneo","d":1790000000,"s":40,"tc":8,"e":[[i%3, i+1, 3,1,1] for i in range(36)],"seat":[10,4,2,2,1,1]}],"staples":[]}
def route(r, req):
    u = req.url
    if u in ("https://boveda-edh.netlify.app/", "https://boveda-edh.netlify.app/index.html"): return r.fulfill(status=200, content_type="text/html", body=html)
    if u.startswith("https://boveda-edh.netlify.app/api/cedh"):
        from urllib.parse import urlparse, parse_qs; q = parse_qs(urlparse(u).query)
        if q.get("q",["data"])[0] == "data": return r.fulfill(status=200, content_type="application/json", body=json.dumps(data))
        name = q["name"][0]; return r.fulfill(status=200, content_type="application/json", body=json.dumps({"name":name,"lists":12,"top":3,"cards":[[n,60.0,70.0] for n in lists[name]]}))
    if u.startswith("https://boveda-edh.netlify.app/api/cards"):
        names = json.loads(req.post_data)["names"]; out = [deckrun.scry(ALL, n if n in ALL else FRONT[n]) for n in names if n in ALL or n in FRONT]
        return r.fulfill(status=200, content_type="application/json", body=json.dumps({"data":out,"not_found":[]}))
    return r.fulfill(status=404, body="")
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width":390,"height":860}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**/*", route); pg.goto("https://boveda-edh.netlify.app/"); pg.wait_for_timeout(600)
    pg.evaluate("""async (lists)=>{ S.data.settings.autoRefresh=false; for (const [cmd, cards] of Object.entries(lists)){ const d={id:'m-'+slug(cmd),format:'commander',name:cmd,commanders:[cmd],cards:cards.map(n=>({n,q:1})),side:[],maybe:[],log:[],created:1,updated:1}; S.data.decks.push(d); await fetchCards(allNames(d),{quiet:true}); } S.view='commander'; S.showMeta.commander=true; S.sel.commander=null; render(); }""", lists)
    before = pg.evaluate("Object.fromEntries(S.data.decks.map(d=>[d.name, powerOf(d, analyze(d)).power]))")
    pg.click('[data-td="load"]'); pg.wait_for_timeout(500)
    pg.click('[data-td-cal="run"]'); pg.wait_for_function("S.data.settings.cedhCal && !S.td.cal", timeout=60000)
    cal = pg.evaluate("S.data.settings.cedhCal"); pg.evaluate("bumpAnalysis()")
    after = pg.evaluate("Object.fromEntries(S.data.decks.map(d=>[d.name, powerOf(d, analyze(d)).power]))")
    pg.click('[data-td-cal="off"]'); pg.wait_for_timeout(200)
    off = pg.evaluate("Object.fromEntries(S.data.decks.map(d=>[d.name, powerOf(d, analyze(d)).power]))")
    b.close()
fails = []
if not cal or len(cal["rows"]) != 3 or cal["k"] <= 1: fails.append("calibración: %s" % cal)
for n, v in before.items():
    if v <= 8 and after[n] != v: fails.append(f"{n} casual cambió {v} → {after[n]}")
    if v > 8 and not after[n] > v: fails.append(f"{n} alto no subió {v} → {after[n]}")
if off != before: fails.append("quitar la calibración no vuelve atrás")
if errs: fails.append(str(errs))
if fails: print("FALLA calibración:\n  " + "\n  ".join(fails)); sys.exit(1)
print("Calibración OK: %s → %s (×%s)" % (before, after, cal["k"]))
