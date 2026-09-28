# Carga un mazo de prueba con sus cartas (tests/fixtures) y devuelve la ficha calculada por la app.
import json, re, os
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
def load_cards(*files):
    ALL = {}
    for f in files:
        g = {}; exec(open(os.path.join(HERE, "fixtures", f)).read(), g); ALL.update(g["C"])
    FRONT = {n.split(" // ")[0]: n for n in ALL}
    return ALL, FRONT
def scry(ALL, name):
    tl,cost,cmc,ci,o,pm,gc = ALL[name]
    return {"object":"card","id":"id-"+re.sub(r'\W','',name),"name":name,"cmc":cmc,"color_identity":list(ci),"colors":list(ci),"type_line":tl,"oracle_text":o,"mana_cost":cost,
      "produced_mana":pm,"prices":{"usd":"1.00","eur":"0.9"},"legalities":{"commander":"legal"},"game_changer":gc,"set":"tst","set_name":"Test","collector_number":"1","rarity":"rare","released_at":"2020-01-01","image_uris":{"normal":"","small":""},"finishes":["nonfoil"]}
REPORT_JS = """()=>{ const d=S.data.decks.find(x=>x.id==='t'); const A=analyze(d); const R=reportOf(d,A); return {p:R.P.power, abs:R.abs, type:R.type.es, tier:R.tier&&R.tier.t, br:[R.P.official.b,R.P.real], salt:R.P.salt, grades:R.report.grades.map(g=>g.es+':'+g.g), plan:R.plan, strat:R.strat, chips:R.chips.map(c=>c.es),
  lands:R.mana.lands, basics:R.mana.basics, avg:R.curve.avg, cheap:R.curve.cheap, ramp:R.ramp, tutors:R.tutors.n, draw:R.cards.draw, rec:R.cards.rec, inter:{c:R.inter.counters, r:R.inter.removal, w:R.inter.wipes, p:R.inter.protect}, timing:R.timing.pct,
  paths:R.wins.paths.map(x=>x.k), tribe:R.tribe&&R.tribe.s, syn:R.syn&&{s:R.syn.score, cov:R.syn.cov, cmd:R.syn.cmd, shape:R.syn.shape.es}, pill:Object.fromEntries(R.pill.map(x=>[x.k, +x.v.toFixed(1)])), missing:A.missing.length, stale:R.stale}; }"""
def run(deck_txt, card_files, commanders, w=390, extra=None):
    ALL, FRONT = load_cards(*card_files)
    def handle(route, req):
        u = req.url
        if 'api.scryfall.com/cards/collection' in u:
            ids = json.loads(req.post_data)['identifiers']; data=[]; nf=[]
            for i in ids:
                n = i.get('name'); full = n if n in ALL else FRONT.get(n)
                (data.append(scry(ALL, full)) if full else nf.append(i))
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({"data":data,"not_found":nf}))
        if u.startswith('file:'): return route.continue_()
        return route.fulfill(status=404, body='')
    text = open(os.path.join(HERE, "fixtures", deck_txt)).read()
    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width':w,'height':900})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/*', handle); pg.goto('file://' + os.path.join(HERE, '..', 'dist', 'index.html')); pg.wait_for_timeout(800)
        pg.evaluate("""async ({t, cmds})=>{ const p=parseList(t,{keepSide:true}); const d={id:'t',format:'commander',name:'Prueba',commanders:cmds,cards:p.filter(c=>!cmds.includes(c.n)).map(c=>({n:c.n,q:c.q})),side:[],maybe:[],log:[],created:1,updated:1};
          S.data.decks.push(d); S.data.settings.onboarded=true; await fetchCards(allNames(d),{quiet:true}); S.view='commander'; S.sel.commander='t'; S.showMeta.commander=false; S.deckTab='nivel'; bumpAnalysis(); render(); }""", {"t":text, "cmds":commanders})
        pg.wait_for_timeout(800)
        R = pg.evaluate(REPORT_JS)
        R["overflow"] = pg.evaluate("document.documentElement.scrollWidth")
        if extra: R["extra"] = extra(pg)
        b.close()
    R["errors"] = errs
    return R
if __name__ == "__main__":
    import sys
    R = run(sys.argv[1], sys.argv[2].split(","), sys.argv[3].split("|"))
    print(json.dumps(R, ensure_ascii=False, indent=1))
