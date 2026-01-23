<script lang="ts">
  import { browser } from '$app/environment';
  import Header from '$components/layout/Header.svelte';
  import { Table, Badge, Button, Modal } from '$components/ui';
  import { apiHelpers } from '$utils/api';
  import { formatCurrency, formatNumber, formatDateTime } from '$utils/format';

  interface Pago {
    id: number;
    monto: number;
    metodo: string;
    referencia: string | null;
    notas: string | null;
    fecha: string;
    admin_nombre: string;
  }

  interface ComisionStats {
    saldo_pendiente: number;
    total_pagado: number;
    comisiones_mes: number;
    comision_porcentaje: number;
  }

  let stats: ComisionStats | null = null;
  let pagos: Pago[] = [];
  let isLoading = true;
  let error: string | null = null;

  // Detail modal
  let showDetailModal = false;
  let selectedPago: Pago | null = null;

  // Load on client-side
  if (browser) {
    loadData();
  }

  async function loadData() {
    isLoading = true;
    error = null;

    const [statsRes, pagosRes] = await Promise.all([
      apiHelpers.getRevendedorDashboard(),
      apiHelpers.getRevendedorPayments(),
    ]);

    if (statsRes.success && statsRes.data) {
      stats = {
        saldo_pendiente: statsRes.data.saldo_pendiente,
        total_pagado: statsRes.data.comisiones_pagadas,
        comisiones_mes: statsRes.data.total_usd_mes * (statsRes.data.comision_porcentaje / 100),
        comision_porcentaje: statsRes.data.comision_porcentaje,
      };
    }

    if (pagosRes.success && pagosRes.data) {
      pagos = pagosRes.data;
    } else if (!statsRes.success) {
      error = pagosRes.message || 'Error al cargar datos';
    }

    isLoading = false;
  }

  function openDetailModal(pago: Pago) {
    selectedPago = pago;
    showDetailModal = true;
  }

  function getMetodoLabel(metodo: string): string {
    const labels: Record<string, string> = {
      zelle: 'Zelle',
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      paypal: 'PayPal',
      otro: 'Otro',
    };
    return labels[metodo] || metodo;
  }
</script>

<svelte:head>
  <title>Mis Comisiones - Revendedor</title>
</svelte:head>

<Header title="Mis Comisiones">
  <a href="/revendedor" class="btn-secondary">
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
    Volver
  </a>
</Header>

<main class="p-6">
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="spinner border-primary-600 h-8 w-8"></div>
    </div>
  {:else if error}
    <div class="p-4 bg-error-50 border border-error-200 rounded-lg mb-6">
      <p class="text-error-600">{error}</p>
      <Button variant="secondary" on:click={loadData} class="mt-2">Reintentar</Button>
    </div>
  {:else if stats}
    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="card p-6 bg-gradient-to-br from-accent-50 to-accent-100 border-accent-200">
        <p class="text-sm text-accent-700">Saldo Pendiente</p>
        <p class="text-3xl font-bold text-accent-600">${formatNumber(stats.saldo_pendiente, 2)}</p>
        <p class="text-xs text-accent-600 mt-1">Disponible para pago</p>
      </div>
      <div class="card p-6">
        <p class="text-sm text-gray-500">Total Pagado</p>
        <p class="text-3xl font-bold text-success-600">${formatNumber(stats.total_pagado, 2)}</p>
        <p class="text-xs text-gray-500 mt-1">Histórico</p>
      </div>
      <div class="card p-6">
        <p class="text-sm text-gray-500">Comisiones Este Mes</p>
        <p class="text-3xl font-bold text-primary-600">${formatNumber(stats.comisiones_mes, 2)}</p>
        <p class="text-xs text-gray-500 mt-1">Generadas</p>
      </div>
      <div class="card p-6">
        <p class="text-sm text-gray-500">Tu Porcentaje</p>
        <p class="text-3xl font-bold text-gray-900">{stats.comision_porcentaje}%</p>
        <p class="text-xs text-gray-500 mt-1">Por envío</p>
      </div>
    </div>

    <!-- Info Card -->
    <div class="card p-4 mb-6 bg-primary-50 border-primary-200">
      <div class="flex items-start gap-3">
        <svg class="w-6 h-6 text-primary-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 class="font-medium text-primary-800">Sobre tus comisiones</h3>
          <p class="text-sm text-primary-700 mt-1">
            Ganas <strong>{stats.comision_porcentaje}%</strong> de cada envío que generes.
            Las comisiones se acumulan en tu saldo pendiente y son pagadas periódicamente
            por el administrador. Los pagos aparecerán en la tabla de abajo.
          </p>
        </div>
      </div>
    </div>

    <!-- Payments History -->
    <div class="card p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Historial de Pagos
      </h2>

      {#if pagos.length === 0}
        <div class="text-center py-12">
          <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-gray-500 text-lg">No hay pagos registrados</p>
          <p class="text-gray-400 text-sm mt-1">Los pagos de comisiones aparecerán aquí</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="th">Fecha</th>
                <th class="th text-right">Monto</th>
                <th class="th">Método</th>
                <th class="th">Referencia</th>
                <th class="th">Procesado por</th>
              </tr>
            </thead>
            <tbody>
              {#each pagos as pago}
                <tr
                  class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  on:click={() => openDetailModal(pago)}
                >
                  <td class="td">{formatDateTime(pago.fecha)}</td>
                  <td class="td text-right">
                    <span class="font-mono font-bold text-success-600">
                      ${formatNumber(pago.monto, 2)}
                    </span>
                  </td>
                  <td class="td">
                    <Badge variant="primary">{getMetodoLabel(pago.metodo)}</Badge>
                  </td>
                  <td class="td">
                    {#if pago.referencia}
                      <span class="font-mono text-sm text-gray-600">{pago.referencia}</span>
                    {:else}
                      <span class="text-gray-400">-</span>
                    {/if}
                  </td>
                  <td class="td text-gray-500">{pago.admin_nombre}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</main>

<!-- Payment Detail Modal -->
<Modal bind:open={showDetailModal} title="Detalle del Pago" size="md">
  {#if selectedPago}
    <div class="space-y-4">
      <div class="p-6 bg-success-50 rounded-lg text-center">
        <p class="text-sm text-success-700">Monto Recibido</p>
        <p class="text-4xl font-bold text-success-600">${formatNumber(selectedPago.monto, 2)}</p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-sm text-gray-500">Fecha</p>
          <p class="font-medium">{formatDateTime(selectedPago.fecha)}</p>
        </div>
        <div>
          <p class="text-sm text-gray-500">Método</p>
          <Badge variant="primary">{getMetodoLabel(selectedPago.metodo)}</Badge>
        </div>
      </div>

      {#if selectedPago.referencia}
        <div>
          <p class="text-sm text-gray-500">Referencia</p>
          <p class="font-mono font-medium">{selectedPago.referencia}</p>
        </div>
      {/if}

      <div>
        <p class="text-sm text-gray-500">Procesado por</p>
        <p class="font-medium">{selectedPago.admin_nombre}</p>
      </div>

      {#if selectedPago.notas}
        <div>
          <p class="text-sm text-gray-500">Notas</p>
          <div class="p-3 bg-gray-50 rounded-lg">
            <p class="text-gray-700">{selectedPago.notas}</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={() => (showDetailModal = false)}>Cerrar</Button>
  </svelte:fragment>
</Modal>

<style>
  .btn-secondary {
    @apply inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors;
  }

  .th {
    @apply px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider;
  }

  .td {
    @apply px-4 py-3 whitespace-nowrap;
  }
</style>
