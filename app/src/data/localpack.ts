// Paquete de cartas de MTGJSON guardado en su propia base del navegador, comprimido.
// Va aparte de los mazos para que el arranque no lo lea entero junto con el resto de los datos.
const DB = "boveda-mtgjson", STORE = "pack", KEY = "v1";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const tx = <T,>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> =>
  open().then(db => new Promise<T | undefined>((res, rej) => {
    const t = db.transaction(STORE, mode); const q = work(t.objectStore(STORE));
    t.oncomplete = () => { res(q ? q.result : undefined); db.close(); }; t.onerror = () => { rej(t.error); db.close(); }; t.onabort = () => { rej(t.error); db.close(); };
  }));

export async function gzipText(text: string): Promise<Blob> {
  return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
}
export async function gunzipBlob(b: Blob): Promise<string> {
  return new Response(b.stream().pipeThrough(new DecompressionStream("gzip"))).text();
}

export interface SavedPack { at: number; gz: Blob }
export async function savePack(json: string): Promise<void> {
  const gz = await gzipText(json);
  await tx("readwrite", s => { s.put({ at: Date.now(), gz } satisfies SavedPack, KEY); });
}
export async function loadPack(): Promise<{ at: number; json: string } | null> {
  try {
    const r = await tx<SavedPack>("readonly", s => s.get(KEY));
    return r && r.gz ? { at: r.at || 0, json: await gunzipBlob(r.gz) } : null;
  } catch { return null; }
}
export async function deletePack(): Promise<void> { try { await tx("readwrite", s => { s.delete(KEY); }); } catch { /* sin base: nada que borrar */ } }
