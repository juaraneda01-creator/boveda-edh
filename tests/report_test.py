# Ficha del mazo: con un mazo real (Hakbal, merfolk) los números deben quedar cerca de Commandersalt.
import json, re, os, sys
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "fixtures/hakbal_cards.py")).read())
def sc(name):
    tl,cost,cmc,ci,o,pm,gc=C[name]
    return {"object":"card","id":"id-"+re.sub(r'\W','',name),"name":name,"cmc":cmc,"color_identity":list(ci),"colors":list(ci),"type_line":tl,"oracle_text":o,"mana_cost":cost,
      "produced_mana":pm,"prices":{"usd":"1.00","eur":"0.9"},"legalities":{"commander":"legal"},"game_changer":gc,"set":"tst","set_name":"Test","collector_number":"1","rarity":"rare","released_at":"2020-01-01","image_uris":{"normal":"","small":""},"finishes":["nonfoil"]}
def handle(route, req):
    u=req.url
    if 'api.scryfall.com/cards/collection' in u:
        ids=json.loads(req.post_data)['identifiers']
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({"data":[sc(i['name']) for i in ids if i.get('name') in C],"not_found":[i for i in ids if i.get('name') not in C]}))
    if u.startswith('file:'): return route.continue_()
    return route.fulfill(status=404, body='')
text=open(os.path.join(HERE, "fixtures/hakbal.txt")).read()
fails=[]; errs=[]
def check(name, ok, got):
    if not ok: fails.append(f"{name}: {got}")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':900})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/*', handle); pg.goto('file://' + os.path.join(HERE, '..', 'dist', 'index.html')); pg.wait_for_timeout(800)
    pg.evaluate("""async t=>{ const p=parseList(t,{keepSide:true}); const d={id:'hk',format:'commander',name:'Tiritones',commanders:['Hakbal of the Surging Soul'],cards:p.filter(c=>!['Hakbal of the Surging Soul','Wonder'].includes(c.n)).map(c=>({n:c.n,q:c.q})),side:[],maybe:[],log:[],created:1,updated:1};
      S.data.decks.push(d); S.data.settings.onboarded=true; await fetchCards(allNames(d),{quiet:true}); S.view='commander'; S.sel.commander='hk'; S.showMeta.commander=false; S.deckTab='nivel'; bumpAnalysis(); render(); }""", text)
    pg.wait_for_timeout(800)
    R=pg.evaluate("""()=>{ const d=S.data.decks.find(x=>x.id==='hk'); const R=reportOf(d, analyze(d)); return {p:R.P.power, br:[R.P.official.b,R.P.real], plan:R.plan, strat:R.strat, lands:R.mana.lands, basics:R.mana.basics, fetch:R.mana.fetch, avg:R.curve.avg, cheap:R.curve.cheap, timing:R.timing.pct, paths:R.wins.paths.map(x=>x.k), tribe:R.tribe&&R.tribe.s, etb:R.engine.etb, counters:R.inter.counters, stale:R.stale}; }""")
    check("nivel 6–7.5 (Commandersalt 6.6)", 6 <= R['p'] <= 7.5, R['p'])
    check("bracket 3/3", R['br']==[3,3], R['br'])
    check("perfil Midrange / Tribal", R['plan']=="Midrange" and R['strat']=="Tribal", R['plan']+" / "+R['strat'])
    check("34 tierras, 14 básicas, 2 fetch", (R['lands'],R['basics'],R['fetch'])==(34,14,2), (R['lands'],R['basics'],R['fetch']))
    check("curva 2.2–2.5", 2.2 <= R['avg'] <= 2.5, R['avg'])
    check("14 baratas", R['cheap']==14, R['cheap'])
    check("timing ≥ 90%", (R['timing'] or 0) >= 90, R['timing'])
    check("gana por combate", R['paths']==["combat"], R['paths'])
    check("tribal merfolk", R['tribe']=="merfolk", R['tribe'])
    check("contrahechizos densos", R['counters']>=6, R['counters'])
    check("sin cartas pendientes", R['stale']==0, R['stale'])
    check("sin desborde en teléfono", pg.evaluate("document.documentElement.scrollWidth")<=390, pg.evaluate("document.documentElement.scrollWidth"))
    b.close()
if errs: fails += ["error de página: "+e for e in errs]
if fails: print("FALLA ficha:\n  " + "\n  ".join(fails)); sys.exit(1)
print("Ficha OK: el mazo de Hakbal da números cercanos a Commandersalt.")
