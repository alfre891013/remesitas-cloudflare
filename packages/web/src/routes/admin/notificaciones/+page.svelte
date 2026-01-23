<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$utils/api';

  interface Notification {
    id: number;
    usuario_id: number | null;
    remesa_id: number | null;
    canal: 'sms' | 'whatsapp' | 'push' | 'email';
    destinatario: string;
    mensaje: string;
    estado: 'pendiente' | 'enviando' | 'enviado' | 'fallido' | 'entregado';
    error_mensaje: string | null;
    provider_message_id: string | null;
    fecha_creacion: string;
    fecha_envio: string | null;
    intentos: number;
    max_intentos: number;
  }

  interface NotificationType {
    id: number;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    plantilla_sms: string | null;
    plantilla_whatsapp: string | null;
    plantilla_email_asunto: string | null;
    plantilla_email_cuerpo: string | null;
    plantilla_push_titulo: string | null;
    plantilla_push_cuerpo: string | null;
    activo: boolean;
  }

  interface Stats {
    total: number;
    byStatus: Record<string, number>;
    byChannel: Record<string, number>;
    recentFailures: number;
    today: { total: number; success: number; rate: string };
    pendingRetry: number;
  }

  // State
  let notifications = $state<Notification[]>([]);
  let stats = $state<Stats | null>(null);
  let notificationTypes = $state<NotificationType[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Pagination
  let page = $state(1);
  let limit = $state(20);
  let total = $state(0);
  let totalPages = $state(1);

  // Filters
  let filterEstado = $state<string>('');
  let filterCanal = $state<string>('');
  let filterDesde = $state('');
  let filterHasta = $state('');

  // Selected for bulk retry
  let selectedIds = $state<number[]>([]);
  let selectAll = $state(false);

  // Modals
  let showDetailModal = $state(false);
  let showTemplateModal = $state(false);
  let showTestModal = $state(false);
  let selectedNotification = $state<Notification | null>(null);
  let editingType = $state<NotificationType | null>(null);

  // Test notification form
  let testChannel = $state<'sms' | 'whatsapp' | 'push' | 'email'>('sms');
  let testRecipient = $state('');
  let testMessage = $state('');
  let isSendingTest = $state(false);

  // Processing
  let isProcessingQueue = $state(false);
  let isRetrying = $state(false);

  onMount(() => {
    loadData();
  });

  async function loadData() {
    isLoading = true;
    error = null;

    try {
      await Promise.all([loadNotifications(), loadStats(), loadTypes()]);
    } catch (e) {
      error = 'Error al cargar datos';
    } finally {
      isLoading = false;
    }
  }

  async function loadNotifications() {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (filterEstado) params.set('estado', filterEstado);
    if (filterCanal) params.set('canal', filterCanal);
    if (filterDesde) params.set('desde', filterDesde);
    if (filterHasta) params.set('hasta', filterHasta);

    const response = await apiClient.get<{
      data: {
        notifications: Notification[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    }>(`/api/notificaciones?${params.toString()}`);

    if (response.success && response.data) {
      notifications = response.data.notifications;
      total = response.data.pagination.total;
      totalPages = response.data.pagination.totalPages;
    }
  }

  async function loadStats() {
    const response = await apiClient.get<{ data: Stats }>('/api/notificaciones/stats');
    if (response.success && response.data) {
      stats = response.data;
    }
  }

  async function loadTypes() {
    const response = await apiClient.get<{ data: NotificationType[] }>('/api/notificaciones/tipos');
    if (response.success && response.data) {
      notificationTypes = response.data;
    }
  }

  function applyFilters() {
    page = 1;
    selectedIds = [];
    selectAll = false;
    loadNotifications();
  }

  function clearFilters() {
    filterEstado = '';
    filterCanal = '';
    filterDesde = '';
    filterHasta = '';
    applyFilters();
  }

  function toggleSelectAll() {
    selectAll = !selectAll;
    if (selectAll) {
      selectedIds = notifications.filter((n) => n.estado === 'fallido').map((n) => n.id);
    } else {
      selectedIds = [];
    }
  }

  function toggleSelect(id: number) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter((i) => i !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
  }

  async function retrySelected() {
    if (selectedIds.length === 0) return;

    isRetrying = true;
    try {
      const response = await apiClient.post('/api/notificaciones/retry', {
        notification_ids: selectedIds,
      });

      if (response.success) {
        selectedIds = [];
        selectAll = false;
        await loadData();
      } else {
        error = response.message || 'Error al reintentar';
      }
    } catch (e) {
      error = 'Error al reintentar notificaciones';
    } finally {
      isRetrying = false;
    }
  }

  async function processQueue() {
    isProcessingQueue = true;
    try {
      const response = await apiClient.post<{ data: { processed: number; succeeded: number; failed: number } }>(
        '/api/notificaciones/process-queue'
      );

      if (response.success) {
        await loadData();
      } else {
        error = response.message || 'Error al procesar cola';
      }
    } catch (e) {
      error = 'Error al procesar cola';
    } finally {
      isProcessingQueue = false;
    }
  }

  async function sendTestNotification() {
    if (!testRecipient || !testMessage) return;

    isSendingTest = true;
    try {
      const response = await apiClient.post('/api/notificaciones/test', {
        channel: testChannel,
        recipient: testRecipient,
        message: testMessage,
      });

      if (response.success) {
        showTestModal = false;
        testRecipient = '';
        testMessage = '';
        await loadData();
      } else {
        error = response.message || 'Error al enviar notificacion';
      }
    } catch (e) {
      error = 'Error al enviar notificacion';
    } finally {
      isSendingTest = false;
    }
  }

  async function updateTemplate() {
    if (!editingType) return;

    try {
      const response = await apiClient.put(`/api/notificaciones/tipos/${editingType.id}`, {
        plantilla_sms: editingType.plantilla_sms,
        plantilla_whatsapp: editingType.plantilla_whatsapp,
        plantilla_email_asunto: editingType.plantilla_email_asunto,
        plantilla_email_cuerpo: editingType.plantilla_email_cuerpo,
        plantilla_push_titulo: editingType.plantilla_push_titulo,
        plantilla_push_cuerpo: editingType.plantilla_push_cuerpo,
        activo: editingType.activo,
      });

      if (response.success) {
        showTemplateModal = false;
        editingType = null;
        await loadTypes();
      } else {
        error = response.message || 'Error al actualizar plantilla';
      }
    } catch (e) {
      error = 'Error al actualizar plantilla';
    }
  }

  function openDetail(notification: Notification) {
    selectedNotification = notification;
    showDetailModal = true;
  }

  function openTemplateEditor(type: NotificationType) {
    editingType = { ...type };
    showTemplateModal = true;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusColor(estado: string): string {
    switch (estado) {
      case 'enviado':
      case 'entregado':
        return 'bg-green-100 text-green-800';
      case 'fallido':
        return 'bg-red-100 text-red-800';
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'enviando':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getChannelIcon(canal: string): string {
    switch (canal) {
      case 'sms':
        return 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
      case 'whatsapp':
        return 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';
      case 'push':
        return 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';
      case 'email':
        return 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }
</script>

<svelte:head>
  <title>Notificaciones - Admin</title>
</svelte:head>

<div class="notifications-page">
  <header class="page-header">
    <div class="header-content">
      <h1>Centro de Notificaciones</h1>
      <p>Gestiona las notificaciones SMS, WhatsApp, Push y Email</p>
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" onclick={() => (showTestModal = true)}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
        Enviar Prueba
      </button>
      <button class="btn btn-primary" onclick={processQueue} disabled={isProcessingQueue}>
        {#if isProcessingQueue}
          <span class="spinner"></span>
          Procesando...
        {:else}
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Procesar Cola
        {/if}
      </button>
    </div>
  </header>

  {#if isLoading}
    <div class="loading-state">
      <div class="spinner-large"></div>
      <p>Cargando notificaciones...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p>{error}</p>
      <button class="btn btn-primary" onclick={loadData}>Reintentar</button>
    </div>
  {:else}
    <!-- Stats Cards -->
    {#if stats}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Total Enviadas</span>
            <span class="stat-value">{stats.total.toLocaleString()}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon green">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Hoy Exitosas</span>
            <span class="stat-value">{stats.today.success} <span class="stat-sub">({stats.today.rate}%)</span></span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon red">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Fallos Recientes</span>
            <span class="stat-value">{stats.recentFailures}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon yellow">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Pendientes Reintento</span>
            <span class="stat-value">{stats.pendingRetry}</span>
          </div>
        </div>
      </div>

      <!-- Channel Breakdown -->
      <div class="channel-breakdown">
        <h3>Por Canal</h3>
        <div class="channel-bars">
          {#each Object.entries(stats.byChannel) as [channel, count]}
            <div class="channel-bar">
              <div class="channel-info">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getChannelIcon(channel)} />
                </svg>
                <span class="channel-name">{channel.toUpperCase()}</span>
                <span class="channel-count">{count.toLocaleString()}</span>
              </div>
              <div class="bar-container">
                <div
                  class="bar-fill"
                  style="width: {stats.total > 0 ? (count / stats.total) * 100 : 0}%"
                ></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Filters -->
    <div class="filters-section">
      <div class="filters-row">
        <div class="filter-group">
          <label for="filterEstado">Estado</label>
          <select id="filterEstado" bind:value={filterEstado} onchange={applyFilters}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="enviando">Enviando</option>
            <option value="enviado">Enviado</option>
            <option value="fallido">Fallido</option>
            <option value="entregado">Entregado</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="filterCanal">Canal</label>
          <select id="filterCanal" bind:value={filterCanal} onchange={applyFilters}>
            <option value="">Todos</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="push">Push</option>
            <option value="email">Email</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="filterDesde">Desde</label>
          <input type="date" id="filterDesde" bind:value={filterDesde} onchange={applyFilters} />
        </div>

        <div class="filter-group">
          <label for="filterHasta">Hasta</label>
          <input type="date" id="filterHasta" bind:value={filterHasta} onchange={applyFilters} />
        </div>

        <button class="btn btn-text" onclick={clearFilters}>Limpiar filtros</button>
      </div>

      {#if selectedIds.length > 0}
        <div class="bulk-actions">
          <span>{selectedIds.length} seleccionadas</span>
          <button class="btn btn-secondary" onclick={retrySelected} disabled={isRetrying}>
            {#if isRetrying}
              <span class="spinner"></span>
            {:else}
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            {/if}
            Reintentar Seleccionadas
          </button>
        </div>
      {/if}
    </div>

    <!-- Notifications Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th class="checkbox-col">
              <input
                type="checkbox"
                checked={selectAll}
                onchange={toggleSelectAll}
                aria-label="Seleccionar todas"
              />
            </th>
            <th>Canal</th>
            <th>Destinatario</th>
            <th>Mensaje</th>
            <th>Estado</th>
            <th>Intentos</th>
            <th>Fecha</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {#each notifications as notification}
            <tr>
              <td class="checkbox-col">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(notification.id)}
                  onchange={() => toggleSelect(notification.id)}
                  disabled={notification.estado !== 'fallido'}
                  aria-label="Seleccionar notificacion"
                />
              </td>
              <td>
                <div class="channel-badge">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getChannelIcon(notification.canal)} />
                  </svg>
                  {notification.canal.toUpperCase()}
                </div>
              </td>
              <td class="destinatario-col">{notification.destinatario}</td>
              <td class="mensaje-col">
                <span class="mensaje-preview" title={notification.mensaje}>
                  {notification.mensaje.substring(0, 50)}{notification.mensaje.length > 50 ? '...' : ''}
                </span>
              </td>
              <td>
                <span class="status-badge {getStatusColor(notification.estado)}">
                  {notification.estado}
                </span>
              </td>
              <td class="intentos-col">
                {notification.intentos}/{notification.max_intentos}
              </td>
              <td class="fecha-col">{formatDate(notification.fecha_creacion)}</td>
              <td>
                <button class="btn-icon" onclick={() => openDetail(notification)} title="Ver detalles">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="8" class="empty-state">
                <p>No hay notificaciones que mostrar</p>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="pagination">
        <button
          class="btn btn-secondary"
          disabled={page === 1}
          onclick={() => { page--; loadNotifications(); }}
        >
          Anterior
        </button>
        <span class="page-info">Pagina {page} de {totalPages}</span>
        <button
          class="btn btn-secondary"
          disabled={page >= totalPages}
          onclick={() => { page++; loadNotifications(); }}
        >
          Siguiente
        </button>
      </div>
    {/if}

    <!-- Notification Types Section -->
    <div class="types-section">
      <h2>Plantillas de Notificacion</h2>
      <div class="types-grid">
        {#each notificationTypes as tipo}
          <div class="type-card">
            <div class="type-header">
              <h3>{tipo.nombre}</h3>
              <span class="type-code">{tipo.codigo}</span>
            </div>
            <div class="type-channels">
              {#if tipo.plantilla_sms}
                <span class="channel-tag sms">SMS</span>
              {/if}
              {#if tipo.plantilla_whatsapp}
                <span class="channel-tag whatsapp">WhatsApp</span>
              {/if}
              {#if tipo.plantilla_push_titulo}
                <span class="channel-tag push">Push</span>
              {/if}
              {#if tipo.plantilla_email_asunto}
                <span class="channel-tag email">Email</span>
              {/if}
            </div>
            <button class="btn btn-text" onclick={() => openTemplateEditor(tipo)}>
              Editar Plantillas
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Detail Modal -->
{#if showDetailModal && selectedNotification}
  <div class="modal-overlay" onclick={() => (showDetailModal = false)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Escape' && (showDetailModal = false)}>
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2>Detalles de Notificacion</h2>
        <button class="modal-close" onclick={() => (showDetailModal = false)} aria-label="Cerrar">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">ID</span>
            <span class="detail-value">#{selectedNotification.id}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Canal</span>
            <span class="detail-value">{selectedNotification.canal.toUpperCase()}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Estado</span>
            <span class="status-badge {getStatusColor(selectedNotification.estado)}">{selectedNotification.estado}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Intentos</span>
            <span class="detail-value">{selectedNotification.intentos}/{selectedNotification.max_intentos}</span>
          </div>
          <div class="detail-item full">
            <span class="detail-label">Destinatario</span>
            <span class="detail-value">{selectedNotification.destinatario}</span>
          </div>
          <div class="detail-item full">
            <span class="detail-label">Mensaje</span>
            <p class="detail-message">{selectedNotification.mensaje}</p>
          </div>
          {#if selectedNotification.error_mensaje}
            <div class="detail-item full error">
              <span class="detail-label">Error</span>
              <p class="detail-error">{selectedNotification.error_mensaje}</p>
            </div>
          {/if}
          <div class="detail-item">
            <span class="detail-label">Fecha Creacion</span>
            <span class="detail-value">{formatDate(selectedNotification.fecha_creacion)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Fecha Envio</span>
            <span class="detail-value">{formatDate(selectedNotification.fecha_envio)}</span>
          </div>
          {#if selectedNotification.provider_message_id}
            <div class="detail-item full">
              <span class="detail-label">ID Proveedor</span>
              <span class="detail-value mono">{selectedNotification.provider_message_id}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Template Editor Modal -->
{#if showTemplateModal && editingType}
  <div class="modal-overlay" onclick={() => (showTemplateModal = false)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Escape' && (showTemplateModal = false)}>
    <div class="modal modal-large" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2>Editar Plantilla: {editingType.nombre}</h2>
        <button class="modal-close" onclick={() => (showTemplateModal = false)} aria-label="Cerrar">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="template-help">
          <p>Variables disponibles: <code>{'{codigo}'}</code>, <code>{'{monto_envio}'}</code>, <code>{'{monto_entrega}'}</code>, <code>{'{beneficiario_nombre}'}</code>, <code>{'{remitente_nombre}'}</code>, <code>{'{url_rastreo}'}</code></p>
        </div>

        <div class="form-group">
          <label for="plantillaSms">Plantilla SMS</label>
          <textarea
            id="plantillaSms"
            bind:value={editingType.plantilla_sms}
            rows="3"
            placeholder="Ingresa la plantilla para SMS..."
          ></textarea>
        </div>

        <div class="form-group">
          <label for="plantillaWhatsapp">Plantilla WhatsApp</label>
          <textarea
            id="plantillaWhatsapp"
            bind:value={editingType.plantilla_whatsapp}
            rows="3"
            placeholder="Ingresa la plantilla para WhatsApp (soporta *negrita*)..."
          ></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="plantillaPushTitulo">Titulo Push</label>
            <input
              type="text"
              id="plantillaPushTitulo"
              bind:value={editingType.plantilla_push_titulo}
              placeholder="Titulo de la notificacion push"
            />
          </div>
          <div class="form-group">
            <label for="plantillaPushCuerpo">Cuerpo Push</label>
            <input
              type="text"
              id="plantillaPushCuerpo"
              bind:value={editingType.plantilla_push_cuerpo}
              placeholder="Cuerpo de la notificacion push"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="plantillaEmailAsunto">Asunto Email</label>
          <input
            type="text"
            id="plantillaEmailAsunto"
            bind:value={editingType.plantilla_email_asunto}
            placeholder="Asunto del correo electronico"
          />
        </div>

        <div class="form-group">
          <label for="plantillaEmailCuerpo">Cuerpo Email</label>
          <textarea
            id="plantillaEmailCuerpo"
            bind:value={editingType.plantilla_email_cuerpo}
            rows="5"
            placeholder="Cuerpo del correo electronico..."
          ></textarea>
        </div>

        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" bind:checked={editingType.activo} />
            Plantilla activa
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => (showTemplateModal = false)}>Cancelar</button>
        <button class="btn btn-primary" onclick={updateTemplate}>Guardar Cambios</button>
      </div>
    </div>
  </div>
{/if}

<!-- Test Notification Modal -->
{#if showTestModal}
  <div class="modal-overlay" onclick={() => (showTestModal = false)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Escape' && (showTestModal = false)}>
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2>Enviar Notificacion de Prueba</h2>
        <button class="modal-close" onclick={() => (showTestModal = false)} aria-label="Cerrar">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="testChannel">Canal</label>
          <select id="testChannel" bind:value={testChannel}>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="push">Push</option>
            <option value="email">Email</option>
          </select>
        </div>

        <div class="form-group">
          <label for="testRecipient">
            {testChannel === 'email' ? 'Email' : testChannel === 'push' ? 'Usuario ID' : 'Telefono'}
          </label>
          <input
            type={testChannel === 'email' ? 'email' : 'text'}
            id="testRecipient"
            bind:value={testRecipient}
            placeholder={testChannel === 'email' ? 'correo@ejemplo.com' : testChannel === 'push' ? 'ID de usuario' : '+1234567890'}
          />
        </div>

        <div class="form-group">
          <label for="testMessage">Mensaje</label>
          <textarea
            id="testMessage"
            bind:value={testMessage}
            rows="4"
            placeholder="Escribe el mensaje de prueba..."
          ></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => (showTestModal = false)}>Cancelar</button>
        <button
          class="btn btn-primary"
          onclick={sendTestNotification}
          disabled={isSendingTest || !testRecipient || !testMessage}
        >
          {#if isSendingTest}
            <span class="spinner"></span>
            Enviando...
          {:else}
            Enviar Prueba
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .notifications-page {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
    gap: 16px;
    flex-wrap: wrap;
  }

  .header-content h1 {
    font-size: 28px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0 0 4px 0;
  }

  .header-content p {
    color: #6b7280;
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    margin-bottom: 32px;
  }

  .stat-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .stat-icon svg {
    width: 24px;
    height: 24px;
  }

  .stat-icon.blue { background: #dbeafe; color: #2563eb; }
  .stat-icon.green { background: #dcfce7; color: #16a34a; }
  .stat-icon.red { background: #fee2e2; color: #dc2626; }
  .stat-icon.yellow { background: #fef3c7; color: #d97706; }

  .stat-content {
    display: flex;
    flex-direction: column;
  }

  .stat-label {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .stat-sub {
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
  }

  /* Channel Breakdown */
  .channel-breakdown {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 32px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .channel-breakdown h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0 0 16px 0;
  }

  .channel-bars {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .channel-bar {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .channel-info svg {
    width: 18px;
    height: 18px;
    color: #6b7280;
  }

  .channel-name {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    min-width: 80px;
  }

  .channel-count {
    font-size: 13px;
    color: #6b7280;
    margin-left: auto;
  }

  .bar-container {
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  /* Filters */
  .filters-section {
    background: white;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .filters-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-group label {
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
  }

  .filter-group select,
  .filter-group input {
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    min-width: 140px;
  }

  .bulk-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
  }

  .bulk-actions span {
    font-size: 14px;
    color: #6b7280;
  }

  /* Table */
  .table-container {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table th,
  .data-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid #e5e7eb;
  }

  .data-table th {
    background: #f9fafb;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .checkbox-col {
    width: 40px;
    text-align: center;
  }

  .channel-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    color: #374151;
  }

  .channel-badge svg {
    width: 16px;
    height: 16px;
  }

  .mensaje-col {
    max-width: 200px;
  }

  .mensaje-preview {
    font-size: 13px;
    color: #6b7280;
  }

  .destinatario-col {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .intentos-col,
  .fecha-col {
    white-space: nowrap;
    font-size: 13px;
    color: #6b7280;
  }

  .status-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
    text-transform: capitalize;
  }

  .empty-state {
    text-align: center;
    padding: 48px !important;
    color: #6b7280;
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
  }

  .page-info {
    font-size: 14px;
    color: #6b7280;
  }

  /* Types Section */
  .types-section {
    margin-top: 48px;
  }

  .types-section h2 {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0 0 20px 0;
  }

  .types-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .type-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .type-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .type-header h3 {
    font-size: 15px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0;
  }

  .type-code {
    font-size: 11px;
    font-weight: 500;
    color: #6b7280;
    background: #f3f4f6;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .type-channels {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .channel-tag {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .channel-tag.sms { background: #dbeafe; color: #2563eb; }
  .channel-tag.whatsapp { background: #dcfce7; color: #16a34a; }
  .channel-tag.push { background: #fef3c7; color: #d97706; }
  .channel-tag.email { background: #f3e8ff; color: #9333ea; }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn svg {
    width: 18px;
    height: 18px;
  }

  .btn-primary {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26, 26, 46, 0.2);
  }

  .btn-secondary {
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f9fafb;
  }

  .btn-text {
    background: transparent;
    color: #2563eb;
    padding: 8px 12px;
  }

  .btn-text:hover {
    background: #eff6ff;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-icon {
    background: transparent;
    border: none;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s;
  }

  .btn-icon:hover {
    background: #f3f4f6;
    color: #1a1a2e;
  }

  .btn-icon svg {
    width: 18px;
    height: 18px;
  }

  /* Spinners */
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner-large {
    width: 32px;
    height: 32px;
    border: 3px solid #e5e7eb;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Loading/Error States */
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px;
    text-align: center;
    color: #6b7280;
  }

  .loading-state p,
  .error-state p {
    margin-top: 16px;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 16px;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-large {
    max-width: 700px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0;
  }

  .modal-close {
    background: transparent;
    border: none;
    padding: 8px;
    cursor: pointer;
    color: #6b7280;
    border-radius: 6px;
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #1a1a2e;
  }

  .modal-close svg {
    width: 20px;
    height: 20px;
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  /* Detail Modal */
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-item.full {
    grid-column: span 2;
  }

  .detail-item.error {
    background: #fee2e2;
    padding: 12px;
    border-radius: 8px;
  }

  .detail-label {
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
  }

  .detail-value {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a2e;
  }

  .detail-value.mono {
    font-family: monospace;
    font-size: 12px;
    background: #f3f4f6;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .detail-message {
    font-size: 14px;
    color: #374151;
    background: #f9fafb;
    padding: 12px;
    border-radius: 8px;
    margin: 0;
    white-space: pre-wrap;
  }

  .detail-error {
    font-size: 14px;
    color: #dc2626;
    margin: 0;
  }

  /* Template Modal */
  .template-help {
    background: #eff6ff;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 20px;
  }

  .template-help p {
    margin: 0;
    font-size: 13px;
    color: #1e40af;
  }

  .template-help code {
    background: #dbeafe;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  /* Form Groups */
  .form-group {
    margin-bottom: 16px;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 6px;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.2s;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .checkbox-group input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .notifications-page {
      padding: 16px;
    }

    .page-header {
      flex-direction: column;
      align-items: stretch;
    }

    .header-actions {
      justify-content: stretch;
    }

    .header-actions .btn {
      flex: 1;
      justify-content: center;
    }

    .filters-row {
      flex-direction: column;
    }

    .filter-group {
      width: 100%;
    }

    .filter-group select,
    .filter-group input {
      width: 100%;
    }

    .data-table {
      font-size: 13px;
    }

    .data-table th,
    .data-table td {
      padding: 8px 12px;
    }

    .mensaje-col,
    .destinatario-col {
      max-width: 120px;
    }

    .detail-grid {
      grid-template-columns: 1fr;
    }

    .detail-item.full {
      grid-column: span 1;
    }

    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
