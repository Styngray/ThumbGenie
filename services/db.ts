const DB_NAME = 'ThumbGenieDB';
const DB_VERSION = 1;
const STORE_DATA = 'project_data';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_DATA)) {
        db.createObjectStore(STORE_DATA, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveProjectDataToDB = async (id: string, data: any) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_DATA], 'readwrite');
    const store = transaction.objectStore(STORE_DATA);
    // Store object with ID and all data properties
    const request = store.put({ id, ...data });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getProjectDataFromDB = async (id: string) => {
  const db = await initDB();
  return new Promise<any>((resolve, reject) => {
    const transaction = db.transaction([STORE_DATA], 'readonly');
    const store = transaction.objectStore(STORE_DATA);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteProjectDataFromDB = async (id: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_DATA], 'readwrite');
    const store = transaction.objectStore(STORE_DATA);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
