// Arma la app en ../constructor/ (lo que se publica). Uso: node build.mjs [--check]
// Sin dependencias en tiempo de ejecución: Preact va incluido en vendor/ y esbuild lo empaqueta todo.
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../constructor");
const require = createRequire(import.meta.url);
// esbuild: el del proyecto (npm install) o, en los entornos sin acceso a npm, el que ya viene instalado
let esbuild;
for (const p of ["esbuild", "/opt/npm-tools/node_modules/esbuild"]) { try { esbuild = require(p); break; } catch { /* siguiente */ } }
if (!esbuild) { console.error("Falta esbuild: corre `npm install` en app/."); process.exit(1); }

const result = await esbuild.build({
  entryPoints: [path.join(HERE, "src/main.tsx")],
  bundle: true, minify: true, format: "esm", target: "es2020", write: false, outdir: OUT,
  entryNames: "app", assetNames: "[name]", legalComments: "none", charset: "utf8",
  jsx: "automatic", jsxImportSource: "preact",
  alias: {
    "preact": path.join(HERE, "vendor/preact/src/index.js"),
    "preact/hooks": path.join(HERE, "vendor/preact/hooks/src/index.js"),
    "preact/jsx-runtime": path.join(HERE, "vendor/preact/jsx-runtime/src/index.js"),
  },
  define: { __BUILD__: JSON.stringify({ v: "@@VERSION@@" }) },
  loader: { ".css": "css" },
});
// La versión es la huella del contenido: mismo código, misma versión, en cualquier máquina.
// Es lo que muestra Ajustes y lo que entrega version.json, para comprobar qué quedó publicado.
const raw = new Map(result.outputFiles.map(f => [path.basename(f.path), f.text]));
const version = createHash("sha256").update(raw.get("app.js")).update(raw.get("app.css") || "").digest("hex").slice(0, 7);
const stamp = t => t.replaceAll("@@VERSION@@", version);
const files = new Map([...raw].map(([n, t]) => [n, stamp(t)]));
files.set("index.html", stamp(fs.readFileSync(path.join(HERE, "index.html"), "utf8")));
files.set("sw.js", stamp(fs.readFileSync(path.join(HERE, "public/sw.js"), "utf8")));
files.set("manifest.webmanifest", fs.readFileSync(path.join(HERE, "public/manifest.webmanifest"), "utf8"));
files.set("version.json", JSON.stringify({ version }) + "\n");

if (process.argv.includes("--check")) {
  // para el CI: lo publicado debe coincidir con el código fuente
  const diff = [...files].filter(([name, text]) => { try { return fs.readFileSync(path.join(OUT, name), "utf8") !== text; } catch { return true; } }).map(([n]) => n);
  if (diff.length) { console.error(`constructor/ está atrasado respecto de app/src (${diff.join(", ")}). Corre: node app/build.mjs`); process.exit(1); }
  console.log("constructor/ está al día.");
} else {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, text] of files) fs.writeFileSync(path.join(OUT, name), text);
  const kb = n => (Buffer.byteLength(files.get(n)) / 1024).toFixed(0) + " KB";
  console.log(`Listo: constructor/ (app.js ${kb("app.js")}, app.css ${kb("app.css")}), versión ${version}.`);
}
