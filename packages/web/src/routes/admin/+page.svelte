<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$components/layout/Header.svelte';
  import { apiHelpers } from '$utils/api';
  import { formatCurrency, formatNumber } from '$utils/format';

  interface DashboardStats {
    remesas_pendientes: number;
    remesas_hoy: number;
    total_usd_hoy: number;
    total_cup_hoy: number;
    tasa_actual: number;
  }

  let stats: DashboardStats | null = null;
  let isLoading = true;
  let error: string | null = null;

  onMount(async () => {
    await loadDashboard();
  });

  async function loadDashboard() {
    isLoading = true;
    error = null;

    const response = await apiHelpers.getDashboard();

    if (response.success && response.data) {
      stats = response.data;
    } else {
      error = response.message || 'Error al cargar el dashboard';
    }

    isLoading = false;
  }
</script>

<svelte:head>
  <title>Dashboard - Remesitas Admin</title>
</svelte:head>

<Header title="Dashboard" />

<main class="p-6">
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="spinner border-primary-600 h-8 w-8"></div>
    </div>
  {:else if error}
    <div class="p-4 bg-error-50 border border-error-200 rounded-lg">
      <p class="text-error-600">{error}</p>
      <button on:click={loadDashboard} class="btn-secondary mt-4">
        Reintentar
      </button>
    </div>
  {:else if stats}
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- Pending Remittances -->
      <div class="stat-card">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-warning-50 rounded-lg">
            <svg class="w-6 h-6 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p class="stat-value">{stats.remesas_pendientes}</p>
            <p class="stat-label">Pendientes</p>
          </div>
        </div>
      </div>

      <!-- Today's Remittances -->
      <div class="stat-card">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-primary-50 rounded-lg">
            <svg class="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p class="stat-value">{stats.remesas_hoy}</p>
            <p class="stat-label">Remesas Hoy</p>
          </div>
        </div>
      </div>

      <!-- Today's USD Total -->
      <div class="stat-card">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-success-50 rounded-lg">
            <svg class="w-6 h-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p class="stat-value">{formatCurrency(stats.total_usd_hoy)}</p>
            <p class="stat-label">Total USD Hoy</p>
          </div>
        </div>
      </div>

      <!-- Current Rate -->
      <div class="stat-card">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-accent-50 rounded-lg">
            <svg class="w-6 h-6 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <p class="stat-value">{formatNumber(stats.tasa_actual, 0)} CUP</p>
            <p class="stat-label">Tasa USD</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="card p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
      <div class="flex flex-wrap gap-4">
        <a href="/admin/remesas/nueva" class="btn-primary">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nueva Remesa
        </a>
        <a href="/admin/usuarios/nuevo" class="btn-secondary">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Nuevo Usuario
        </a>
        <a href="/admin/tasas" class="btn-secondary">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar Tasas
        </a>
        <a href="/admin/reportes" class="btn-secondary">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Ver Reportes
        </a>
      </div>
    </div>

    <!-- CUP Total Card -->
    <div class="card p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Total CUP Hoy</h2>
      <p class="text-3xl font-bold text-primary-600">
        {formatNumber(stats.total_cup_hoy, 0)} CUP
      </p>
      <p class="text-sm text-gray-500 mt-1">
        Equivalente a {formatCurrency(stats.total_usd_hoy)} a tasa actual
      </p>
    </div>
  {/if}
</main>
