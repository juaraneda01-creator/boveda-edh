# Versión en vivo: el meta de Pauper y Pioneer llega de /api/meta y reemplaza la foto guardada si es más nuevo.
import json, os, sys, time
from playwright.sync_api import sync_playwright
html = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "index.html")).read()
NOW = int(time.time() * 1000); DAY = 864e5
LIST = "4 Lightning Bolt\n4 Counterspell\n4 Brainstorm\n4 Delver of Secrets\n4 Ponder\n20 Island\n20 Mountain\nSideboard\n3 Pyroblast\n2 Hydroblast"
state = {"mode": "building", "payload": None, "hits": 0}
def route(r, req):
    u = req.url
    if u in ("https://boveda-edh.netlify.app/", "https://boveda-edh.netlify.app/index.html"): return r.fulfill(status=200, content_type="text/html", body=html)
    if u.startswith("https://boveda-edh.netlify.app/api/meta"):
        state["hits"] += 1
        if state["mode"] == "ok": return r.fulfill(status=200, content_type="application/json", body=json.dumps(state["payload"]))
        if state["mode"] == "down": return r.abort()
        if state["mode"] == "error": return r.fulfill(status=502, content_type="application/json", body='{"error":"x"}')
        return r.fulfill(status=503, content_type="application/json", body='{"code":"building"}')
    return r.fulfill(status=404, body="")
fails = []
def chk(ok, msg):
    if not ok: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width":390, "height":900}, service_workers="block"); pg = ctx.new_page(); errs = []   # sin service worker: la prueba recarga la página y no debe recibir la versión publicada
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("**/*", route)
    # 1) el servidor aún no tiene datos: la app sigue con la foto guardada
    pg.goto("https://boveda-edh.netlify.app/"); pg.wait_for_function("typeof META_LIVE!=='undefined' && typeof S!=='undefined'"); pg.wait_for_timeout(2000)
    B = pg.evaluate("({live:LIVE, at:META_AT, when:metaWhen('pauper'), pau:META.pauper.archetypes.map(a=>a.name), pio:META.pioneer.archetypes.map(a=>a.name), arch:PAUPER_MU.arch, pwAlias:PAUPER_MU.pwAlias, liveP:META_LIVE.pauper})")
    chk(B["live"] and state["hits"] >= 1, "la versión en vivo no pidió /api/meta")
    chk(B["liveP"] is None and B["when"] == "foto del " + B["at"], "sin datos del servidor debe mostrar la foto: %s" % B["when"])
    # 2) llega un meta más nuevo: 8 arquetipos conocidos y uno nuevo; la primera lista es de hace 45 días
    def arch(n, share, i, cat="aggro", age=3): return {"name":n, "share":share, "cat":cat, "arch":"https://mtgtop8.com/archetype?a=%d" % i, "recent":10 - i, "deck":"https://mtgtop8.com/event?e=1&d=%d" % i, "date":NOW - age*DAY, "sample":"Lista %d · Liga (1) · 01/01/26" % i, "list":LIST}
    pau = [arch(n, 20 - 2*i, i, age=45 if i == 0 else 3) for i, n in enumerate(B["pau"][:8])] + [arch("Mazo Recien Llegado", 3, 8, "combo"), arch("Bajo El Corte", 1, 9)]
    # entradas dañinas: dirección con comillas y nombre con etiquetas; deben quedar fuera o inofensivas
    evil = arch("Mazo Malo", 19, 30); evil["arch"] = 'https://mtgtop8.com/archetype?a=1" onmouseover="window.__pwn=1'; pau.append(evil)
    evil2 = arch('<img src=x onerror="window.__pwn=2">', 2.5, 31); evil2["deck"] = 'javascript:window.__pwn=3'; evil2["share"] = "2.5"; pau.append(evil2)
    pio = [arch(n, 20 - 2*i, 20 + i) for i, n in enumerate(B["pio"])]
    rows = [{"name":B["pwAlias"].get(n, n), "pct":12 - i, "decks":120 - 10*i} for i, n in enumerate(B["arch"][:9])] + [{"name":"Otro Mazo", "pct":9.5, "decks":95}]
    state["payload"] = {"v":1, "at":NOW, "errors":[], "pauper":{"at":NOW, "total":777, "archetypes":pau}, "pioneer":{"at":NOW, "total":555, "archetypes":pio}, "pw":{"at":NOW, "rows":rows, "period":"Sep 24 - Oct 7, 2026", "total":1234, "events":40}}
    state["mode"] = "ok"
    pg.goto("https://boveda-edh.netlify.app/")
    try: pg.wait_for_function("typeof META_LIVE!=='undefined' && META_LIVE && META_LIVE.pauper", timeout=15000)
    except Exception as e:
        info = pg.evaluate("({ml: typeof META_LIVE, live: typeof LIVE!=='undefined' ? LIVE : 'sin LIVE', s: typeof S, boot: typeof S!=='undefined' && !!S.boot, apply: typeof applyLiveMeta, url: location.href})")
        try: info["probe"] = pg.evaluate("(async()=>{ try { const r=await fetch('/api/meta'); const d=await r.json(); const c=cleanLiveMeta(d); return {ok:r.ok, n:c.pauper&&c.pauper.archetypes.length, at:c.pauper&&c.pauper.at, baked:esDate(META_AT), applied:applyLiveMeta(d)}; } catch(e){ return String(e); } })()")
        except Exception as e2: info["probe"] = str(e2)[:200]
        print("FALLA meta en vivo: no llegó el meta. Estado: %s · errores: %s · consultas: %s" % (json.dumps(info), errs[:3], state["hits"])); sys.exit(1)
    pg.evaluate("S.data.settings.onboarded=true; S.view='pauper'; S.showMeta.pauper=true; render()"); pg.wait_for_timeout(300)
    L = pg.evaluate("""({names:META.pauper.archetypes.map(a=>a.name), src:META.pauper.src, when:metaWhen('pauper'), vs:META_VS.pauper['Mazo Recien Llegado'], decks:metaDecks('pauper').map(a=>a.main.reduce((s,c)=>s+c.q,0)),
      text:document.querySelector('#deck-pane').innerText, pw:PAUPER_MU.pw, pwAt:PAUPER_MU.pwAt, other:PAUPER_MU.pwOther, age:listAgeDays(META.pauper.archetypes[0]), pio:META.pioneer.archetypes.length, overflow:document.documentElement.scrollWidth})""")
    chk(len(L["names"]) == 9 and L["names"][:8] == B["pau"][:8] and L["names"][8] == "Mazo Recien Llegado", "arquetipos en vivo: %s" % L["names"])
    chk("777 mazos" in L["src"] and L["when"].startswith("al día ("), "encabezado: %s · %s" % (L["src"], L["when"]))
    chk(L["vs"] and L["vs"]["plan"] == "combo" and L["vs"].get("auto"), "plan de sideboard del arquetipo nuevo: %s" % L["vs"])
    chk(all(n == 60 for n in L["decks"]), "las listas en vivo no se leyeron: %s" % L["decks"])
    chk(L["age"] == 45 and "lista de hace 45 días" in L["text"] and "hace 3 días" in L["text"], "antigüedad de las listas")
    chk("nuevo" in L["text"] and "sin matchups" in L["text"] and "al día" in L["text"], "etiquetas del meta en pantalla")
    chk("se renuevan solos cada día" in L["text"], "la nota al pie no explica la actualización diaria")
    chk(len(L["pw"]) == 8 and "Sep 24 - Oct 7, 2026" in L["pwAt"] and "1.234" in L["pwAt"] and "Otro Mazo" in L["other"], "Pauper World en vivo: %s %s %s" % (L["pw"], L["pwAt"], L["other"]))
    chk(L["pio"] == 8, "Pioneer en vivo: %s" % L["pio"])
    chk(L["overflow"] <= 390, "desborde en el meta de Pauper: %s" % L["overflow"])
    H = pg.evaluate("({pwn:window.__pwn||0, evil:META.pauper.archetypes.some(a=>a.name==='Mazo Malo'), handlers:document.querySelectorAll('#deck-pane [onmouseover], #deck-pane [onerror], #deck-pane img[src=x]').length, js:[...document.querySelectorAll('#deck-pane a')].filter(a=>/^javascript:/i.test(a.getAttribute('href')||'')).length})")
    chk(H == {"pwn":0, "evil":False, "handlers":0, "js":0}, "el meta del servidor pudo inyectar HTML: %s" % H)
    pg.evaluate("S.view='pioneer'; S.showMeta.pioneer=true; render()"); pg.wait_for_timeout(200)
    chk(pg.evaluate("document.documentElement.scrollWidth") <= 390 and "al día" in pg.inner_text("#deck-pane"), "meta de Pioneer en pantalla")
    # 3) reglas de reemplazo y de desempate
    U = pg.evaluate("""()=>{ const r={}; const n0=META.pauper.archetypes.length;
      r.stale = applyLiveMeta({pauper:{at:esDate(META_AT)-864e5, archetypes:[{name:'X', share:50, list:'60 Island'}]}});
      r.few = applyLiveMeta({pauper:{at:Date.now(), archetypes:[{name:'Y', share:50, list:'60 Island'}]}});
      r.junk = [applyLiveMeta(null), applyLiveMeta({pauper:{at:Date.now()}}), applyLiveMeta('x')];
      r.same = META.pauper.archetypes.length===n0 && !META.pauper.archetypes.some(a=>a.name==='X'||a.name==='Y');
      r.tieRecent = rankLive('pioneer', [{name:'A', share:4, recent:1}, {name:'B', share:4, recent:5}, {name:'C', share:9, recent:0}], null).map(a=>a.name);
      r.tiePw = rankLive('pauper', [{name:'A', share:4, recent:9}, {name:'B', share:4, recent:1}], {rows:[{name:'A', pct:1, decks:10}, {name:'B', pct:4, decks:50}]}).map(a=>a.name);
      r.date = [esDate('1 de octubre de 2026')===Date.UTC(2026,9,1,12), esDate('nada')]; return r; }""")
    chk(U["stale"] is False and U["few"] is False and U["junk"] == [False, False, False] and U["same"], "un meta viejo, incompleto o roto no debe reemplazar la foto: %s" % U)
    chk(U["tieRecent"] == ["C", "B", "A"] and U["tiePw"] == ["B", "A"], "desempates: %s %s" % (U["tieRecent"], U["tiePw"]))
    chk(U["date"] == [True, 0], "fecha en español: %s" % U["date"])
    # 4) sin conexión con el servidor: usa el último meta en vivo que quedó guardado
    state["mode"] = "down"
    pg.goto("https://boveda-edh.netlify.app/"); pg.wait_for_function("typeof META_LIVE!=='undefined' && typeof S!=='undefined'"); pg.wait_for_timeout(2500)
    D = pg.evaluate("({live:META_LIVE.pauper, names:META.pauper.archetypes.map(a=>a.name)})")
    chk(D["live"] == NOW and "Mazo Recien Llegado" in D["names"], "sin servidor no usó el meta guardado: %s" % D)
    # 5) el servidor responde con error: también usa el meta guardado
    state["mode"] = "error"
    pg.goto("https://boveda-edh.netlify.app/"); pg.wait_for_function("typeof META_LIVE!=='undefined' && typeof S!=='undefined'"); pg.wait_for_timeout(2500)
    E = pg.evaluate("({live:META_LIVE.pauper, when:metaWhen('pauper')})")
    chk(E["live"] == NOW and E["when"].startswith("al día"), "con error del servidor no usó el meta guardado: %s" % E)
    b.close()
if errs: fails.append("errores de JavaScript: %s" % errs[:3])
if fails: print("FALLA meta en vivo:\n  " + "\n  ".join(fails)); sys.exit(1)
print("Meta en vivo OK: reemplaza la foto si es más nuevo, marca listas viejas y arquetipos nuevos, desempata y funciona sin servidor.")
