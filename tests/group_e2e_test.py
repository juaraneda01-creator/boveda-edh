# Mesa compartida de punta a punta: dos teléfonos, la función real del servidor.
import json, os, re, subprocess, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deckrun
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); F = os.path.join(HERE, "fixtures")
srv = subprocess.Popen(["node", os.path.join(HERE, "group_server.mjs"), "8788"], stdout=subprocess.PIPE); srv.stdout.readline()
html = open(os.path.join(HERE, "..", "index.html")).read()
ALL, FRONT = deckrun.load_cards("hakbal_cards.py", "voja_cards.py")
def route(r, req):
    u = req.url
    if u in ("https://boveda-edh.netlify.app/", "https://boveda-edh.netlify.app/index.html"): return r.fulfill(status=200, content_type="text/html", body=html)
    if u.startswith("https://boveda-edh.netlify.app/api/group"):
        q = urllib.request.Request("http://127.0.0.1:8788" + u[len("https://boveda-edh.netlify.app"):], data=(req.post_data or "").encode() if req.method=="POST" else None, method=req.method)
        try: resp = urllib.request.urlopen(q); return r.fulfill(status=resp.status, content_type="application/json", body=resp.read())
        except urllib.error.HTTPError as e: return r.fulfill(status=e.code, content_type="application/json", body=e.read())
    if u.startswith("https://boveda-edh.netlify.app/api/cards"):
        names = json.loads(req.post_data)["names"]; data = [deckrun.scry(ALL, n if n in ALL else FRONT[n]) for n in names if n in ALL or n in FRONT]
        return r.fulfill(status=200, content_type="application/json", body=json.dumps({"data":data, "not_found":[]}))
    return r.fulfill(status=404, body="")
def phone(b, deck_txt, cmd, name):
    pg = b.new_context(viewport={"width":390, "height":860}).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**/*", route); pg.goto("https://boveda-edh.netlify.app/"); pg.wait_for_timeout(600)
    pg.evaluate("""async ({t,cmd,name})=>{ S.data.settings.autoRefresh=false; S.data.settings.onboarded=true; const p=parseList(t,{keepSide:true}); const d={id:'d'+name,format:'commander',name,commanders:[cmd],cards:p.filter(c=>c.n!==cmd).map(c=>({n:c.n,q:c.q})),side:[],maybe:[],log:[],created:1,updated:1}; S.data.decks.push(d); await fetchCards(allNames(d),{quiet:true}); S.view='commander'; S.showMeta.commander='local'; S.sel.commander=null; bumpAnalysis(); render(); }""", {"t":open(os.path.join(F, deck_txt)).read(), "cmd":cmd, "name":name})
    pg.wait_for_timeout(300); return pg, errs
fails = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        A, ea = phone(b, "hakbal.txt", "Hakbal of the Surging Soul", "Tiritones")
        A.fill("#grp-me", "Juan"); A.fill("#grp-name", "Los del jueves"); A.click('[data-grp="create"]'); A.wait_for_timeout(800)
        code = A.evaluate("S.data.group && S.data.group.code")
        if not code: fails.append("no se creó el grupo")
        B, eb = phone(b, "voja.txt", "Voja, Jaws of the Conclave", "Voja")
        B.fill("#grp-me", "Pedro"); B.fill("#grp-code", code or ""); B.click('[data-grp="join"]'); B.wait_for_timeout(800)
        if "Los del jueves" not in B.inner_text(".grp"): fails.append("Pedro no ve el grupo")
        A.click('[data-grp="refresh"]'); A.wait_for_timeout(1200)
        rivals = A.evaluate("S.data.decks.filter(d=>d.rival&&d.rival.group).map(d=>d.name+'|'+d.rival.owner+'|'+d.cards.length)")
        if not rivals or not rivals[0].startswith("Voja|Pedro"): fails.append("Juan no recibió el mazo de Pedro: %s" % rivals)
        # anotar partida del grupo
        juan = A.evaluate("S.data.group.mid"); pedro = B.evaluate("S.data.group.mid")
        A.click(f'[data-grp-pl^="{juan}|{juan}:"]'); A.click(f'[data-grp-pl^="{pedro}|{pedro}:"]')
        A.click(f'[data-grp-seat="{juan}|1"]'); A.click(f'[data-grp-seat="{pedro}|2"]'); A.click(f'[data-grp-win="{pedro}"]'); A.click('[data-grp="save"]'); A.wait_for_timeout(800)
        B.click('[data-grp="refresh"]'); B.wait_for_timeout(1000)
        tabla = B.inner_text(".grp")
        if "Pedro" not in tabla or "1 · 100%" not in tabla: fails.append("la tabla de Pedro no muestra la victoria: " + tabla[-400:])
        rec = B.evaluate("gameStats(gamesOf(S.data.decks.find(d=>d.name==='Voja' && !d.rival)))")
        if rec["n"] != 1 or rec["w"] != 1: fails.append("el récord del mazo de Pedro no incluye la partida del grupo: %s" % rec)
        # la mesa de hoy ya puede usar el mazo de Pedro
        if "Voja" not in A.inner_text(".mesa"): fails.append("la mesa de hoy no ofrece el mazo del grupo")
        for e in ea + eb: fails.append("error: " + e)
        for pg in (A, B):
            if pg.evaluate("document.documentElement.scrollWidth") > 390: fails.append("desborde en teléfono")
        b.close()
finally:
    srv.terminate()
if fails: print("FALLA grupo:\n  " + "\n  ".join(fails)); sys.exit(1)
print("Grupo en teléfonos OK: crear, unirse, recibir mazos, anotar una vez y verlo los dos.")
