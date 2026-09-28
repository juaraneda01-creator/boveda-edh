// Base de cartas propia: datos de Scryfall guardados en compacto (Netlify Blobs) y renovados a diario.
// El teléfono descarga ~10 veces menos datos y no depende de que Scryfall responda en ese momento.
import { getStore } from "@netlify/blobs";

const FRESH = 20 * 3600e3;                 // precios del día
const MAX_NAMES = 150;
const json = (o, status = 200) => new Response(JSON.stringify(o), {status, headers:{"content-type":"application/json", "cache-control":"no-store"}});
const HITS = new Map();
function limited(req){
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "?";
  const now = Date.now(), recent = (HITS.get(ip) || []).filter(t => now - t < 60000); recent.push(now); HITS.set(ip, recent);
  if (HITS.size > 5000) HITS.clear();
  return recent.length > 40;
}
export const slug = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pick = (o, keys) => { const r = {}; if (!o) return r; for (const k of keys) if (o[k] != null) r[k] = o[k]; return r; };
// solo lo que la app usa
export function trim(c){
  const out = pick(c, ["id","name","cmc","color_identity","colors","type_line","oracle_text","mana_cost","produced_mana","game_changer","power","toughness","set","set_name","collector_number","rarity","released_at","lang","finishes","promo","frame_effects","full_art","border_color","scryfall_uri","edhrec_rank","reserved"]);
  out.prices = pick(c.prices, ["usd","usd_foil","usd_etched","eur","eur_foil","eur_etched"]);
  out.legalities = pick(c.legalities, ["commander","pauper","pioneer"]);
  if (c.image_uris) out.image_uris = pick(c.image_uris, ["normal","small","art_crop"]);
  if (c.purchase_uris) out.purchase_uris = pick(c.purchase_uris, ["cardkingdom","tcgplayer","cardmarket"]);
  if (Array.isArray(c.card_faces)) out.card_faces = c.card_faces.map(f => ({...pick(f, ["name","mana_cost","type_line","oracle_text","power","toughness","colors"]), ...(f.image_uris ? {image_uris: pick(f.image_uris, ["normal","small","art_crop"])} : {})}));
  return out;
}
async function scryfall(names){
  const r = await fetch("https://api.scryfall.com/cards/collection", {method:"POST", headers:{"content-type":"application/json", accept:"application/json", "user-agent":"BovedaEDH/1.0 (+https://boveda-edh.netlify.app)"}, body: JSON.stringify({identifiers: names.map(n => ({name: n.split(" // ")[0]}))})});
  if (!r.ok) throw Object.assign(new Error("Scryfall " + r.status), {status:r.status});
  return r.json();
}

export default async (req) => {
  if (limited(req)) return json({error:"demasiadas consultas"}, 429);
  if (req.method !== "POST") return json({error:"método no permitido"}, 405);
  let body; try { body = await req.json(); } catch { return json({error:"cuerpo inválido"}, 400); }
  const names = [...new Set((Array.isArray(body.names) ? body.names : []).map(n => String(n || "").trim()).filter(Boolean))].slice(0, MAX_NAMES);
  if (!names.length) return json({data:[], not_found:[]});
  const store = getStore({name:"boveda-cards", consistency:"eventual"});
  const now = Date.now();
  const hits = await Promise.all(names.map(n => store.get("c/" + slug(n.split(" // ")[0]), {type:"json"}).catch(() => null)));
  const data = [], miss = [];
  names.forEach((n, i) => { const h = hits[i]; if (h && h.card && now - (h.at || 0) < FRESH) data.push(h.card); else miss.push({n, old:h && h.card}); });
  const not_found = [];
  for (let i = 0; i < miss.length; i += 75){
    const chunk = miss.slice(i, i + 75);
    let j;
    try { j = await scryfall(chunk.map(x => x.n)); }
    catch(e){ for (const x of chunk) x.old ? data.push(x.old) : not_found.push({name:x.n}); continue; }   // si Scryfall falla, se usa lo guardado aunque sea de ayer
    const byName = new Map(); for (const c of j.data || []) byName.set(slug(c.name.split(" // ")[0]), c);
    const saves = [];
    for (const x of chunk){
      const c = byName.get(slug(x.n.split(" // ")[0]));
      if (!c){ if (x.old) data.push(x.old); else not_found.push({name:x.n}); continue; }
      const t = trim(c); data.push(t);
      const keys = new Set([slug(x.n.split(" // ")[0]), slug(c.name.split(" // ")[0])]);
      for (const k of keys) saves.push(store.setJSON("c/" + k, {at: now, card: t}).catch(() => {}));
    }
    await Promise.all(saves);
    if (i + 75 < miss.length) await new Promise(r => setTimeout(r, 110));
  }
  return json({data, not_found, cached: names.length - miss.length});
};

export const config = { path: "/api/cards" };
