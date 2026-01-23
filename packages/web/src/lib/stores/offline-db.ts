/**
 * IndexedDB store for offline-first data persistence
 * Uses the idb library for a cleaner Promise-based API
 */

const DB_NAME = 'remesitas-offline';
const DB_VERSION = 1;

// Store names
const STORES = {
  PENDING_REMESAS: 'pending-remesas',
  PENDING_CONTACTOS: 'pending-contactos',
  CACHE_TASAS: 'cache-tasas',
  CACHE_PROVINCIAS: 'cache-provincias',
  CACHE_BENEFICIARIOS: 'cache-beneficiarios',
  CACHE_REMITENTES: 'cache-remitentes',
  SYNC_QUEUE: 'sync-queue',
} as const;

// Interfaces
export interface PendingRemesa {
  id: string;
  data: {
    remitente_nombre: string;
    remitente_telefono: string;
    beneficiario_nombre: string;
    beneficiario_telefono: string;
    beneficiario_direccion: string;
    monto_envio: number;
    tipo_entrega: 'MN' | 'USD';
  };
  created_at: number;
  attempts: number;
  last_attempt?: number;
  error?: string;
}

export interface PendingContacto {
  id: string;
  data: {
    nombre: string;
    email: string;
    telefono?: string;
    asunto: string;
    mensaje: string;
  };
  created_at: number;
  attempts: number;
  last_attempt?: number;
  error?: string;
}

export interface CachedTasa {
  id: string;
  moneda: string;
  tasa: number;
  updated_at: number;
}

export interface CachedProvincia {
  id: number;
  nombre: string;
  codigo: string;
  municipios?: Array<{ id: number; nombre: string }>;
  cached_at: number;
}

export interface SyncQueueItem {
  id: string;
  type: 'remesa' | 'contacto' | 'other';
  action: 'create' | 'update' | 'delete';
  data: unknown;
  created_at: number;
  synced: boolean;
  synced_at?: number;
}

// Database instance
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize and open the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineDB] Error opening database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('[OfflineDB] Database opened successfully');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      console.log('[OfflineDB] Upgrading database...');
      const db = (event.target as IDBOpenDBRequest).result;

      // Pending remesas store
      if (!db.objectStoreNames.contains(STORES.PENDING_REMESAS)) {
        const remesasStore = db.createObjectStore(STORES.PENDING_REMESAS, { keyPath: 'id' });
        remesasStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // Pending contactos store
      if (!db.objectStoreNames.contains(STORES.PENDING_CONTACTOS)) {
        const contactosStore = db.createObjectStore(STORES.PENDING_CONTACTOS, { keyPath: 'id' });
        contactosStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // Cache tasas store
      if (!db.objectStoreNames.contains(STORES.CACHE_TASAS)) {
        db.createObjectStore(STORES.CACHE_TASAS, { keyPath: 'id' });
      }

      // Cache provincias store
      if (!db.objectStoreNames.contains(STORES.CACHE_PROVINCIAS)) {
        db.createObjectStore(STORES.CACHE_PROVINCIAS, { keyPath: 'id' });
      }

      // Cache beneficiarios store
      if (!db.objectStoreNames.contains(STORES.CACHE_BENEFICIARIOS)) {
        const beneficiariosStore = db.createObjectStore(STORES.CACHE_BENEFICIARIOS, { keyPath: 'id', autoIncrement: true });
        beneficiariosStore.createIndex('telefono', 'telefono', { unique: false });
        beneficiariosStore.createIndex('nombre', 'nombre', { unique: false });
      }

      // Cache remitentes store
      if (!db.objectStoreNames.contains(STORES.CACHE_REMITENTES)) {
        const remitentesStore = db.createObjectStore(STORES.CACHE_REMITENTES, { keyPath: 'id', autoIncrement: true });
        remitentesStore.createIndex('telefono', 'telefono', { unique: false });
        remitentesStore.createIndex('nombre', 'nombre', { unique: false });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        syncStore.createIndex('synced', 'synced', { unique: false });
        syncStore.createIndex('type', 'type', { unique: false });
      }

      console.log('[OfflineDB] Database upgrade complete');
    };
  });

  return dbPromise;
}

/**
 * Generate a unique ID for offline items
 */
function generateId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============ Pending Remesas Operations ============

export async function addPendingRemesa(data: PendingRemesa['data']): Promise<string> {
  const db = await openDB();
  const id = generateId();
  const item: PendingRemesa = {
    id,
    data,
    created_at: Date.now(),
    attempts: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_REMESAS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_REMESAS);
    const request = store.add(item);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingRemesas(): Promise<PendingRemesa[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_REMESAS, 'readonly');
    const store = tx.objectStore(STORES.PENDING_REMESAS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function updatePendingRemesa(id: string, updates: Partial<PendingRemesa>): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_REMESAS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_REMESAS);

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        const updated = { ...getRequest.result, ...updates };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        reject(new Error('Remesa not found'));
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function deletePendingRemesa(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_REMESAS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_REMESAS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingRemesasCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_REMESAS, 'readonly');
    const store = tx.objectStore(STORES.PENDING_REMESAS);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============ Pending Contactos Operations ============

export async function addPendingContacto(data: PendingContacto['data']): Promise<string> {
  const db = await openDB();
  const id = generateId();
  const item: PendingContacto = {
    id,
    data,
    created_at: Date.now(),
    attempts: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_CONTACTOS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_CONTACTOS);
    const request = store.add(item);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingContactos(): Promise<PendingContacto[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_CONTACTOS, 'readonly');
    const store = tx.objectStore(STORES.PENDING_CONTACTOS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePendingContacto(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_CONTACTOS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_CONTACTOS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============ Cache Operations ============

export async function cacheTasas(tasas: CachedTasa[]): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CACHE_TASAS, 'readwrite');
    const store = tx.objectStore(STORES.CACHE_TASAS);

    // Clear existing and add new
    store.clear();
    tasas.forEach((tasa) => {
      store.add({ ...tasa, updated_at: Date.now() });
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedTasas(): Promise<CachedTasa[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CACHE_TASAS, 'readonly');
    const store = tx.objectStore(STORES.CACHE_TASAS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheProvincias(provincias: CachedProvincia[]): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CACHE_PROVINCIAS, 'readwrite');
    const store = tx.objectStore(STORES.CACHE_PROVINCIAS);

    // Clear existing and add new
    store.clear();
    provincias.forEach((prov) => {
      store.add({ ...prov, cached_at: Date.now() });
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedProvincias(): Promise<CachedProvincia[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CACHE_PROVINCIAS, 'readonly');
    const store = tx.objectStore(STORES.CACHE_PROVINCIAS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ============ Utility Functions ============

export async function clearAllOfflineData(): Promise<void> {
  const db = await openDB();
  const storeNames = Object.values(STORES);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');

    storeNames.forEach((storeName) => {
      tx.objectStore(storeName).clear();
    });

    tx.oncomplete = () => {
      console.log('[OfflineDB] All offline data cleared');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineStats(): Promise<{
  pendingRemesas: number;
  pendingContactos: number;
  cachedTasas: number;
  cachedProvincias: number;
}> {
  const db = await openDB();

  const counts = await Promise.all([
    new Promise<number>((resolve) => {
      const tx = db.transaction(STORES.PENDING_REMESAS, 'readonly');
      const req = tx.objectStore(STORES.PENDING_REMESAS).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    }),
    new Promise<number>((resolve) => {
      const tx = db.transaction(STORES.PENDING_CONTACTOS, 'readonly');
      const req = tx.objectStore(STORES.PENDING_CONTACTOS).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    }),
    new Promise<number>((resolve) => {
      const tx = db.transaction(STORES.CACHE_TASAS, 'readonly');
      const req = tx.objectStore(STORES.CACHE_TASAS).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    }),
    new Promise<number>((resolve) => {
      const tx = db.transaction(STORES.CACHE_PROVINCIAS, 'readonly');
      const req = tx.objectStore(STORES.CACHE_PROVINCIAS).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    }),
  ]);

  return {
    pendingRemesas: counts[0],
    pendingContactos: counts[1],
    cachedTasas: counts[2],
    cachedProvincias: counts[3],
  };
}

/**
 * Check if IndexedDB is supported
 */
export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Request persistent storage
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`[OfflineDB] Persistent storage: ${isPersisted ? 'granted' : 'denied'}`);
    return isPersisted;
  }
  return false;
}

/**
 * Get storage estimate
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return null;
}
