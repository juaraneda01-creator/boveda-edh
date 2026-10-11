# Bóveda Constructor

App para armar, probar y ajustar mazos de Commander por casillas. Reemplaza, para ese trabajo, a la Bóveda EDH original (que sigue en la raíz del repositorio).

## Qué hay aquí

| Carpeta | Qué contiene |
|---|---|
| `src/engine/` | El motor: lector de listas, análisis, bracket, casillas, borrador, sugerencias, pruebas de manos, partidas simuladas y comparación A contra B. No conoce la pantalla ni el almacenamiento. |
| `src/data/` | Almacenamiento por tablas (IndexedDB), fuentes externas y acciones. |
| `src/ui/` | Las pantallas (Preact). |
| `vendor/preact/` | Preact 10.29.8, copiado desde su repositorio (licencia MIT incluida). Así la app no necesita instalar nada para armarse. |
| `tests/` | Pruebas del motor (`*.test.ts`), de paridad con la Bóveda original y de navegador (`e2e.mjs`). |
| `../constructor/` | La app armada: es lo que se publica. |

## Cómo trabajar

```
node --test tests/*.test.ts    # motor y paridad (Node 22 o superior, sin instalar nada)
npx tsc --noEmit -p .          # tipos
node build.mjs                 # arma ../constructor/
node tests/e2e.mjs             # pruebas de navegador (necesita Playwright y Chromium)
```

Orden al cambiar código: pruebas del motor, tipos, armar, pruebas de navegador, y subir `app/` junto con `constructor/`. El CI falla si `constructor/` no coincide con el código fuente.

## Versión

`build.mjs` calcula una huella del contenido (7 caracteres) y la deja en Ajustes y en `constructor/version.json`. Para saber si lo publicado está al día, compara `https://boveda-edh.netlify.app/constructor/version.json` con el archivo del repositorio.

## Decisiones

- **Solo Commander.** Sin colección, precios ni venta.
- **Una sola versión de la app.** No hay variante para claude.ai ni archivo suelto.
- **Paridad.** Las reglas que detectan roles, etiquetas y marcas de cada carta vienen tal cual de la Bóveda original. `tests/parity.test.ts` comprueba que el motor nuevo da los mismos resultados, incluidas las simulaciones con semilla. Si algún día se borra `../src/`, esas pruebas se omiten solas.
- **Fuentes.** Scryfall directo. EDHREC, Commander Spellbook, EDHTop16, Moxfield y Archidekt pasan por `/api/proxy` cuando la app corre en el sitio publicado; si el puente no está, se intenta directo.
