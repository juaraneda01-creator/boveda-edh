# Registro de partidas y referencia de Commandersalt, en el teléfono.
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deckrun
fails = []
def check(name, ok, got):
    if not ok: fails.append(f"{name}: {got}")
def flow(pg):
    pg.evaluate("""()=>{ S.data.decks.push({id:'f1',format:'commander',name:'Mazo de Pedro',rival:{owner:'Pedro'},commanders:['Kinnan, Bonder Prodigy'],cards:[],side:[],maybe:[],log:[],created:1,updated:1}); S.deckTab='partidas'; render(); }""")
    pg.wait_for_timeout(200)
    def game(res, turn_delta, how, seat, opp=True):
        pg.click(f'[data-gm-res="{res}"]')
        for _ in range(abs(turn_delta)): pg.click(f'[data-gm-turn="{1 if turn_delta>0 else -1}"]')
        if how: pg.click(f'[data-gm-how="{how}"]')
        pg.click(f'[data-gm-seat="{seat}"]')
        if opp and not pg.locator('[data-gm-opp="Kinnan, Bonder Prodigy"][aria-pressed="true"]').count(): pg.click('[data-gm-opp="Kinnan, Bonder Prodigy"]')
        pg.click('[data-gm-save]'); pg.wait_for_timeout(150)
    game("win", 1, "combat", 1); game("loss", -2, None, 3); game("win", 0, "combat", 1)
    out = {"n": pg.evaluate("S.data.games.length"), "stats": pg.inner_text('.gm .stats'), "seat": pg.inner_text('.gm-seats') if pg.locator('.gm-seats').count() else ""}
    pass
    # referencia de Commandersalt
    pg.evaluate("S.deckTab='nivel'; render()"); pg.wait_for_timeout(300)
    pg.fill('#rp-cs', '6,6'); pg.click('[data-rp="cs"]'); pg.wait_for_timeout(200)
    out["cs"] = pg.evaluate("S.data.decks.find(x=>x.id==='t').csRef.p")
    pg.evaluate("S.showMeta.commander='local'; render()"); pg.wait_for_timeout(300)
    out["board"] = pg.inner_text('table') if pg.locator('table').count() else ""
    # unión de dos dispositivos: las partidas de ambos se conservan
    out["merge"] = pg.evaluate("""()=>{ const base={decks:[],binders:[],collection:{items:[]},wishlist:[],games:[]}; const loc={...base, games:[{id:'a',deck:'t',res:'win'}]}; const rem={...base, games:[{id:'b',deck:'t',res:'loss'}]};
      return syMerge(base, loc, rem).d.games.map(g=>g.id).sort(); }""")
    return out
R = deckrun.run("hakbal.txt", ["hakbal_cards.py"], ["Hakbal of the Surging Soul"], extra=flow)
X = R["extra"]
check("3 partidas", X["n"] == 3, X["n"])
check("récord 2-1 y 67%", "2-1" in X["stats"] and "67" in X["stats"], X["stats"])
check("asiento 1: 100%", "100%" in X["seat"], X["seat"])
check("referencia Commandersalt", X["cs"] == 6.6, X["cs"])
check("tabla con Commandersalt y récord", "6.6" in X["board"] and "2-1" in X["board"], X["board"][:300])
check("unión conserva partidas", X["merge"] == ["a", "b"], X["merge"])
check("sin desborde", R["overflow"] <= 390, R["overflow"])
check("sin errores", not R["errors"], R["errors"])
if fails: print("FALLA partidas:\n  " + "\n  ".join(map(str, fails))); sys.exit(1)
print("Partidas OK: se anotan, suman estadísticas, se ven en la tabla y no se pierden al unir dispositivos.")
