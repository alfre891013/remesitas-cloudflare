<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { apiHelpers } from '$utils/api';
  import { formatNumber, formatDateTime, getEstadoLabel } from '$utils/format';

  let codigo = '';
  let isLoading = false;
  let error: string | null = null;
  let result: {
    codigo: string;
    estado: string;
    estado_descripcion: string;
    beneficiario_nombre: string;
    monto_entrega: number;
    moneda_entrega: string;
    fecha_creacion: string;
    fecha_entrega: string | null;
  } | null = null;

  onMount(() => {
    // Check URL for codigo param
    const urlCodigo = $page.url.searchParams.get('codigo');
    if (urlCodigo) {
      codigo = urlCodigo;
      handleTrack();
    }
  });

  async function handleTrack() {
    if (!codigo.trim()) return;

    isLoading = true;
    error = null;
    result = null;

    const response = await apiHelpers.trackRemesa(codigo.toUpperCase());

    if (response.success && response.data) {
      result = response.data;
    } else {
      error = response.message || 'Remesa no encontrada';
    }

    isLoading = false;
  }

  const estadoSteps = ['solicitud', 'pendiente', 'en_proceso', 'entregada'];

  function getStepStatus(estado: string, step: string): 'completed' | 'current' | 'pending' {
    const currentIndex = estadoSteps.indexOf(estado);
    const stepIndex = estadoSteps.indexOf(step);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  }
</script>

<svelte:head>
  <title>Rastrear Envío - Remesitas</title>
</svelte:head>

<main class="max-w-2xl mx-auto py-12 px-4">
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold text-gray-900">Rastrear Envío</h1>
    <p class="mt-2 text-gray-600">Ingresa tu código de seguimiento</p>
  </div>

  <div class="card p-6 mb-8">
    <form on:submit|preventDefault={handleTrack} class="flex gap-4">
      <input
        type="text"
        bind:value={codigo}
        class="input flex-1 text-lg font-mono uppercase"
        placeholder="Ej: 260119-A3B7"
        required
      />
      <button type="submit" class="btn-primary" disabled={isLoading || !codigo.trim()}>
        {#if isLoading}
          <span class="spinner"></span>
        {:else}
          Rastrear
        {/if}
      </button>
    </form>
  </div>

  {#if error}
    <div class="card p-6 border-error-200 bg-error-50">
      <div class="flex items-center gap-4">
        <div class="p-3 bg-error-100 rounded-full">
          <svg class="w-6 h-6 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div>
          <h3 class="font-semibold text-gray-900">No encontrado</h3>
          <p class="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    </div>
  {/if}

  {#if result}
    <div class="card p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
        <div>
          <p class="text-sm text-gray-500">Código</p>
          <p class="text-xl font-mono font-bold text-gray-900">{result.codigo}</p>
        </div>
        <span class="status-{result.estado} text-sm px-3 py-1">
          {getEstadoLabel(result.estado)}
        </span>
      </div>

      <!-- Status Timeline -->
      <div class="mb-6">
        <h3 class="font-semibold text-gray-900 mb-4">Estado del Envío</h3>
        <div class="relative">
          {#each estadoSteps as step, i}
            {@const status = getStepStatus(result.estado, step)}
            <div class="flex items-start gap-4 mb-4 last:mb-0">
              <div class="relative">
                <div class={`h-8 w-8 rounded-full flex items-center justify-center ${
                  status === 'completed' ? 'bg-success-500' :
                  status === 'current' ? 'bg-primary-500' :
                  'bg-gray-200'
                }`}>
                  {#if status === 'completed'}
                    <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  {:else}
                    <span class={`text-sm font-medium ${status === 'current' ? 'text-white' : 'text-gray-500'}`}>
                      {i + 1}
                    </span>
                  {/if}
                </div>
                {#if i < estadoSteps.length - 1}
                  <div class={`absolute left-4 top-8 w-0.5 h-8 -translate-x-1/2 ${
                    status === 'completed' ? 'bg-success-500' : 'bg-gray-200'
                  }`}></div>
                {/if}
              </div>
              <div class="pt-1">
                <p class={`font-medium ${status === 'current' ? 'text-primary-600' : status === 'completed' ? 'text-gray-900' : 'text-gray-400'}`}>
                  {getEstadoLabel(step)}
                </p>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Details -->
      <div class="bg-gray-50 rounded-lg p-4 space-y-3">
        <div class="flex justify-between">
          <span class="text-gray-500">Beneficiario</span>
          <span class="font-medium text-gray-900">{result.beneficiario_nombre}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Monto a recibir</span>
          <span class="font-medium text-gray-900">
            {formatNumber(result.monto_entrega, result.moneda_entrega === 'USD' ? 2 : 0)}
            {result.moneda_entrega}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Fecha de solicitud</span>
          <span class="font-medium text-gray-900">{formatDateTime(result.fecha_creacion)}</span>
        </div>
        {#if result.fecha_entrega}
          <div class="flex justify-between">
            <span class="text-gray-500">Fecha de entrega</span>
            <span class="font-medium text-success-600">{formatDateTime(result.fecha_entrega)}</span>
          </div>
        {/if}
      </div>

      <!-- Status description -->
      <div class="mt-6 p-4 bg-primary-50 rounded-lg">
        <p class="text-sm text-primary-800">
          <span class="font-medium">Estado actual:</span> {result.estado_descripcion}
        </p>
      </div>
    </div>
  {/if}
</main>
