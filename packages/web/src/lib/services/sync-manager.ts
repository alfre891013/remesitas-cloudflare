/**
 * Sync Manager Service
 * Handles background synchronization of offline data when connectivity is restored
 */

import { browser } from '$app/environment';
import { apiClient } from '$utils/api';
import {
  getPendingRemesas,
  updatePendingRemesa,
  deletePendingRemesa,
  getPendingContactos,
  deletePendingContacto,
  type PendingRemesa,
  type PendingContacto,
} from '$stores/offline-db';
import { toastStore } from '$stores/toast';

// Maximum retry attempts before giving up
const MAX_RETRY_ATTEMPTS = 5;

// Minimum time between sync attempts (in milliseconds)
const MIN_SYNC_INTERVAL = 10000; // 10 seconds

// Track last sync time
let lastSyncTime = 0;

// Track if sync is in progress
let syncInProgress = false;

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  return browser ? navigator.onLine : true;
}

/**
 * Register for background sync if supported
 */
export async function registerBackgroundSync(tag: string): Promise<boolean> {
  if (!browser || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as any).sync.register(tag);
      console.log(`[SyncManager] Registered background sync: ${tag}`);
      return true;
    }
  } catch (error) {
    console.error('[SyncManager] Failed to register background sync:', error);
  }

  return false;
}

/**
 * Start sync manager - listens for online events and messages from service worker
 */
export function initSyncManager(): () => void {
  if (!browser) {
    return () => {};
  }

  // Listen for online event
  const handleOnline = () => {
    console.log('[SyncManager] Connection restored, starting sync...');
    syncAllPending();
  };

  // Listen for messages from service worker
  const handleMessage = (event: MessageEvent) => {
    const { type, tag, status } = event.data || {};

    if (type === 'SYNC_STATUS') {
      console.log(`[SyncManager] Sync status for ${tag}: ${status}`);

      if (status === 'started') {
        syncAllPending();
      }
    }

    if (type === 'NAVIGATE' && event.data.url) {
      // Handle navigation from notification click
      window.location.href = event.data.url;
    }
  };

  window.addEventListener('online', handleOnline);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleMessage);
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  };
}

/**
 * Sync all pending items
 */
export async function syncAllPending(): Promise<{
  remesas: { success: number; failed: number };
  contactos: { success: number; failed: number };
}> {
  // Prevent multiple concurrent syncs
  if (syncInProgress) {
    console.log('[SyncManager] Sync already in progress, skipping...');
    return { remesas: { success: 0, failed: 0 }, contactos: { success: 0, failed: 0 } };
  }

  // Throttle sync attempts
  const now = Date.now();
  if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
    console.log('[SyncManager] Throttling sync, too soon since last attempt');
    return { remesas: { success: 0, failed: 0 }, contactos: { success: 0, failed: 0 } };
  }

  if (!isOnline()) {
    console.log('[SyncManager] Offline, cannot sync');
    return { remesas: { success: 0, failed: 0 }, contactos: { success: 0, failed: 0 } };
  }

  syncInProgress = true;
  lastSyncTime = now;

  console.log('[SyncManager] Starting sync...');

  try {
    const [remesasResult, contactosResult] = await Promise.all([
      syncPendingRemesas(),
      syncPendingContactos(),
    ]);

    const totalSuccess = remesasResult.success + contactosResult.success;
    const totalFailed = remesasResult.failed + contactosResult.failed;

    if (totalSuccess > 0) {
      toastStore.success(`${totalSuccess} elemento${totalSuccess > 1 ? 's' : ''} sincronizado${totalSuccess > 1 ? 's' : ''}`);
    }

    if (totalFailed > 0) {
      toastStore.error(`${totalFailed} elemento${totalFailed > 1 ? 's' : ''} no se pudo${totalFailed > 1 ? 'ieron' : ''} sincronizar`);
    }

    return { remesas: remesasResult, contactos: contactosResult };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Sync pending remesas
 */
async function syncPendingRemesas(): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  try {
    const pendingRemesas = await getPendingRemesas();

    if (pendingRemesas.length === 0) {
      return { success: 0, failed: 0 };
    }

    console.log(`[SyncManager] Syncing ${pendingRemesas.length} pending remesas...`);

    for (const remesa of pendingRemesas) {
      if (remesa.attempts >= MAX_RETRY_ATTEMPTS) {
        console.warn(`[SyncManager] Skipping remesa ${remesa.id}: max retries exceeded`);
        failed++;
        continue;
      }

      try {
        // Update attempt count
        await updatePendingRemesa(remesa.id, {
          attempts: remesa.attempts + 1,
          last_attempt: Date.now(),
        });

        // Try to submit to API
        const response = await apiClient.post('/api/publico/solicitar', remesa.data);

        if (response.success) {
          // Success - remove from pending
          await deletePendingRemesa(remesa.id);
          console.log(`[SyncManager] Remesa ${remesa.id} synced successfully`);
          success++;
        } else {
          // API error - update error message
          await updatePendingRemesa(remesa.id, {
            error: response.message || 'Error desconocido',
          });
          console.warn(`[SyncManager] Remesa ${remesa.id} failed: ${response.message}`);
          failed++;
        }
      } catch (error) {
        console.error(`[SyncManager] Error syncing remesa ${remesa.id}:`, error);
        await updatePendingRemesa(remesa.id, {
          error: String(error),
        });
        failed++;
      }
    }
  } catch (error) {
    console.error('[SyncManager] Error getting pending remesas:', error);
  }

  return { success, failed };
}

/**
 * Sync pending contact messages
 */
async function syncPendingContactos(): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  try {
    const pendingContactos = await getPendingContactos();

    if (pendingContactos.length === 0) {
      return { success: 0, failed: 0 };
    }

    console.log(`[SyncManager] Syncing ${pendingContactos.length} pending contact messages...`);

    for (const contacto of pendingContactos) {
      if (contacto.attempts >= MAX_RETRY_ATTEMPTS) {
        console.warn(`[SyncManager] Skipping contacto ${contacto.id}: max retries exceeded`);
        failed++;
        continue;
      }

      try {
        // Try to submit to API
        const response = await apiClient.post('/api/mensajes/contacto', contacto.data);

        if (response.success) {
          // Success - remove from pending
          await deletePendingContacto(contacto.id);
          console.log(`[SyncManager] Contacto ${contacto.id} synced successfully`);
          success++;
        } else {
          console.warn(`[SyncManager] Contacto ${contacto.id} failed: ${response.message}`);
          failed++;
        }
      } catch (error) {
        console.error(`[SyncManager] Error syncing contacto ${contacto.id}:`, error);
        failed++;
      }
    }
  } catch (error) {
    console.error('[SyncManager] Error getting pending contactos:', error);
  }

  return { success, failed };
}

/**
 * Queue a remesa for offline submission
 */
export async function queueRemesaForSync(data: PendingRemesa['data']): Promise<string> {
  const { addPendingRemesa } = await import('$stores/offline-db');
  const id = await addPendingRemesa(data);

  // Try to register background sync
  await registerBackgroundSync('sync-remesas');

  toastStore.info('Guardado offline. Se enviara cuando haya conexion.');

  return id;
}

/**
 * Queue a contact message for offline submission
 */
export async function queueContactoForSync(data: PendingContacto['data']): Promise<string> {
  const { addPendingContacto } = await import('$stores/offline-db');
  const id = await addPendingContacto(data);

  // Try to register background sync
  await registerBackgroundSync('sync-contacto');

  toastStore.info('Mensaje guardado. Se enviara cuando haya conexion.');

  return id;
}

/**
 * Check if there are pending items to sync
 */
export async function hasPendingSync(): Promise<boolean> {
  try {
    const [remesas, contactos] = await Promise.all([
      getPendingRemesas(),
      getPendingContactos(),
    ]);

    return remesas.length > 0 || contactos.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get count of pending items
 */
export async function getPendingSyncCount(): Promise<number> {
  try {
    const [remesas, contactos] = await Promise.all([
      getPendingRemesas(),
      getPendingContactos(),
    ]);

    return remesas.length + contactos.length;
  } catch (error) {
    return 0;
  }
}
