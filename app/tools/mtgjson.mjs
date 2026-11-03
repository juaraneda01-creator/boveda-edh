// Convierte AtomicCards de MTGJSON en el paquete compacto que carga la app (Ajustes → Cartas sin conexión).
// Uso: node tools/mtgjson.mjs AtomicCards.json.gz [cartas-boveda.json.gz]
// El paquete pesa bastante menos que AtomicCards y se carga más rápido en el teléfono.
import fs from "node:fs";
import zlib from "node:zlib";
import { compactAtomic } from "../src/engine/mtgjson.ts";

const [, , input, output = "cartas-boveda.json.gz"] = process.argv;
if (!input) { console.error("Uso: node tools/mtgjson.mjs AtomicCards.json.gz [salida.json.gz]"); process.exit(1); }
const raw = fs.readFileSync(input);
const text = raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw).toString("utf8") : raw.toString("utf8");
const pack = compactAtomic(JSON.parse(text));
const gz = zlib.gzipSync(JSON.stringify(pack), { level: 9 });
fs.writeFileSync(output, gz);
const gc = pack.cards.filter(c => c.game_changer).length;
console.log(`${output}: ${pack.cards.length} cartas, ${gc} Game Changers, MTGJSON ${pack.date} (${pack.version}), ${(gz.length / 1048576).toFixed(1)} MB`);
