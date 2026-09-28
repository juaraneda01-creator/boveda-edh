# Bóveda EDH

Tus mazos de Commander, Pauper y Pioneer, tu colección de ManaBox, carpetas de venta, matchups de Pauper y alertas de precios.

Versión en vivo: https://boveda-edh.netlify.app

## Estructura

- `src/` código fuente (JavaScript y CSS). **Se edita aquí.**
- `build.py` une `src/` en una sola página: escribe `index.html` (versión en vivo), `dist/boveda-edh.html` (archivo descargable) y `dist/boveda-edh-web.html` (versión con cuenta de claude.ai).
- `netlify/functions/` puente propio (`/api/proxy`) y sincronización por código (`/api/sync`).
- `sw.js`, `manifest.webmanifest`, `icons/` para instalarla como app.
- `tests/` pruebas que corren en cada cambio (GitHub Actions).

## Cambiar algo

```
python3 build.py          # arma index.html y dist/
python3 tests/smoke.py    # prueba la página en un navegador
```

Sube `src/`, `build.py` e `index.html` juntos. Netlify publica solo.

Tus datos (mazos, colección, respaldos) se guardan en tu navegador o, si creas un código, en tu espacio de sincronización; nunca en este repositorio.
