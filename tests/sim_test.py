# Partidas simuladas: tres mazos reales, 300 partidas; resultados razonables y rápidos.
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deckrun
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
def flow(pg):
    for i,(txt,cmd) in enumerate([("hapatra.txt","Hapatra, Vizier of Poisons"),("callampitas.txt","Slimefoot and Squee")]):
        pg.evaluate("""async ({t,cmd,id,name})=>{ const p=parseList(t,{keepSide:true}); const d={id,format:'commander',name,rival:{owner:'Amigo'},commanders:[cmd],cards:p.filter(c=>c.n!==cmd).map(c=>({n:c.n,q:c.q})),side:[],maybe:[],log:[],created:1,updated:1}; S.data.decks.push(d); await fetchCards(allNames(d),{quiet:true}); }""", {"t":open(os.path.join(F,txt)).read(),"cmd":cmd,"id":"r%d"%i,"name":txt.split('.')[0]})
    pg.evaluate("S.deckTab='partidas'; bumpAnalysis(); render()"); pg.wait_for_timeout(300)
    t0 = time.time(); pg.click('[data-sim-run="200"]'); pg.wait_for_function("!S.simBusy && S.data.decks.find(x=>x.id==='t').sim", timeout=60000)
    sim = pg.evaluate("S.data.decks.find(x=>x.id==='t').sim"); sim["secs"] = time.time()-t0
    sim["real"] = pg.evaluate("(S.data.games||[]).length")
    return sim
R = deckrun.run("hakbal.txt", ["hakbal_cards.py","hapatra_cards.py","slimefoot_cards.py"], ["Hakbal of the Surging Soul"], extra=flow)
S = R["extra"]; fails = []
def check(name, ok, got):
    if not ok: fails.append(f"{name}: {got}")
check("rápido (< 10 s)", S["secs"] < 10, round(S["secs"],1))
check("3 mazos", len(S["decks"]) == 3, len(S["decks"]))
tot = sum(d["w"] for d in S["decks"]) + S["draws"]
check("todas las partidas cuentan", tot == S["n"], (tot, S["n"]))
for d in S["decks"]:
    check(f"{d['name']} gana entre 10% y 65%", 0.10 <= d["pct"] <= 0.65, round(d["pct"],2))
    check(f"{d['name']} gana entre los turnos 5 y 14", d["avgTurn"] and 5 <= d["avgTurn"] <= 14, d["avgTurn"])
check("no se mezcla con partidas reales", S["real"] == 0, S["real"])
check("sin errores", not R["errors"], R["errors"])
if fails: print("FALLA simulación:\n  " + "\n  ".join(map(str, fails))); sys.exit(1)
print("Simulación OK: 200 partidas de tres mazos, resultados razonables y separados de las partidas reales.")
