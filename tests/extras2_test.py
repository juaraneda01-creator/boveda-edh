# Segunda tanda: chequeo rápido de mesa, turno de victoria con partidas reales, biblioteca por bracket,
# almacenamiento, imágenes del mazo y precios para claude.ai.
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deckrun
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
def sectioned(txt, cmd):
    lines = [l for l in open(os.path.join(F, txt)).read().splitlines() if l.strip()]
    rest = [l for l in lines if cmd not in l]
    return "Commander\n1 %s\n\nDeck\n%s\n" % (cmd, "\n".join(rest))
def flow(pg):
    out = {}
    # ---- chequeo rápido: dos listas pegadas con secciones Commander y Deck, sin guardar los mazos
    pg.evaluate("openTool('chequeo')"); pg.wait_for_timeout(300)
    out["qc_view"] = pg.evaluate("[S.view, S.showMeta.commander, !!document.querySelector('#qc-0')]")
    pg.fill("#qc-0", sectioned("voja.txt", "Voja, Jaws of the Conclave")); pg.fill("#qc-1", sectioned("hapatra.txt", "Hapatra, Vizier of Poisons"))
    n0 = pg.evaluate("S.data.decks.length")
    pg.click('[data-qc="run"]'); pg.wait_for_function("S.qc.decks && !S.qc.busy", timeout=30000); pg.wait_for_timeout(300)
    out["qc"] = pg.evaluate("""()=>{ const sec=document.querySelector('#qc-0').closest('.sec'); const M=mesaEval(S.qc.decks);
      return {decks:S.qc.decks.map(d=>({cmd:d.commanders, n:d.cards.reduce((a,c)=>a+c.q,0)})), errs:S.qc.errs, text:sec.innerText, rows:sec.querySelectorAll('tbody tr').length, verdict:M&&M.verdict.es, owners:M.rows.map(r=>r.owner), saved:S.data.decks.length}; }""")
    out["qc"]["before"] = n0
    out["qc_overflow"] = pg.evaluate("document.documentElement.scrollWidth")
    out["qc_share"] = pg.evaluate("mesaText(mesaEval(S.qc.decks))")
    pg.click('[data-qc="save"]'); pg.wait_for_timeout(300)
    out["qc_after_save"] = pg.evaluate("[S.qc.decks, document.querySelectorAll('[data-qc=\"save\"]').length]")
    out["qc_saved"] = pg.evaluate("S.data.decks.filter(d=>d.rival).map(d=>[d.name, d.commanders.length, !!d.qc])")
    # la Mesa de hoy sigue funcionando con sus propios mazos
    out["mesa_plain"] = pg.evaluate("(()=>{ S.mesa.ids=['t']; const M=mesaEval(); return M && M.rows.length===1 && M.rows[0].d.id==='t'; })()")

    # ---- turno de victoria con partidas reales
    out["win"] = pg.evaluate("""()=>{ const d=S.data.decks.find(x=>x.id==='t'); const sim=simulate(d, analyze(d)); const r={};
      const P0=powerOf(d, analyze(d)); r.w0=winTurnOf(d, sim); r.sim=sim.winAvg;
      const add=(n,turn)=>{ for(let i=0;i<n;i++) S.data.games.push({id:uid(), at:Date.now()-i*864e5*2, deck:'t', res:'win', turn, how:null, seat:null, opp:[], note:''}); };
      S.data.games=S.data.games||[]; add(10,5); S.data.games.push({id:uid(), at:1, deck:'t', res:'loss', turn:9, opp:[], note:''}); S.data.games.push({id:uid(), at:2, deck:'t', res:'win', turn:0, opp:[], note:''});
      r.w10=winTurnOf(d, sim); const P10=powerOf(d, analyze(d)); r.memo = P10!==P0; r.why=JSON.stringify(P10.axes||P10);
      add(20,5); r.w30=winTurnOf(d, sim);
      S.mesa.ids=['t']; const M=mesaEval(); r.mesa=[M.rows[0].speed, M.rows[0].real]; r.table=mesaTableHTML(M);
      S.data.games.push({id:uid(), at:3, deck:'r0', res:'win', turn:4, opp:[], note:''});
      const q=winTurnOf({id:'qc-0', format:'commander', cards:[], commanders:[]}, sim); const o=winTurnOf(S.data.decks.find(x=>x.rival), sim); r.other=[q.n, q.t===sim.winAvg, o.n];
      return r; }""")
    pg.evaluate("S.view='commander'; S.showMeta.commander=false; S.sel.commander='t'; S.deckTab='partidas'; render()"); pg.wait_for_timeout(300)
    out["win_tab"] = pg.inner_text("#deck-pane"); out["win_overflow"] = pg.evaluate("document.documentElement.scrollWidth")

    # ---- imágenes del mazo
    out["snap_btns"] = pg.evaluate("[...document.querySelectorAll('#deck-pane [data-act^=snap]')].map(b=>b.dataset.act)")
    out["snap_png"] = pg.evaluate("""async ()=>{ S.deckTab='analisis'; render(); const r = await nodeToPng(document.querySelector('#deck-pane .pane-body'), {title:'Prueba', sub:'Análisis'}); return [r.blob.size, r.width, r.blob.type]; }""")
    out["snap_zip"] = pg.evaluate("zipStore([{name:'a.png', data:new Uint8Array([1,2,3])},{name:'b.png', data:new Uint8Array([4])}]).size")

    # ---- biblioteca por bracket
    pg.evaluate("S.view='commander'; S.showMeta.commander=false; render()"); pg.wait_for_timeout(150)
    pg.click('[data-act="show-lib"]'); pg.wait_for_timeout(400)
    out["lib"] = pg.evaluate("""()=>{ const rows=libRows(); const all=rows.length; const brs=[...new Set(rows.map(r=>r.P.real))];
      S.lib.br=brs[0]; const byBr=libRows().length; const okBr=libRows().every(r=>r.P.real===brs[0]); S.lib.br=0;
      S.lib.src='tuyos'; const mine=libRows().map(r=>r.d.id); S.lib.src='amigos'; const fr=libRows().length; S.lib.src='all';
      S.lib.q='voja'; const q=libRows().map(r=>r.d.name); S.lib.q=''; render();
      return {mode:S.showMeta.commander, all, byBr, okBr, mine, fr, q, title:document.querySelector('#deck-pane h2').innerText, pressed:document.querySelector('[data-act="show-lib"]').getAttribute('aria-pressed'), live:!!document.querySelector('[data-lib="td"]')}; }""")
    out["lib_overflow"] = pg.evaluate("document.documentElement.scrollWidth")
    out["lib_tool"] = pg.evaluate("(()=>{ S.view='tools'; render(); openTool('biblioteca'); return [S.view, S.showMeta.commander]; })()")

    # ---- almacenamiento (Ajustes y respaldo)
    pg.evaluate("S.settingsOpen=true; renderSettings()"); pg.wait_for_timeout(100)
    out["st_btn"] = pg.locator('#settings [data-act="storage"]').count()
    pg.click('#settings [data-act="storage"]'); pg.wait_for_function("!!S.storage", timeout=10000); pg.wait_for_timeout(200)
    out["st"] = pg.evaluate("({open:S.settingsOpen, rows:S.storage.rows.map(r=>r.where), decks:S.storage.decks, bytes:S.storage.bytes, text:document.querySelector('#settings').innerText})")
    out["st_overflow"] = pg.evaluate("document.documentElement.scrollWidth")

    # ---- precios para claude.ai
    out["pr"] = pg.evaluate("""()=>{ const r={}; r.btn=!!document.querySelector('#settings [data-act="prices-file"]'); r.status=priceStatus();
      let got=null; const dl=window.download; window.download=(n,t,ty)=>{ got={n,t,ty}; };
      document.querySelector('#settings [data-act="prices-file"]').click(); window.download=dl;
      const j=JSON.parse(got.t); r.file={name:got.n, kind:j.kind, app:j.app, cards:Object.keys(j.cardData.cards).length, decks:'decks' in j, coll:'collection' in j};
      r.stillOpen=S.settingsOpen;
      // versión de claude.ai: sin precios, con precios viejos y al día
      const iw=window.claude; window.claude={use(){}}; const keep=JSON.stringify(S.cards);
      S.pricesReady=false; for (const c of Object.values(S.cards)){ c.usd=null; c.eur=null; } r.early=priceBannerHTML(); S.cards=JSON.parse(keep); S.pricesReady=true;
      for (const c of Object.values(S.cards)){ c.usd=null; c.eur=null; } r.none=priceBannerHTML();
      S.cards=JSON.parse(keep); for (const c of Object.values(S.cards)) c.at=Date.now()-9*864e5; r.old=priceBannerHTML();
      for (const c of Object.values(S.cards)) c.at=Date.now()-2*864e5; r.fresh=priceBannerHTML(); r.webRow=pricesFileHTML();
      // importar el archivo de precios: solo datos de cartas, más nuevos
      const before=S.data.decks.length; const cd=j.cardData; for (const c of Object.values(cd.cards)){ c.at=Date.now(); c.usd=7.5; }
      r.merged=mergeCardData(cd); r.price=cardOf('Sol Ring') ? cardOf('Sol Ring').usd : null; r.sameDecks=S.data.decks.length===before;
      window.claude=iw; r.liveBanner=priceBannerHTML(); return r; }""")
    # el archivo de precios por la ruta real de "Importar respaldo": aunque traiga mazos o ajustes, solo entran los datos de cartas
    f = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist", "precios-prueba.json")
    json.dump({"app":"boveda-edh", "kind":"precios", "version":4, "at":1, "decks":[{"id":"colado", "format":"commander", "name":"Colado", "cards":[{"n":"Sol Ring", "q":1}]}], "settings":{"cur":"eur", "sellMin":999},
      "collection":{"items":[{"n":"Black Lotus", "q":4}]}, "cardData":{"cards":{"carta-de-precio":{"n":"Carta De Precio", "usd":3.21, "at":9999999999999, "t":"Artifact", "cmc":1, "ci":""}}}}, open(f, "w"))
    before = pg.evaluate("JSON.stringify([S.data.decks.map(d=>d.id), S.data.settings.cur, S.data.settings.sellMin, S.data.collection.items.length])")
    pg.set_input_files("#file-backup", f); pg.wait_for_timeout(500); os.remove(f)
    out["imp"] = pg.evaluate("({same: JSON.stringify([S.data.decks.map(d=>d.id), S.data.settings.cur, S.data.settings.sellMin, S.data.collection.items.length]), card:(S.cards['carta-de-precio']||{}).usd, toast:document.querySelector('#toast').innerText})")
    out["imp"]["before"] = before
    return out
R = deckrun.run("hakbal.txt", ["hakbal_cards.py","voja_cards.py","hapatra_cards.py"], ["Hakbal of the Surging Soul"], extra=flow)
X = R["extra"]; fails = []
def chk(ok, msg):
    if not ok: fails.append(msg)
# chequeo rápido
q = X["qc"]
chk(X["qc_view"] == ["commander", "local", True], "la herramienta no abre el chequeo: %s" % X["qc_view"])
chk(not q["errs"], "errores del chequeo: %s" % q["errs"])
chk(len(q["decks"]) == 2 and all(len(d["cmd"]) == 1 for d in q["decks"]), "comandantes mal separados: %s" % q["decks"])
chk(q["decks"][0]["cmd"] == ["Voja, Jaws of the Conclave"] and all(d["n"] >= 90 for d in q["decks"]), "las cartas quedaron como comandante: %s" % q["decks"])
chk(q["rows"] == 2 and q["verdict"] and q["verdict"] in q["text"], "sin tabla o veredicto: %s" % q["text"][:200])
chk(q["owners"] == ["Mazo 1", "Mazo 2"], "dueños: %s" % q["owners"])
chk(q["saved"] == q["before"], "el chequeo guardó mazos sin pedirlo")
chk("Simulación" not in X["qc_share"] and "Mazo 1" in X["qc_share"], "resumen para compartir: %s" % X["qc_share"])
chk(len(X["qc_saved"]) == 2 and all(c == 1 and not f for _, c, f in X["qc_saved"]), "guardar en amigos: %s" % X["qc_saved"])
chk(X["qc_after_save"] == [None, 0], "tras guardar se puede volver a guardar lo mismo: %s" % X["qc_after_save"])
chk(X["mesa_plain"], "la Mesa de hoy dejó de usar sus propios mazos")
# turno de victoria
w = X["win"]; s = w["sim"]
chk(s and w["w0"]["n"] == 0 and abs(w["w0"]["t"] - s) < 1e-9, "sin partidas debe usar el simulador: %s" % w["w0"])
chk(w["w10"]["n"] == 10 and abs(w["w10"]["t"] - (10*s + 50)/20) < 1e-9 and abs(w["w10"]["w"] - 0.5) < 1e-9, "10 victorias deben pesar la mitad: %s" % w["w10"])
chk(w["w30"]["n"] == 30 and abs(w["w30"]["t"] - (10*s + 150)/40) < 1e-9 and abs(w["w30"]["w"] - 0.75) < 1e-9, "30 victorias deben pesar 75 %%: %s" % w["w30"])
chk(w["memo"] and "real" in w["why"], "el nivel no se recalculó con las partidas: %s" % w["why"][:300])
chk(w["mesa"][1] == 30 and abs(w["mesa"][0] - w["w30"]["t"]) < 1e-9 and "✓" in w["table"], "la Mesa de hoy no usa el turno corregido: %s" % w["mesa"])
chk(w["other"] == [0, True, 0], "un mazo sin partidas propias heredó las de otro: %s" % w["other"])
chk("Turno de victoria" in X["win_tab"] and "75%" in X["win_tab"], "la pestaña Partidas no muestra el turno ajustado")
# imágenes
chk(set(X["snap_btns"]) >= {"snap-all"} and any(a in ("snap", "snap-share") for a in X["snap_btns"]), "faltan los botones de imagen: %s" % X["snap_btns"])
chk(X["snap_png"][0] > 2000 and X["snap_png"][2] == "image/png", "la imagen no se generó: %s" % X["snap_png"])
chk(X["snap_zip"] > 100, "zip vacío")
# biblioteca
L = X["lib"]
chk(L["mode"] == "lib" and "iblioteca" in L["title"] and L["pressed"] == "true", "la biblioteca no abre: %s" % L)
chk(L["all"] == 3 and L["mine"] == ["t"] and L["fr"] == 2 and L["okBr"] and 1 <= L["byBr"] <= 3, "filtros de la biblioteca: %s" % L)
chk(len(L["q"]) == 1 and "voja" in L["q"][0].lower(), "búsqueda: %s" % L["q"])
chk(not L["live"], "el archivo no debe ofrecer listas de torneo")
chk(X["lib_tool"] == ["commander", "lib"], "la herramienta no abre la biblioteca: %s" % X["lib_tool"])
# almacenamiento
S_ = X["st"]
chk(X["st_btn"] == 1 and S_["open"] and S_["decks"] >= 3 and S_["bytes"] > 1000, "almacenamiento: %s" % {k: S_[k] for k in ("open", "decks", "bytes")})
chk(any("localStorage" in r for r in S_["rows"]) and any("grupo" in r.lower() for r in S_["rows"]), "filas de almacenamiento: %s" % S_["rows"])
# precios
P = X["pr"]
chk(P["btn"] and P["file"]["kind"] == "precios" and P["file"]["app"] == "boveda-edh" and P["file"]["cards"] > 50, "archivo de precios: %s" % P["file"])
chk(not P["file"]["decks"] and not P["file"]["coll"], "el archivo de precios lleva mazos o colección")
chk(P["stillOpen"], "descargar precios cerró Ajustes")
chk(P["early"] == "", "el aviso de precios aparece antes de que carguen las cartas")
chk("no tiene precios" in P["none"] and "hace 9 días" in P["old"] and P["fresh"] == "" and P["liveBanner"] == "", "avisos de precios: %s" % [P["none"][:60], P["old"][:80], P["fresh"], P["liveBanner"]])
chk("Importar respaldo" in P["webRow"] and "data-act" not in P["webRow"], "fila de Ajustes en claude.ai: %s" % P["webRow"][:120])
chk(P["merged"] > 50 and P["price"] == 7.5 and P["sameDecks"], "importar precios: %s" % [P["merged"], P["price"], P["sameDecks"]])
I = X["imp"]
chk(I["same"] == I["before"] and I["card"] == 3.21 and "Precios importados" in I["toast"], "un archivo de precios cambió mazos, colección o ajustes: %s" % I)
for k in ("qc_overflow", "win_overflow", "lib_overflow", "st_overflow"):
    chk(X[k] <= 390, "desborde en %s: %s px" % (k, X[k]))
if R["errors"]: fails.append(str(R["errors"]))
if fails: print("FALLA segunda tanda:\n  " + "\n  ".join(fails)); sys.exit(1)
print("Segunda tanda OK: chequeo rápido, turno de victoria real, biblioteca, almacenamiento, imágenes y precios.")
