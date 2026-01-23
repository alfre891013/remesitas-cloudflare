<script lang="ts">
  import { browser } from '$app/environment';
  import Header from '$components/layout/Header.svelte';
  import { apiClient } from '$utils/api';

  interface Mensaje {
    id: number;
    numero: string;
    nombre: string;
    email: string;
    telefono: string | null;
    asunto: string;
    mensaje: string;
    estado: string;
    fecha_creacion: string;
    fecha_lectura: string | null;
    fecha_respuesta: string | null;
    respondido_por: number | null;
    respuesta?: string;
  }

  let mensajes: Mensaje[] = $state([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let counts = $state<Record<string, number>>({});

  // Filters
  let filterEstado = $state('');
  let filterSearch = $state('');

  // Modal state
  let selectedMensaje: Mensaje | null = $state(null);
  let showModal = $state(false);
  let modalRespuesta = $state('');
  let isSubmitting = $state(false);

  const estados = [
    { value: 'nuevo', label: 'Nuevo', color: 'bg-primary-100 text-primary-700' },
    { value: 'leido', label: 'Leido', color: 'bg-gray-100 text-gray-700' },
    { value: 'respondido', label: 'Respondido', color: 'bg-success-100 text-success-700' },
    { value: 'cerrado', label: 'Cerrado', color: 'bg-gray-100 text-gray-500' },
    { value: 'spam', label: 'Spam', color: 'bg-error-100 text-error-700' },
  ];

  const asuntoLabels: Record<string, string> = {
    consulta: 'Consulta general',
    envio: 'Problema con envio',
    pago: 'Consulta de pagos',
    cuenta: 'Problema de cuenta',
    sugerencia: 'Sugerencia',
    reclamo: 'Reclamo formal',
    otro: 'Otro',
  };

  if (browser) {
    loadMensajes();
  }

  async function loadMensajes() {
    isLoading = true;
    error = null;

    try {
      let url = '/api/mensajes?';
      if (filterEstado) url += `estado=${filterEstado}&`;
      if (filterSearch) url += `search=${encodeURIComponent(filterSearch)}&`;

      const response = await apiClient.get<{
        data: Mensaje[];
        counts: Record<string, number>;
        total: number;
      }>(url);

      if (response.success) {
        mensajes = response.data || [];
        counts = response.counts || {};
      } else {
        error = response.message || 'Error al cargar los mensajes';
      }
    } catch (e) {
      error = 'Error de conexion';
    }

    isLoading = false;
  }

  async function openModal(mensaje: Mensaje) {
    // Fetch full message details
    try {
      const response = await apiClient.get<{ data: Mensaje }>(`/api/mensajes/${mensaje.id}`);
      if (response.success && response.data) {
        selectedMensaje = response.data;
        modalRespuesta = response.data.respuesta || '';
        showModal = true;
        // Reload list to update estado to 'leido' if it was 'nuevo'
        if (mensaje.estado === 'nuevo') {
          loadMensajes();
        }
      }
    } catch (e) {
      console.error('Error loading message details:', e);
    }
  }

  async function sendResponse() {
    if (!selectedMensaje || !modalRespuesta.trim()) return;

    isSubmitting = true;

    try {
      const response = await apiClient.put(`/api/mensajes/${selectedMensaje.id}`, {
        respuesta: modalRespuesta.trim(),
      });

      if (response.success) {
        showModal = false;
        await loadMensajes();
      } else {
        alert(response.message || 'Error al enviar la respuesta');
      }
    } catch (e) {
      alert('Error de conexion');
    }

    isSubmitting = false;
  }

  async function updateEstado(mensaje: Mensaje, nuevoEstado: string) {
    try {
      const response = await apiClient.put(`/api/mensajes/${mensaje.id}`, {
        estado: nuevoEstado,
      });

      if (response.success) {
        await loadMensajes();
      } else {
        alert(response.message || 'Error al actualizar el estado');
      }
    } catch (e) {
      alert('Error de conexion');
    }
  }

  async function deleteMensaje(mensaje: Mensaje) {
    if (!confirm(`¿Seguro que deseas eliminar el mensaje ${mensaje.numero}?`)) return;

    try {
      const response = await apiClient.delete(`/api/mensajes/${mensaje.id}`);

      if (response.success) {
        await loadMensajes();
      } else {
        alert(response.message || 'Error al eliminar');
      }
    } catch (e) {
      alert('Error de conexion');
    }
  }

  function getEstadoStyle(estado: string): string {
    return estados.find((e) => e.value === estado)?.color || 'bg-gray-100 text-gray-700';
  }

  function getEstadoLabel(estado: string): string {
    return estados.find((e) => e.value === estado)?.label || estado;
  }

  function getAsuntoLabel(asunto: string): string {
    return asuntoLabels[asunto] || asunto;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function handleSearch() {
    loadMensajes();
  }
</script>

<svelte:head>
  <title>Mensajes de Contacto - Remesitas Admin</title>
</svelte:head>

<Header title="Mensajes de Contacto" />

<main class="p-6">
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="spinner border-primary-600 h-8 w-8"></div>
    </div>
  {:else if error}
    <div class="p-4 bg-error-50 border border-error-200 rounded-lg">
      <p class="text-error-600">{error}</p>
      <button onclick={loadMensajes} class="btn-secondary mt-4">
        Reintentar
      </button>
    </div>
  {:else}
    <!-- Stats Summary -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div class="bg-primary-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-primary-600">{counts.nuevo || 0}</p>
        <p class="text-sm text-primary-700">Nuevos</p>
      </div>
      <div class="bg-gray-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-gray-600">{counts.leido || 0}</p>
        <p class="text-sm text-gray-700">Leidos</p>
      </div>
      <div class="bg-success-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-success-600">{counts.respondido || 0}</p>
        <p class="text-sm text-success-700">Respondidos</p>
      </div>
      <div class="bg-gray-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-gray-500">{counts.cerrado || 0}</p>
        <p class="text-sm text-gray-600">Cerrados</p>
      </div>
      <div class="bg-error-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-error-600">{counts.spam || 0}</p>
        <p class="text-sm text-error-700">Spam</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="card p-4 mb-6">
      <div class="flex flex-wrap gap-4 items-end">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select bind:value={filterEstado} onchange={loadMensajes} class="input-select">
            <option value="">Todos</option>
            {#each estados as estado}
              <option value={estado.value}>{estado.label}</option>
            {/each}
          </select>
        </div>
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={filterSearch}
              placeholder="Nombre, email o numero..."
              class="input flex-1"
              onkeydown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onclick={handleSearch} class="btn-secondary">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>
        <div>
          <button onclick={loadMensajes} class="btn-secondary">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>
      </div>
    </div>

    <!-- Messages List -->
    {#if mensajes.length === 0}
      <div class="card p-12 text-center text-gray-500">
        No hay mensajes con los filtros seleccionados
      </div>
    {:else}
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Fecha</th>
                <th>Nombre</th>
                <th>Asunto</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#each mensajes as mensaje}
                <tr class={mensaje.estado === 'nuevo' ? 'bg-primary-50' : ''}>
                  <td class="font-mono text-sm font-medium">{mensaje.numero}</td>
                  <td class="text-sm text-gray-500">{formatDate(mensaje.fecha_creacion)}</td>
                  <td>
                    <div class="font-medium text-gray-900">{mensaje.nombre}</div>
                    <div class="text-sm text-gray-500">{mensaje.email}</div>
                  </td>
                  <td class="text-sm">{getAsuntoLabel(mensaje.asunto)}</td>
                  <td>
                    <span class="badge {getEstadoStyle(mensaje.estado)}">
                      {getEstadoLabel(mensaje.estado)}
                    </span>
                  </td>
                  <td>
                    <div class="flex gap-2">
                      <button onclick={() => openModal(mensaje)} class="btn-sm btn-secondary">
                        Ver
                      </button>
                      {#if mensaje.estado !== 'spam'}
                        <button
                          onclick={() => updateEstado(mensaje, 'spam')}
                          class="btn-sm btn-ghost text-error-600"
                          title="Marcar como spam"
                        >
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </button>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {/if}

  <!-- Modal -->
  {#if showModal && selectedMensaje}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{selectedMensaje.numero}</h3>
              <p class="text-sm text-gray-500">{formatDate(selectedMensaje.fecha_creacion)}</p>
            </div>
            <span class="badge {getEstadoStyle(selectedMensaje.estado)}">
              {getEstadoLabel(selectedMensaje.estado)}
            </span>
          </div>

          <!-- Message Info -->
          <div class="bg-gray-50 rounded-lg p-4 mb-4">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p class="text-sm text-gray-500">Nombre</p>
                <p class="font-medium">{selectedMensaje.nombre}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Email</p>
                <a href="mailto:{selectedMensaje.email}" class="font-medium text-primary-600 hover:underline">
                  {selectedMensaje.email}
                </a>
              </div>
              {#if selectedMensaje.telefono}
                <div>
                  <p class="text-sm text-gray-500">Telefono</p>
                  <a href="tel:{selectedMensaje.telefono}" class="font-medium text-primary-600 hover:underline">
                    {selectedMensaje.telefono}
                  </a>
                </div>
              {/if}
              <div>
                <p class="text-sm text-gray-500">Asunto</p>
                <p class="font-medium">{getAsuntoLabel(selectedMensaje.asunto)}</p>
              </div>
            </div>
            <div>
              <p class="text-sm text-gray-500 mb-1">Mensaje</p>
              <p class="text-gray-800 whitespace-pre-wrap">{selectedMensaje.mensaje}</p>
            </div>
          </div>

          <!-- Previous Response -->
          {#if selectedMensaje.respuesta}
            <div class="bg-success-50 border border-success-200 rounded-lg p-4 mb-4">
              <p class="text-sm text-success-700 mb-1">Respuesta enviada</p>
              <p class="text-gray-800 whitespace-pre-wrap">{selectedMensaje.respuesta}</p>
              {#if selectedMensaje.fecha_respuesta}
                <p class="text-xs text-gray-500 mt-2">
                  {formatDate(selectedMensaje.fecha_respuesta)}
                </p>
              {/if}
            </div>
          {/if}

          <!-- Response Form -->
          {#if selectedMensaje.estado !== 'respondido' && selectedMensaje.estado !== 'cerrado'}
            <form onsubmit={(e) => { e.preventDefault(); sendResponse(); }}>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Responder al mensaje
                </label>
                <textarea
                  bind:value={modalRespuesta}
                  class="input"
                  rows="4"
                  placeholder="Escribe tu respuesta..."
                  required
                ></textarea>
                <p class="text-xs text-gray-500 mt-1">
                  La respuesta se enviara por email a {selectedMensaje.email}
                </p>
              </div>

              <div class="flex gap-3 justify-between">
                <div class="flex gap-2">
                  {#if selectedMensaje.estado !== 'cerrado'}
                    <button
                      type="button"
                      onclick={() => { updateEstado(selectedMensaje!, 'cerrado'); showModal = false; }}
                      class="btn-ghost text-gray-600"
                    >
                      Cerrar sin responder
                    </button>
                  {/if}
                </div>
                <div class="flex gap-3">
                  <button type="button" onclick={() => showModal = false} class="btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" class="btn-primary" disabled={isSubmitting || !modalRespuesta.trim()}>
                    {isSubmitting ? 'Enviando...' : 'Enviar Respuesta'}
                  </button>
                </div>
              </div>
            </form>
          {:else}
            <div class="flex justify-end">
              <button onclick={() => showModal = false} class="btn-secondary">
                Cerrar
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  .btn-sm {
    padding: 0.25rem 0.75rem;
    font-size: 0.875rem;
    border-radius: 0.375rem;
  }
  .btn-ghost {
    background: transparent;
    border: none;
    cursor: pointer;
  }
  .btn-ghost:hover {
    background: rgba(0, 0, 0, 0.05);
  }
  .input-select {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }
</style>
