<script lang="ts">
  import { browser } from '$app/environment';
  import { getPendingRemesasCount, getOfflineStats } from '$stores/offline-db';

  let isOnline = $state(browser ? navigator.onLine : true);
  let pendingCount = $state(0);
  let showDetails = $state(false);
  let offlineStats = $state<{
    pendingRemesas: number;
    pendingContactos: number;
    cachedTasas: number;
    cachedProvincias: number;
  } | null>(null);

  // Monitor online/offline status
  $effect(() => {
    if (!browser) return;

    const handleOnline = () => {
      isOnline = true;
      // Trigger sync when coming back online
      triggerSync();
    };

    const handleOffline = () => {
      isOnline = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    isOnline = navigator.onLine;
    loadPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  // Load pending items count periodically
  $effect(() => {
    if (!browser) return;

    const interval = setInterval(loadPendingCount, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  });

  async function loadPendingCount() {
    try {
      pendingCount = await getPendingRemesasCount();
    } catch (e) {
      console.error('Error loading pending count:', e);
    }
  }

  async function loadStats() {
    try {
      offlineStats = await getOfflineStats();
    } catch (e) {
      console.error('Error loading offline stats:', e);
    }
  }

  function triggerSync() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        if ('sync' in registration) {
          (registration as any).sync.register('sync-remesas');
          (registration as any).sync.register('sync-contacto');
        }
      });
    }
  }

  function toggleDetails() {
    showDetails = !showDetails;
    if (showDetails) {
      loadStats();
    }
  }
</script>

<!-- Offline Banner -->
{#if !isOnline}
  <div class="offline-banner">
    <div class="offline-banner-content">
      <svg class="offline-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
      </svg>
      <span class="offline-text">Sin conexion a internet</span>
      {#if pendingCount > 0}
        <span class="pending-badge">{pendingCount} pendiente{pendingCount > 1 ? 's' : ''}</span>
      {/if}
    </div>
  </div>
{/if}

<!-- Pending Items Indicator (shown when online but has pending items) -->
{#if isOnline && pendingCount > 0}
  <button class="pending-indicator" onclick={toggleDetails}>
    <svg class="sync-icon {showDetails ? '' : 'animate-spin-slow'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    <span class="pending-count">{pendingCount}</span>
  </button>
{/if}

<!-- Details Modal -->
{#if showDetails && offlineStats}
  <div class="details-overlay" onclick={() => showDetails = false} role="presentation">
    <div class="details-modal" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="details-header">
        <h3>Estado de Sincronizacion</h3>
        <button class="close-btn" onclick={() => showDetails = false}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="details-content">
        <div class="status-row">
          <span class="status-label">Estado</span>
          <span class="status-value {isOnline ? 'online' : 'offline'}">
            {isOnline ? 'Conectado' : 'Sin conexion'}
          </span>
        </div>

        <div class="divider"></div>

        <div class="stats-section">
          <h4>Pendientes de sincronizar</h4>
          <div class="stat-item">
            <span>Remesas</span>
            <span class="stat-count">{offlineStats.pendingRemesas}</span>
          </div>
          <div class="stat-item">
            <span>Mensajes</span>
            <span class="stat-count">{offlineStats.pendingContactos}</span>
          </div>
        </div>

        <div class="stats-section">
          <h4>Datos en cache</h4>
          <div class="stat-item">
            <span>Tasas de cambio</span>
            <span class="stat-count">{offlineStats.cachedTasas}</span>
          </div>
          <div class="stat-item">
            <span>Provincias</span>
            <span class="stat-count">{offlineStats.cachedProvincias}</span>
          </div>
        </div>
      </div>

      {#if isOnline && (offlineStats.pendingRemesas > 0 || offlineStats.pendingContactos > 0)}
        <div class="details-footer">
          <button class="sync-btn" onclick={triggerSync}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sincronizar ahora
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Offline Banner */
  .offline-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #dc2626 0%, #b91c1c 100%);
    color: white;
    padding: 8px 16px;
    z-index: 9999;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .offline-banner-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .offline-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .offline-text {
    font-weight: 500;
  }

  .pending-badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  /* Pending Indicator Button */
  .pending-indicator {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 6px;
    background: #2563eb;
    color: white;
    border: none;
    padding: 10px 14px;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    transition: all 0.2s ease;
    z-index: 100;
  }

  .pending-indicator:hover {
    background: #1d4ed8;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
  }

  .sync-icon {
    width: 18px;
    height: 18px;
  }

  .animate-spin-slow {
    animation: spin 3s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .pending-count {
    min-width: 20px;
  }

  /* Details Modal */
  .details-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 9999;
    padding: 16px;
  }

  @media (min-width: 640px) {
    .details-overlay {
      align-items: center;
    }
  }

  .details-modal {
    background: white;
    border-radius: 16px;
    width: 100%;
    max-width: 360px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }

  .details-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .details-header h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #6b7280;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: #1f2937;
  }

  .close-btn svg {
    width: 20px;
    height: 20px;
  }

  .details-content {
    padding: 16px 20px;
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .status-label {
    color: #6b7280;
    font-size: 14px;
  }

  .status-value {
    font-weight: 600;
    font-size: 14px;
    padding: 4px 10px;
    border-radius: 12px;
  }

  .status-value.online {
    background: #dcfce7;
    color: #16a34a;
  }

  .status-value.offline {
    background: #fee2e2;
    color: #dc2626;
  }

  .divider {
    height: 1px;
    background: #e5e7eb;
    margin: 12px 0;
  }

  .stats-section {
    margin-bottom: 16px;
  }

  .stats-section:last-child {
    margin-bottom: 0;
  }

  .stats-section h4 {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 8px;
  }

  .stat-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
    color: #374151;
  }

  .stat-count {
    font-weight: 600;
    color: #1f2937;
    background: #f3f4f6;
    padding: 2px 10px;
    border-radius: 8px;
  }

  .details-footer {
    padding: 12px 20px 16px;
    border-top: 1px solid #e5e7eb;
  }

  .sync-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    background: #2563eb;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .sync-btn:hover {
    background: #1d4ed8;
  }

  .sync-btn svg {
    width: 18px;
    height: 18px;
  }
</style>
