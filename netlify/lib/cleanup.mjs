// Limpieza semanal: borra lo abandonado para que el almacenamiento no crezca sin fin.
// - códigos de sincronización sin uso en 400 días
// - grupos sin actividad en 400 días, y avisos de "cambió de código" con más de 30 días
// - contadores de cuota de días anteriores
const DAY = 86400e3;
export async function cleanup({sync, group, quota}, now = Date.now(), budgetMs = 20000){
  const t0 = Date.now(), out = {sync:0, group:0, quota:0};
  const keys = async store => { const r = await store.list(); return (r.blobs || []).map(b => b.key); };
  const last = m => m && m.metadata ? Math.max(Number(m.metadata.at) || 0, Number(m.metadata.seen) || 0) : 0;
  const old = async (store, key, maxAge) => { const at = last(await store.getMetadata(key).catch(() => null)); return at && now - at > maxAge; };
  if (sync) for (const k of await keys(sync)){ if (Date.now() - t0 > budgetMs) break; if (await old(sync, k, 400 * DAY)){ await sync.delete(k); out.sync++; } }
  if (group) for (const k of await keys(group)){
    if (Date.now() - t0 > budgetMs) break;
    const at = last(await group.getMetadata(k).catch(() => null));
    if (!at) continue;   // grupos anteriores a la marca de tiempo: se marcan en su próxima escritura
    let limit = 400 * DAY;
    if (now - at > 30 * DAY){ const d = await group.get(k, {type:"json"}).catch(() => null); if (d && d.moved) limit = 30 * DAY; }
    if (now - at > limit){ await group.delete(k); out.group++; }
  }
  if (quota){ const today = new Date(now).toISOString().slice(0, 10); for (const k of await keys(quota)){ if (Date.now() - t0 > budgetMs) break; const day = k.split("/")[2]; if (day && day < today){ await quota.delete(k); out.quota++; } } }
  return out;
}
