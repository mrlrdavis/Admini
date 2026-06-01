type StoreName = 'auth' | 'integrations';

function openAdminiDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('admini_browser_state', 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of ['auth', 'integrations'] satisfies StoreName[]) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'key' });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIndexedDbStorage(storeName: StoreName) {
  return {
    async getItem(key: string): Promise<string | null> {
      const db = await openAdminiDb();
      const value = await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const request = tx.objectStore(storeName).get(key);
        request.onsuccess = () => resolve((request.result?.value as string | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return value;
    },
    async setItem(key: string, value: string): Promise<void> {
      const db = await openAdminiDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    async removeItem(key: string): Promise<void> {
      const db = await openAdminiDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }
  };
}
