/** 本机文件夹句柄的持久化：File System Access API 的句柄可以存进 IndexedDB，下次访问还能用 */

const DB_NAME = "our-travel-map-media";
const STORE = "dir-handles";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 打开失败"));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 读写失败"));
    t.oncomplete = () => db.close();
  });
}

export function saveDirHandle(key: string, handle: unknown): Promise<void> {
  return withStore("readwrite", (s) => s.put(handle, key));
}

export function loadDirHandle<T = unknown>(key: string): Promise<T | undefined> {
  return withStore<T | undefined>("readonly", (s) => s.get(key));
}

export function clearDirHandle(key: string): Promise<void> {
  return withStore("readwrite", (s) => s.delete(key));
}

export function supportsFolderPicker(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}
