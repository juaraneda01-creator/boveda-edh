# Mesa de hoy: tres mazos de distinto nivel; la app avisa quién está por encima y simula la mesa.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deckrun
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
def flow(pg):
    for i,(txt,cmd,owner) in enumerate([("voja.txt","Voja, Jaws of the Conclave","Pedro"),("hapatra.txt","Hapatra, Vizier of Poisons","Ana")]):
        pg.evaluate("""async ({t,cmd,id,name,owner})=>{ const p=parseList(t,{keepSide:true}); const d={id,format:'commander',name,rival:{owner},commanders:[cmd],cards:p.filter(c=>c.n!==cmd).map(c=>({n:c.n,q:c.q})),side:[],maybe:[],log:[],created:1,updated:1}; S.data.decks.push(d); await fetchCards(allNames(d),{quiet:true}); }""", {"t":open(os.path.join(F,txt)).read(),"cmd":cmd,"id":"r%d"%i,"name":txt.split('.')[0].capitalize(),"owner":owner})
    pg.evaluate("S.view='commander'; S.showMeta.commander='local'; S.sel.commander=null; bumpAnalysis(); render()"); pg.wait_for_timeout(300)
    for id in ["t","r0","r1"]: pg.click(f'[data-mesa-deck="{id}"]'); pg.wait_for_timeout(100)
    out = {"verdict": pg.inner_text('.mesa-v'), "tips": pg.inner_text('.mesa-tips') if pg.locator('.mesa-tips').count() else ""}
    pg.click('[data-mesa="sim"]'); pg.wait_for_function("S.mesa.sim && !S.mesa.busy", timeout=30000); pg.wait_for_timeout(200)
    out["sim"] = pg.inner_text('.mesa'); out["overflow"] = pg.evaluate("document.documentElement.scrollWidth")
    return out
R = deckrun.run("hakbal.txt", ["hakbal_cards.py","voja_cards.py","hapatra_cards.py"], ["Hakbal of the Surging Soul"], extra=flow)
X = R["extra"]; fails = []
if "dispareja" not in X["verdict"].lower(): fails.append("veredicto: " + X["verdict"])
if "Voja" not in X["tips"]: fails.append("no avisa que Voja está por encima: " + X["tips"])
if "Simulación:" not in X["sim"]: fails.append("sin simulación")
if X["overflow"] > 390: fails.append("desborde %s" % X["overflow"])
if R["errors"]: fails.append(str(R["errors"]))
if fails: print("FALLA mesa:\n  " + "\n  ".join(fails)); sys.exit(1)
print("Mesa OK: detecta la mesa dispareja, avisa quién está por encima y simula.")
