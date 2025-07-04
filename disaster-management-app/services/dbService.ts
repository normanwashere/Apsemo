// A simple IndexedDB wrapper service
const DB_NAME = 'dma-offline-db';
const DB_VERSION = 1;
const STORES = {
    residents: 'residents',
    evac_centers: 'evac_centers',
    metadata: 'metadata'
};

let db: IDBDatabase;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject("Error opening IndexedDB.");
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const tempDb = (event.target as IDBOpenDBRequest).result;
            if (!tempDb.objectStoreNames.contains(STORES.residents)) {
                tempDb.createObjectStore(STORES.residents, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(STORES.evac_centers)) {
                tempDb.createObjectStore(STORES.evac_centers, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(STORES.metadata)) {
                tempDb.createObjectStore(STORES.metadata, { keyPath: 'key' });
            }
        };
    });
};

export const cacheData = async (storeName: string, data: any[]) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear(); // Clear old data before caching new data
        data.forEach(item => store.put(item));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(`Error caching data to ${storeName}.`);
    });
};

export const getCachedData = async <T>(storeName: string): Promise<T[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(`Error getting cached data from ${storeName}.`);
    });
};

export const getMetadata = async (key: string) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.metadata, 'readonly');
        const store = transaction.objectStore(STORES.metadata);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(`Error getting metadata for key: ${key}.`);
    });
};

export const setMetadata = async (key: string, value: any) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORES.metadata, 'readwrite');
        const store = transaction.objectStore(STORES.metadata);
        store.put({ key, value });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(`Error setting metadata for key: ${key}.`);
    });
};

export const clearCache = async () => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORES.residents, STORES.evac_centers, STORES.metadata], 'readwrite');
        transaction.objectStore(STORES.residents).clear();
        transaction.objectStore(STORES.evac_centers).clear();
        transaction.objectStore(STORES.metadata).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject('Error clearing cache.');
    });
};
