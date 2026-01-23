<script lang="ts">
  import { browser } from '$app/environment';
  import Header from '$components/layout/Header.svelte';
  import { apiClient } from '$utils/api';

  interface Disputa {
    id: number;
    numero: string;
    remesa_id: number;
    remesa_codigo: string;
    tipo_nombre: string;
    estado: string;
    prioridad: string;
    descripcion: string;
    fecha_creacion: string;
    fecha_limite: string | null;
    asignado_nombre: string | null;
    reportador_nombre: string;
  }

  interface TipoDisputa {
    id: number;
    codigo: string;
    nombre: string;
  }

  interface Usuario {
    id: number;
    nombre: string;
  }

  let disputas: Disputa[] = $state([]);
  let tipos: TipoDisputa[] = $state([]);
  let admins: Usuario[] = $state([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Filters
  let filterEstado = $state('');
  let filterPrioridad = $state('');

  // Modal state
  let selectedDisputa: Disputa | null = $state(null);
  let showModal = $state(false);
  let modalEstado = $state('');
  let modalAsignado = $state('');
  let modalResolucion = $state('');
  let isSubmitting = $state(false);

  const estados = [
    { value: 'abierta', label: 'Abierta', color: 'bg-warning-100 text-warning-700' },
    { value: 'en_investigacion', label: 'En Investigacion', color: 'bg-primary-100 text-primary-700' },
    { value: 'pendiente_cliente', label: 'Pendiente Cliente', color: 'bg-gray-100 text-gray-700' },
    { value: 'resuelta', label: 'Resuelta', color: 'bg-success-100 text-success-700' },
    { value: 'rechazada', label: 'Rechazada', color: 'bg-error-100 text-error-700' },
    { value: 'escalada', label: 'Escalada', color: 'bg-purple-100 text-purple-700' },
  ];

  const prioridades = [
    { value: 'baja', label: 'Baja', color: 'bg-gray-100 text-gray-600' },
    { value: 'normal', label: 'Normal', color: 'bg-primary-100 text-primary-600' },
    { value: 'alta', label: 'Alta', color: 'bg-warning-100 text-warning-600' },
    { value: 'urgente', label: 'Urgente', color: 'bg-error-100 text-error-600' },
  ];

  if (browser) {
    loadData();
  }

  async function loadData() {
    isLoading = true;
    error = null;

    try {
      const [disputasRes, tiposRes, adminsRes] = await Promise.all([
        apiClient.get<{ data: Disputa[] }>('/api/disputas'),
        apiClient.get<{ data: TipoDisputa[] }>('/api/disputas/tipos'),
        apiClient.get<{ data: Usuario[] }>('/api/admin/usuarios?rol=admin'),
      ]);

      if (disputasRes.success && disputasRes.data) {
        disputas = disputasRes.data;
      }
      if (tiposRes.success && tiposRes.data) {
        tipos = tiposRes.data;
      }
      if (adminsRes.success && adminsRes.data) {
        admins = adminsRes.data;
      }
    } catch (e) {
      error = 'Error al cargar datos';
    }

    isLoading = false;
  }

  async function loadDisputas() {
    try {
      let url = '/api/disputas?';
      if (filterEstado) url += `estado=${filterEstado}&`;
      if (filterPrioridad) url += `prioridad=${filterPrioridad}&`;

      const response = await apiClient.get<{ data: Disputa[] }>(url);
      if (response.success && response.data) {
        disputas = response.data;
      }
    } catch (e) {
      console.error('Error loading disputas', e);
    }
  }

  function openModal(disputa: Disputa) {
    selectedDisputa = disputa;
    modalEstado = disputa.estado;
    modalAsignado = '';
    modalResolucion = '';
    showModal = true;
  }

  async function updateDisputa() {
    if (!selectedDisputa) return;

    isSubmitting = true;

    try {
      const updates: Record<string, any> = {};
      if (modalEstado && modalEstado !== selectedDisputa.estado) {
        updates.estado = modalEstado;
      }
      if (modalAsignado) {
        updates.asignado_a = parseInt(modalAsignado);
      }
      if (modalResolucion) {
        updates.resolucion = modalResolucion;
      }

      if (Object.keys(updates).length === 0) {
        showModal = false;
        return;
      }

      const response = await apiClient.put(`/api/disputas/${selectedDisputa.id}`, updates);

      if (response.success) {
        showModal = false;
        await loadDisputas();
      } else {
        alert(response.message || 'Error al actualizar');
      }
    } catch (e) {
      alert('Error de conexion');
    }

    isSubmitting = false;
  }

  function getEstadoStyle(estado: string): string {
    return estados.find(e => e.value === estado)?.color || 'bg-gray-100 text-gray-700';
  }

  function getPrioridadStyle(prioridad: string): string {
    return prioridades.find(p => p.value === prioridad)?.color || 'bg-gray-100 text-gray-600';
  }

  function getEstadoLabel(estado: string): string {
    return estados.find(e => e.value === estado)?.label || estado;
  }

  function getPrioridadLabel(prioridad: string): string {
    return prioridades.find(p => p.value === prioridad)?.label || prioridad;
  }

  function isOverdue(fechaLimite: string | null): boolean {
    if (!fechaLimite) return false;
    return new Date(fechaLimite) < new Date();
  }

  // Filtered disputas
  let filteredDisputas = $derived(disputas);
</script>

<svelte:head>
  <title>Disputas - Remesitas Admin</title>
</svelte:head>

<Header title="Gestion de Disputas" />

<main class="p-6">
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="spinner border-primary-600 h-8 w-8"></div>
    </div>
  {:else if error}
    <div class="p-4 bg-error-50 border border-error-200 rounded-lg">
      <p class="text-error-600">{error}</p>
      <button onclick={loadData} class="btn-secondary mt-4">
        Reintentar
      </button>
    </div>
  {:else}
    <!-- Filters -->
    <div class="card p-4 mb-6">
      <div class="flex flex-wrap gap-4 items-center">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select bind:value={filterEstado} onchange={loadDisputas} class="input-select">
            <option value="">Todos</option>
            {#each estados as estado}
              <option value={estado.value}>{estado.label}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
          <select bind:value={filterPrioridad} onchange={loadDisputas} class="input-select">
            <option value="">Todas</option>
            {#each prioridades as prioridad}
              <option value={prioridad.value}>{prioridad.label}</option>
            {/each}
          </select>
        </div>
        <div class="ml-auto">
          <button onclick={loadDisputas} class="btn-secondary">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>
      </div>
    </div>

    <!-- Stats Summary -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-warning-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-warning-600">{disputas.filter(d => d.estado === 'abierta').length}</p>
        <p class="text-sm text-warning-700">Abiertas</p>
      </div>
      <div class="bg-primary-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-primary-600">{disputas.filter(d => d.estado === 'en_investigacion').length}</p>
        <p class="text-sm text-primary-700">En Investigacion</p>
      </div>
      <div class="bg-error-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-error-600">{disputas.filter(d => d.prioridad === 'urgente' && d.estado !== 'resuelta').length}</p>
        <p class="text-sm text-error-700">Urgentes</p>
      </div>
      <div class="bg-success-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-success-600">{disputas.filter(d => d.estado === 'resuelta').length}</p>
        <p class="text-sm text-success-700">Resueltas</p>
      </div>
    </div>

    <!-- Disputes Table -->
    {#if filteredDisputas.length === 0}
      <div class="card p-12 text-center text-gray-500">
        No hay disputas con los filtros seleccionados
      </div>
    {:else}
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Remesa</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Fecha Limite</th>
                <th>Asignado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredDisputas as disputa}
                <tr class={isOverdue(disputa.fecha_limite) && disputa.estado !== 'resuelta' ? 'bg-error-50' : ''}>
                  <td class="font-medium">{disputa.numero}</td>
                  <td>
                    <a href="/admin/remesas?codigo={disputa.remesa_codigo}" class="text-primary-600 hover:underline">
                      {disputa.remesa_codigo}
                    </a>
                  </td>
                  <td class="text-sm">{disputa.tipo_nombre}</td>
                  <td>
                    <span class="badge {getEstadoStyle(disputa.estado)}">
                      {getEstadoLabel(disputa.estado)}
                    </span>
                  </td>
                  <td>
                    <span class="badge {getPrioridadStyle(disputa.prioridad)}">
                      {getPrioridadLabel(disputa.prioridad)}
                    </span>
                  </td>
                  <td class="text-sm {isOverdue(disputa.fecha_limite) && disputa.estado !== 'resuelta' ? 'text-error-600 font-medium' : 'text-gray-500'}">
                    {#if disputa.fecha_limite}
                      {new Date(disputa.fecha_limite).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {#if isOverdue(disputa.fecha_limite) && disputa.estado !== 'resuelta'}
                        <span class="text-error-600 text-xs"> (Vencida)</span>
                      {/if}
                    {:else}
                      -
                    {/if}
                  </td>
                  <td class="text-sm">{disputa.asignado_nombre || '-'}</td>
                  <td>
                    <button onclick={() => openModal(disputa)} class="btn-sm btn-secondary">
                      Gestionar
                    </button>
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
  {#if showModal && selectedDisputa}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold mb-4">Gestionar Disputa {selectedDisputa.numero}</h3>

        <!-- Disputa Info -->
        <div class="mb-4 p-3 bg-gray-50 rounded-lg">
          <p class="text-sm"><strong>Remesa:</strong> {selectedDisputa.remesa_codigo}</p>
          <p class="text-sm"><strong>Tipo:</strong> {selectedDisputa.tipo_nombre}</p>
          <p class="text-sm"><strong>Reportado por:</strong> {selectedDisputa.reportador_nombre}</p>
          <p class="text-sm mt-2">{selectedDisputa.descripcion}</p>
        </div>

        <form onsubmit={(e) => { e.preventDefault(); updateDisputa(); }}>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select bind:value={modalEstado} class="input-select">
              {#each estados as estado}
                <option value={estado.value}>{estado.label}</option>
              {/each}
            </select>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Asignar a</label>
            <select bind:value={modalAsignado} class="input-select">
              <option value="">Sin asignar</option>
              {#each admins as admin}
                <option value={admin.id}>{admin.nombre}</option>
              {/each}
            </select>
          </div>

          {#if modalEstado === 'resuelta' || modalEstado === 'rechazada'}
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Resolucion</label>
              <textarea
                bind:value={modalResolucion}
                class="input"
                rows="3"
                placeholder="Describe como se resolvio la disputa..."
                required
              ></textarea>
            </div>
          {/if}

          <div class="flex gap-3 justify-end">
            <button type="button" onclick={() => showModal = false} class="btn-secondary">
              Cancelar
            </button>
            <button type="submit" class="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
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
  .input-select {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }
</style>
