# Mejoras de la tercera ronda: partida en vivo, juez, constructor con estrategia, bracket por dos ejes,
# densidad competitiva y ajuste a Commandersalt.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deckrun
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
def flow(pg):
    out = {}
    for i,(txt,cmd,owner) in enumerate([("voja.txt","Voja, Jaws of the Conclave",None),("hapatra.txt","Hapatra, Vizier of Poisons","Ana")]):
        pg.evaluate("""async ({t,cmd,id,name,owner})=>{ const p=parseList(t,{keepSide:true}); const d={id,format:'commander',name,commanders:[cmd],cards:p.filter(c=>c.n!==cmd).map(c=>({n:c.n,q:c.q})),side:[],maybe:[],log:[],created:1,updated:1}; if (owner) d.rival={owner}; S.data.decks.push(d); await fetchCards(allNames(d),{quiet:true}); }""", {"t":open(os.path.join(F,txt)).read(),"cmd":cmd,"id":"r%d"%i,"name":txt.split('.')[0].capitalize(),"owner":owner})
    pg.evaluate("bumpAnalysis()")
    # bracket por dos ejes y densidad en la ficha
    pg.evaluate("S.view='commander'; S.sel.commander='r0'; S.showMeta.commander=false; S.deckTab='nivel'; render()"); pg.wait_for_timeout(400)
    out["axes"] = pg.evaluate("(()=>{ const d=S.data.decks.find(x=>x.id==='r0'); const P=powerOf(d, analyze(d)); return {b:P.axes&&P.axes.b, speed:P.axes&&P.axes.speed, warp:P.axes&&P.axes.warp, dens:P.density&&P.density.pct}; })()")
    out["axesUI"] = pg.locator('.rp-axes').count()
    # ajuste a Commandersalt con 3 referencias
    pg.evaluate("""(()=>{ const ref={t:6.6, r0:8.2, r1:6.9}; for (const d of S.data.decks) if (ref[d.id]) d.csRef={p:ref[d.id], at:1}; bumpAnalysis(); })()""")
    fit = pg.evaluate("(()=>{ const F=csFitCompute(); S.data.settings.csFit=F; bumpAnalysis(); return F; })()")
    out["fit"] = fit
    out["fitPower"] = pg.evaluate("S.data.decks.filter(d=>d.csRef).map(d=>[powerOf(d,analyze(d)).power, d.csRef.p])")
    pg.evaluate("delete S.data.settings.csFit; bumpAnalysis()")
    # partida en vivo desde Mesa de hoy
    pg.evaluate("S.view='commander'; S.showMeta.commander='local'; S.sel.commander=null; S.mesa={ids:[],sim:null,busy:false}; render()"); pg.wait_for_timeout(300)
    for id in ["t","r0","r1"]: pg.click(f'[data-mesa-deck="{id}"]'); pg.wait_for_timeout(80)
    pg.click('[data-mt="play"]'); pg.wait_for_timeout(200)
    out["mt"] = pg.locator('.mt-p').count()
    # Voja (asiento 2) pega 21 de comandante a Hapatra; Hakbal (asiento 1) se queda sin vida
    for _ in range(21): pg.click('[data-mt="cd"][data-i="2"][data-from="1"]')
    pg.evaluate("S.match.players[0].life = 1; matchSave(); render()")
    pg.click('[data-mt="life"][data-i="0"][data-v="-1"]'); pg.wait_for_timeout(100)
    out["done"] = pg.evaluate("S.match.done")
    out["overflowMt"] = pg.evaluate("document.documentElement.scrollWidth")
    n0 = pg.evaluate("(S.data.games||[]).length")
    pg.click('[data-mt="save"]'); pg.wait_for_timeout(200)
    out["saved"] = pg.evaluate(f"(S.data.games||[]).slice({n0}).map(g=>[g.deck,g.res,g.how])")
    # el juez: sin clave, ofrece abrir en Claude
    pg.evaluate("S.view='judge'; render()"); pg.wait_for_timeout(200)
    out["judge"] = {"chat": pg.locator('[data-jz="chat"]').count(), "cards": pg.evaluate("judgeCards('Si uso [[Swords to Plowshares]] sobre \"Voja, Jaws of the Conclave\"', 'Sol Ring')")}
    out["prompt"] = pg.evaluate("judgePrompt('¿Vuelve a la zona de mando?', [{n:'Swords to Plowshares', oracle:'Exile target creature.', rulings:[{d:'2020-01-01', t:'x'}]}])")
    # constructor: controles nuevos
    pg.evaluate("S.view='commander'; S.editing={format:'commander', name:'', commanders:[], text:''}; S.showMeta.commander=false; render()"); pg.wait_for_timeout(200)
    out["bld"] = [pg.locator(s).count() for s in ['#bld-theme','[data-t="bld-inter"]','[data-t="bld-br"]','#bld-excl']]
    return out
R = deckrun.run("hakbal.txt", ["hakbal_cards.py","voja_cards.py","hapatra_cards.py"], ["Hakbal of the Surging Soul"], extra=flow)
X = R["extra"]; fails = []
a = X["axes"]
if not a or not (1 <= (a["b"] or 0) <= 5) or a["b"] != max(a["speed"], a["warp"]): fails.append("ejes: %s" % a)
if a and a["dens"] is None: fails.append("sin densidad")
if not X["axesUI"]: fails.append("la ficha no muestra el bracket por ejes")
f = X["fit"]
if "err" in f or not (0.5 <= f["a"] <= 2) or f["err1"] > f["err0"] + 1e-9: fails.append("ajuste: %s" % f)
if X["mt"] != 3: fails.append("partida en vivo: %s jugadores" % X["mt"])
d = X["done"]
if not d or d["winner"] != 1 or d["how"] not in ("combat","cmdr"): fails.append("fin de partida: %s" % d)
if X["overflowMt"] > 390: fails.append("desborde partida en vivo %s" % X["overflowMt"])
s = X["saved"]
if sorted(x[0] for x in s) != ["r0","t"] or dict((x[0],x[1]) for x in s) != {"t":"loss","r0":"win"}: fails.append("partidas anotadas: %s" % s)
if not X["judge"]["chat"] or set(X["judge"]["cards"]) != {"Sol Ring","Swords to Plowshares","Voja, Jaws of the Conclave"}: fails.append("juez: %s" % X["judge"])
if "Reglas citadas" not in X["prompt"] or "2020-01-01" not in X["prompt"]: fails.append("consulta del juez incompleta")
if 0 in X["bld"]: fails.append("constructor sin controles nuevos: %s" % X["bld"])
if R["errors"]: fails.append(str(R["errors"]))
if fails: print("FALLA extras:\n  " + "\n  ".join(fails)); sys.exit(1)
print("Extras OK: bracket por velocidad y deformación, densidad, ajuste a Commandersalt (error %.2f → %.2f), partida en vivo anotada, juez y constructor." % (f["err0"], f["err1"]))
