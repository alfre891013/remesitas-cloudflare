<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$components/layout/Header.svelte';
  import { Button, Input, Select, Badge } from '$components/ui';
  import { apiHelpers } from '$utils/api';
  import { formatCurrency, formatNumber, formatDate, getEstadoLabel, getEstadoColor } from '$utils/format';

  // Tab state
  let activeTab: 'resumen' | 'diario' | 'repartidores' | 'revendedores' | 'balance' = 'resumen';

  // Filters
  let fechaInicio = '';
  let fechaFin = '';
  let fechaDiario = new Date().toISOString().split('T')[0];

  // Loading states
  let isLoading = false;

  // Data
  let resumenData: any = null;
  let diarioData: any = null;
  let repartidoresData: any[] = [];
  let revendedoresData: any[] = [];
  let balanceData: any = null;

  onMount(() => {
    // Set default date range (this month)
    const now = new Date();
    fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    fechaFin = now.toISOString().split('T')[0];
    loadResumen();
  });

  async function loadResumen() {
    isLoading = true;
    const params: Record<string, string> = {};
    if (fechaInicio) params.fecha_inicio = fechaInicio;
    if (fechaFin) params.fecha_fin = fechaFin;

    const response = await apiHelpers.getReportSummary(params);
    if (response.success && response.data) {
      resumenData = response.data;
    }
    isLoading = false;
  }

  async function loadDiario() {
    isLoading = true;
    const response = await apiHelpers.getDailyReport(fechaDiario);
    if (response.success && response.data) {
      diarioData = response.data;
    }
    isLoading = false;
  }

  async function loadRepartidores() {
    isLoading = true;
    const params: Record<string, string> = {};
    if (fechaInicio) params.fecha_inicio = fechaInicio;
    if (fechaFin) params.fecha_fin = fechaFin;

    const response = await apiHelpers.getRepartidorReport(params);
    if (response.success && response.data) {
      repartidoresData = response.data;
    }
    isLoading = false;
  }

  async function loadRevendedores() {
    isLoading = true;
    const params: Record<string, string> = {};
    if (fechaInicio) params.fecha_inicio = fechaInicio;
    if (fechaFin) params.fecha_fin = fechaFin;

    const response = await apiHelpers.getRevendedorReport(params);
    if (response.success && response.data) {
      revendedoresData = response.data;
    }
    isLoading = false;
  }

  async function loadBalance() {
    isLoading = true;
    const response = await apiHelpers.getBalanceReport();
    if (response.success && response.data) {
      balanceData = response.data;
    }
    isLoading = false;
  }

  function handleTabChange(tab: typeof activeTab) {
    activeTab = tab;
    switch (tab) {
      case 'resumen':
        loadResumen();
        break;
      case 'diario':
        loadDiario();
        break;
      case 'repartidores':
        loadRepartidores();
        break;
      case 'revendedores':
        loadRevendedores();
        break;
      case 'balance':
        loadBalance();
        break;
    }
  }

  async function exportCSV() {
    const params: Record<string, string> = { tipo: 'remesas' };
    if (fechaInicio) params.fecha_inicio = fechaInicio;
    if (fechaFin) params.fecha_fin = fechaFin;

    // Open in new tab for download
    const queryString = new URLSearchParams(params).toString();
    window.open(`/api/reportes/exportar?${queryString}`, '_blank');
  }
</script>

<svelte:head>
  <title>Reportes - Admin</title>
</svelte:head>

<Header title="Reportes">
  <Button variant="secondary" on:click={exportCSV}>
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
    Exportar CSV
  </Button>
</Header>

<main class="p-6">
  <!-- Tabs -->
  <div class="border-b border-gray-200 mb-6">
    <nav class="flex gap-4">
      {#each [
        { id: 'resumen', label: 'Resumen' },
        { id: 'diario', label: 'Diario' },
        { id: 'repartidores', label: 'Repartidores' },
        { id: 'revendedores', label: 'Revendedores' },
        { id: 'balance', label: 'Balance' },
      ] as tab}
        <button
          on:click={() => handleTabChange(tab.id as typeof activeTab)}
          class="px-4 py-2 font-medium text-sm border-b-2 transition-colors {activeTab === tab.id
            ? 'text-primary-600 border-primary-600'
            : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'}"
        >
          {tab.label}
        </button>
      {/each}
    </nav>
  </div>

  <!-- Filters -->
  {#if activeTab === 'diario'}
    <div class="card p-4 mb-6">
      <div class="flex items-end gap-4">
        <div class="w-48">
          <Input type="date" label="Fecha" bind:value={fechaDiario} />
        </div>
        <Button variant="secondary" on:click={loadDiario}>Cargar</Button>
      </div>
    </div>
  {:else if activeTab !== 'balance'}
    <div class="card p-4 mb-6">
      <div class="flex flex-wrap items-end gap-4">
        <div class="w-48">
          <Input type="date" label="Desde" bind:value={fechaInicio} />
        </div>
        <div class="w-48">
          <Input type="date" label="Hasta" bind:value={fechaFin} />
        </div>
        <Button variant="secondary" on:click={() => handleTabChange(activeTab)}>
          Aplicar Filtros
        </Button>
      </div>
    </div>
  {/if}

  <!-- Loading -->
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="spinner border-primary-600 h-8 w-8"></div>
    </div>
  {:else}
    <!-- Resumen Tab -->
    {#if activeTab === 'resumen' && resumenData}
      <div class="space-y-6">
        <!-- Totals -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div class="stat-card">
            <p class="stat-label">Total Remesas</p>
            <p class="stat-value">{resumenData.totales?.total_remesas || 0}</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Total USD Enviado</p>
            <p class="stat-value text-success-600">
              {formatCurrency(resumenData.totales?.total_monto_envio || 0)}
            </p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Total Comisiones</p>
            <p class="stat-value text-primary-600">
              {formatCurrency(resumenData.totales?.total_comision || 0)}
            </p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Total Cobrado</p>
            <p class="stat-value">
              {formatCurrency(resumenData.totales?.total_cobrado || 0)}
            </p>
          </div>
        </div>

        <!-- By Status -->
        <div class="card p-6">
          <h3 class="font-semibold text-gray-900 mb-4">Por Estado</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {#each resumenData.por_estado || [] as item}
              <div class="p-4 rounded-lg bg-gray-50">
                <Badge variant={getEstadoColor(item.estado)}>{getEstadoLabel(item.estado)}</Badge>
                <p class="mt-2 text-2xl font-bold">{item.cantidad}</p>
                <p class="text-sm text-gray-500">{formatCurrency(item.total_monto_envio)}</p>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Diario Tab -->
    {#if activeTab === 'diario' && diarioData}
      <div class="space-y-6">
        <div class="text-center mb-4">
          <p class="text-sm text-gray-500">Reporte del</p>
          <p class="text-2xl font-bold">{formatDate(diarioData.fecha)}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="card p-6">
            <h3 class="font-semibold text-gray-900 mb-4">Remesas Creadas</h3>
            <p class="text-4xl font-bold text-primary-600">{diarioData.remesas_creadas?.total || 0}</p>
            <div class="mt-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Monto USD</span>
                <span class="font-medium">
                  {formatCurrency(diarioData.remesas_creadas?.total_monto_envio || 0)}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Comisiones</span>
                <span class="font-medium">
                  {formatCurrency(diarioData.remesas_creadas?.total_comision || 0)}
                </span>
              </div>
            </div>
          </div>

          <div class="card p-6">
            <h3 class="font-semibold text-gray-900 mb-4">Entregas</h3>
            <p class="text-4xl font-bold text-success-600">{diarioData.entregas?.total || 0}</p>
            <div class="mt-4 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Total entregado</span>
                <span class="font-medium">
                  {formatNumber(diarioData.entregas?.total_monto_entrega || 0, 0)} CUP
                </span>
              </div>
            </div>
          </div>

          <div class="card p-6">
            <h3 class="font-semibold text-gray-900 mb-4">Solicitudes Pendientes</h3>
            <p class="text-4xl font-bold text-warning-600">{diarioData.solicitudes_pendientes || 0}</p>
            <p class="text-sm text-gray-500 mt-4">Esperando aprobación</p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Repartidores Tab -->
    {#if activeTab === 'repartidores'}
      <div class="card overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="th">Repartidor</th>
              <th class="th text-right">Entregas</th>
              <th class="th text-right">Total USD</th>
              <th class="th text-right">Total Entregado</th>
              <th class="th text-right">Saldo USD</th>
              <th class="th text-right">Saldo CUP</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each repartidoresData as rep}
              <tr class="hover:bg-gray-50">
                <td class="td font-medium">{rep.nombre}</td>
                <td class="td text-right">{rep.entregas}</td>
                <td class="td text-right">{formatCurrency(rep.total_monto_envio)}</td>
                <td class="td text-right">{formatNumber(rep.total_monto_entrega, 0)} CUP</td>
                <td class="td text-right font-mono text-success-600">
                  ${formatNumber(rep.saldo_usd, 0)}
                </td>
                <td class="td text-right font-mono text-primary-600">
                  {formatNumber(rep.saldo_cup, 0)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- Revendedores Tab -->
    {#if activeTab === 'revendedores'}
      <div class="card overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="th">Revendedor</th>
              <th class="th text-right">Remesas</th>
              <th class="th text-right">Total USD</th>
              <th class="th text-right">Comisión Plat.</th>
              <th class="th text-right">Saldo Pend.</th>
              <th class="th text-right">Total Pagado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each revendedoresData as rev}
              <tr class="hover:bg-gray-50">
                <td class="td">
                  <div class="font-medium">{rev.nombre}</div>
                  <div class="text-xs text-gray-500">{rev.comision_revendedor}% comisión</div>
                </td>
                <td class="td text-right">{rev.remesas_count}</td>
                <td class="td text-right">{formatCurrency(rev.total_monto_envio)}</td>
                <td class="td text-right">{formatCurrency(rev.total_comision_plataforma)}</td>
                <td class="td text-right font-mono text-warning-600">
                  {formatCurrency(rev.saldo_pendiente)}
                </td>
                <td class="td text-right font-mono text-success-600">
                  {formatCurrency(rev.total_pagado)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- Balance Tab -->
    {#if activeTab === 'balance' && balanceData}
      <div class="space-y-6">
        <!-- Repartidores Balance -->
        <div class="card p-6">
          <h3 class="font-semibold text-gray-900 mb-4">Saldos de Repartidores</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <thead>
                <tr class="border-b">
                  <th class="text-left py-2">Repartidor</th>
                  <th class="text-right py-2">USD</th>
                  <th class="text-right py-2">CUP</th>
                </tr>
              </thead>
              <tbody>
                {#each balanceData.repartidores?.items || [] as rep}
                  <tr class="border-b">
                    <td class="py-2">{rep.nombre}</td>
                    <td class="py-2 text-right font-mono text-success-600">
                      ${formatNumber(rep.saldo_usd, 0)}
                    </td>
                    <td class="py-2 text-right font-mono text-primary-600">
                      {formatNumber(rep.saldo_cup, 0)}
                    </td>
                  </tr>
                {/each}
              </tbody>
              <tfoot class="bg-gray-50 font-semibold">
                <tr>
                  <td class="py-2">TOTAL</td>
                  <td class="py-2 text-right text-success-600">
                    ${formatNumber(balanceData.repartidores?.totales?.usd || 0, 0)}
                  </td>
                  <td class="py-2 text-right text-primary-600">
                    {formatNumber(balanceData.repartidores?.totales?.cup || 0, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Revendedores Balance -->
        <div class="card p-6">
          <h3 class="font-semibold text-gray-900 mb-4">Saldos Pendientes de Revendedores</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <thead>
                <tr class="border-b">
                  <th class="text-left py-2">Revendedor</th>
                  <th class="text-right py-2">Comisión %</th>
                  <th class="text-right py-2">Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {#each balanceData.revendedores?.items || [] as rev}
                  <tr class="border-b">
                    <td class="py-2">{rev.nombre}</td>
                    <td class="py-2 text-right">{rev.comision_revendedor}%</td>
                    <td class="py-2 text-right font-mono text-warning-600">
                      {formatCurrency(rev.saldo_pendiente)}
                    </td>
                  </tr>
                {/each}
              </tbody>
              <tfoot class="bg-gray-50 font-semibold">
                <tr>
                  <td class="py-2" colspan="2">TOTAL PENDIENTE</td>
                  <td class="py-2 text-right text-warning-600">
                    {formatCurrency(balanceData.revendedores?.total_pendiente || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Remesas en Proceso -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="card p-6">
            <h3 class="font-semibold text-gray-900 mb-4">Remesas Pendientes</h3>
            <p class="text-4xl font-bold">{balanceData.remesas?.pendientes?.count || 0}</p>
            <p class="text-sm text-gray-500 mt-2">
              {formatCurrency(balanceData.remesas?.pendientes?.total_monto_envio || 0)} USD
            </p>
          </div>
          <div class="card p-6">
            <h3 class="font-semibold text-gray-900 mb-4">Remesas en Proceso</h3>
            <p class="text-4xl font-bold">{balanceData.remesas?.en_proceso?.count || 0}</p>
            <p class="text-sm text-gray-500 mt-2">
              {formatCurrency(balanceData.remesas?.en_proceso?.total_monto_envio || 0)} USD
            </p>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</main>
