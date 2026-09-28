# Scryfall rechaza un lote por un nombre malo: las demás cartas igual deben cargarse.
import json
from playwright.sync_api import sync_playwright
def card(n): return {"object":"card","id":"x","name":n,"cmc":2,"color_identity":["G"],"colors":["G"],"type_line":"Creature — Elf","oracle_text":"{T}: Add {G}.","mana_cost":"{1}{G}","produced_mana":["G"],"prices":{"usd":"1.0"},"legalities":{"commander":"legal"},"set":"tst","collector_number":"1"}
calls={'n':0}
def handle(route, req):
    u=req.url
    if 'cards/collection' in u:
        calls['n']+=1
        ids=json.loads(req.post_data)['identifiers']
        if any(not i['name'] or '\t' in i['name'] or 'BAD' in i['name'] for i in ids): return route.fulfill(status=400, content_type='application/json', body='{"object":"error"}')
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({"data":[card(i['name']) for i in ids],"not_found":[]}))
    if 'cards/named' in u: return route.fulfill(status=404, body='{}')
    if u.startswith('file:'): return route.continue_()
    return route.fulfill(status=404, body='')
names=["Card %d"%i for i in range(78)]+["BAD ’name"]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/*', handle); import os; pg.goto('file://'+os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','dist','index.html')); pg.wait_for_timeout(800)
    pg.evaluate("""names=>{ const d={id:'t',format:'commander',name:'Prueba',commanders:[],cards:names.map(n=>({n,q:1})),side:[],maybe:[],log:[],created:1,updated:1}; S.data.decks.push(d); S.view='commander'; S.sel.commander='t'; S.deckTab='lista'; render(); }""", names)

    # simula otra tarea larga en curso (actualización de precios) mientras se toca el botón
    pg.evaluate("S.busy={label:'Actualizando precios del día',done:0,total:500}; fetchCards(S.data.decks[0].cards.map(c=>c.n))"); pg.wait_for_timeout(2500)
    left = pg.evaluate("analyze(S.data.decks[0]).missing.length")
    pg.evaluate("S.busy=null; render()"); pg.wait_for_timeout(200)
    banner = pg.inner_text('.banner') if pg.locator('.banner').count() else ''
    b.close()
if left != 1 or 'BAD' not in banner or errs:
    print('FALLA carga de cartas:', left, banner, errs); raise SystemExit(1)
print('Cartas OK: un nombre malo no deja sin datos al resto y el aviso dice cuál falló.')
