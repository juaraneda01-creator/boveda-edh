# Ficha del mazo: con mazos reales, los números deben quedar cerca de Commandersalt.
# Referencias de Commandersalt anotadas en cada caso (nivel, brackets, notas de la boleta).
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deckrun
fails = []
def check(deck, name, ok, got):
    if not ok: fails.append(f"{deck} · {name}: {got}")

# Tiritones (Hakbal) — Commandersalt: 6.6 · bracket 3/3 · Midrange/Kindred · sal C, interacción B+, remates B-, sinergia A+
R = deckrun.run("hakbal.txt", ["hakbal_cards.py"], ["Hakbal of the Surging Soul"])
D = "Tiritones"
check(D, "nivel 6–7.3", 6 <= R['p'] <= 7.3, R['p'])
check(D, "bracket 3/3", R['br'] == [3, 3], R['br'])
check(D, "perfil Midrange / Tribal", (R['plan'], R['strat']) == ("Midrange", "Tribal"), (R['plan'], R['strat']))
check(D, "34 tierras, 14 básicas", (R['lands'], R['basics']) == (34, 14), (R['lands'], R['basics']))
check(D, "curva 2.2–2.5", 2.2 <= R['avg'] <= 2.5, R['avg'])
check(D, "timing ≥ 90%", (R['timing'] or 0) >= 90, R['timing'])
check(D, "gana por combate", R['paths'] == ["combat"], R['paths'])
check(D, "tribal merfolk", R['tribe'] == "merfolk", R['tribe'])
check(D, "boleta", [g.split(":")[1][0] for g in R['grades']] == ["C", "B", "B", "A"], R['grades'])

# Hapatra Landfall — Commandersalt: 6.95 · bracket 2/3 · Combo/Midrange · sal B-, interacción B-, remates A+, sinergia B+
R2 = deckrun.run("hapatra.txt", ["hapatra_cards.py"], ["Hapatra, Vizier of Poisons"])
D = "Hapatra"
check(D, "nivel 6.3–7.5", 6.3 <= R2['p'] <= 7.5, R2['p'])
check(D, "bracket 2/3", R2['br'] == [2, 3], R2['br'])
check(D, "perfil Combo", R2['plan'] == "Combo", R2['plan'])
check(D, "8 tutores", R2['tutors'] == 8, R2['tutors'])
check(D, "11 de robo", R2['draw'] == 11, R2['draw'])
check(D, "remates con bucle de sacrificio", "combo" in R2['paths'], R2['paths'])
check(D, "remates A", R2['grades'][2].split(":")[1][0] == "A", R2['grades'])
check(D, "sinergia B", R2['grades'][3].split(":")[1][0] == "B", R2['grades'])
check(D, "tema -1/-1", R2['strat'] == "Contadores -1/-1", R2['strat'])

for X in (R, R2):
    check("ambos", "sin cartas pendientes", X['missing'] == 0 and X['stale'] == 0, (X['missing'], X['stale']))
    check("ambos", "sin desborde en teléfono", X['overflow'] <= 390, X['overflow'])
    check("ambos", "sin errores", not X['errors'], X['errors'])
if fails: print("FALLA ficha:\n  " + "\n  ".join(map(str, fails))); sys.exit(1)
print("Ficha OK: Tiritones y Hapatra dan números cercanos a Commandersalt.")
