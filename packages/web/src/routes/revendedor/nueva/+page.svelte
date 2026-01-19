<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Header from '$components/layout/Header.svelte';
  import { Button, Input, Select, Textarea } from '$components/ui';
  import { apiHelpers } from '$utils/api';
  import { formatNumber } from '$utils/format';

  // Form data
  let remitente = {
    nombre: '',
    telefono: '',
    direccion: '',
  };

  let beneficiario = {
    nombre: '',
    telefono: '',
    direccion: '',
    provincia: 'La Habana',
  };

  let envio = {
    monto_usd: 100,
    tipo_entrega: 'CUP',
    notas: '',
  };

  // Calculator results
  let calculo: {
    monto_entrega: number;
    tasa_usada: number;
    comision_plataforma: number;
    comision_revendedor: number;
    total_cobrar: number;
  } | null = null;

  // UI state
  let isCalculating = false;
  let isSubmitting = false;
  let error = '';
  let calcDebounce: ReturnType<typeof setTimeout>;

  // Autocomplete
  let remitentesSugeridos: any[] = [];
  let beneficiariosSugeridos: any[] = [];
  let showRemitenteSuggestions = false;
  let showBeneficiarioSuggestions = false;

  const provincias = [
    { value: 'Pinar del Río', label: 'Pinar del Río' },
    { value: 'Artemisa', label: 'Artemisa' },
    { value: 'La Habana', label: 'La Habana' },
    { value: 'Mayabeque', label: 'Mayabeque' },
    { value: 'Matanzas', label: 'Matanzas' },
    { value: 'Cienfuegos', label: 'Cienfuegos' },
    { value: 'Villa Clara', label: 'Villa Clara' },
    { value: 'Sancti Spíritus', label: 'Sancti Spíritus' },
    { value: 'Ciego de Ávila', label: 'Ciego de Ávila' },
    { value: 'Camagüey', label: 'Camagüey' },
    { value: 'Las Tunas', label: 'Las Tunas' },
    { value: 'Holguín', label: 'Holguín' },
    { value: 'Granma', label: 'Granma' },
    { value: 'Santiago de Cuba', label: 'Santiago de Cuba' },
    { value: 'Guantánamo', label: 'Guantánamo' },
    { value: 'Isla de la Juventud', label: 'Isla de la Juventud' },
  ];

  const tipoEntregaOptions = [
    { value: 'CUP', label: 'Pesos Cubanos (CUP)' },
    { value: 'USD', label: 'Dólares (USD)' },
  ];

  onMount(() => {
    calculateAmount();
  });

  function handleMontoChange() {
    clearTimeout(calcDebounce);
    calcDebounce = setTimeout(calculateAmount, 300);
  }

  async function calculateAmount() {
    if (envio.monto_usd <= 0) {
      calculo = null;
      return;
    }

    isCalculating = true;

    const response = await apiHelpers.revendedorCalculate(envio.monto_usd, envio.tipo_entrega);

    if (response.success && response.data) {
      calculo = response.data;
    } else {
      calculo = null;
    }

    isCalculating = false;
  }

  async function searchRemitentes(query: string) {
    if (query.length < 2) {
      remitentesSugeridos = [];
      return;
    }

    const response = await apiHelpers.searchRemitentes(query);
    if (response.success && response.data) {
      remitentesSugeridos = response.data;
      showRemitenteSuggestions = remitentesSugeridos.length > 0;
    }
  }

  async function searchBeneficiarios(query: string) {
    if (query.length < 2) {
      beneficiariosSugeridos = [];
      return;
    }

    const response = await apiHelpers.searchBeneficiarios(query);
    if (response.success && response.data) {
      beneficiariosSugeridos = response.data;
      showBeneficiarioSuggestions = beneficiariosSugeridos.length > 0;
    }
  }

  function selectRemitente(r: any) {
    remitente = {
      nombre: r.nombre,
      telefono: r.telefono || '',
      direccion: r.direccion || '',
    };
    showRemitenteSuggestions = false;
    remitentesSugeridos = [];
  }

  function selectBeneficiario(b: any) {
    beneficiario = {
      nombre: b.nombre,
      telefono: b.telefono || '',
      direccion: b.direccion || '',
      provincia: b.provincia || 'La Habana',
    };
    showBeneficiarioSuggestions = false;
    beneficiariosSugeridos = [];
  }

  async function handleSubmit() {
    error = '';

    // Validations
    if (!remitente.nombre) {
      error = 'El nombre del remitente es requerido';
      return;
    }
    if (!beneficiario.nombre) {
      error = 'El nombre del beneficiario es requerido';
      return;
    }
    if (!beneficiario.telefono) {
      error = 'El teléfono del beneficiario es requerido';
      return;
    }
    if (!beneficiario.direccion) {
      error = 'La dirección del beneficiario es requerida';
      return;
    }
    if (envio.monto_usd < 20) {
      error = 'El monto mínimo es $20 USD';
      return;
    }

    isSubmitting = true;

    const data = {
      remitente_nombre: remitente.nombre,
      remitente_telefono: remitente.telefono,
      remitente_direccion: remitente.direccion,
      beneficiario_nombre: beneficiario.nombre,
      beneficiario_telefono: beneficiario.telefono,
      beneficiario_direccion: beneficiario.direccion,
      beneficiario_provincia: beneficiario.provincia,
      monto_envio: envio.monto_usd,
      tipo_entrega: envio.tipo_entrega,
      notas: envio.notas || undefined,
    };

    const response = await apiHelpers.createRevendedorRemesa(data);

    if (response.success) {
      goto('/revendedor/remesas');
    } else {
      error = response.message || 'Error al crear la remesa';
    }

    isSubmitting = false;
  }
</script>

<svelte:head>
  <title>Nueva Remesa - Revendedor</title>
</svelte:head>

<Header title="Nueva Remesa">
  <a href="/revendedor" class="btn-secondary">
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
    Volver
  </a>
</Header>

<main class="p-6 max-w-4xl mx-auto">
  {#if error}
    <div class="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
      <p class="text-error-700">{error}</p>
    </div>
  {/if}

  <form on:submit|preventDefault={handleSubmit} class="space-y-8">
    <!-- Remitente Section -->
    <div class="card p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Datos del Remitente (USA)
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="relative">
          <Input
            label="Nombre completo *"
            bind:value={remitente.nombre}
            placeholder="Nombre del remitente"
            on:input={(e) => searchRemitentes(e.target.value)}
            on:focus={() => (showRemitenteSuggestions = remitentesSugeridos.length > 0)}
            required
          />
          {#if showRemitenteSuggestions && remitentesSugeridos.length > 0}
            <div class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {#each remitentesSugeridos as r}
                <button
                  type="button"
                  class="w-full px-4 py-2 text-left hover:bg-gray-50 flex flex-col"
                  on:click={() => selectRemitente(r)}
                >
                  <span class="font-medium">{r.nombre}</span>
                  {#if r.telefono}
                    <span class="text-xs text-gray-500">{r.telefono}</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <Input
          label="Teléfono"
          type="tel"
          bind:value={remitente.telefono}
          placeholder="+1 555 123 4567"
        />
        <div class="md:col-span-2">
          <Input
            label="Dirección"
            bind:value={remitente.direccion}
            placeholder="Dirección en USA"
          />
        </div>
      </div>
    </div>

    <!-- Beneficiario Section -->
    <div class="card p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Datos del Beneficiario (Cuba)
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="relative">
          <Input
            label="Nombre completo *"
            bind:value={beneficiario.nombre}
            placeholder="Nombre del beneficiario"
            on:input={(e) => searchBeneficiarios(e.target.value)}
            on:focus={() => (showBeneficiarioSuggestions = beneficiariosSugeridos.length > 0)}
            required
          />
          {#if showBeneficiarioSuggestions && beneficiariosSugeridos.length > 0}
            <div class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {#each beneficiariosSugeridos as b}
                <button
                  type="button"
                  class="w-full px-4 py-2 text-left hover:bg-gray-50 flex flex-col"
                  on:click={() => selectBeneficiario(b)}
                >
                  <span class="font-medium">{b.nombre}</span>
                  <span class="text-xs text-gray-500">{b.direccion}, {b.provincia}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <Input
          label="Teléfono *"
          type="tel"
          bind:value={beneficiario.telefono}
          placeholder="5X XXX XXXX"
          required
        />
        <Select
          label="Provincia *"
          bind:value={beneficiario.provincia}
          options={provincias}
        />
        <div class="md:col-span-2">
          <Input
            label="Dirección completa *"
            bind:value={beneficiario.direccion}
            placeholder="Calle, número, entre calles, municipio"
            required
          />
        </div>
      </div>
    </div>

    <!-- Envío Section -->
    <div class="card p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Datos del Envío
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Monto a enviar (USD) *"
          type="number"
          bind:value={envio.monto_usd}
          min={20}
          max={5000}
          step="0.01"
          on:input={handleMontoChange}
          required
        />
        <Select
          label="Moneda de entrega *"
          bind:value={envio.tipo_entrega}
          options={tipoEntregaOptions}
          on:change={calculateAmount}
        />
        <div class="md:col-span-2">
          <Textarea
            label="Notas (opcional)"
            bind:value={envio.notas}
            placeholder="Instrucciones especiales, horario de entrega, etc."
            rows={2}
          />
        </div>
      </div>
    </div>

    <!-- Calculator Results -->
    {#if calculo}
      <div class="card p-6 bg-gradient-to-br from-primary-50 to-accent-50 border-primary-200">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Resumen del Envío</h3>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="text-center p-3 bg-white rounded-lg">
            <p class="text-sm text-gray-500">Envía</p>
            <p class="text-xl font-bold text-gray-900">${formatNumber(envio.monto_usd, 2)}</p>
          </div>
          <div class="text-center p-3 bg-white rounded-lg">
            <p class="text-sm text-gray-500">Recibe</p>
            <p class="text-xl font-bold text-primary-600">
              {formatNumber(calculo.monto_entrega, envio.tipo_entrega === 'USD' ? 2 : 0)}
              <span class="text-sm font-normal text-gray-500">{envio.tipo_entrega}</span>
            </p>
          </div>
          <div class="text-center p-3 bg-white rounded-lg">
            <p class="text-sm text-gray-500">Tasa</p>
            <p class="text-xl font-bold text-gray-900">{formatNumber(calculo.tasa_usada, 0)}</p>
          </div>
          <div class="text-center p-3 bg-white rounded-lg">
            <p class="text-sm text-gray-500">Tu Comisión</p>
            <p class="text-xl font-bold text-success-600">${formatNumber(calculo.comision_revendedor, 2)}</p>
          </div>
        </div>

        <div class="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-primary-300">
          <span class="text-lg font-medium text-gray-700">Total a cobrar al cliente:</span>
          <span class="text-3xl font-bold text-primary-600">${formatNumber(calculo.total_cobrar, 2)}</span>
        </div>

        <p class="mt-3 text-sm text-gray-500 text-center">
          Comisión plataforma: ${formatNumber(calculo.comision_plataforma, 2)} |
          Tu comisión: ${formatNumber(calculo.comision_revendedor, 2)}
        </p>
      </div>
    {:else if isCalculating}
      <div class="card p-6 flex items-center justify-center">
        <div class="spinner border-primary-600 h-6 w-6 mr-3"></div>
        <span class="text-gray-500">Calculando...</span>
      </div>
    {/if}

    <!-- Submit Button -->
    <div class="flex justify-end gap-4">
      <a href="/revendedor" class="btn-secondary">Cancelar</a>
      <Button
        type="submit"
        variant="primary"
        loading={isSubmitting}
        disabled={!calculo || isSubmitting}
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Crear Remesa
      </Button>
    </div>
  </form>
</main>

<style>
  .btn-secondary {
    @apply inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors;
  }
</style>
