const DB_NAME = 'ripple-room',
  VERSION = 1;
let db;
export async function openDB() {
  if (db) return db;
  db = await new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, VERSION);
    r.onupgradeneeded = () => {
      for (const store of ['rooms', 'settings'])
        if (!r.result.objectStoreNames.contains(store))
          r.result.createObjectStore(store, { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return db;
}
export async function put(store, value) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => res(value);
    tx.onerror = () => rej(tx.error);
  });
}
export async function all(store) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const r = d.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function remove(store, id) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const t = d.transaction(store, 'readwrite');
    t.objectStore(store).delete(id);
    t.oncomplete = res;
    t.onerror = () => rej(t.error);
  });
}
export async function get(store, id) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const r = d.transaction(store).objectStore(store).get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
