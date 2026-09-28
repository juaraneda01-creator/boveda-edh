// Sal de EDHREC: lista paginada (top/salt.json, top/salt--1.json, …) hasta que la sal baja de 0,8.
// Bajo ese valor las cartas casi no molestan en la mesa y la app las estima por lo que hacen.
// Se arma por tramos: cada ejecución sigue desde la página donde quedó la anterior.
export const SALT_MIN = 0.8, SALT_MAX_PAGES = 40, SALT_TTL = 7 * 864e5;
export const slugName = s => String(s || "").toLowerCase().replace(/æ/g, "ae").replace(/œ/g, "oe").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const views = j => j && (j.cardviews || ((((j.container || {}).json_dict || {}).cardlists || []).flatMap(c => c.cardviews || [])));
export async function buildSalt(fetchJSON, {budgetMs = 25000, from = null} = {}){
  const t0 = Date.now(), map = {...((from && from.map) || {})}; let page = (from && +from.pages) || 0, done = false, err = false;
  while (page < SALT_MAX_PAGES && Date.now() - t0 < budgetMs){
    const url = page === 0 ? "https://json.edhrec.com/pages/top/salt.json" : `https://json.edhrec.com/pages/top/salt--${page}.json`;
    let j; try { j = await fetchJSON(url); } catch(e){ if (String(e && e.message) === "404" && page > 0){ done = true; } else err = true; break; }   // 404 = no hay más páginas
    const list = views(j) || []; if (!list.length){ done = true; break; }
    let low = Infinity;
    for (const c of list){ if (c && c.name && typeof c.salt === "number"){ map[slugName(c.name)] = Math.round(c.salt * 1000) / 1000; low = Math.min(low, c.salt); } }
    page++;
    if (low < SALT_MIN || (j && j.more === undefined && page > 1)){ done = true; break; }
  }
  if (page >= SALT_MAX_PAGES) done = true;
  return {at: Date.now(), started: (from && from.started) || t0, done, err, pages: page, n: Object.keys(map).length, map};
}
// un tramo de trabajo: "map" es la última lista completa (o la mejor parcial), "work" la que se está armando
// escrituras condicionales y un turno a la vez: dos visitas simultáneas no bajan las mismas páginas ni pisan una lista completa
const cond = m => m && m.etag ? {onlyIfMatch: m.etag} : {onlyIfNew: true};
const wrote = r => !r || r.modified !== false;
export async function saltStep(store, fetchJSON, budgetMs){
  const M = await store.getWithMetadata("map", {type:"json"}).catch(() => null); let map = M && M.data;
  if (map && map.done && Date.now() - map.at < SALT_TTL) return map;
  // turno: se marca "work" como tomado; si otro ya lo tiene hace menos de un minuto, se sirve lo que haya
  const W = await store.getWithMetadata("work", {type:"json"}).catch(() => null); let work = W && W.data;
  if (work && work.busy && Date.now() - work.busy < 60000) return map;
  if (!wrote(await store.setJSON("work", {...(work || {}), busy: Date.now()}, cond(W)))) return map;
  if (!work || work.done || Date.now() - (work.started || 0) > 2 * SALT_TTL) work = null;
  const b = await buildSalt(fetchJSON, {budgetMs, from: work});
  if (b.done){ if (wrote(await store.setJSON("map", b, cond(M)))) map = b; await store.delete("work").catch(() => {}); return map; }
  await store.setJSON("work", {...b, busy: 0});
  if (!map || (!map.done && b.n > map.n)){ if (wrote(await store.setJSON("map", b, cond(M)))) map = b; }
  return map;
}
