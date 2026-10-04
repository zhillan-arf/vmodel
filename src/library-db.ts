export const databaseName = 'vmodel-library';
export function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('Saved models are unavailable. Browser storage is not available.')); return; }
    const request = indexedDB.open(databaseName, 1);
    let blocked = false;
    request.onblocked = () => { blocked = true; reject(new Error('Close other studio tabs, then retry.')); };
    request.onerror = () => reject(request.error?.name === 'VersionError'
      ? new Error('This library needs a newer application version. Saved data has not changed.') : request.error);
    request.onupgradeneeded = () => {
      if(blocked){request.transaction?.abort();return;}
      const db = request.result;
      db.createObjectStore('assets', { keyPath: 'hash' });
      db.createObjectStore('models', { keyPath: 'id' }).createIndex('assetHash', 'assetHash', { unique: true });
      db.createObjectStore('attachments', { keyPath: 'id' }).createIndex('modelId', 'modelId');
      db.createObjectStore('preferences', { keyPath: 'key' }).put({ key: 'schemaVersion', value: 1 });
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close(); resolve(db);
    };
  });
}
export function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
export async function transact<T>(stores: string[], mode: IDBTransactionMode,
  run: (tx: IDBTransaction) => Promise<T> | T, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const db = await openLibrary();
  try {
    signal?.throwIfAborted();
    const tx = db.transaction(stores, mode);
    const abort = () => { try { tx.abort(); } catch { /* The transaction has completed. */ } };
    signal?.addEventListener('abort', abort, { once: true });
    const completed = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? signal?.reason ?? new Error('Storage operation stopped. Retry the operation.'));
      tx.onerror = () => {};
    });
    try {
      const value = await run(tx);
      await completed;
      return value;
    } catch (error) { abort(); await completed.catch(() => {}); throw error; }
    finally { signal?.removeEventListener('abort', abort); }
  } finally { db.close(); }
}
