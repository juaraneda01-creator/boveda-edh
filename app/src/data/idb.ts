// Almacenamiento por tablas en IndexedDB: cada mazo, versión, partida y carta es un registro propio.
// Guardar un cambio escribe solo ese registro, no todos los datos.

export type StoreName = "decks" | "versions" | "games" | "cards" | "kv";
const DB_NAME = "boveda-constructor", DB_VERSION = 1;

let dbp: Promise<IDBDatabase> | null = null;
/** Si el navegador no deja usar IndexedDB (modo privado antiguo, bloqueo), los datos viven solo en memoria. */
export let memoryOnly = false;
const mem: Record<StoreName, Map<string, unknown>> = { decks: new Map(), versions: new Map(), games: new Map(), cards: new Map(), kv: new Map() };

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise<IDBDatabase>((res, rej) => {
    let r: IDBOpenDBRequest;
    try { r = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { rej(e); return; }
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("decks")) db.createObjectStore("decks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("versions")) db.createObjectStore("versions", { keyPath: "id" }).createIndex("deckId", "deckId");
      if (!db.objectStoreNames.contains("games")) db.createObjectStore("games", { keyPath: "id" }).createIndex("deckId", "deckId");
      if (!db.objectStoreNames.contains("cards")) db.createObjectStore("cards", { keyPath: "k" });
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "k" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("base de datos bloqueada"));
  }).catch(e => { memoryOnly = true; throw e; });
  return dbp;
}

const keyOf = (store: StoreName, v: unknown): string => String((v as Record<string, unknown>)[store === "cards" || store === "kv" ? "k" : "id"]);
const done = (tx: IDBTransaction): Promise<void> => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error("transacción cancelada")); });

export async function getAll<T>(store: StoreName): Promise<T[]> {
  try {
    const db = await open();
    return await new Promise<T[]>((res, rej) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result as T[]); q.onerror = () => rej(q.error); });
  } catch { return [...mem[store].values()] as T[]; }
}

const tryOpen = (): Promise<IDBDatabase | null> => open().catch(() => null);

/** Guarda uno o más registros. Si el navegador rechaza la escritura (sin espacio), el error llega a quien llamó. */
export async function put(store: StoreName, ...values: unknown[]): Promise<void> {
  for (const v of values) mem[store].set(keyOf(store, v), v);
  const db = await tryOpen(); if (!db) return;
  const tx = db.transaction(store, "readwrite"); const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  await done(tx);
}

export async function del(store: StoreName, ...keys: string[]): Promise<void> {
  for (const k of keys) mem[store].delete(k);
  const db = await tryOpen(); if (!db) return;
  const tx = db.transaction(store, "readwrite"); const os = tx.objectStore(store);
  for (const k of keys) os.delete(k);
  await done(tx);
}

export async function clearAll(stores: StoreName[]): Promise<void> {
  for (const s of stores) mem[s].clear();
  const db = await tryOpen(); if (!db) return;
  const tx = db.transaction(stores, "readwrite");
  for (const s of stores) tx.objectStore(s).clear();
  await done(tx);
}

export async function kvGet<T>(k: string): Promise<T | null> {
  try {
    const db = await open();
    const r = await new Promise<{ k: string; v: T } | undefined>((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    return r ? r.v : null;
  } catch { const r = mem.kv.get(k) as { v: T } | undefined; return r ? r.v : null; }
}
export const kvSet = (k: string, v: unknown): Promise<void> => put("kv", { k, v });

/** Cuánto ocupa lo guardado, si el navegador lo informa. */
export async function usage(): Promise<{ used: number; quota: number } | null> {
  try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } catch { return null; }
}
/** Pide al navegador que no borre los datos cuando falte espacio. */
export async function persist(): Promise<boolean> {
  try { return !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); } catch { return false; }
}
