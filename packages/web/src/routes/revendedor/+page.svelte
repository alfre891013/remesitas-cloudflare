<script lang="ts">
  import { browser } from '$app/environment';
  import Header from '$components/layout/Header.svelte';
  import { apiHelpers } from '$utils/api';
  import { formatCurrency, formatNumber } from '$utils/format';

  interface DashboardStats {
    remesas_mes: number;
    total_usd_mes: number;
    saldo_pendiente: number;
    comisiones_pagadas: number;
    comision_porcentaje: number;
  }

  let stats: DashboardStats | null = null;
  let isLoading = true;
  let error: string | null = null;

  // Load on client-side
  if (browser) {
    loadDashboard();
  }

  async function loadDashboard() {
    isLoading = true;
    error = null;

    const response = await apiHelpers.getRevendedorDashboard();

    if (response.success) {
      stats = response.data;
    } else {
      error = response.message || 'Error al cargar el dashboard';
    }

    isLoading = false;
  }
</script>

<svelte:head>
  <title>Panel Revendedor - Remesitas</title>
</svelte:head>

<Header title="Panel de Revendedor" />

<main class="p-6">
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="spinner border-primary-600 h-8 w-8"></div>
    </div>
  {:else if error}
    <div class="p-4 bg-error-50 border border-error-200 rounded-lg">
      <p class="text-error-600">{error}</p>
      <button on:click={loadDashboard} class="btn-secondary mt-4">Reintentar</button>
    </div>
  {:else if stats}
    <!-- Stats Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="stat-card">
        <p class="stat-value">{stats.remesas_mes}</p>
        <p class="stat-label">Remesas Este Mes</p>
      </div>
      <div class="stat-card">
        <p class="stat-value">{formatCurrency(stats.total_usd_mes)}</p>
        <p class="stat-label">Total USD Mes</p>
      </div>
      <div class="stat-card bg-accent-50">
        <p class="stat-value text-accent-600">{formatCurrency(stats.saldo_pendiente)}</p>
        <p class="stat-label">Comisiones Pendientes</p>
      </div>
      <div class="stat-card">
        <p class="stat-value text-success-600">{formatCurrency(stats.comisiones_pagadas)}</p>
        <p class="stat-label">Total Pagado</p>
      </div>
    </div>

    <!-- Commission Info -->
    <div class="card p-6 mb-8">
      <div class="flex items-center gap-4">
        <div class="p-3 bg-primary-100 rounded-lg">
          <svg class="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div>
          <p class="text-sm text-gray-500">Tu porcentaje de comisión</p>
          <p class="text-2xl font-bold text-primary-600">{stats.comision_porcentaje}%</p>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="card p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
      <div class="flex flex-wrap gap-4">
        <a href="/revendedor/nueva" class="btn-primary">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nueva Remesa
        </a>
        <a href="/revendedor/remesas" class="btn-secondary">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Ver Mis Remesas
        </a>
        <a href="/revendedor/comisiones" class="btn-secondary">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Ver Comisiones
        </a>
      </div>
    </div>
  {/if}
</main>
