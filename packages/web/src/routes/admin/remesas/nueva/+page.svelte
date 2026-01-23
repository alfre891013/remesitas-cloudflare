<script lang="ts">
  import { goto } from '$app/navigation';
  import Header from '$components/layout/Header.svelte';
  import { Button, Input, Select, Textarea } from '$components/ui';
  import { apiHelpers } from '$utils/api';
  import { formatCurrency, formatNumber } from '$utils/format';

  interface Calculo {
    monto_envio: number;
    tasa_cambio: number;
    monto_entrega: number;
    moneda_entrega: string;
    comision_porcentaje: number;
    comision_fija: number;
    total_comision: number;
    total_cobrado: number;
  }

  // Form data
  let tipoEntrega = 'MN';
  let remitenteNombre = '';
  let remitenteTelefono = '';
  let beneficiarioNombre = '';
  let beneficiarioTelefono = '';
  let beneficiarioDireccion = '';
  let montoEnvio = '';
  let tasaCambioOverride = '';
  let notas = '';

  // State
  let calculo: Calculo | null = null;
  let isCalculating = false;
  let isSubmitting = false;
  let error: string | null = null;

  // Autocomplete
  let remitenteSuggestions: Array<{ nombre: string; telefono: string }> = [];
  let beneficiarioSuggestions: Array<{ nombre: string; telefono: string; direccion: string }> = [];
  let showRemitenteSuggestions = false;
  let showBeneficiarioSuggestions = false;

  const tipoEntregaOptions = [
    { value: 'MN', label: 'Moneda Nacional (CUP)' },
    { value: 'USD', label: 'Dólares (USD)' },
  ];

  // Calculate on amount or type change
  $: if (montoEnvio && parseFloat(montoEnvio) > 0) {
    calculateDebounced();
  } else {
    calculo = null;
  }

  let calcTimeout: ReturnType<typeof setTimeout>;
  function calculateDebounced() {
    clearTimeout(calcTimeout);
    calcTimeout = setTimeout(calculate, 300);
  }

  async function calculate() {
    const monto = parseFloat(montoEnvio);
    if (!monto || monto <= 0) return;

    isCalculating = true;
    const response = await apiHelpers.calculate(monto, tipoEntrega);

    if (response.success && response.data) {
      calculo = response.data;
    }
    isCalculating = false;
  }

  async function searchRemitentes() {
    if (remitenteNombre.length < 2) {
      remitenteSuggestions = [];
      return;
    }

    const response = await apiHelpers.searchRemitentes(remitenteNombre);
    if (response.success && response.data) {
      remitenteSuggestions = response.data;
      showRemitenteSuggestions = remitenteSuggestions.length > 0;
    }
  }

  async function searchBeneficiarios() {
    if (beneficiarioNombre.length < 2) {
      beneficiarioSuggestions = [];
      return;
    }

    const response = await apiHelpers.searchBeneficiarios(beneficiarioNombre);
    if (response.success && response.data) {
      beneficiarioSuggestions = response.data;
      showBeneficiarioSuggestions = beneficiarioSuggestions.length > 0;
    }
  }

  function selectRemitente(item: { nombre: string; telefono: string }) {
    remitenteNombre = item.nombre;
    remitenteTelefono = item.telefono;
    showRemitenteSuggestions = false;
  }

  function selectBeneficiario(item: { nombre: string; telefono: string; direccion: string }) {
    beneficiarioNombre = item.nombre;
    beneficiarioTelefono = item.telefono;
    beneficiarioDireccion = item.direccion;
    showBeneficiarioSuggestions = false;
  }

  async function handleSubmit() {
    error = null;

    // Validation
    if (!remitenteNombre || !remitenteTelefono) {
      error = 'Complete los datos del remitente';
      return;
    }
    if (!beneficiarioNombre || !beneficiarioTelefono || !beneficiarioDireccion) {
      error = 'Complete los datos del beneficiario';
      return;
    }
    if (!montoEnvio || parseFloat(montoEnvio) <= 0) {
      error = 'Ingrese un monto válido';
      return;
    }

    isSubmitting = true;

    const data: Record<string, any> = {
      tipo_entrega: tipoEntrega,
      remitente_nombre: remitenteNombre,
      remitente_telefono: remitenteTelefono,
      beneficiario_nombre: beneficiarioNombre,
      beneficiario_telefono: beneficiarioTelefono,
      beneficiario_direccion: beneficiarioDireccion,
      monto_envio: parseFloat(montoEnvio),
      notas: notas || undefined,
    };

    if (tasaCambioOverride) {
      data.tasa_cambio = parseFloat(tasaCambioOverride);
    }

    const response = await apiHelpers.createRemesa(data);

    if (response.success) {
      goto('/admin/remesas');
    } else {
      error = response.message || 'Error al crear la remesa';
    }

    isSubmitting = false;
  }
</script>

<svelte:head>
  <title>Nueva Remesa - Admin</title>
</svelte:head>

<Header title="Nueva Remesa">
  <a href="/admin/remesas" class="btn-secondary">
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
    Volver
  </a>
</Header>

<main class="p-6">
  <form on:submit|preventDefault={handleSubmit} class="max-w-4xl mx-auto">
    {#if error}
      <div class="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
        <p class="text-error-700">{error}</p>
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left Column - Form -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Remitente -->
        <div class="card p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Remitente (EE.UU.)</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="relative">
              <Input
                label="Nombre completo"
                bind:value={remitenteNombre}
                on:input={searchRemitentes}
                on:focus={() => (showRemitenteSuggestions = remitenteSuggestions.length > 0)}
                on:blur={() => setTimeout(() => (showRemitenteSuggestions = false), 200)}
                required
              />
              {#if showRemitenteSuggestions}
                <div class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {#each remitenteSuggestions as item}
                    <button
                      type="button"
                      class="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm"
                      on:click={() => selectRemitente(item)}
                    >
                      <p class="font-medium">{item.nombre}</p>
                      <p class="text-gray-500">{item.telefono}</p>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            <Input
              label="Teléfono"
              type="tel"
              bind:value={remitenteTelefono}
              placeholder="+1 (xxx) xxx-xxxx"
              required
            />
          </div>
        </div>

        <!-- Beneficiario -->
        <div class="card p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Beneficiario (Cuba)</h3>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="relative">
                <Input
                  label="Nombre completo"
                  bind:value={beneficiarioNombre}
                  on:input={searchBeneficiarios}
                  on:focus={() => (showBeneficiarioSuggestions = beneficiarioSuggestions.length > 0)}
                  on:blur={() => setTimeout(() => (showBeneficiarioSuggestions = false), 200)}
                  required
                />
                {#if showBeneficiarioSuggestions}
                  <div class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {#each beneficiarioSuggestions as item}
                      <button
                        type="button"
                        class="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm"
                        on:click={() => selectBeneficiario(item)}
                      >
                        <p class="font-medium">{item.nombre}</p>
                        <p class="text-gray-500">{item.telefono}</p>
                        <p class="text-gray-400 text-xs truncate">{item.direccion}</p>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
              <Input
                label="Teléfono"
                type="tel"
                bind:value={beneficiarioTelefono}
                placeholder="+53 xx xxx xxxx"
                required
              />
            </div>
            <Textarea
              label="Dirección de entrega"
              bind:value={beneficiarioDireccion}
              placeholder="Calle, número, entre calles, municipio, provincia"
              rows={2}
              required
            />
          </div>
        </div>

        <!-- Monto -->
        <div class="card p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Detalles del Envío</h3>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Tipo de entrega"
                bind:value={tipoEntrega}
                options={tipoEntregaOptions}
                on:change={calculate}
              />
              <Input
                label="Monto a enviar (USD)"
                type="number"
                bind:value={montoEnvio}
                min={1}
                max={10000}
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
            <Input
              label="Tasa de cambio personalizada (opcional)"
              type="number"
              bind:value={tasaCambioOverride}
              min={100}
              step="1"
              placeholder="Dejar vacío para usar tasa actual"
            />
            <Textarea label="Notas" bind:value={notas} rows={2} placeholder="Notas adicionales..." />
          </div>
        </div>
      </div>

      <!-- Right Column - Calculator -->
      <div class="lg:col-span-1">
        <div class="card p-6 sticky top-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Resumen</h3>

          {#if isCalculating}
            <div class="flex items-center justify-center py-8">
              <div class="spinner border-primary-600 h-6 w-6"></div>
            </div>
          {:else if calculo}
            <div class="space-y-4">
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Monto a enviar</span>
                <span class="font-semibold">{formatCurrency(calculo.monto_envio)}</span>
              </div>
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Tasa de cambio</span>
                <span class="font-semibold">{formatNumber(calculo.tasa_cambio, 0)} CUP</span>
              </div>
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Comisión ({calculo.comision_porcentaje}%)</span>
                <span class="font-semibold">{formatCurrency(calculo.total_comision)}</span>
              </div>
              <div class="flex justify-between py-2 border-b bg-primary-50 -mx-6 px-6">
                <span class="text-primary-700 font-medium">Beneficiario recibe</span>
                <span class="font-bold text-primary-700">
                  {formatNumber(calculo.monto_entrega, calculo.moneda_entrega === 'USD' ? 2 : 0)}
                  {calculo.moneda_entrega}
                </span>
              </div>
              <div class="flex justify-between py-2 text-lg">
                <span class="font-semibold">Total a cobrar</span>
                <span class="font-bold text-success-600">{formatCurrency(calculo.total_cobrado)}</span>
              </div>
            </div>
          {:else}
            <p class="text-gray-500 text-center py-8">
              Ingrese el monto para ver el cálculo
            </p>
          {/if}

          <div class="mt-6 pt-6 border-t">
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting}
              disabled={!calculo}
            >
              Crear Remesa
            </Button>
          </div>
        </div>
      </div>
    </div>
  </form>
</main>
