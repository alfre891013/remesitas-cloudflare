<script lang="ts">
  import { browser } from '$app/environment';
  import { apiHelpers } from '$utils/api';
  import { formatNumber, formatRelativeTime } from '$utils/format';

  interface Rate {
    moneda_destino: string;
    tasa: number;
    fecha_actualizacion: string;
  }

  let rates: Rate[] = [];
  let isLoading = true;
  let error: string | null = null;

  const currencyNames: Record<string, string> = {
    USD: 'Dólar Estadounidense',
    EUR: 'Euro',
    MLC: 'Moneda Libremente Convertible',
    CAD: 'Dólar Canadiense',
    MXN: 'Peso Mexicano',
    BRL: 'Real Brasileño',
    ZELLE: 'Zelle',
    CLA: 'MLC Clásica',
  };

  const currencyFlags: Record<string, string> = {
    USD: '🇺🇸',
    EUR: '🇪🇺',
    MLC: '🇨🇺',
    CAD: '🇨🇦',
    MXN: '🇲🇽',
    BRL: '🇧🇷',
    ZELLE: '💳',
    CLA: '🇨🇺',
  };

  // Load on client-side
  if (browser) {
    loadRates();
  }

  async function loadRates() {
    isLoading = true;
    error = null;

    const response = await apiHelpers.getPublicRates();

    if (response.success && response.data) {
      rates = response.data;
    } else {
      error = response.message || 'Error al cargar las tasas';
    }

    isLoading = false;
  }
</script>

<svelte:head>
  <title>Tasas de Cambio - Remesitas</title>
</svelte:head>

<main class="max-w-4xl mx-auto py-12 px-4">
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold text-gray-900">Tasas de Cambio</h1>
    <p class="mt-2 text-gray-600">Tasas actualizadas automáticamente</p>
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="spinner border-primary-600 h-8 w-8"></div>
    </div>
  {:else if error}
    <div class="card p-6 border-error-200 bg-error-50 text-center">
      <p class="text-error-600">{error}</p>
      <button on:click={loadRates} class="btn-secondary mt-4">
        Reintentar
      </button>
    </div>
  {:else}
    <!-- Main USD Rate -->
    {#if rates.find(r => r.moneda_destino === 'USD')}
      {@const usd = rates.find(r => r.moneda_destino === 'USD')}
      <div class="card p-8 mb-8 text-center bg-gradient-to-br from-primary-50 to-white">
        <p class="text-sm font-medium text-primary-600 mb-2">Tasa USD/CUP</p>
        <p class="text-5xl font-bold text-gray-900 mb-2">
          {formatNumber(usd?.tasa || 0, 0)} <span class="text-2xl text-gray-500">CUP</span>
        </p>
        <p class="text-sm text-gray-500">
          1 USD = {formatNumber(usd?.tasa || 0, 0)} CUP
        </p>
        {#if usd?.fecha_actualizacion}
          <p class="text-xs text-gray-400 mt-4">
            Actualizado {formatRelativeTime(usd.fecha_actualizacion)}
          </p>
        {/if}
      </div>
    {/if}

    <!-- All Rates Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each rates as rate}
        <div class="card p-6 hover:shadow-card-hover transition-shadow">
          <div class="flex items-center gap-4 mb-4">
            <span class="text-3xl">{currencyFlags[rate.moneda_destino] || '💱'}</span>
            <div>
              <p class="font-semibold text-gray-900">{rate.moneda_destino}</p>
              <p class="text-sm text-gray-500">{currencyNames[rate.moneda_destino] || rate.moneda_destino}</p>
            </div>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-primary-600">
              {formatNumber(rate.tasa, 0)}
            </span>
            <span class="text-sm text-gray-500">CUP</span>
          </div>
          <p class="text-xs text-gray-400 mt-2">
            Actualizado {formatRelativeTime(rate.fecha_actualizacion)}
          </p>
        </div>
      {/each}
    </div>

    <!-- Info Card -->
    <div class="card p-6 mt-8 bg-gray-50">
      <div class="flex items-start gap-4">
        <div class="p-2 bg-primary-100 rounded-lg">
          <svg class="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 class="font-semibold text-gray-900 mb-1">Sobre nuestras tasas</h3>
          <p class="text-sm text-gray-600">
            Las tasas se actualizan automáticamente cada 12 horas desde fuentes confiables del mercado informal cubano.
            La tasa final aplicada a tu envío puede variar ligeramente según el momento de la transacción.
          </p>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div class="text-center mt-8">
      <a href="/solicitar" class="btn-primary btn-lg">
        Enviar Dinero Ahora
      </a>
    </div>
  {/if}
</main>
