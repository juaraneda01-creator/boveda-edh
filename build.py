import pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parent
src = ROOT/'src'
ORDER = ['meta.js','core.js','tags.js','power.js','report.js','ui.js','pauper.js','events.js','tools.js','account.js','web.js','live.js','home.js']
css = (src/'style.css').read_text()
js = "\n".join((src/f).read_text() for f in ORDER)
html = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Bóveda EDH: tus mazos de Commander, Pauper y Pioneer, tu colección de ManaBox y alertas de precios.">
<title>Bóveda EDH</title>
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#1F5C4A">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Bóveda">
<link rel="apple-touch-icon" href="/icons/icon-180.png">
<link rel="icon" href="/icons/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya:wght@500;700&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=Alegreya+Sans+SC:wght@500;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>{css}</style>
</head>
<body>
<header class="top"><div class="top-in">
  <div class="brand"><span class="sigil" aria-hidden="true"><i class="p-W"></i><i class="p-U"></i><i class="p-R"></i><i class="p-G"></i></span>Bóveda EDH</div>
  <nav class="tabs" id="tabs" role="tablist" aria-label="Secciones"></nav>
  <div class="top-right"><span class="sync" id="sync"></span><button class="btn sm" id="btn-settings" aria-expanded="false">Ajustes y respaldo</button></div>
  <div class="settings" id="settings" hidden></div>
</div></header>
<main class="wrap" id="main"></main>
<div id="modal" hidden></div>
<img class="preview" id="preview" alt="" hidden>
<div class="toast" id="toast" hidden></div>
<input type="file" id="file-backup" accept=".json,application/json" hidden>
<script>
{js}
</script>
</body>
</html>
'''
dist = ROOT/'dist'; dist.mkdir(exist_ok=True)
(ROOT/'index.html').write_text(html)          # versión en vivo (Netlify)
(dist/'boveda-edh.html').write_text(html)     # archivo descargable
(dist/'index.html').write_text(html)
(dist/'app.js').write_text(js)                # para revisar la sintaxis

# versión con cuenta (claude.ai): sin <head>/<body> propios
head = html[html.index('<head>')+6:html.index('</head>')]
body = html[html.index('<body>\n<header')+6:html.rindex('</body>')]
head = re.sub(r'<meta[^>]*>\n?', '', head)
head = re.sub(r'<link rel="(preconnect|manifest|apple-touch-icon|icon)"[^>]*>\n?', '', head)
note = '<div class="banner" style="margin:12px auto;max-width:1180px" id="art-note"><span>Versión con cuenta: inicia sesión (arriba a la derecha) para guardar tus datos en todos tus dispositivos. Precios de Scryfall, EDHREC e importar por enlace funcionan en la <a href="https://boveda-edh.netlify.app" target="_blank" rel="noopener">versión en vivo</a>; pasa los datos con el respaldo.</span></div>'
body = body.replace('<main class="wrap" id="main">', note+'<main class="wrap" id="main">', 1)
(dist/'boveda-edh-web.html').write_text(head.strip()+"\n"+body.strip())
print(len(html))
