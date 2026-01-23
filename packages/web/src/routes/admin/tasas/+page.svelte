<script lang="ts">
  import { browser } from '$app/environment';
  import Header from '$components/layout/Header.svelte';
  import { Table, Badge, Modal, Button, Input } from '$components/ui';
  import { apiHelpers } from '$utils/api';
  import { formatNumber, formatDateTime } from '$utils/format';
  import { toast } from '$stores/toast';

  interface TasaCambio {
    id: number;
    moneda_origen: string;
    moneda_destino: string;
    tasa: number;
    activa: boolean;
    fecha_actualizacion: string;
  }

  interface ExternalRate {
    moneda: string;
    tasa: number;
  }

  let tasas: TasaCambio[] = [];
  let externalRates: ExternalRate[] = [];
  let autoUpdateGlobal = false;
  let isLoading = true;
  let isFetching = false;
  let error: string | null = null;

  // Edit modal
  let showEditModal = false;
  let editingTasa: TasaCambio | null = null;
  let editTasa = 0;
  let editActiva = true;
  let isUpdating = false;

  // Preview modal
  let showPreviewModal = false;

  // Load on client-side
  if (browser) {
    loadTasas();
  }

  async function loadTasas() {
    isLoading = true;
    error = null;

    const response = await apiHelpers.getRatesAdmin();

    if (response.success && response.data) {
      tasas = response.data.rates;
      autoUpdateGlobal = response.data.auto_update_global;
    } else {
      error = response.message || 'Error al cargar tasas';
    }

    isLoading = false;
  }

  async function fetchExternalRates() {
    isFetching = true;

    const response = await apiHelpers.previewExternalRates();

    if (response.success && response.data) {
      externalRates = response.data.rates || [];
      showPreviewModal = true;
    } else {
      toast.error(response.message || 'Error al obtener tasas externas');
    }

    isFetching = false;
  }

  async function applyExternalRates() {
    isFetching = true;

    const response = await apiHelpers.fetchExternalRates();

    if (response.success) {
      toast.success('Tasas aplicadas correctamente');
      showPreviewModal = false;
      await loadTasas();
    } else {
      toast.error(response.message || 'Error al aplicar tasas');
    }

    isFetching = false;
  }

  function openEditModal(tasa: TasaCambio) {
    editingTasa = tasa;
    editTasa = tasa.tasa;
    editActiva = tasa.activa;
    showEditModal = true;
  }

  async function handleUpdate() {
    if (!editingTasa) return;

    isUpdating = true;

    const response = await apiHelpers.updateRate(editingTasa.moneda_destino, {
      tasa: editTasa,
      activa: editActiva,
    });

    if (response.success) {
      toast.success('Tasa actualizada correctamente');
      showEditModal = false;
      await loadTasas();
    } else {
      toast.error(response.message || 'Error al actualizar');
    }

    isUpdating = false;
  }

  function getMonedaLabel(moneda: string): string {
    const labels: Record<string, string> = {
      CUP: 'Peso Cubano (CUP)',
      EUR: 'Euro',
      MLC: 'MLC',
      CAD: 'Dólar Canadiense',
      MXN: 'Peso Mexicano',
      BRL: 'Real Brasileño',
      ZELLE: 'Zelle',
      CLA: 'MLC Clásica',
    };
    return labels[moneda] || moneda;
  }
</script>

<svelte:head>
  <title>Tasas de Cambio - Admin</title>
</svelte:head>

<Header title="Tasas de Cambio">
  <div class="flex items-center gap-3">
    <Button variant="secondary" on:click={fetchExternalRates} loading={isFetching}>
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
        />
      </svg>
      Obtener Tasas Externas
    </Button>
  </div>
</Header>

<main class="p-6">
  {#if error}
    <div class="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
      <p class="text-error-700">{error}</p>
      <Button variant="secondary" size="sm" on:click={loadTasas} class="mt-2">Reintentar</Button>
    </div>
  {/if}

  <!-- Info Card -->
  <div class="card p-4 mb-6 bg-primary-50 border-primary-200">
    <div class="flex items-start gap-3">
      <svg class="w-6 h-6 text-primary-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div>
        <h3 class="font-medium text-primary-800">Fuentes de Tasas</h3>
        <p class="text-sm text-primary-700 mt-1">
          Las tasas se obtienen de CiberCuba (principal) y ElToque (respaldo). Puedes actualizar
          manualmente cada tasa o obtener las tasas externas para aplicarlas.
        </p>
      </div>
    </div>
  </div>

  <!-- Table -->
  <Table loading={isLoading} isEmpty={tasas.length === 0} emptyMessage="No hay tasas configuradas">
    <svelte:fragment slot="head">
      <th class="th">Moneda</th>
      <th class="th text-right">Tasa (CUP)</th>
      <th class="th">Estado</th>
      <th class="th">Última Actualización</th>
      <th class="th">Acciones</th>
    </svelte:fragment>

    {#each tasas as tasa}
      <tr class="hover:bg-gray-50">
        <td class="td">
          <div class="font-medium">{tasa.moneda_destino}</div>
          <div class="text-xs text-gray-500">{getMonedaLabel(tasa.moneda_destino)}</div>
        </td>
        <td class="td text-right">
          <span class="text-xl font-bold font-mono text-primary-600">
            {formatNumber(tasa.tasa, 0)}
          </span>
          <span class="text-sm text-gray-500 ml-1">CUP</span>
        </td>
        <td class="td">
          <Badge variant={tasa.activa ? 'success' : 'gray'}>
            {tasa.activa ? 'Activa' : 'Inactiva'}
          </Badge>
        </td>
        <td class="td-muted">{formatDateTime(tasa.fecha_actualizacion)}</td>
        <td class="td">
          <button
            on:click={() => openEditModal(tasa)}
            class="text-primary-600 hover:text-primary-800"
            title="Editar"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </td>
      </tr>
    {/each}
  </Table>

  <!-- Rate Guide -->
  <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="card p-6">
      <h3 class="font-semibold text-gray-900 mb-4">Cálculo para Entrega en CUP</h3>
      <div class="space-y-2 text-sm text-gray-600">
        <p>
          <strong>Monto entrega</strong> = Monto USD × (Tasa USD - 15)
        </p>
        <p class="text-xs text-gray-500">
          Se descuentan 15 CUP de la tasa como margen operativo
        </p>
      </div>
    </div>
    <div class="card p-6">
      <h3 class="font-semibold text-gray-900 mb-4">Cálculo para Entrega en USD</h3>
      <div class="space-y-2 text-sm text-gray-600">
        <p>
          <strong>Monto entrega</strong> = Monto USD × 0.95
        </p>
        <p class="text-xs text-gray-500">
          Se cobra 5% de comisión para entregas en USD
        </p>
      </div>
    </div>
  </div>
</main>

<!-- Edit Modal -->
<Modal bind:open={showEditModal} title="Editar Tasa" size="sm">
  {#if editingTasa}
    <div class="space-y-4">
      <div class="p-4 bg-gray-50 rounded-lg">
        <p class="text-sm text-gray-500">Moneda</p>
        <p class="text-lg font-semibold">
          {editingTasa.moneda_destino} - {getMonedaLabel(editingTasa.moneda_destino)}
        </p>
      </div>

      <Input
        label="Tasa (CUP por 1 USD)"
        type="number"
        bind:value={editTasa}
        min={100}
        max={1000}
        step="1"
        required
      />

      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={editActiva} class="rounded border-gray-300" />
        <span class="text-sm text-gray-700">Tasa activa</span>
      </label>
    </div>
  {/if}

  <svelte:fragment slot="footer">
    <Button variant="primary" on:click={handleUpdate} loading={isUpdating}>Guardar</Button>
    <Button variant="secondary" on:click={() => (showEditModal = false)}>Cancelar</Button>
  </svelte:fragment>
</Modal>

<!-- Preview External Rates Modal -->
<Modal bind:open={showPreviewModal} title="Tasas Externas" size="md">
  <div class="space-y-4">
    <p class="text-sm text-gray-600">
      Las siguientes tasas fueron obtenidas de fuentes externas. Revise y aplique si son correctas.
    </p>

    <div class="space-y-2">
      {#each externalRates as rate}
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <span class="font-medium">{rate.moneda}</span>
          <span class="font-mono text-lg text-primary-600">{formatNumber(rate.tasa, 0)} CUP</span>
        </div>
      {/each}
    </div>
  </div>

  <svelte:fragment slot="footer">
    <Button variant="primary" on:click={applyExternalRates} loading={isFetching}>
      Aplicar Tasas
    </Button>
    <Button variant="secondary" on:click={() => (showPreviewModal = false)}>Cancelar</Button>
  </svelte:fragment>
</Modal>
