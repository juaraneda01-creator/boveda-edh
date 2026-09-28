// Sal de EDHREC: lista paginada (top/salt.json, top/salt--1.json, …) hasta que la sal baja de 0,8.
// Bajo ese valor las cartas casi no molestan en la mesa y la app las estima por lo que hacen.
export const SALT_MIN = 0.8, SALT_MAX_PAGES = 40, SALT_TTL = 7 * 864e5;
export const slugName = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const views = j => j && (j.cardviews || ((((j.container || {}).json_dict || {}).cardlists || []).flatMap(c => c.cardviews || [])));
export async function buildSalt(fetchJSON, {budgetMs = 25000} = {}){
  const t0 = Date.now(), map = {}; let page = 0, done = false;
  while (page < SALT_MAX_PAGES && Date.now() - t0 < budgetMs){
    const url = page === 0 ? "https://json.edhrec.com/pages/top/salt.json" : `https://json.edhrec.com/pages/top/salt--${page}.json`;
    let j; try { j = await fetchJSON(url); } catch { break; }
    const list = views(j) || []; if (!list.length){ done = true; break; }
    let low = Infinity;
    for (const c of list){ if (c && c.name && typeof c.salt === "number"){ map[slugName(c.name)] = Math.round(c.salt * 1000) / 1000; low = Math.min(low, c.salt); } }
    page++;
    if (low < SALT_MIN || (j && j.more === undefined && page > 1)){ done = true; break; }
  }
  return {at: Date.now(), done, pages: page, n: Object.keys(map).length, map};
}
