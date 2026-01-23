<script lang="ts">
  import { browser } from '$app/environment';
  import Header from '$components/layout/Header.svelte';
  import { apiClient } from '$utils/api';
  import { formatCurrency, formatNumber } from '$utils/format';

  interface Repartidor {
    id: number;
    nombre: string;
    saldo_usd: number;
    saldo_cup: number;
    activo: boolean;
  }

  interface Movimiento {
    id: number;
    tipo: string;
    moneda: string;
    monto: number;
    saldo_anterior: number;
    saldo_nuevo: number;
    fecha: string;
    notas: string | null;
    remesa_codigo?: string;
  }

  let repartidores: Repartidor[] = $state([]);
  let movimientos: Movimiento[] = $state([]);
  let selectedRepartidor: Repartidor | null = $state(null);
  let isLoading = $state(true);
  let isLoadingMovimientos = $state(false);
  let error = $state<string | null>(null);

  // Modal state
  let showModal = $state(false);
  let modalType: 'asignacion' | 'retiro' = $state('asignacion');
  let modalMoneda: 'USD' | 'CUP' = $state('USD');
  let modalMonto = $state('');
  let modalNotas = $state('');
  let isSubmitting = $state(false);

  if (browser) {
    loadRepartidores();
  }

  async function loadRepartidores() {
    isLoading = true;
    error = null;

    try {
      const response = await apiClient.get<{ data: Repartidor[] }>('/api/admin/usuarios?rol=repartidor');
      if (response.success && response.data) {
        repartidores = response.data;
      } else {
        error = response.message || 'Error al cargar repartidores';
      }
    } catch (e) {
      error = 'Error de conexion';
    }

    isLoading = false;
  }

  async function loadMovimientos(repartidorId: number) {
    isLoadingMovimientos = true;

    try {
      const response = await apiClient.get<{ data: Movimiento[] }>(
        `/api/admin/efectivo/movimientos?repartidor_id=${repartidorId}&limit=50`
      );
      if (response.success && response.data) {
        movimientos = response.data;
      }
    } catch (e) {
      console.error('Error loading movimientos', e);
    }

    isLoadingMovimientos = false;
  }

  function selectRepartidor(repartidor: Repartidor) {
    selectedRepartidor = repartidor;
    loadMovimientos(repartidor.id);
  }

  function openModal(tipo: 'asignacion' | 'retiro', moneda: 'USD' | 'CUP') {
    modalType = tipo;
    modalMoneda = moneda;
    modalMonto = '';
    modalNotas = '';
    showModal = true;
  }

  async function submitMovimiento() {
    if (!selectedRepartidor || !modalMonto) return;

    isSubmitting = true;

    try {
      const response = await apiClient.post('/api/admin/efectivo', {
        repartidor_id: selectedRepartidor.id,
        tipo: modalType,
        moneda: modalMoneda,
        monto: parseFloat(modalMonto),
        notas: modalNotas || null,
      });

      if (response.success) {
        showModal = false;
        await loadRepartidores();
        const updated = repartidores.find(r => r.id === selectedRepartidor!.id);
        if (updated) {
          selectedRepartidor = updated;
          await loadMovimientos(updated.id);
        }
      } else {
        alert(response.message || 'Error al registrar movimiento');
      }
    } catch (e) {
      alert('Error de conexion');
    }

    isSubmitting = false;
  }

  function getTipoLabel(tipo: string): string {
    const labels: Record<string, string> = {
      asignacion: 'Asignacion',
      retiro: 'Retiro',
      entrega: 'Entrega',
      recogida: 'Recogida',
      venta_usd: 'Venta USD',
    };
    return labels[tipo] || tipo;
  }

  function getTipoColor(tipo: string): string {
    if (tipo === 'asignacion' || tipo === 'recogida') return 'text-success-600 bg-success-50';
    if (tipo === 'retiro' || tipo === 'entrega') return 'text-error-600 bg-error-50';
    return 'text-gray-600 bg-gray-50';
  }

  // Calculate totals
  let totalUSD = $derived(repartidores.reduce((sum, r) => sum + r.saldo_usd, 0));
  let totalCUP = $derived(repartidores.reduce((sum, r) => sum + r.saldo_cup, 0));
</script>

<svelte:head>
  <title>Gestion de Efectivo - Remesitas Admin</title>
</svelte:head>

<Header title="Gestion de Efectivo" />

<main class="p-6">
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="spinner border-primary-600 h-8 w-8"></div>
    </div>
  {:else if error}
    <div class="p-4 bg-error-50 border border-error-200 rounded-lg">
      <p class="text-error-600">{error}</p>
      <button onclick={loadRepartidores} class="btn-secondary mt-4">
        Reintentar
      </button>
    </div>
  {:else}
    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div class="stat-card">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-success-50 rounded-lg">
            <svg class="w-6 h-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p class="stat-value">{formatCurrency(totalUSD)}</p>
            <p class="stat-label">Total USD en Calle</p>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-primary-50 rounded-lg">
            <svg class="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p class="stat-value">{formatNumber(totalCUP, 0)} CUP</p>
            <p class="stat-label">Total CUP en Calle</p>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Repartidores List -->
      <div class="card p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Repartidores</h2>
        <div class="space-y-3">
          {#each repartidores as repartidor}
            <button
              onclick={() => selectRepartidor(repartidor)}
              class="w-full text-left p-4 rounded-lg border transition-colors {selectedRepartidor?.id === repartidor.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-900">{repartidor.nombre}</p>
                  <div class="flex gap-4 mt-1 text-sm">
                    <span class="text-success-600">{formatCurrency(repartidor.saldo_usd)}</span>
                    <span class="text-primary-600">{formatNumber(repartidor.saldo_cup, 0)} CUP</span>
                  </div>
                </div>
                {#if !repartidor.activo}
                  <span class="badge-error">Inactivo</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Repartidor Details -->
      <div class="lg:col-span-2">
        {#if selectedRepartidor}
          <div class="card p-6 mb-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900">{selectedRepartidor.nombre}</h2>
            </div>

            <!-- Balance Cards -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div class="p-4 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-500">Saldo USD</p>
                <p class="text-2xl font-bold text-success-600">{formatCurrency(selectedRepartidor.saldo_usd)}</p>
                <div class="flex gap-2 mt-3">
                  <button onclick={() => openModal('asignacion', 'USD')} class="btn-sm btn-success">
                    + Asignar
                  </button>
                  <button onclick={() => openModal('retiro', 'USD')} class="btn-sm btn-error">
                    - Retirar
                  </button>
                </div>
              </div>
              <div class="p-4 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-500">Saldo CUP</p>
                <p class="text-2xl font-bold text-primary-600">{formatNumber(selectedRepartidor.saldo_cup, 0)} CUP</p>
                <div class="flex gap-2 mt-3">
                  <button onclick={() => openModal('asignacion', 'CUP')} class="btn-sm btn-success">
                    + Asignar
                  </button>
                  <button onclick={() => openModal('retiro', 'CUP')} class="btn-sm btn-error">
                    - Retirar
                  </button>
                </div>
              </div>
            </div>

            <!-- Movimientos -->
            <h3 class="font-medium text-gray-900 mb-3">Ultimos Movimientos</h3>
            {#if isLoadingMovimientos}
              <div class="flex justify-center py-8">
                <div class="spinner border-primary-600 h-6 w-6"></div>
              </div>
            {:else if movimientos.length === 0}
              <p class="text-gray-500 text-center py-8">No hay movimientos registrados</p>
            {:else}
              <div class="overflow-x-auto">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Monto</th>
                      <th>Saldo</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each movimientos as mov}
                      <tr>
                        <td class="text-sm">{new Date(mov.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          <span class="badge {getTipoColor(mov.tipo)}">
                            {getTipoLabel(mov.tipo)}
                          </span>
                        </td>
                        <td class="font-medium">
                          {mov.moneda === 'USD' ? formatCurrency(mov.monto) : `${formatNumber(mov.monto, 0)} CUP`}
                        </td>
                        <td class="text-sm text-gray-500">
                          {mov.moneda === 'USD' ? formatCurrency(mov.saldo_nuevo) : `${formatNumber(mov.saldo_nuevo, 0)} CUP`}
                        </td>
                        <td class="text-sm text-gray-500 max-w-xs truncate">
                          {mov.notas || '-'}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {:else}
          <div class="card p-12 text-center text-gray-500">
            Seleccione un repartidor para ver sus detalles
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Modal -->
  {#if showModal}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-semibold mb-4">
          {modalType === 'asignacion' ? 'Asignar' : 'Retirar'} {modalMoneda}
        </h3>
        <form onsubmit={(e) => { e.preventDefault(); submitMovimiento(); }}>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Monto ({modalMoneda})
            </label>
            <input
              type="number"
              bind:value={modalMonto}
              class="input"
              step="0.01"
              min="0.01"
              required
            />
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              bind:value={modalNotas}
              class="input"
              rows="3"
            ></textarea>
          </div>
          <div class="flex gap-3 justify-end">
            <button type="button" onclick={() => showModal = false} class="btn-secondary">
              Cancelar
            </button>
            <button type="submit" class="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Confirmar'}
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
  .btn-success {
    background-color: rgb(var(--color-success-600));
    color: white;
  }
  .btn-success:hover {
    background-color: rgb(var(--color-success-700));
  }
  .btn-error {
    background-color: rgb(var(--color-error-600));
    color: white;
  }
  .btn-error:hover {
    background-color: rgb(var(--color-error-700));
  }
</style>
